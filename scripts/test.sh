#!/usr/bin/env bash
# Simple end-to-end test. Run it after: docker compose up -d --build
# set -e = stop at the first command that fails (and exit with an error)
set -e

URL=${API_URL:-http://localhost:8080/api}
PLATE=$((RANDOM % 9000000 + 1000000))   # random 7-digit plate, so re-runs don't clash

echo "Waiting for the app to start..."
for i in $(seq 1 30); do
  curl -sf "$URL/status" > /dev/null && break
  sleep 1
done

echo "Test 1: a car enters"
curl -sf -X POST "$URL/cars" -H "Content-Type: application/json" -d "{\"plate\":\"$PLATE\"}" | grep '"action":"entry"'

echo "Test 2: the car appears in the status"
curl -sf "$URL/status" | grep "$PLATE"

echo "Test 3: a bad plate is rejected with 400"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$URL/cars" -H "Content-Type: application/json" -d '{"plate":"12"}')
[ "$CODE" = "400" ]

echo "All tests passed"
