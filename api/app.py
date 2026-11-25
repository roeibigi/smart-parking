"""Smart Parking API - simple version.

POST /api/cars    camera sends a plate -> car enters (or exits if already inside)
GET  /api/status  dashboard reads free spots, current price and parked cars
"""
import json
import math
import os
import re
import time

import redis
from flask import Flask, jsonify, request

app = Flask(__name__)

# "redis" is the service name in docker-compose.yml. Docker's internal DNS
# turns that name into the Redis container's IP address.
db = redis.Redis(host=os.environ.get("REDIS_HOST", "redis"), port=6379, decode_responses=True)

FLOORS = 3
SPOTS_PER_FLOOR = 4
TOTAL_SPOTS = FLOORS * SPOTS_PER_FLOOR


@app.before_request
def create_spots_once():
    # Create the spots only if the lot is brand new. Without this check every
    # restart would reset the lot and the parked cars would "disappear".
    if not db.exists("free") and not db.exists("cars"):
        for floor in range(1, FLOORS + 1):
            for num in range(1, SPOTS_PER_FLOOR + 1):
                # score 201 = floor 2, spot 1. Lower score = closer to the exit.
                db.zadd("free", {f"{floor}-{num:02d}": floor * 100 + num})


def price_per_hour():
    """Dynamic price in shekels: the fuller the lot, the more expensive."""
    occupancy = db.hlen("cars") / TOTAL_SPOTS
    if occupancy < 0.5:
        return 12
    if occupancy < 0.8:
        return 18
    return 24


@app.post("/api/cars")
def camera():
    data = request.get_json(silent=True)
    plate = data.get("plate") if isinstance(data, dict) else None
    # Reject bad input (400), never "fix" it. [0-9] and not \d, because \d
    # also accepts non-English digits.
    if not isinstance(plate, str) or not re.fullmatch(r"[0-9]{7,8}", plate):
        return jsonify(error="plate must be 7-8 digits"), 400

    car = db.hget("cars", plate)
    if car:  # the plate is already inside -> this is an EXIT
        car = json.loads(car)
        hours = max(1, math.ceil((time.time() - car["since"]) / 3600))  # min 1 hour
        db.hdel("cars", plate)
        db.zadd("free", {car["spot"]: car["score"]})  # the spot is free again
        return jsonify(action="exit", plate=plate, spot=car["spot"], fee=hours * car["rate"])

    # ENTRY. Price is locked now, based on how full the lot is.
    rate = price_per_hour()
    # ZPOPMIN takes the closest free spot AND removes it in one atomic
    # command, so two cars can never get the same spot.
    popped = db.zpopmin("free")
    if not popped:
        return jsonify(action="full", plate=plate), 409
    spot, score = popped[0]
    db.hset("cars", plate, json.dumps({"spot": spot, "score": score, "since": time.time(), "rate": rate}))
    return jsonify(action="entry", plate=plate, spot=spot, rate=rate), 201


@app.get("/api/status")
def status():
    cars = [{"plate": p, **json.loads(v)} for p, v in db.hgetall("cars").items()]
    cars.sort(key=lambda c: c["score"])
    return jsonify(total=TOTAL_SPOTS, free=db.zcard("free"), price_per_hour=price_per_hour(), cars=cars)


if __name__ == "__main__":
    # 0.0.0.0 = listen on all interfaces, so nginx (another container) can reach us.
    app.run(host="0.0.0.0", port=5000)
