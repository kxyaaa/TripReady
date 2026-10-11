"use strict";
/* Controller: pencarian tempat, lokasi perangkat, pemilih titik */
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
  const cat = bias && matchCategory(q);
  if (cat) { // mis. "toko baju": cari berdasarkan jenis tempat di sekitar, bukan nama
    try { const near = await searchNearby(cat, bias, signal); if (near.length) return near; }
    catch (e) { if (e.name === "AbortError") throw e; }
  }
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
  const render = (list, hasBias, explicit) => {
    if (!list.length) return msg(explicit ? "Tidak ditemukan di data OpenStreetMap. Coba ejaan lain, tambahkan nama kota, atau ketik jenis tempat seperti \"toko baju\"." : "Belum ada hasil. Tekan Enter untuk pencarian lanjutan, atau tambahkan nama kota.");
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
      st.items = list; st.active = -1; render(list, !!b, explicit);
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

    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTR }).addTo(pk.map);

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

