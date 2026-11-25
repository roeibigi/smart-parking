// ---------- Settings that match the API ----------
const FLOORS = 3;

// Our "unique element": a joke for each floor
const FLOOR_JOKES = {
  1: "ליד היציאה. יום המזל שלך",
  2: "אמצע הדרך. עוד קצת",
  3: "קומה 3? מקווה שעשית אימון רגליים",
};

// Car paint colors. Each plate always gets the same color.
const CAR_COLORS = ["#d94a3d", "#2c6fd1", "#f0f0ea", "#2b2b2e", "#8a96a3", "#e3a72f", "#2f8f5b", "#7a3fb0"];

let seenPlates = null; // plates already on screen; null until the first load

function colorFor(plate) {
  let hash = 2166136261; // FNV-1a: small, well-mixed string hash
  for (const ch of plate) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  return CAR_COLORS[hash % CAR_COLORS.length];
}

// ---------- Reading the lot (GET) ----------

async function loadStatus() {
  try {
    // Relative URL: same nginx that served the page forwards /api/... to the API.
    const res = await fetch("/api/status");
    render(await res.json());
    document.getElementById("error").textContent = "";
  } catch (e) {
    document.getElementById("error").textContent = "אין חיבור לשרת. בדקו שהקונטיינרים רצים (docker compose ps).";
  }
}

async function poll() {
  await loadStatus();
  // setTimeout AFTER the answer arrives (not setInterval), so requests never pile up.
  setTimeout(poll, 2000);
}

function render(data) {
  document.getElementById("free").textContent = data.free;
  document.getElementById("total").textContent = data.total;

  // Light up the current price on the meter
  for (const seg of document.querySelectorAll("#meter span")) {
    seg.classList.toggle("on", Number(seg.dataset.price) === data.price_per_hour);
  }

  // Full lot: the curb turns red-white
  const full = data.free === 0;
  document.getElementById("curb").classList.toggle("full", full);
  document.body.classList.toggle("is-full", full);

  // Which car sits in which spot
  const bySpot = {};
  for (const car of data.cars) bySpot[car.spot] = car;

  const perFloor = Math.round(data.total / FLOORS);
  const garage = document.getElementById("garage");
  const floorTpl = document.getElementById("floor-tpl");
  const spotTpl = document.getElementById("spot-tpl");
  const fragment = document.createDocumentFragment();

  for (let floor = FLOORS; floor >= 1; floor--) {
    const floorEl = floorTpl.content.firstElementChild.cloneNode(true);
    floorEl.querySelector(".floor-num").textContent = `קומה ${floor}`;
    floorEl.querySelector(".floor-joke").textContent = FLOOR_JOKES[floor] || "";
    if (floor === 1) floorEl.classList.add("ground");
    const lane = floorEl.querySelector(".lane");

    for (let num = 1; num <= perFloor; num++) {
      const spotId = `${floor}-${String(num).padStart(2, "0")}`;
      const spotEl = spotTpl.content.firstElementChild.cloneNode(true);
      spotEl.querySelector(".spot-id").textContent = spotId;

      const car = bySpot[spotId];
      if (car) {
        spotEl.classList.add("taken");
        const carEl = spotEl.querySelector(".car");
        carEl.hidden = false;
        carEl.style.setProperty("--car", colorFor(car.plate));
        // Animate ONLY cars that weren't on screen before (the list is rebuilt every 2s)
        if (seenPlates && !seenPlates.has(car.plate)) carEl.classList.add("arriving");

        const info = spotEl.querySelector(".spot-info");
        info.hidden = false;
        // textContent (never innerHTML): server data is shown as plain text, never run as code
        info.querySelector(".plate-num").textContent = car.plate;
        info.querySelector(".spot-rate").textContent = `${car.rate} ₪/שעה`;
        const exitBtn = info.querySelector(".btn-exit");
        exitBtn.setAttribute("aria-label", `הוצא את רכב ${car.plate}`);
        exitBtn.addEventListener("click", () => sendPlate(car.plate));
      }
      lane.appendChild(spotEl);
    }
    fragment.appendChild(floorEl);
  }
  garage.replaceChildren(fragment);
  seenPlates = new Set(data.cars.map((c) => c.plate));
}

// ---------- Sending a plate (POST), like the camera does ----------

async function sendPlate(plate) {
  const msg = document.getElementById("message");
  msg.className = "message";
  try {
    const res = await fetch("/api/cars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plate: plate }),
    });
    const data = await res.json();

    if (data.action === "entry") {
      const floor = data.spot.split("-")[0];
      msg.textContent = `רכב ${data.plate} נכנס למקום ${data.spot}, ${data.rate} ₪ לשעה. ${FLOOR_JOKES[floor] || ""}`;
      msg.classList.add("ok");
    } else if (data.action === "exit") {
      msg.textContent = `רכב ${data.plate} יצא ממקום ${data.spot}. לתשלום: ${data.fee} ₪. נסיעה טובה!`;
      msg.classList.add("bye");
    } else if (data.action === "full") {
      msg.textContent = "החניון מלא. אין מקום לרכב " + data.plate + ", נסו שוב כשמישהו יוצא.";
      msg.classList.add("bad");
    } else {
      msg.textContent = data.error === "plate must be 7-8 digits"
        ? "מספר רכב צריך להיות 7 או 8 ספרות, בלי מקפים."
        : data.error;
      msg.classList.add("bad");
    }
  } catch (e) {
    msg.textContent = "אין חיבור לשרת. הפעולה לא בוצעה.";
    msg.classList.add("bad");
  }
  loadStatus(); // update the map right away
}

document.getElementById("car-form").addEventListener("submit", (event) => {
  event.preventDefault(); // stop the form from reloading the page
  const input = document.getElementById("plate");
  sendPlate(input.value.trim());
  input.value = "";
  input.focus();
});

document.getElementById("random-car").addEventListener("click", () => {
  const plate = String(Math.floor(1000000 + Math.random() * 9000000)); // 7 digits
  sendPlate(plate);
});

poll();
