"use strict";
/* TripReady — Ready Before You Go
   API publik: Nominatim (lokasi), Open-Meteo (cuaca + kualitas udara), OSRM (rute),
   Nager.Date (hari libur nasional), Leaflet + Peta Google Maps (via Tile URL). Tanpa database. */

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

/* ---------- UI dasar ---------- */
function toast(msg) { const el = $("toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 3200); }
function setStatus(msg) { $("formStatus").textContent = msg; }
function greet() {
  const h = new Date().getHours();
  $("greeting").textContent = h < 11 ? "Selamat Pagi! ☀️" : h < 15 ? "Selamat Siang! 🌤️" : h < 18 ? "Selamat Sore! 🌇" : "Selamat Malam! 🌙";
}
function updateClock() {
  const now = new Date();
  $("clock").textContent = new Intl.DateTimeFormat("id-ID", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(now).replace(".", ":");
  $("todayDate").textContent = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);
}
greet(); updateClock(); setInterval(updateClock, 30000);

const dateInput = $("tripDate");
dateInput.min = localISO();
dateInput.max = localISO(new Date(Date.now() + 15 * 86400000));
dateInput.value = localISO();
$("activity").addEventListener("change", () => $("durationField").classList.toggle("hidden", $("activity").value !== "wisata"));

function addNotifs(list) {
  const ul = $("notifList");
  const hhmm = pad(new Date().getHours()) + ":" + pad(new Date().getMinutes());
  ul.innerHTML = list.slice(0, 5).map((n) => `<li><i>${n[0]}</i><span>${esc(n[1])}</span><time>${hhmm}</time></li>`).join("") || `<li class="notif-empty">Belum ada catatan.</li>`;
  S.unread = list.length;
  const b = $("bellCount"); b.textContent = S.unread; b.classList.toggle("hidden", !S.unread);
}
$("bellBtn").addEventListener("click", () => {
  S.unread = 0; $("bellCount").classList.add("hidden"); go("beranda");
  $("notifPanel").classList.remove("flash"); void $("notifPanel").offsetWidth; $("notifPanel").classList.add("flash");
});

/* menu mobile & navigasi aktif */
const sidebar = $("sidebar"), scrim = $("scrim");
const closeMenu = () => { sidebar.classList.remove("open"); scrim.classList.remove("show"); };
$("mobileMenu").addEventListener("click", () => { sidebar.classList.toggle("open"); scrim.classList.toggle("show"); });
scrim.addEventListener("click", closeMenu);
const PAGES = ["beranda", "rencana", "recommendations", "peta", "cuaca", "checklist", "pengingat"];
function showPage(id) {
  if (!PAGES.includes(id)) id = "beranda";
  PAGES.forEach((p) => $(p).classList.toggle("active", p === id));
  document.querySelectorAll(".nav-item").forEach((x) => x.classList.toggle("active", x.dataset.target === id));
  closeMenu(); window.scrollTo(0, 0);
  $("infoFab").classList.toggle("hidden", !["recommendations", "peta", "cuaca"].includes(id));
  if (id === "peta" && S.map) setTimeout(() => (S.fit ? S.fit() : S.map.invalidateSize()), 60);
}
function go(id) { if (location.hash === "#" + id) showPage(id); else location.hash = id; }
window.addEventListener("hashchange", () => showPage(location.hash.slice(1)));
showPage(location.hash.slice(1));

/* ---------- Pencarian tempat (autocomplete ala Google Maps / ojol) ---------- */
const PHOTON = "https://photon.komoot.io/api/";
const fmtDist = (km) => (km < 1 ? `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m` : km < 10 ? `${km.toFixed(1).replace(".", ",")} km` : `${Math.round(km)} km`);
const fmtAcc = (m) => (m >= 1000 ? (m / 1000).toFixed(1).replace(".", ",") + " km" : Math.round(m) + " m");
const getBias = () => (S.origin ? [Number(S.origin.lat), Number(S.origin.lon)] : S.bias);

async function geocode(q, limit = 1, bias = null) {
  let url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&extratags=1&limit=${limit}&accept-language=id&q=${encodeURIComponent(q)}`;
  if (bias) url += `&viewbox=${bias[1] - 1.5},${bias[0] + 1.5},${bias[1] + 1.5},${bias[0] - 1.5}&bounded=0`;
  let res;
  try { res = await fetch(url); } catch { throw new Error("Tidak bisa terhubung ke layanan lokasi. Periksa koneksi internet."); }
  if (!res.ok) throw new Error("Layanan pencarian lokasi sedang tidak tersedia. Coba lagi sebentar.");
  return res.json();
}
const OSM_T = { N: "node", W: "way", R: "relation" };
function fromPhoton(f) {
  const p = f.properties || {}, [lon, lat] = f.geometry.coordinates;
  const street = [p.street, p.housenumber].filter(Boolean).join(" ");
  const city = p.city || p.town || p.village || p.locality || p.district;
  const parts = [p.name, street, p.district, city, p.county, p.state, p.country].filter(Boolean);
  return {
    lat: String(lat), lon: String(lon), name: p.name || street || "", display_name: parts.filter((x, i) => parts.indexOf(x) === i).join(", "),
    category: p.osm_key, type: p.osm_value, extratags: {}, osmRef: OSM_T[p.osm_type] && p.osm_id ? { type: OSM_T[p.osm_type], id: p.osm_id } : null,
    address: { country_code: (p.countrycode || "").toLowerCase(), city, suburb: p.district, county: p.county, state: p.state, road: p.street }
  };
}
async function searchPlaces(q, { bias = null, signal, explicit = false } = {}) {
  let list = null;
  try {
    const r = await fetch(`${PHOTON}?q=${encodeURIComponent(q)}&limit=15${bias ? `&lat=${bias[0]}&lon=${bias[1]}` : ""}`, { signal });
    if (!r.ok) throw new Error("photon " + r.status);
    list = ((await r.json()).features || []).filter((f) => f.geometry?.coordinates).map(fromPhoton);
  } catch (e) { if (e.name === "AbortError") throw e; }
  if ((!list || !list.length) && explicit) list = await geocode(q, 10, bias); 
  if (list === null) throw new Error("Layanan pencarian tempat sedang sibuk. Tekan Enter untuk mencoba pencarian cadangan.");
  if (bias) {
    list.forEach((p) => { p.distKm = haversine(bias, [Number(p.lat), Number(p.lon)]); });
    const tok = nrm(q), hit = (p) => (nrm(p.name).includes(tok) ? 1 : 0);
    list.sort((a, b) => hit(b) - hit(a) || (hit(a) && hit(b) ? a.distKm - b.distKm : 0)); 
  }
  return list;
}
const pickLabel = (p) => {
  const a = p.address || {}, area = a.city || a.town || a.village || a.suburb || a.county || a.state, n = shortName(p);
  return area && area !== n ? `${n}, ${area}` : p.display_name.split(",").slice(0, 3).join(",").trim();
};
const subLine = (p) => p.display_name.split(",").slice(1, 4).join(",").trim() || p.display_name;
const placeIcon = (p) => {
  const t = p.type || "", c = p.category || "";
  if (isArea(p)) return "🏙️";
  if (/^(restaurant|cafe|fast_food|food_court|bar|pub|ice_cream|bakery|confectionery|marketplace)$/.test(t)) return "🍽️";
  if (c === "shop") return "🛍️";
  if (/^(school|university|college|kindergarten)$/.test(t)) return "🏫";
  if (/^(hospital|clinic|doctors|dentist|pharmacy)$/.test(t)) return "🏥";
  if (c === "tourism" || c === "natural" || c === "leisure") return "🏞️";
  if (c === "office" || /^(townhall|courthouse|police|post_office|bank|public_building)$/.test(t)) return "🏢";
  if (c === "highway" || c === "railway" || c === "aeroway") return "🚉";
  return "📍";
};

function attachAC({ inputId, listId, pickKey, queryKey, bias, biasText, noBiasText, onPick }) {
  const input = $(inputId), ul = $(listId), box = input.closest(".ac-wrap, .field") || input.parentElement;
  const st = { items: [], active: -1, seq: 0, timer: null, ctrl: null };
  const hide = () => { ul.classList.add("hidden"); st.active = -1; };
  const msg = (t) => { ul.innerHTML = `<li class="s-msg">${esc(t)}</li>`; ul.classList.remove("hidden"); };
  const mark = () => { ul.querySelectorAll("li[data-i]").forEach((li, i) => li.classList.toggle("active", i === st.active)); ul.querySelector("li.active")?.scrollIntoView({ block: "nearest" }); };
  const choose = (p) => {
    const label = pickLabel(p);
    S[pickKey] = p; S[queryKey] = label; input.value = label; input.title = p.display_name; input.scrollLeft = 0;
    clearTimeout(st.timer); st.ctrl?.abort(); st.seq++; hide(); onPick?.(p);
  };
  const render = (list, hasBias) => {
    if (!list.length) return msg("Tempat tidak ditemukan. Coba ejaan lain atau tambahkan nama kota/daerah.");
    ul.innerHTML = list.map((p, i) => `<li role="option" data-i="${i}"><span class="s-ic">${placeIcon(p)}</span><span class="s-tx"><b>${esc(shortName(p))}</b><small>${esc(subLine(p))}</small></span>${p.distKm != null ? `<span class="s-dist">${fmtDist(p.distKm)}</span>` : ""}</li>`).join("")
      + `<li class="s-hint">${esc(hasBias ? biasText : noBiasText)}</li>`;
    ul.classList.remove("hidden");
  };
  async function search(explicit = false, rethrow = false) {
    const q = input.value.trim();
    clearTimeout(st.timer); st.ctrl?.abort();
    if (q.length < (explicit ? 1 : 3)) { if (!explicit) hide(); return null; }
    const my = ++st.seq, ctrl = (st.ctrl = new AbortController()), b = bias();
    msg("Mencari…");
    try {
      const list = (await searchPlaces(q, { bias: b, signal: ctrl.signal, explicit })).slice(0, 8);
      if (my !== st.seq) return null;
      st.items = list; st.active = -1; render(list, !!b);
      return list;
    } catch (e) {
      if (e.name === "AbortError" || my !== st.seq) return null;
      msg(e.message); if (rethrow) throw e;
      return null;
    }
  }
  input.addEventListener("input", () => {
    if (input.value.trim() !== S[queryKey]) S[pickKey] = null;
    clearTimeout(st.timer); st.timer = setTimeout(() => search(false), 450);
  });
  input.addEventListener("keydown", (e) => {
    const open = !ul.classList.contains("hidden") && st.items.length > 0, n = st.items.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!n) return;
      e.preventDefault(); ul.classList.remove("hidden");
      st.active = e.key === "ArrowDown" ? (st.active + 1) % n : (st.active - 1 + n) % n; mark();
    } else if (e.key === "Enter") {
      if (open && st.active >= 0) { e.preventDefault(); choose(st.items[st.active]); }
      else if (input.value.trim() && !(S[pickKey] && S[queryKey] === input.value.trim())) { e.preventDefault(); search(true); }
    } else if (e.key === "Escape") hide();
  });
  ul.addEventListener("click", (e) => { const li = e.target.closest("li[data-i]"); if (li) choose(st.items[Number(li.dataset.i)]); });
  document.addEventListener("click", (e) => { if (!box.contains(e.target)) hide(); });
  return { input, search, choose, hide };
}

async function ensurePlace(ac, pickKey, queryKey, label) {
  const val = ac.input.value.trim();
  if (S[pickKey] && S[queryKey] === val) return S[pickKey];
  const list = await ac.search(true, true);
  if (!list) return null;
  if (!list.length) throw new Error(`${label} "${val}" belum ditemukan. Coba ejaan lain atau tambahkan nama kota/daerah.`);
  if (list.length === 1) { ac.choose(list[0]); return list[0]; }
  setStatus(`Ada ${list.length} tempat yang cocok dengan "${val}". Pilih salah satu dari daftar, lalu tekan Lihat Rekomendasi lagi.`);
  toast(`Pilih dulu ${label.toLowerCase()} dari daftar.`);
  ac.input.scrollIntoView({ block: "center", behavior: "smooth" });
  return null;
}

const originAC = attachAC({
  inputId: "origin", listId: "originSuggest", pickKey: "origin", queryKey: "originQuery", bias: () => S.bias,
  biasText: "Diurutkan dari yang terdekat dengan lokasi terakhirmu.", noBiasText: "Tambahkan nama kota/daerah agar lebih tepat, atau pakai tombol Lokasi saya.",
  onPick: (p) => { S.bias = [Number(p.lat), Number(p.lon)]; setStatus("Lokasi awal dipilih: " + shortName(p) + "."); }
});
const destAC = attachAC({
  inputId: "destination", listId: "suggestList", pickKey: "dest", queryKey: "destQuery", bias: getBias,
  biasText: "Diurutkan dari yang terdekat dengan lokasi awalmu.", noBiasText: "Isi Lokasi awal / tekan Lokasi saya agar hasil diurutkan dari yang terdekat.",
  onPick: (p) => { setStatus("Tujuan dipilih: " + shortName(p) + ". Lanjutkan dengan Lihat Rekomendasi."); showOnMap(p); }
});
$("suggestBtn").addEventListener("click", () => {
  if (!$("destination").value.trim()) { $("destination").focus(); setStatus("Ketik nama tempat dulu, lalu tekan Cari."); return; }
  destAC.search(true);
});
$("quickSearch").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const v = e.currentTarget.value.trim(); if (!v) return;
  $("destination").value = v; S.dest = null; go("rencana"); destAC.search(true);
});

/* ---------- Lokasi saya ---------- */
async function reverseGeocode(lat, lon) {
  try { const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=id&lat=${lat}&lon=${lon}`); return r.ok ? await r.json() : null; } catch { return null; }
}
function setOrigin(lat, lon, rev, prefix) {
  const place = rev?.display_name ? rev.display_name.split(",").slice(0, 2).join(",").trim() : `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  const label = `${prefix} — ${place}`, el = $("origin");
  S.origin = { lat, lon, display_name: label, address: rev?.address }; S.originQuery = label; S.bias = [lat, lon];
  el.value = label; el.title = rev?.display_name || label; el.scrollLeft = 0;
  return label;
}
const GOOD_ACC = 100; 
$("geoBtn").addEventListener("click", () => {
  if (!navigator.geolocation) { toast("Perangkat ini tidak mendukung deteksi lokasi."); return; }
  const btn = $("geoBtn"); btn.disabled = true;
  setStatus("Membaca lokasi perangkat… tunggu beberapa detik.");
  let best = null, done = false, id = null, tAll = null, tFirst = null;
  const finish = async (err) => {
    if (done) return; done = true; navigator.geolocation.clearWatch(id); clearTimeout(tAll); clearTimeout(tFirst); btn.disabled = false;
    if (!best) { setStatus(err?.code === 1 ? "Izin lokasi ditolak. Izinkan lokasi untuk situs ini, atau ketik / pilih lokasi awal manual." : "Lokasi tidak bisa dibaca. Nyalakan lokasi perangkat, atau ketik / pilih lokasi awal manual."); toast("Lokasi tidak bisa dibaca."); return; }
    const { latitude: lat, longitude: lon, accuracy: acc } = best.coords;
    if (acc <= GOOD_ACC) {
      setStatus("Mencari nama tempat dari koordinat…");
      setOrigin(lat, lon, await reverseGeocode(lat, lon), "Lokasi saya");
      setStatus(`Lokasi terdeteksi (akurasi ±${fmtAcc(acc)}). Pastikan nama tempat di atas sudah benar.`); toast("Lokasi awal terdeteksi.");
    } else {
      setStatus(`Perangkat hanya bisa memperkirakan lokasi (±${fmtAcc(acc)}), jadi perlu kamu cek di peta dulu.`);
      toast("Lokasi kurang presisi — cek dulu di peta."); openPick({ lat, lon, acc });
    }
  };
  tAll = setTimeout(() => finish(), 15000);
  id = navigator.geolocation.watchPosition(
    (pos) => {
      if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
      if (pos.coords.accuracy <= GOOD_ACC) finish(); else if (!tFirst) tFirst = setTimeout(() => finish(), 6000);
    },
    (err) => { if (err.code === 1 || !best) finish(err); },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
  );
});

/* ---------- Peta pemilih lokasi awal ---------- */
const pk = { map: null, marker: null, circle: null, pos: null, mode: "pick" };
const pickSheet = $("pickSheet");
function closePick() { pickSheet.classList.add("hidden"); }
function placePick(ll, keepCircle) {
  pk.pos = L.latLng(ll.lat, ll.lng).wrap();
  if (!keepCircle && pk.circle) { pk.map.removeLayer(pk.circle); pk.circle = null; }
  if (pk.marker) pk.marker.setLatLng(ll);
  else { pk.marker = L.marker(ll, { draggable: true }).addTo(pk.map); pk.marker.on("dragend", () => placePick(pk.marker.getLatLng())); }
  $("pickOk").disabled = false;
  if (!keepCircle) $("pickHint").textContent = `Titik: ${pk.pos.lat.toFixed(5)}, ${pk.pos.lng.toFixed(5)} — geser pin atau klik peta untuk memperbaiki, lalu tekan tombol konfirmasi.`;
}
function openPick(o = {}) {
  if (typeof L === "undefined") { toast("Peta tidak bisa dimuat. Periksa koneksi internet."); return; }
  pickSheet.classList.remove("hidden");
  pk.mode = o.lat != null ? "geo" : "pick"; pk.pos = null; $("pickOk").disabled = true; $("pickSearch").value = "";
  $("pickTitle").textContent = pk.mode === "geo" ? "Cek lokasimu" : "Pilih lokasi awalmu";
  $("pickOk").textContent = pk.mode === "geo" ? "Ya, lokasi saya di sini" : "Pakai titik ini";
  if (!pk.map) {
    pk.map = L.map("pickMap", { minZoom: 2, worldCopyJump: true });
    
    // MENGGUNAKAN TILE GOOGLE MAPS LANGSUNG (Tanpa API Key, super detail)
    L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
      maxZoom: 19,
      attribution: '© Google Maps'
    }).addTo(pk.map);
    
    pk.map.on("click", (e) => placePick(e.latlng));
  }
  if (pk.marker) { pk.map.removeLayer(pk.marker); pk.marker = null; }
  if (pk.circle) { pk.map.removeLayer(pk.circle); pk.circle = null; }
  if (pk.mode === "geo") {
    pk.map.setView([o.lat, o.lon], o.acc > 3000 ? 11 : o.acc > 800 ? 13 : 15);
    placePick({ lat: o.lat, lng: o.lon }, true);
    pk.circle = L.circle([o.lat, o.lon], { radius: o.acc, color: "#6e6cd6", weight: 1, fillOpacity: 0.12 }).addTo(pk.map);
    $("pickHint").textContent = `⚠ Perangkat ini kemungkinan tidak punya GPS, jadi lokasi diperkirakan dari Wi-Fi/IP (±${fmtAcc(o.acc)}) dan bisa meleset jauh, bahkan ke kota lain. Kalau pin salah: cari tempatmu di kolom atas, atau geser pin / klik peta di posisimu yang sebenarnya.`;
  } else {
    const c = S.origin ? [Number(S.origin.lat), Number(S.origin.lon)] : S.bias;
    pk.map.setView(c || [2, 100], c ? 13 : 4);
    $("pickHint").textContent = "Cari nama tempat di atas, atau klik peta untuk menaruh pin. Pin bisa digeser.";
  }
  setTimeout(() => pk.map.invalidateSize(), 80);
}
$("pickBtn").addEventListener("click", () => openPick());
attachAC({
  inputId: "pickSearch", listId: "pickSuggest", pickKey: "pickPlace", queryKey: "pickQuery", bias: () => null,
  biasText: "", noBiasText: "Ketik nama jalan, kelurahan, atau kota.",
  onPick: (p) => { const ll = { lat: Number(p.lat), lng: Number(p.lon) }; pk.map.setView(ll, 16); placePick(ll); }
});
$("pickOk").addEventListener("click", async () => {
  if (!pk.pos) return;
  const { lat, lng: lon } = pk.pos, geo = pk.mode === "geo"; $("pickOk").disabled = true; setStatus("Mencari nama tempat dari titik yang dipilih…");
  const rev = await reverseGeocode(lat, lon);
  setOrigin(lat, lon, rev, geo ? "Lokasi saya" : "Titik pilihan");
  closePick(); setStatus("Lokasi awal diatur: " + $("origin").value + "."); toast("Lokasi awal diatur.");
});
$("pickClose").addEventListener("click", closePick); $("pickCancel").addEventListener("click", closePick);
pickSheet.addEventListener("click", (e) => { if (e.target === pickSheet) closePick(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !pickSheet.classList.contains("hidden")) closePick(); });

/* ---------- API cuaca, udara, rute, libur ---------- */
async function fetchWeather(lat, lon) {
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=16`
    + `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day`
    + `&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,uv_index`;
  let r;
  try { r = await fetch(u); } catch { throw new Error("Tidak bisa terhubung ke layanan cuaca. Periksa koneksi internet."); }
  if (!r.ok) throw new Error("Data cuaca tidak bisa diambil saat ini.");
  return r.json();
}
async function fetchAir(lat, lon) {
  try {
    const r = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=us_aqi&timezone=auto&forecast_days=5`);
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
const unwrapLon = (lon, ref) => { while (lon - ref > 180) lon -= 360; while (lon - ref < -180) lon += 360; return lon; };
function arc(a, b, n = 64) {
  const V = ([la, lo]) => [Math.cos(rad(la)) * Math.cos(rad(lo)), Math.cos(rad(la)) * Math.sin(rad(lo)), Math.sin(rad(la))];
  const A = V(a), B = V(b), w = Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])));
  if (w < 1e-6 || Math.PI - w < 1e-6) return [a, [b[0], unwrapLon(b[1], a[1])]];
  const pts = []; let prev = a[1];
  for (let i = 0; i <= n; i++) {
    const t = i / n, s1 = Math.sin((1 - t) * w) / Math.sin(w), s2 = Math.sin(t * w) / Math.sin(w);
    const x = s1 * A[0] + s2 * B[0], y = s1 * A[1] + s2 * B[1], z = s1 * A[2] + s2 * B[2];
    const lon = unwrapLon((Math.atan2(y, x) * 180) / Math.PI, prev); prev = lon;
    pts.push([(Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI, lon]);
  }
  return pts;
}
const OSRM = { car: "https://routing.openstreetmap.de/routed-car", bike: "https://routing.openstreetmap.de/routed-bike", foot: "https://routing.openstreetmap.de/routed-foot" };

async function fetchRoute(o, d, profile) {
  // MEMAKSA RESOLUSI RUTE FULL AGAR GARISNYA SUPER AKURAT & TIDAK PATAH-PATAH
  const path = `/route/v1/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=full&geometries=geojson`;
  const urls = [OSRM[profile] + path]; 
  
  if (profile === "car") {
    urls.unshift("https://router.project-osrm.org" + path); // Prioritas server utama OSRM
  }
  
  for (const u of urls) {
    try {
      const r = await fetch(u); if (!r.ok) continue;
      const j = await r.json();
      if (j.code === "Ok" && j.routes?.[0]) return { ...j.routes[0], src: new URL(u).host };
    } catch { /* coba server berikutnya */ }
  }
  return null;
}

async function computeTravel(mode, origin, dest) {
  const o = [+origin.lat, +origin.lon], d = [+dest.lat, +dest.lon], air = haversine(o, d), nm = MODE_NAME[mode];
  if (mode === "plane" || mode === "ship") {
    const v = EST[mode], eta = Math.max(1, Math.ceil((air / v) * 60));
    return { kind: "est", eta, distKm: air, geometry: mode === "plane" ? arc(o, d) : [o, [d[0], unwrapLon(d[1], o[1])]], dashed: true,
      detail: `${air.toFixed(0)} km garis lurus · perkiraan rata-rata ${v} km/jam (bukan jadwal)`,
      how: `Tidak ada API gratis yang menyediakan jadwal ${nm}. Dihitung dari jarak garis lurus lokasi awal–tujuan (${air.toFixed(0)} km, rumus haversine dari koordinat Nominatim) ÷ kecepatan rata-rata ${v} km/jam. Belum termasuk check-in, boarding, transit, atau cuaca. Cek jadwal resmi operator.`,
      caption: mode === "plane" ? `Garis lengkung putus-putus = rute terpendek di permukaan bumi (great-circle) ± ${air.toFixed(0)} km; rute maskapai sebenarnya bisa berbeda.` : `Garis putus-putus = jarak lurus ± ${air.toFixed(0)} km, bukan jalur pelayaran.` };
  }
  const profile = ROAD[mode];
  // Panggil fetchRoute tanpa parameter `long`
  const r = await fetchRoute(origin, dest, profile);
  
  if (!r) return { kind: "none", eta: 0, detail: `Rute ${nm} tidak ditemukan dari lokasi awal (mungkin beda pulau/benua). Coba pesawat atau kapal.`, how: "", caption: "" };
  const km = r.distance / 1000, geometry = r.geometry.coordinates.map(([x, y]) => [y, x]);
  if (mode === "train") {
    const v = EST.train, eta = Math.max(1, Math.ceil((km / v) * 60));
    return { kind: "est", eta, distKm: km, geometry, dashed: false,
      detail: `${km.toFixed(1)} km (rute jalan) · perkiraan rata-rata ${v} km/jam (bukan jadwal)`,
      how: `Tidak ada API gratis untuk jadwal kereta. Jarak memakai rute jalan dari OSRM (${km.toFixed(1)} km) sebagai pendekatan lintasan rel, ÷ kecepatan rata-rata ${v} km/jam. Belum termasuk menunggu/transit; cek jadwal resmi operator.`,
      caption: `Garis biru = rute jalan ${km.toFixed(1)} km sebagai pendekatan; jalur rel sebenarnya bisa berbeda.` };
  }
  const eta = Math.max(1, Math.ceil(r.duration / 60));
  const note = mode === "motor" ? " OSRM tidak punya profil motor, jadi memakai profil mobil." : mode === "bus" ? " Memakai profil mobil; bus bisa lebih lama karena berhenti/transit." : "";
  return { kind: "api", eta, distKm: km, geometry, dashed: false, profile,
    detail: `${km.toFixed(1)} km · durasi langsung dari API rute (OSRM, profil ${profile})`,
    how: `Durasi ${fmtDur(eta)} dan jarak ${km.toFixed(1)} km diambil langsung dari OSRM (${r.src}), profil "${profile}", mengikuti jaringan jalan nyata.${note} Tidak mencakup kemacetan langsung.`,
    caption: `Rute ${km.toFixed(1)} km (garis biru). Tidak mencakup kemacetan langsung.` };
}

async function fetchOffset(lat, lon) {
  try { const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto&current=temperature_2m`); return r.ok ? ((await r.json()).utc_offset_seconds ?? null) : null; } catch { return null; }
}
const nrm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
async function fetchHours(dest) {
  const tag = dest.extratags?.opening_hours;
  if (tag) return { tag, parsed: parseOpening(tag), via: "tag opening_hours OpenStreetMap (lewat Nominatim)", name: null };
  if (isArea(dest)) return null;
  if (dest.osmRef) { 
    for (const host of ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]) {
      try {
        const r = await fetch(`${host}?data=${encodeURIComponent(`[out:json][timeout:15];${dest.osmRef.type}(${dest.osmRef.id});out tags;`)}`); if (!r.ok) continue;
        const tags = (await r.json()).elements?.[0]?.tags;
        if (tags?.opening_hours) return { tag: tags.opening_hours, parsed: parseOpening(tags.opening_hours), via: "tag opening_hours OpenStreetMap pada tempat yang kamu pilih (lewat Overpass API)", name: tags.name || null };
        break;
      } catch { /* coba host berikutnya */ }
    }
  }
  const want = nrm(shortName(dest)); if (want.length < 3) return null;
  const q = `[out:json][timeout:15];nwr(around:200,${dest.lat},${dest.lon})["opening_hours"]["name"];out tags 60;`;
  for (const host of ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]) {
    try {
      const r = await fetch(`${host}?data=${encodeURIComponent(q)}`); if (!r.ok) continue;
      for (const e of (await r.json()).elements || []) {
        const names = [e.tags.name, e.tags["name:en"], e.tags["name:id"], e.tags.alt_name].filter(Boolean).map(nrm);
        if (names.some((n) => n && (n.includes(want) || want.includes(n)))) return { tag: e.tags.opening_hours, parsed: parseOpening(e.tags.opening_hours), via: "OpenStreetMap, dicari di sekitar titik tujuan lewat Overpass API", name: e.tags.name };
      }
      return null;
    } catch { /* coba host berikutnya */ }
  }

  const type = dest.type || "";
  if (FALLBACK_HOURS[type]) {
    return { 
      tag: FALLBACK_HOURS[type], 
      parsed: parseOpening(FALLBACK_HOURS[type]), 
      via: "perkiraan sistem berdasarkan jenis tempat (" + type + ")", 
      name: shortName(dest) 
    };
  }
  return null;
}
const holCache = {};
async function fetchHolidays(cc, year) {
  if (!cc) return {};
  const key = cc + year;
  if (holCache[key]) return holCache[key];
  try {
    const r = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${cc.toUpperCase()}`);
    if (!r.ok || r.status === 204) return (holCache[key] = null);
    const arr = await r.json();
    return (holCache[key] = Object.fromEntries(arr.map((h) => [h.date, h.localName || h.name])));
  } catch { return null; }
}

/* ---------- Jam operasional (parser sederhana) ---------- */
const ORD = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
function parseDays(s) {
  s = s.replace(/\s/g, "");
  if (!s) return new Set([0, 1, 2, 3, 4, 5, 6]);
  const out = new Set(); let onlyPH = true;
  for (const part of s.split(",")) {
    if (/^(PH|SH)$/i.test(part)) continue;
    onlyPH = false;
    const m = part.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/);
    if (!m) return null;
    let a = ORD.indexOf(m[1]); const b = m[2] ? ORD.indexOf(m[2]) : a;
    for (let guard = 0; guard < 8; guard++) { out.add((a + 1) % 7); if (a === b) break; a = (a + 1) % 7; }
  }
  return onlyPH ? "PH" : out;
}
function parseOpening(str) {
  const s = String(str || "").trim();
  if (!s) return null;
  if (/^24\/7$/i.test(s)) return { isOpen: () => true, text: () => "24 jam" };
  const rules = [];
  for (let raw of s.split(";")) {
    raw = raw.trim(); if (!raw) continue;
    const m = raw.match(/^([A-Za-z,\- ]*?)\s*(off|closed|\d{1,2}:\d{2}.*)$/i);
    if (!m) return null;
    const days = parseDays(m[1]);
    if (days === null) return null;
    if (days === "PH") continue;
    let ivs = [];
    if (!/^(off|closed)$/i.test(m[2].trim())) {
      for (const seg of m[2].split(",")) {
        const t = seg.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
        if (!t) return null;
        const a = +t[1] * 60 + +t[2]; let b = +t[3] * 60 + +t[4];
        if (b <= a) b += 1440;
        ivs.push([a, b]);
      }
    }
    rules.push({ days, ivs });
  }
  if (!rules.length) return null;
  const curOf = (day) => { let c = null; for (const r of rules) if (r.days.has(day)) c = r.ivs; return c; };
  return {
    isOpen: (day, min) => {
      let prev = null; for (const r of rules) if (r.days.has((day + 6) % 7)) prev = r.ivs;
      const cur = curOf(day);
      let open = !!cur && cur.some(([a, b]) => min >= a && min < b);
      if (prev && prev.some(([a, b]) => b > 1440 && min + 1440 >= a && min + 1440 < b)) open = true;
      return open;
    },
    text: (day) => { const c = curOf(day); return c && c.length ? c.map(([a, b]) => `${fmtT(minToStr(a))}–${fmtT(minToStr(b))}`).join(", ") : "Tutup"; }
  };
}

/* ---------- Penilaian ---------- */
function windowMetrics(C, arrMin, dur) {
  const h = C.W.hourly, n = h.time.length, from = Math.floor(arrMin / 60), to = Math.min(from + 5, Math.floor((arrMin + dur) / 60));
  const m = { hasRain: false, rain: 0, precip: 0, wind: 0, uv: 0, app: -99, sev: -1, code: 0, aqi: null };
  for (let hr = from; hr <= to; hr++) {
    const i = C.base + hr;
    if (i < 0) continue; if (i >= n) break;
    const c = h.weather_code[i];
    const pp = h.precipitation_probability?.[i]; if (pp != null) { m.rain = Math.max(m.rain, pp); m.hasRain = true; }
    m.precip += h.precipitation?.[i] ?? 0;
    m.wind = Math.max(m.wind, h.wind_speed_10m?.[i] ?? 0);
    m.uv = Math.max(m.uv, h.uv_index?.[i] ?? 0);
    m.app = Math.max(m.app, h.apparent_temperature?.[i] ?? -99);
    if (sevOf(c) > m.sev) { m.sev = sevOf(c); m.code = c; }
    if (C.A?.hourly) { const k = C.A.hourly.time.indexOf(h.time[i]); const v = k >= 0 ? C.A.hourly.us_aqi[k] : null; if (v != null) m.aqi = Math.max(m.aqi ?? 0, v); }
  }
  m.outOfRange = C.base + from < 0 || C.base + from >= n;
  m.arrIdx = Math.max(0, Math.min(n - 1, C.base + from));
  if (m.sev <= 0) m.code = h.weather_code[m.arrIdx];
  m.temp = Math.round(h.temperature_2m[m.arrIdx]);
  m.arrWind = Math.round(h.wind_speed_10m[m.arrIdx] ?? 0);
  m.arrCode = h.weather_code[m.arrIdx];
  m.app = Math.round(m.app); m.wind = Math.round(m.wind); m.precip = Math.round(m.precip * 10) / 10;
  return m;
}
function dayInfo(C, min) {
  const off = Math.floor(min / 1440), d = new Date(Date.UTC(C.Y, C.Mo - 1, C.Dd + off)), dow = d.getUTCDay();
  const iso = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return { off, iso, dow, weekend: (WEEKEND[C.cc] || [6, 0]).includes(dow), holidayName: C.hols?.[iso] || null };
}
function openAt(C, min, day) { return C.openEval ? C.openEval.isOpen(day.dow, ((min % 1440) + 1440) % 1440) : null; }
function assess(C, m, open, day) {
  const act = C.act, outdoor = !!EXPOSED[C.mode];
  const w = { jogging: 1.1, wisata: 1.1, kuliner: 0.6, belanja: 0.55, kampus: 0.65, urus: 0.75 }[act] * (outdoor ? 1.25 : 0.8);
  let s = 0; const r = [];
  const add = (pts, txt) => { if (pts <= 0) return; s += pts; if (txt) r.push(txt); };
  const rp = (m.rain / 100) * 6 * w;
  add(rp, m.rain >= 35 ? `peluang hujan ${m.rain}%` : "");
  if (m.sev === 2) add(1.5 * w, m.rain < 35 ? "diprakirakan hujan" : "");
  if (m.sev === 3) add(3 * w, "hujan lebat");
  if (m.sev === 4) add(4, "ada potensi badai petir");
  if (m.precip >= 5) add(1.5 * w, `curah hujan sekitar ${m.precip} mm`);
  if (act === "jogging") {
    if (m.app >= 35) add(4, `suhu terasa sangat panas (${m.app}°C)`); else if (m.app >= 32) add(2, `suhu terasa panas (${m.app}°C)`);
    if (m.wind >= 40) add(4, `angin sangat kencang (${m.wind} km/jam)`); else if (m.wind >= 30) add(2, `angin cukup kencang (${m.wind} km/jam)`);
    if (m.uv >= 8) add(2, `indeks UV tinggi (${Math.round(m.uv)})`);
    if (m.aqi >= 151) add(5, `kualitas udara buruk (AQI ${m.aqi})`); else if (m.aqi >= 101) add(2.5, `kualitas udara kurang baik (AQI ${m.aqi})`);
  } else if (act === "wisata") {
    if (m.app >= 34) add(1.5, `suhu terasa panas (${m.app}°C)`);
    if (m.uv >= 9) add(1, `indeks UV tinggi (${Math.round(m.uv)})`);
    if (m.wind >= 40) add(2, `angin kencang (${m.wind} km/jam)`);
    if (m.aqi >= 151) add(2, `kualitas udara buruk (AQI ${m.aqi})`);
  } else {
    if (m.app >= 36) add(1, `suhu terasa sangat panas (${m.app}°C)`);
    if (m.wind >= 45 && outdoor) add(2, `angin sangat kencang (${m.wind} km/jam)`);
  }
  if (open === false) add(6, "tempat terindikasi tutup pada jam itu");
  if (act === "urus" && open !== true) {
    if (day.holidayName) add(2.5, `tanggal merah (${day.holidayName}), kantor layanan umumnya tutup`);
    else if (day.weekend) add(2, "akhir pekan, kantor layanan umumnya tutup");
  }
  return { score: s, reasons: r, level: s >= 5 ? "bad" : s >= 2.5 ? "warning" : "good" };
}
function evaluate(C, startMin) {
  const arrMin = startMin + C.tzDelta + C.eta, day = dayInfo(C, arrMin);
  const m = windowMetrics(C, arrMin, DUR[C.act]), open = openAt(C, arrMin, day);
  return { startMin, eta: C.eta, arrMin, day, m, open, ...assess(C, m, open, day) };
}
const win = (e) => `${fmtT(minToStr(e.startMin))}–${fmtT(minToStr(e.startMin + 120))}`;

function buildVerdict(C, A, best) {
  const t = fmtT(minToStr(A.startMin));
  const rs = A.reasons.join(", ") || "kondisi kurang mendukung";
  const better = best && best.score < A.score - 0.8;
  const sug = better ? ` Waktu berangkat yang lebih disarankan sekitar ${win(best)}.` : (A.level !== "good" ? " Belum ada jam lain hari ini yang jauh lebih baik; pertimbangkan tanggal lain." : "");
  const rainy = A.m.rain >= 40 || A.m.sev >= 2;
  const go = C.act === "wisata"
    ? (rainy ? " Jika tetap pergi, bawa payung atau jas hujan dan siapkan barang sesuai checklist di bawah." : " Siapkan barang sesuai checklist di bawah.")
    : " Jika tetap pergi, beri waktu perjalanan lebih longgar dan konfirmasi dulu ke tempat tujuan.";
  if (A.level === "bad") return { kind: "bad", icon: "⛔", label: "KURANG DISARANKAN", title: `Kurang disarankan berangkat pukul ${t}`, text: `Kurang disarankan pergi pukul ${t} karena ${rs}.${sug}${go}` };
  if (A.level === "warning") return { kind: "warning", icon: "⚠️", label: "PERLU ANTISIPASI", title: "Bisa berangkat, tapi perlu antisipasi", text: `Berangkat pukul ${t} masih memungkinkan, tetapi ${rs}.${sug}${go}` };
  return { kind: "good", icon: "✅", label: "LAYAK BERANGKAT", title: `Layak berangkat pukul ${t}`, text: `Dari prakiraan yang tersedia, tidak ada kendala berarti untuk ${ACT_NAME[C.act]}.${better ? sug : " Waktu pilihanmu sudah termasuk yang terbaik hari ini."}${C.act === "wisata" ? " Barang bawaan ada di checklist di bawah." : ""}` };
}

/* ---------- Render hasil ---------- */
const RISK = { good: "Risiko: Rendah", warning: "Risiko: Sedang", bad: "Risiko: Tinggi" };
function renderPlans(C, list) {
  $("plans").innerHTML = list.map((p) => {
    const e = p.e, wx = wxInfo(e.m.code);
    const arriveLabel = e.eta ? "Tiba (jam setempat)" : "Mulai kegiatan";
    const openLine = e.open === true ? ["✅", "Tempat buka saat tiba"] : e.open === false ? ["⛔", "Terindikasi tutup saat tiba"] : ["🕘", "Jam buka belum diketahui"];
    return `<article class="plan ${p.cls}">
      <div class="plan-head">${p.name}<span>${p.tag}</span></div>
      <div class="plan-times"><div><b>${fmtT(minToStr(e.startMin))}</b><small>Berangkat</small></div><div><b>${fmtT(minToStr(e.arrMin))}${e.day.off ? `<sup>${e.day.off > 0 ? "+" : "−"}${Math.abs(e.day.off)}</sup>` : ""}</b><small>${arriveLabel}</small></div></div>
      <ul>
        <li><i>${wxIcon(e.m.code, Math.floor((((e.arrMin % 1440) + 1440) % 1440) / 60))}</i><span>${esc(wx[0])}, peluang hujan tertinggi ${pctv(e.m.hasRain ? e.m.rain : null)}</span></li>
        <li><i>🌡️</i><span>${e.m.temp}°C · angin ${e.m.wind} km/jam</span></li>
        <li><i>${openLine[0]}</i><span>${openLine[1]}</span></li>
        ${e.eta ? `<li><i>🧭</i><span>Perjalanan ± ${fmtDur(e.eta)}</span></li>` : ""}
      </ul>
      <div class="risk ${e.level}">${RISK[e.level]}</div></article>`;
  }).join("");
}
function renderHourly(C, m) {
  const h = C.W.hourly, ci = m.arrIdx, hr0 = Number(h.time[ci].slice(11, 13));
  let html = "";
  for (let i = ci - 2; i <= ci + 3; i++) {
    if (i < 0 || i >= h.time.length) continue;
    const hr = Number(h.time[i].slice(11, 13));
    html += `<div class="hr ${i === ci ? "on" : ""}"><small>${pad(hr)}.00</small><span>${wxIcon(h.weather_code[i], hr)}</span><b>${Math.round(h.temperature_2m[i])}°C</b><em>💧${pctv(h.precipitation_probability?.[i])}</em></div>`;
  }
  $("hourly").innerHTML = html;
  const uvl = (u) => (u < 3 ? "Rendah" : u < 6 ? "Sedang" : u < 8 ? "Tinggi" : u < 11 ? "Sangat tinggi" : "Ekstrem");
  const aql = (a) => (a <= 50 ? "Baik" : a <= 100 ? "Sedang" : a <= 150 ? "Sensitif" : a <= 200 ? "Tidak sehat" : "Sangat buruk");
  $("rainChance").textContent = pctv(h.precipitation_probability?.[ci]);
  $("humidity").textContent = pctv(h.relative_humidity_2m?.[ci]);
  const uv = h.uv_index?.[ci]; $("uv").textContent = uv != null ? Math.round(uv) : "—"; $("uvLabel").textContent = uv != null ? uvl(uv) : "";
  $("wind").textContent = `${Math.round(h.wind_speed_10m?.[ci] ?? 0)} km/jam`;
  let aq = null;
  if (C.A?.hourly) { const k = C.A.hourly.time.indexOf(h.time[ci]); aq = k >= 0 ? C.A.hourly.us_aqi[k] : null; }
  $("aqi").textContent = aq != null ? aq : "—"; $("aqiLabel").textContent = aq != null ? aql(aq) : "tidak tersedia";
  return hr0;
}
function dayRainWindow(C) {
  const h = C.W.hourly, hrs = [];
  for (let hr = 6; hr <= 22; hr++) { const i = C.base + hr; if (i < h.time.length && ((h.precipitation_probability?.[i] ?? 0) >= 50 || sevOf(h.weather_code[i]) >= 2)) hrs.push(hr); }
  return hrs.length ? `${pad(hrs[0])}.00–${pad(hrs[hrs.length - 1] + 1)}.00` : null;
}

/* ---------- Checklist wisata ---------- */
function buildPacking(C, A, place) {
  const days = Number(C.days), nights = days - 1, m = A.m;
  const txt = `${place.display_name} ${place.name || ""} ${place.type || ""} ${place.category || ""}`.toLowerCase();
  const is = (re) => re.test(txt);
  const ele = Number(place.extratags?.ele);
  const beach = is(/pantai|beach|bahari|pulau|island|snorkel|selam|marina|laguna/);
  const waterpark = is(/waterboom|water park|waterpark|kolam renang|pemandian|pemandian air panas|hot spring|air panas/);
  const waterfall = is(/air terjun|waterfall|curug|arung|rafting|sungai|river/);
  const mountain = is(/gunung|mount|puncak|bukit|hill|kawah|volcano|hutan|forest|taman nasional|national park|geopark|camping|berkemah|dataran tinggi/) || ele >= 900;
  const religious = is(/masjid|mosque|gereja|church|pura|vihara|klenteng|candi|temple|kuil|makam/);
  const highland = ele >= 900 || is(/berastagi|brastagi|dieng|bromo|kintamani|lembang|puncak|dataran tinggi|toba|sipiso/);
  const wet = beach || waterpark || waterfall;
  const cold = highland || m.temp <= 22;
  const hot = m.temp >= 30 || m.uv >= 7;
  const rainy = m.rain >= 40 || m.sev >= 2;
  const exposed = !!EXPOSED[C.mode];
  const L = [];
  const add = (g, ic, t, n) => L.push({ g, ic, t, n });

  add("Pakaian", "👕", `Baju ${days + (wet || mountain ? 1 : 0)} helai`, days > 1 ? `1 per hari${wet || mountain ? " + 1 cadangan karena basah/keringat" : ""}` : wet || mountain ? "1 cadangan karena basah/keringat" : "Pilih bahan nyaman & menyerap keringat");
  add("Pakaian", "🩲", `Pakaian dalam ${days + (wet ? 1 : 0)} set`, "");
  add("Pakaian", "👖", `Celana/rok ${Math.max(1, Math.ceil(days / 2))} buah`, days > 1 ? "Bisa dipakai ulang sehari" : "");
  if (!beach) add("Pakaian", "🧦", `Kaos kaki ${days} pasang`, "");
  if (nights > 0) add("Pakaian", "🛏️", `Baju tidur ${nights >= 3 ? 2 : 1} set`, "");
  if (cold) add("Pakaian", "🧥", "Jaket / pakaian hangat", highland ? "Daerah dataran tinggi biasanya lebih dingin, terutama malam" : `Suhu sekitar ${m.temp}°C`);
  if (wet) add("Pakaian", "🩱", "Pakaian renang atau pakaian cepat kering", "Plus baju ganti kering");
  if (wet) add("Pakaian", "🧖", "Handuk cepat kering", "");
  if (religious) add("Pakaian", "🧕", "Pakaian sopan (bahu & lutut tertutup)", "Tempat ibadah/situs budaya biasanya mensyaratkan");
  add("Alas kaki", beach ? "🩴" : "👟", beach ? "Sandal pantai / sandal anti-slip" : mountain || waterfall ? "Sepatu/sandal gunung dengan grip" : "Sepatu nyaman untuk banyak berjalan", mountain || waterfall ? "Jalur bisa licin dan berbatu" : "");

  if (rainy) add("Perlindungan cuaca", "🌧️", exposed ? "Jas hujan" : "Payung lipat", exposed ? `Peluang hujan ${m.rain}%; jas hujan lebih praktis untuk ${MODE_NAME[C.mode]}` : `Peluang hujan ${m.rain}%`);
  if (rainy || wet) add("Perlindungan cuaca", "🛍️", "Pelindung tahan air untuk ponsel & tas", "Kantong ziplock atau cover tas");
  if (hot) add("Perlindungan cuaca", "🧢", "Topi / pelindung kepala", `Suhu ${m.temp}°C, UV ${Math.round(m.uv)}`);
  if (hot || beach || m.uv >= 5) add("Perlindungan cuaca", "🧴", "Tabir surya SPF 30+", "Oleskan ulang tiap 2–3 jam");
  if (m.wind >= 25 && exposed) add("Perlindungan cuaca", "🧣", "Jaket tahan angin", `Angin hingga ${m.wind} km/jam`);
  if (mountain) add("Perlindungan cuaca", "🔦", "Senter kecil / headlamp", "Jalur bisa gelap bila pulang sore");

  add("Perlengkapan penting", "💧", hot ? "Air minum isi ulang (min. 1,5 L)" : "Air minum isi ulang", "");
  add("Perlengkapan penting", "🔋", nights > 0 ? "Ponsel, charger & power bank" : "Ponsel & power bank", "");
  add("Perlengkapan penting", "🪪", "KTP & tiket / bukti reservasi", "");
  add("Perlengkapan penting", "💵", "Uang tunai secukupnya", "Tidak semua lokasi wisata menerima non-tunai");
  if (nights > 0) add("Perlengkapan penting", "🪥", "Perlengkapan mandi", "");
  if (nights > 0 || wet) add("Perlengkapan penting", "🛍️", "Kantong plastik untuk pakaian basah/kotor", "");
  if (nights > 0 || mountain || waterfall) add("Perlengkapan penting", "🩹", "P3K ringan & obat pribadi", "Plester, minyak angin, obat yang rutin diminum");
  return L;
}
function renderPacking(items) {
  const box = $("packingList");
  if (!items) { box.innerHTML = ""; $("packTag").textContent = "Khusus aktivitas wisata"; $("packIntro").innerHTML = "Aktivitas ini tidak memerlukan daftar barang. Pilih <b>Wisata / jalan-jalan</b> untuk mendapat checklist yang disesuaikan dengan tujuan, cuaca, transportasi, dan lama menginap."; return; }
  $("packTag").textContent = `${items.length} barang`;
  $("packIntro").textContent = "Disusun dari tujuan, cuaca saat kegiatan, transportasi, dan lama wisata. Centang yang sudah masuk tas.";
  let g = "", html = "";
  items.forEach((it, i) => {
    if (it.g !== g) { g = it.g; html += `<div class="pack-group">${esc(g)}</div>`; }
    html += `<label class="pack-item"><input type="checkbox" id="pk${i}"><span class="ic">${it.ic}</span><span class="tx">${esc(it.t)}${it.n ? `<small>${esc(it.n)}</small>` : ""}</span></label>`;
  });
  box.innerHTML = html;
}

/* ---------- Peta (Leaflet) ---------- */
function initMap() {
  if (typeof L === "undefined") { $("mapCaption").textContent = "Peta tidak bisa dimuat (periksa koneksi internet). Gunakan tautan OpenStreetMap di hasil rekomendasi."; return; }
  S.map = L.map("map", { scrollWheelZoom: false, minZoom: 2, worldCopyJump: true }).setView([15, 20], 2);
  
  // TILE GOOGLE MAPS ASLI (Keyless)
  L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", { 
    maxZoom: 19, 
    attribution: '© Google Maps' 
  }).addTo(S.map);
  
  S.layer = L.layerGroup().addTo(S.map);
}
const pin = (emoji, size) => L.divIcon({ className: "", html: `<div class="pin" style="font-size:${size}px">${emoji}</div>`, iconSize: [size, size], iconAnchor: [size / 2, size] });
function showOnMap(dest, origin, route) {
  if (!S.map) return;
  S.layer.clearLayers();
  let d = [Number(dest.lat), Number(dest.lon)];
  if (route?.dashed && route.geometry?.length) d = route.geometry[route.geometry.length - 1];
  L.marker(d, { icon: pin("📍", 28) }).addTo(S.layer).bindPopup(esc(shortName(dest)));
  let bounds = null;
  if (origin) {
    const o = [Number(origin.lat), Number(origin.lon)];
    L.marker(o, { icon: pin("🟢", 18) }).addTo(S.layer).bindPopup("Lokasi awal");
    const dashed = { color: "#9aa3c7", weight: 3, dashArray: "8 8" };
    const line = route?.geometry?.length
      ? L.polyline(route.geometry, route.dashed ? dashed : { color: "#5b7cf0", weight: 5, opacity: 0.85 })
      : L.polyline([o, d], dashed);
    bounds = line.addTo(S.layer).getBounds();
  }
  S.fit = () => { S.map.invalidateSize(); if (bounds) S.map.fitBounds(bounds, { padding: [40, 40] }); else S.map.setView(d, 15); };
  S.fit();
}

/* ---------- Kalender (.ics & Google Calendar) ---------- */
function setupCalendar(C, A, dest) {
  const startD = new Date(C.depTs);
  const endD = new Date(startD.getTime() + (A.eta + DUR[C.act]) * 60000);
  const stamp = (d) => d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const title = `Berangkat ke ${shortName(dest)} (${ACT_NAME[C.act]})`;
  const note = `Rencana dari TripReady. ${A.reasons.length ? "Catatan: " + A.reasons.join(", ") + "." : "Prakiraan cuaca mendukung."}`;
  $("icsBtn").onclick = () => {
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TripReady//ID", "BEGIN:VEVENT", `UID:${Date.now()}@tripready`, `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(startD)}`, `DTEND:${stamp(endD)}`, `SUMMARY:${title.replace(/[,;]/g, " ")}`, `LOCATION:${dest.display_name.replace(/[,;]/g, " ")}`, `DESCRIPTION:${note.replace(/[,;]/g, " ")}`,
      "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:Waktunya bersiap", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" })); a.download = "perjalanan-tripready.ics";
    document.body.appendChild(a); a.click(); a.remove(); toast("File kalender (.ics) diunduh.");
  };
  $("gcalBtn").href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${stamp(startD)}/${stamp(endD)}&details=${encodeURIComponent(note)}&location=${encodeURIComponent(dest.display_name)}`;
}

/* ---------- Pengingat (hanya atas izin & klik pengguna) ---------- */
const LEADS = [[30, "30 menit sebelum berangkat"], [60, "1 jam sebelum berangkat"], [180, "3 jam sebelum berangkat"], [1440, "1 hari sebelum berangkat"]];
const fmtDT = (ts) => new Date(ts).toLocaleString("id-ID", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).replace(/\./g, ":");
function armTimer(rem) {
  clearTimeout(S.timer);
  const wait = rem.ts - rem.lead * 60000 - Date.now();
  if (wait <= 0) return false;
  S.timer = setTimeout(() => {
    const body = `Perjalanan ke ${rem.place} dimulai ${rem.lead >= 1440 ? "besok" : rem.lead >= 60 ? `sekitar ${rem.lead / 60} jam lagi` : `${rem.lead} menit lagi`}. Cek cuaca dan persiapanmu.`;
    try { new Notification("TripReady — waktunya bersiap!", { body }); } catch { }
    toast("🔔 " + body);
    clearReminder(true);
  }, wait);
  return true;
}
function clearReminder(fired) {
  clearTimeout(S.timer); S.reminder = null;
  try { localStorage.removeItem("tr_reminder"); } catch { }
  $("cancelReminder").classList.add("hidden");
  if (!fired) toast("Pengingat dibatalkan.");
}
$("cancelReminder").addEventListener("click", () => { clearReminder(false); $("reminderText").textContent = "Pengingat dibatalkan. Buat atau ulangi rencana untuk mengatur yang baru."; $("enableReminder").classList.remove("hidden"); $("leadTime").classList.remove("hidden"); });

function setupReminder(plan) {
  const box = $("reminderBox"), txt = $("reminderText"), btn = $("enableReminder"), sel = $("leadTime");
  const diff = plan.ts - Date.now();
  const opts = LEADS.filter(([m]) => diff > m * 60000 + 60000);
  btn.disabled = false; btn.textContent = "Aktifkan notifikasi"; btn.classList.remove("hidden"); sel.classList.remove("hidden");
  const prev = S.reminder ? ` Pengingat sebelumnya (${S.reminder.place}) masih aktif; mengaktifkan yang baru akan menggantikannya.` : "";
  if (!opts.length) {
    box.classList.toggle("hidden", !S.reminder);
    btn.classList.add("hidden"); sel.classList.add("hidden");
    txt.textContent = (diff <= 0 ? "Waktu berangkat sudah lewat." : "Waktu berangkat tinggal sebentar lagi (atau sama dengan waktu input), jadi pengingat tidak ditawarkan.") + prev;
    return;
  }
  sel.innerHTML = opts.map(([m, l]) => `<option value="${m}">${l}</option>`).join("");
  box.classList.remove("hidden");
  txt.textContent = `Perjalanan dijadwalkan ${fmtDT(plan.ts)}. Aktifkan sendiri jika ingin diingatkan.` + prev;
  btn.onclick = async () => {
    if (!("Notification" in window)) { toast("Peramban ini tidak mendukung notifikasi."); return; }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { toast("Izin notifikasi belum diberikan."); txt.textContent = "Notifikasi diblokir. Izinkan notifikasi untuk situs ini di pengaturan peramban, lalu coba lagi."; return; }
    const lead = Number(sel.value);
    clearTimeout(S.timer);
    const rem = { ts: plan.ts, lead, place: plan.place };
    if (!armTimer(rem)) { toast("Waktu pengingat sudah lewat."); return; }
    S.reminder = rem;
    try { localStorage.setItem("tr_reminder", JSON.stringify(rem)); } catch { }
    txt.textContent = `Pengingat aktif: ${LEADS.find(([m]) => m === lead)[1]} (${fmtDT(plan.ts)}). Biarkan halaman ini tetap terbuka.`;
    btn.textContent = "✓ Notifikasi aktif"; btn.disabled = true; $("cancelReminder").classList.remove("hidden");
    toast("Pengingat berhasil dijadwalkan.");
  };
}
(function restoreReminder() {
  try {
    const rem = JSON.parse(localStorage.getItem("tr_reminder") || "null");
    if (rem && "Notification" in window && Notification.permission === "granted" && armTimer(rem)) {
      S.reminder = rem;
      $("reminderBox").classList.remove("hidden"); $("enableReminder").classList.add("hidden"); $("leadTime").classList.add("hidden"); $("cancelReminder").classList.remove("hidden");
      $("reminderText").textContent = `Pengingat aktif untuk perjalanan ke ${rem.place} (${fmtDT(rem.ts)}). Biarkan halaman ini tetap terbuka.`;
    } else localStorage.removeItem("tr_reminder");
  } catch { }
})();

/* ---------- Proses utama ---------- */
async function runPlan() {
  if (S.busy) return;
  const destText = $("destination").value.trim();
  const date = dateInput.value, time = $("tripTime").value;
  if (!destText) { setStatus("Masukkan tujuan terlebih dahulu."); $("destination").focus(); return; }
  if (!date || !time) { setStatus("Lengkapi tanggal dan jam berangkat."); return; }
  if (date < dateInput.min || date > dateInput.max) { setStatus("Pilih tanggal dari hari ini sampai 16 hari ke depan (batas prakiraan)."); return; }
  const act = $("activity").value, mode = $("transport").value;
  S.busy = true; $("submitBtn").disabled = true; destAC.hide(); originAC.hide();
  try {
    setStatus("Memeriksa lokasi…");
    let origin = null;
    if ($("origin").value.trim()) {
      try { origin = await ensurePlace(originAC, "origin", "originQuery", "Lokasi awal"); if (!origin) return; }
      catch (e) { toast("Lokasi awal tidak ditemukan, rekomendasi dibuat tanpa rute."); }
    }
    const dest = await ensurePlace(destAC, "dest", "destQuery", "Tujuan");
    if (!dest) return;
    setStatus("Mengambil cuaca, rute, dan kalender…");
    const lat = Number(dest.lat), lon = Number(dest.lon);
    const cc = dest.address?.country_code;
    const [W, A, travel, hols, hrs, oOff] = await Promise.all([
      fetchWeather(lat, lon), fetchAir(lat, lon),
      origin ? computeTravel(mode, origin, dest) : null,
      fetchHolidays(cc, date.slice(0, 4)),
      fetchHours(dest),
      origin ? fetchOffset(origin.lat, origin.lon) : null
    ]);
    const [Y, Mo, Dd] = date.split("-").map(Number);
    const t0 = W.hourly.time[0];
    const base = Math.round((Date.UTC(Y, Mo - 1, Dd) - Date.UTC(+t0.slice(0, 4), +t0.slice(5, 7) - 1, +t0.slice(8, 10))) / 3600000);
    if (base + 24 <= 0 || base >= W.hourly.time.length) throw new Error("Prakiraan untuk tanggal itu belum tersedia. Pilih tanggal dalam 16 hari ke depan.");
    const eta = travel?.eta || 0, dOff = W.utc_offset_seconds || 0, depOff = eta && oOff != null ? oOff : dOff;
    const startMin = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
    const depTs = Date.UTC(Y, Mo - 1, Dd, 0, startMin) - depOff * 1000; 
    const C = { depTs, W, A, base, act, mode, date, Y, Mo, Dd, cc, hols, eta, tzDelta: Math.round((dOff - depOff) / 60), days: $("duration").value, openEval: hrs?.parsed || null };
    const eA = evaluate(C, startMin);
    if (eA.m.outOfRange) throw new Error("Perkiraan waktu tiba berada di luar jangkauan prakiraan 16 hari. Pilih tanggal lebih awal.");
    C.holidayName = eA.day.holidayName; const weekend = eA.day.weekend;

    const cands = [];
    for (let hr = 5; hr <= 20; hr++) {
      const sm = hr * 60; if (Math.abs(sm - startMin) < 45) continue;
      const e = evaluate(C, sm); if (e.m.outOfRange) continue; e.rank = e.score + (Math.abs(sm - startMin) / 60) * 0.15; cands.push(e);
    }
    cands.sort((a, b) => a.rank - b.rank);
    const eB = cands[0] || null;
    const eC = cands.find((c) => eB && Math.abs(c.startMin - eB.startMin) >= 120) || null;

    const verdict = buildVerdict(C, eA, eB);
    $("emptyState").classList.add("hidden"); $("results").classList.remove("hidden");
    $("verdict").className = "verdict " + verdict.kind;
    $("verdictIcon").textContent = verdict.icon; $("verdictLabel").textContent = verdict.label;
    $("verdictTitle").textContent = verdict.title; $("verdictText").textContent = verdict.text;

    const m = eA.m, wxA = wxInfo(m.arrCode);
    $("weatherValue").textContent = wxA[0];
    $("weatherDetail").textContent = `Saat tiba sekitar ${fmtT(minToStr(eA.arrMin))}`;
    $("tempValue").textContent = `${m.temp}°C`;
    $("rainDetail").textContent = `${m.hasRain ? "Peluang hujan tertinggi " + m.rain + "%" : "Peluang hujan tidak tersedia"} · angin ${m.wind} km/jam`;

    const hoursRaw = hrs?.tag || null, area = isArea(dest), T = travel;
    $("hoursValue").textContent = area ? "Tidak berlaku" : eA.open === true ? "Buka" : eA.open === false ? "Tutup" : "Belum diketahui";
    const gq = encodeURIComponent(`${shortName(dest)} ${dest.address?.city || dest.address?.town || dest.address?.state || ""}`.trim());
    $("hoursLink").href = `https://www.google.com/maps/search/?api=1&query=${gq}`;
    $("hoursLink").classList.toggle("hidden", area || (!!hoursRaw && !!hrs.parsed));
    $("hoursDetail").textContent = area ? `Tujuanmu berupa wilayah (${dest.type}), bukan satu tempat, jadi tidak punya jam buka. Cari nama tempat spesifik (museum, taman, kantor, restoran) untuk melihat jam operasionalnya.`
      : !hoursRaw ? "Belum tercatat di OpenStreetMap (data diisi sukarelawan, tidak semua tempat punya). Cek langsung ke tempatnya atau lewat tautan di bawah."
      : hrs.parsed ? `Hari itu: ${hrs.parsed.text(eA.day.dow)} · tercatat: ${hoursRaw}${hrs.name ? ` (${hrs.name})` : ""}`
      : `Format jam rumit, cek manual: ${hoursRaw}`;

    $("etaValue").textContent = T?.eta ? `± ${fmtDur(T.eta)}` : "—";
    $("etaDetail").textContent = T?.eta ? T.detail : origin ? (T?.detail || "Rute tidak ditemukan dari lokasi awal") : "Isi lokasi awal untuk estimasi";

    renderPlans(C, [
      { name: "Plan A", tag: "Rencana kamu", cls: "", e: eA },
      ...(eB ? [{ name: "Plan B", tag: eB.score < eA.score - 0.5 ? "Disarankan" : "Alternatif", cls: eB.score < eA.score - 0.5 ? "rec" : "alt", e: eB }] : []),
      ...(eC ? [{ name: "Plan C", tag: "Alternatif", cls: "alt", e: eC }] : [])
    ]);
    $("plansNote").textContent = `Dibandingkan pada ${new Date(date + "T12:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long" })} · waktu setempat tujuan (${W.timezone_abbreviation || W.timezone})`;

    $("placeAddress").textContent = dest.display_name;
    $("placeNote").textContent = hoursRaw ? "Jam operasional bersumber dari data OpenStreetMap dan bisa berbeda dari kondisi nyata." : "Data jam buka tempat ini tidak tersedia di OpenStreetMap.";
    $("mapLink").href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
    const dayName = new Date(eA.day.iso + "T12:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (C.holidayName) { $("calTag").textContent = "Tanggal merah"; $("calText").textContent = `${dayName} adalah hari libur nasional: ${C.holidayName}. Banyak kantor layanan tutup.`; }
    else if (weekend) { $("calTag").textContent = "Akhir pekan"; $("calText").textContent = `${dayName} jatuh pada akhir pekan. Kantor pemerintahan dan sebagian layanan umumnya libur.`; }
    else if (hols === null) { $("calTag").textContent = "Hari kerja"; $("calText").textContent = `${dayName}. Data hari libur nasional untuk negara ini tidak tersedia, cek kalender resmi setempat.`; }
    else { $("calTag").textContent = "Hari kerja"; $("calText").textContent = `${dayName}. Tidak ada hari libur nasional pada tanggal ini.`; }
    setupCalendar(C, eA, dest);

    showOnMap(dest, origin, T?.geometry ? { geometry: T.geometry, dashed: T.dashed } : null);
    $("mapCaption").textContent = T?.caption || (origin ? `Rute tidak ditemukan. Garis putus-putus = jarak lurus ± ${Math.round(haversine([+origin.lat, +origin.lon], [lat, lon]))} km.` : "Lokasi tujuan ditandai di peta. Isi lokasi awal untuk menampilkan rute.");
    renderHourly(C, m);
    $("wxLink").href = `https://open-meteo.com/en/docs#latitude=${lat}&longitude=${lon}`;
    const cur = W.current || {}, curWx = wxInfo(cur.weather_code ?? m.arrCode);
    $("currentCity").textContent = dest.address?.city || dest.address?.town || dest.address?.village || dest.address?.county || dest.address?.state || shortName(dest);
    $("currentTemp").textContent = `${Math.round(cur.temperature_2m ?? m.temp)}°`;
    $("currentDescription").textContent = curWx[0]; $("currentWeatherIcon").textContent = wxIcon(cur.weather_code ?? m.arrCode, cur.is_day === 0 ? 22 : 12);

    const rw = dayRainWindow(C);
    $("warnText").textContent = m.sev === 4 ? "Ada potensi badai petir pada jam kegiatanmu. Hindari area terbuka dan pohon tinggi."
      : m.rain >= 60 ? `Potensi hujan tinggi (${m.rain}%) pada jam kegiatanmu.${rw ? ` Hujan berpeluang sekitar ${rw} hari itu.` : ""}`
      : rw ? `Hujan berpeluang sekitar ${rw} di tujuan pada tanggal itu.`
      : "Tidak ada peringatan cuaca signifikan pada tanggal dan jam yang kamu pilih.";

    renderPacking(act === "wisata" ? buildPacking(C, eA, dest) : null);

    const notes = [[verdict.icon, verdict.title]];
    if (m.rain >= 40) notes.push(["🌧️", `Peluang hujan ${m.rain}% selama kegiatan.`]);
    if (eA.open === false) notes.push(["⛔", "Tempat terindikasi tutup saat kamu tiba."]);
    else if (eA.open === true) notes.push(["✅", "Tempat tercatat buka saat kamu tiba."]);
    if (C.holidayName) notes.push(["📅", `Tanggal merah: ${C.holidayName}.`]);
    else if (weekend && act === "urus") notes.push(["📅", "Akhir pekan: kantor layanan umumnya tutup."]);
    if (T?.eta) notes.push(["🧭", `Perjalanan ± ${fmtDur(T.eta)} (${T.distKm.toFixed(1)} km, ${MODE_NAME[mode]}).`]);
    if (eB && eB.score < eA.score - 0.8) notes.push(["⏰", `Jam lebih baik: sekitar ${win(eB)}.`]);
    addNotifs(notes);

    const says = verdict.kind === "good" ? "Cuaca mendukung! Selamat jalan dan hati-hati ya ✨" : verdict.kind === "warning" ? "Boleh berangkat, tapi siap-siap dulu ya. Cek rekomendasi jam lain!" : `Hmm, kurang pas. Coba lihat Plan B${eB ? ` (${fmtT(minToStr(eB.startMin))})` : ""}.`;
    $("mimiSays").textContent = says; $("sideBubble").textContent = says;

    const place = shortName(dest);
    setupReminder({ ts: depTs, place });
    renderInfo({ C, eA, T, hrs, area, dest, dur: DUR[act], dOff, depOff });
    setStatus("Analisis selesai. Ingat: cuaca adalah prakiraan, bukan kepastian.");
    go("recommendations");
  } catch (e) {
    setStatus(e.message || "Terjadi kesalahan saat mengambil data."); toast(e.message || "Gagal mengambil data.");
  } finally { S.busy = false; $("submitBtn").disabled = false; }
}
$("tripForm").addEventListener("submit", (e) => { e.preventDefault(); runPlan(); });
const utcLbl = (s) => { const mn = Math.round(s / 60), a = Math.abs(mn); return `UTC${mn < 0 ? "−" : "+"}${Math.floor(a / 60)}${a % 60 ? ":" + pad(a % 60) : ""}`; };
function renderInfo(x) {
  const it = (t, v, p) => `<section class="info-item"><h4>${t}${v ? `<b>${esc(v)}</b>` : ""}</h4><p>${p}</p></section>`;
  let h = "";
  if (!x) {
    h = `<p class="muted-text">Buat rencana dulu, nanti di sini muncul asal setiap angka lengkap dengan nilainya.</p>`
      + it("Peluang hujan & kelembapan (%)", "", "Dari Open-Meteo: <code>precipitation_probability</code> dan <code>relative_humidity_2m</code> di koordinat tujuan. Berupa prakiraan model, bukan kepastian.")
      + it("Estimasi perjalanan", "", "Mobil/motor/bus/sepeda/jalan kaki: durasi langsung dari API rute OSRM. Pesawat/kapal/kereta: tidak ada API gratis, jadi dihitung dari jarak ÷ kecepatan rata-rata (dijelaskan setelah rencana dibuat).")
      + it("Jam operasional", "", "Dari data OpenStreetMap (Nominatim/Overpass). Banyak tempat belum tercatat, dan wilayah/kota memang tidak punya jam buka.")
      + it("Level risiko", "", "Skor sederhana buatan aplikasi, bukan angka dari API.");
  } else {
    const { C, eA, T, hrs, area, dur, dOff, depOff } = x, m = eA.m, hh = C.W.hourly;
    const from = Math.floor(eA.arrMin / 60), to = Math.min(from + 5, Math.floor((eA.arrMin + dur) / 60));
    const hr2 = (n) => pad(((n % 24) + 24) % 24) + ".00", wtxt = `${hr2(from)}–${hr2(to + 1)}`;
    h = it("Peluang hujan", pctv(m.hasRain ? m.rain : null), `Open-Meteo, variabel <code>precipitation_probability</code> di koordinat tujuan: peluang hujan di atas 0,1 mm pada jam itu menurut model prakiraan (bukan kepastian). Angka yang tampil = nilai tertinggi pada ${wtxt} (jam setempat tujuan), dihitung sejak perkiraan tiba selama ±${dur} menit kegiatan ${esc(ACT_NAME[C.act])} (maks. 6 jam). Lama kegiatan ini asumsi aplikasi.`)
      + it("Kelembapan", pctv(hh.relative_humidity_2m?.[m.arrIdx]), "Open-Meteo, <code>relative_humidity_2m</code> pada jam tiba.")
      + it("Suhu · angin · UV", `${m.temp}°C`, "Suhu = <code>temperature_2m</code> pada jam tiba. Angin (<code>wind_speed_10m</code>) dan UV (<code>uv_index</code>) = nilai tertinggi dalam jendela waktu di atas.")
      + it("Kualitas udara", m.aqi != null ? String(m.aqi) : "—", "Open-Meteo Air Quality API, <code>us_aqi</code> (skala AQI Amerika Serikat). Hanya tersedia sekitar 5 hari ke depan.")
      + it("Estimasi perjalanan", T?.eta ? `± ${fmtDur(T.eta)}` : "—", esc(T?.how || T?.detail || "Isi lokasi awal agar ada estimasi."))
      + (T?.eta ? it("Waktu tiba", fmtT(minToStr(eA.arrMin)), `Berangkat ${fmtT(minToStr(eA.startMin))} (${utcLbl(depOff)}) + ${fmtDur(T.eta)} = tiba ${fmtT(minToStr(eA.arrMin))} waktu setempat tujuan (${utcLbl(dOff)}). Cuaca dan jam buka dinilai pada waktu tiba. Selisih zona waktu memakai offset Open-Meteo saat ini; bisa meleset 1 jam bila beda musim jam-musim panas.`) : "")
      + it("Jam operasional", area ? "—" : eA.open === true ? "Buka" : eA.open === false ? "Tutup" : "Tidak diketahui", area ? "Tujuan berupa wilayah, bukan satu tempat." : hrs ? `Sumber: ${esc(hrs.via)}. Tercatat: <code>${esc(hrs.tag)}</code>, dicocokkan dengan jam tiba.` : "Tidak ada tag <code>opening_hours</code> di OpenStreetMap untuk tempat ini (data sukarelawan), jadi tidak ditebak.")
      + it("Tanggal merah / akhir pekan", eA.day.holidayName || (eA.day.weekend ? "Akhir pekan" : "Hari kerja"), "Hari libur nasional dari Nager.Date. Akhir pekan memakai tabel hari libur mingguan per negara di aplikasi (Sabtu–Minggu, kecuali beberapa negara).")
      + it("Level risiko", RISK[eA.level].replace("Risiko: ", ""), `Skor sederhana buatan aplikasi, bukan data API: poin dari peluang hujan, jenis cuaca, panas, angin, UV, AQI, jam buka, dan tanggal merah, disesuaikan aktivitas &amp; transportasi. Skor Plan A = ${eA.score.toFixed(1)} (≥2,5 Sedang, ≥5 Tinggi).${eA.reasons.length ? " Faktor: " + esc(eA.reasons.join(", ")) + "." : " Tidak ada faktor yang menambah skor."}`);
  }
  $("infoBody").innerHTML = h;
}
const infoFab = $("infoFab"), infoSheet = $("infoSheet");
const openInfo = () => { infoSheet.classList.remove("hidden"); $("infoClose").focus(); };
const closeInfo = () => { infoSheet.classList.add("hidden"); infoFab.focus(); };
infoFab.addEventListener("click", openInfo); $("infoClose").addEventListener("click", closeInfo);
infoSheet.addEventListener("click", (e) => { if (e.target === infoSheet) closeInfo(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !infoSheet.classList.contains("hidden")) closeInfo(); });
renderInfo(null);
initMap();