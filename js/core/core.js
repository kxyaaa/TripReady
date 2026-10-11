"use strict";
/* TripReady — Ready Before You Go
   API publik: Nominatim (lokasi), Open-Meteo (cuaca + kualitas udara), OSRM (rute),
   Nager.Date (hari libur nasional), Leaflet + tile Esri World Street Map. Tanpa database. */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const fmtT = (t) => t.replace(":", ".");
const minToStr = (m) => { m = ((Math.round(m) % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ":" + pad(m % 60); };
const localISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pctv = (v) => (v == null ? "–" : Math.round(v) + "%");
const WEEKEND = { sa: [5, 6], qa: [5, 6], kw: [5, 6], bh: [5, 6], om: [5, 6], eg: [5, 6], jo: [5, 6], iq: [5, 6], il: [5, 6], dz: [5, 6], sy: [5, 6], ye: [5, 6], ly: [5, 6], ir: [5], af: [4, 5], bn: [5, 0] };
const rad = (x) => (x * Math.PI) / 180;
const haversine = (a, b) => { const dLa = rad(b[0] - a[0]), dLo = rad(b[1] - a[1]); const q = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLo / 2) ** 2; return 6371 * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q)); };
const shortName = (p) => p.name || p.display_name.split(",")[0];

const TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", TILE_ATTR = "Tiles © Esri, data © OpenStreetMap contributors";
/* Web Push (opsional): isi setelah Worker dideploy, lihat docs/PUSH_SETUP.md. Kosong = fitur nonaktif. */
const PUSH_API = "https://tripready-push.chartfancyy.workers.dev", VAPID_PUBLIC = "BGTypKZaNgE3xJtlWxNfGqzZFwFqbMsdnb3rq-3Lfc6xRpGARp1q2eS8CHLNOQkoB0FAZa7IsvUrOLvUSmFT2hI";
const S = { dest: null, destQuery: "", origin: null, originQuery: "", map: null, layer: null, busy: false, unread: 0, reminder: null, timer: null, bias: null };

const WX = {
  0: ["Cerah", "☀️"], 1: ["Cerah berawan", "🌤️"], 2: ["Berawan sebagian", "⛅"], 3: ["Berawan", "☁️"],
  45: ["Berkabut", "🌫️"], 48: ["Kabut tebal", "🌫️"], 51: ["Gerimis ringan", "🌦️"], 53: ["Gerimis", "🌦️"], 55: ["Gerimis lebat", "🌧️"],
  56: ["Gerimis beku", "🌧️"], 57: ["Gerimis beku lebat", "🌧️"], 61: ["Hujan ringan", "🌦️"], 63: ["Hujan sedang", "🌧️"], 65: ["Hujan lebat", "🌧️"],
  66: ["Hujan beku", "🌧️"], 67: ["Hujan beku lebat", "🌧️"], 71: ["Salju ringan", "🌨️"], 73: ["Salju", "🌨️"], 75: ["Salju lebat", "🌨️"],
  77: ["Butiran salju", "🌨️"], 80: ["Hujan sesaat ringan", "🌦️"], 81: ["Hujan sesaat", "🌧️"], 82: ["Hujan sesaat lebat", "⛈️"],
  85: ["Hujan salju", "🌨️"], 86: ["Hujan salju lebat", "🌨️"], 95: ["Badai petir", "⛈️"], 96: ["Badai petir & hujan es", "⛈️"], 99: ["Badai petir kuat", "⛈️"]
};
const RAINY = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82];
const HEAVY = [65, 67, 82];
const THUNDER = [95, 96, 99];
const wxInfo = (c) => WX[c] || ["Cuaca berubah", "🌡️"];
const wxIcon = (c, hour) => ((c === 0 || c === 1) && (hour < 6 || hour >= 18) ? "🌙" : wxInfo(c)[1]);
const sevOf = (c) => (THUNDER.includes(c) ? 4 : HEAVY.includes(c) ? 3 : RAINY.includes(c) ? 2 : 0);

const ACT_NAME = { urus: "mengurus keperluan", wisata: "wisata", jogging: "jogging", kuliner: "kuliner", belanja: "belanja", kampus: "kuliah/bekerja" };
const DUR = { urus: 90, wisata: 240, jogging: 60, kuliner: 90, belanja: 120, kampus: 240 };
const MODE_NAME = { motor: "motor", car: "mobil", bus: "bus", train: "kereta api", plane: "pesawat", ship: "kapal", bike: "sepeda", walk: "jalan kaki" };
const EXPOSED = { motor: true, bike: true, walk: true };
const ROAD = { motor: "car", car: "car", bus: "car", train: "car", bike: "bike", walk: "foot" };
const EST = { plane: 800, ship: 30, train: 80 };
const AREA = /^(city|town|village|hamlet|suburb|neighbourhood|quarter|state|county|country|region|province|municipality|district|island|archipelago|administrative|city_district|borough|locality)$/;
const isArea = (p) => ["boundary", "place"].includes(p.category) && AREA.test(p.type || "");
const fmtDur = (m) => { m = Math.round(m); const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), n = m % 60; return [d ? `${d} hari` : "", h ? `${h} jam` : "", n && !d ? `${n} mnt` : ""].filter(Boolean).join(" ") || "0 mnt"; };

// Fallback jam buka apabila data detail tidak ada di OSM
const FALLBACK_HOURS = {
  mall: "10:00-22:00",
  supermarket: "08:00-22:00",
  department_store: "10:00-22:00",
  university: "07:00-17:00; Su off",
  school: "07:00-15:00; Su off",
  bank: "08:00-15:00; Sa,Su off",
  hospital: "24/7",
  clinic: "08:00-20:00",
  pharmacy: "08:00-21:00",
  restaurant: "10:00-22:00",
  cafe: "10:00-23:00"
};

