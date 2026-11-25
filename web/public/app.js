// A funny message per floor: our "unique element"
const FLOOR_JOKES = {
  1: "קרוב ליציאה, איזה מזל 🍀",
  2: "קומה 2, אמצע הדרך 🚶",
  3: "קומה 3? מקווה שעשית אימון רגליים היום 🦵",
};

async function refresh() {
  try {
    // Relative URL: goes to the same nginx that served this page,
    // and nginx forwards /api/... to the API container.
    const res = await fetch("/api/status");
    const data = await res.json();
    show(data);
    document.getElementById("error").textContent = "";
  } catch (e) {
    document.getElementById("error").textContent = "אין חיבור לשרת...";
  }
  // setTimeout AFTER the answer arrives (not setInterval), so requests
  // never pile up when the server is slow.
  setTimeout(refresh, 2000);
}

function show(data) {
  document.getElementById("free").textContent = data.free;
  document.getElementById("total").textContent = data.total;
  document.getElementById("price").textContent = data.price_per_hour;

  const list = document.getElementById("cars");
  list.replaceChildren(); // clear the old list
  for (const car of data.cars) {
    const floor = car.spot.split("-")[0];
    const li = document.createElement("li");
    // textContent (never innerHTML): data from the server is shown as plain
    // text, so it can never run as code in the page.
    li.textContent = `🚗 ${car.plate}  ←  מקום ${car.spot}  |  ${car.rate} ₪ לשעה  |  ${FLOOR_JOKES[floor]}`;
    list.appendChild(li);
  }
}

refresh();
