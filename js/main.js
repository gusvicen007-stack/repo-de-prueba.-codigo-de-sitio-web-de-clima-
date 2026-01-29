// ====== 7Timer Config ======
const API_BASE = "https://www.7timer.info/bin/api.pl";
const PRODUCT = "civillight";
const CSV_PATHS = ["./city_coordinates.csv", "./city_coordinates.cvs"]; // por si lo nombraste mal

// ====== Iconos (tu carpeta /images) ======
const ICON_MAP = {
  clear: "clear.png",
  cloudy: "cloudy.png",
  fog: "fog.png",
  humid: "humid.png",
  ishower: "ishower.png",
  lightrain: "lightrain.png",
  lightsnow: "lightsnow.png",
  mcloudy: "mcloudy.png",
  oshower: "oshower.png",
  pcloudy: "pcloudy.png",
  rain: "rain.png",
  rainsnow: "rainsnow.png",
  snow: "snow.png",
  tsrain: "tsrain.png",
  ts: "tstorm.png", // 7Timer usa "ts" → tú tienes "tstorm.png"
  windy: "windy.png"
};

function iconFor(weatherCode) {
  return ICON_MAP[weatherCode] ?? "cloudy.png";
}

function weatherLabel(code) {
  const map = {
    clear: "Despejado",
    pcloudy: "Poco nublado",
    mcloudy: "Medio nublado",
    cloudy: "Nublado",
    humid: "Húmedo",
    fog: "Niebla",
    lightrain: "Llovizna",
    oshower: "Chubascos",
    ishower: "Lluvia intermitente",
    rain: "Lluvia",
    lightsnow: "Nieve ligera",
    snow: "Nieve",
    rainsnow: "Aguanieve",
    ts: "Tormenta eléctrica",
    tsrain: "Tormenta con lluvia",
    windy: "Viento"
  };
  return map[code] ?? code;
}

// ====== DOM Helpers ======
const $ = (id) => document.getElementById(id);

function norm(s) {
  return (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function setPill(type, text) {
  const el = $("statusPill");
  if (!el) return;
  el.textContent = text;

  const styles = {
    loading: { bg: "rgba(255,200,90,.14)", bd: "rgba(255,200,90,.30)", fg: "rgba(255,220,160,.92)" },
    error:   { bg: "rgba(255,90,110,.14)", bd: "rgba(255,90,110,.30)", fg: "rgba(255,170,180,.92)" },
    ok:      { bg: "rgba(80,200,120,.14)", bd: "rgba(80,200,120,.30)", fg: "rgba(170,255,210,.92)" }
  }[type] || { bg: "rgba(255,255,255,.08)", bd: "rgba(255,255,255,.14)", fg: "rgba(255,255,255,.8)" };

  el.style.background = styles.bg;
  el.style.borderColor = styles.bd;
  el.style.color = styles.fg;
}

function showError(msg) {
  const box = $("errorBox");
  if (!box) return;
  box.hidden = false;
  box.textContent = msg;
}

function clearError() {
  const box = $("errorBox");
  if (!box) return;
  box.hidden = true;
  box.textContent = "";
}

// ====== Splash + Background ======
function slugCityName(city) {
  return (city ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

function hideSplash() {
  const splash = document.getElementById("splash");
  if (splash) splash.classList.add("hidden");
}

function setEarthSplashVisible() {
  const splash = document.getElementById("splash");
  if (splash) splash.classList.remove("hidden");
}

// ✅ Fuerza visibilidad del app aunque el CSS esté mal
function setAppVisible(show) {
  const app = document.getElementById("app");
  if (!app) return;

  app.style.opacity = show ? "1" : "0";
  app.style.pointerEvents = show ? "auto" : "none";
  app.style.transform = show ? "translateY(0)" : "translateY(8px)";
}

function enterHomeMode() {
  document.body.classList.add("is-home");
  setEarthSplashVisible();
  setAppVisible(false); // 👈 clave: oculta app en home
}

function exitHomeMode() {
  document.body.classList.remove("is-home");
  hideSplash();
  setAppVisible(true); // 👈 clave: muestra app al salir
}

/**
 * 1) Wikipedia thumbnail si existe
 * 2) Fallback: Unsplash Source (sin key)
 */
async function resolveCityPhotoUrl(place) {
  const city = place.city?.trim();
  if (!city) return null;

  // 1) Wikimedia PageImages (thumb grande) — mejor calidad que REST summary
  const title = encodeURIComponent(city.replace(/\s+/g, "_"));
  const api = `https://en.wikipedia.org/w/api.php?action=query&titles=${title}&prop=pageimages&format=json&pithumbsize=1920&origin=*`;

  try {
    const res = await fetch(api, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const pages = data?.query?.pages;
      const firstKey = pages ? Object.keys(pages)[0] : null;
      const page = firstKey ? pages[firstKey] : null;
      const src = page?.thumbnail?.source; // URL grande (≈1920px)
      if (src) return src;

      // Si quieres aún más grande (original), usa:
      // const api2 = `https://en.wikipedia.org/w/api.php?action=query&titles=${title}&prop=pageimages&format=json&piprop=original&origin=*`;
      // ...y lees page?.original?.source
    }
  } catch {}

  // 2) Fallback: Unsplash Source (suele ser alta pero cambia)
  const q = encodeURIComponent(`${place.city} ${place.country ?? ""} skyline`);
  return `https://source.unsplash.com/1920x1080/?${q}`;
}


async function setCityBackground(place) {
  const bg = document.getElementById("bgPhoto");
  if (!bg) return;

  const key = `city_bg_${slugCityName(place.city)}`;
  const cached = localStorage.getItem(key);

  const url = cached || (await resolveCityPhotoUrl(place));
  if (!url) return;

  await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });

  bg.style.backgroundImage = `url("${url}")`;
  document.body.classList.add("has-city-bg");

  if (!cached) localStorage.setItem(key, url);
}

// ====== CSV -> City DB ======
let CITY_DB = [];

async function loadCityCSV() {
  for (const path of CSV_PATHS) {
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) continue;
      const text = await res.text();
      const parsed = parseCSV(text);
      if (parsed.length) {
        CITY_DB = parsed;
        return;
      }
    } catch {}
  }

  CITY_DB = [
    { city: "London", country: "England", lat: 51.507, lon: -0.127 },
    { city: "Paris", country: "France", lat: 48.856, lon: 2.352 }
  ];
}

function parseCSV(text) {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const header = lines[0].split(",").map(h => norm(h));

  const idx = {
    lat: header.findIndex(h => ["lat", "latitude", "latitud"].includes(h)),
    lon: header.findIndex(h => ["lon", "lng", "longitude", "longitud"].includes(h)),
    city: header.findIndex(h => ["city", "ciudad", "name"].includes(h)),
    country: header.findIndex(h => ["country", "pais", "país"].includes(h))
  };

  if (idx.lat === -1 || idx.lon === -1 || idx.city === -1) return [];

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim());
    const city = cols[idx.city];
    const lat = Number(cols[idx.lat]);
    const lon = Number(cols[idx.lon]);
    const country = idx.country !== -1 ? (cols[idx.country] ?? "") : "";

    if (!city || Number.isNaN(lat) || Number.isNaN(lon)) continue;
    out.push({ city, country, lat, lon });
  }
  return out;
}

function findCityMatches(q, limit = 8) {
  const nq = norm(q);
  if (!nq) return [];

  const scored = CITY_DB.map(c => {
    const name = norm(c.city);
    const score =
      name === nq ? 100 :
      name.startsWith(nq) ? 80 :
      name.includes(nq) ? 60 : 0;
    return { c, score };
  }).filter(x => x.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(x => x.c);
}

// ====== 7Timer Fetch ======
async function fetchForecast(lat, lon) {
  const url = new URL(API_BASE);
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("product", PRODUCT);
  url.searchParams.set("output", "json");

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);

  try {
    const res = await fetch(url.toString(), { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// ====== Render ======
function formatDateFromYmdInt(ymd) {
  const s = String(ymd);
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6)) - 1;
  const d = Number(s.slice(6, 8));
  const dt = new Date(Date.UTC(y, m, d));

  return {
    dow: dt.toLocaleDateString("es-MX", { weekday: "short" }),
    nice: dt.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })
  };
}

function render(place, data) {
  const title = $("placeTitle");
  const meta = $("metaLine");
  const today = $("today");
  const grid = $("grid");
  const ftitle = $("forecastTitle");

  title.textContent = `${place.city}${place.country ? `, ${place.country}` : ""}`;
  meta.textContent = `Coordenadas: ${place.lat.toFixed(3)}, ${place.lon.toFixed(3)} · ${new Date().toLocaleString("es-MX")}`;

  const series = data?.dataseries ?? [];
  if (!series.length) {
    today.hidden = true;
    grid.hidden = true;
    ftitle.hidden = true;
    showError("No llegó forecast del API.");
    return;
  }

  const first = series[0];
  const { dow, nice } = formatDateFromYmdInt(first.date);
  const w = weatherLabel(first.weather);
  const icon = iconFor(first.weather);
  const tmax = first?.temp2m?.max ?? "—";
  const tmin = first?.temp2m?.min ?? "—";
  const wind = first?.wind10m_max ?? "—";

  today.innerHTML = `
    <div class="today-card">
      <div class="icon" title="${w}">
        <img src="images/${icon}" alt="${w}">
      </div>
      <div class="big">
        <div class="line1">
          <div class="temp">${tmax}°</div>
          <div class="desc">${w} · <b>${dow}</b> · ${nice}</div>
        </div>
        <div class="extra">Mín: ${tmin}° · Viento (máx): ${wind}</div>
      </div>
    </div>
  `;
  today.hidden = false;

  const rest = series.slice(1, 8);
  grid.innerHTML = rest.map(item => {
    const { dow, nice } = formatDateFromYmdInt(item.date);
    const w = weatherLabel(item.weather);
    const icon = iconFor(item.weather);
    const tmax = item?.temp2m?.max ?? "—";
    const tmin = item?.temp2m?.min ?? "—";
    const wind = item?.wind10m_max ?? "—";

    return `
      <article class="day">
        <div class="dtop">
          <div>
            <div class="dow">${dow}</div>
            <div class="date">${nice}</div>
          </div>
          <div class="miniicon" title="${w}">
            <img src="images/${icon}" alt="${w}">
          </div>
        </div>
        <div class="temps">
          <div class="max">${tmax}°</div>
          <div class="min">min ${tmin}°</div>
        </div>
        <div class="w">${w}</div>
        <div class="w">Viento máx: ${wind}</div>
      </article>
    `;
  }).join("");

  ftitle.hidden = false;
  grid.hidden = false;
}

// ====== Autocomplete UI ======
function openSuggestions(items) {
  const box = $("suggestions");
  if (!box) return;

  if (!items.length) {
    box.classList.remove("open");
    box.innerHTML = "";
    return;
  }

  box.innerHTML = items.map((c, i) => `
    <button type="button" data-idx="${i}">
      <span>${c.city}</span>
      <small>${c.country ?? ""} · ${c.lat.toFixed(2)}, ${c.lon.toFixed(2)}</small>
    </button>
  `).join("");

  box.classList.add("open");

  box.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      $("cityInput").value = btn.querySelector("span").textContent;
      box.classList.remove("open");
      box.innerHTML = "";
      $("cityInput")?.focus();
    });
  });
}

// ====== Search flow ======
async function runSearch(cityName) {
  clearError();
  setPill("loading", "Cargando…");

  const matches = findCityMatches(cityName, 1);
  if (!matches.length) {
    setPill("error", "No encontrada");
    showError("No encontré esa ciudad en tu CSV. Intenta con otro nombre (tal cual aparece en la lista).");
    return;
  }

  const place = matches[0];
  localStorage.setItem("last_city", place.city);

  try {
    const data = await fetchForecast(place.lat, place.lon);
    render(place, data);

    // ✅ salir del modo inicio (oculta Tierra + muestra app)
    exitHomeMode();

    await setCityBackground(place);

    document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setPill("ok", "Listo");
  } catch (err) {
    setPill("error", "Error");
    showError(`No se pudo consultar el API. Detalle: ${err?.message ?? err}`);
  }
}

// ====== Init ======
(async function init() {
  await loadCityCSV();

  const form = $("searchForm");
  const input = $("cityInput");

  // Siempre inicio Tierra
  enterHomeMode();

  // ✅ “Empezar” cierra splash y muestra app (aunque CSS esté mal)
  document.getElementById("btnStart")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    exitHomeMode();
    setPill("ok", "Listo");
    setTimeout(() => input?.focus(), 50);
  });

  // Fallback: click en el fondo del splash también lo cierra
  document.getElementById("splash")?.addEventListener("click", () => {
    exitHomeMode();
    setTimeout(() => input?.focus(), 50);
  });

  // Precarga input con last_city (sin auto-buscar)
  const last = localStorage.getItem("last_city");
  if (last) input.value = last;

  input.addEventListener("input", () => {
    const items = findCityMatches(input.value, 8);
    openSuggestions(items);
  });

  input.addEventListener("blur", () => {
    setTimeout(() => $("suggestions")?.classList.remove("open"), 120);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const city = input.value.trim();
    if (!city) return;
    runSearch(city);
  });
})();
