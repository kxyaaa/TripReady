"use strict";
/* Service: pemanggilan API publik (cuaca, udara, rute, jam buka, libur) */
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
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
/* Daftar elemen (bisa kosong), atau null bila SEMUA server gagal/timeout. Perbedaan keduanya penting. */
async function overpass(q, { signal, ms = 12000 } = {}) {
  for (const host of OVERPASS) {
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), ms), onAbort = () => ctrl.abort();
    signal?.addEventListener("abort", onAbort);
    try {
      const r = await fetch(`${host}?data=${encodeURIComponent(q)}`, { signal: ctrl.signal });
      if (r.ok) return (await r.json()).elements || [];
    } catch (e) { if (signal?.aborted) throw e; /* timeout/jaringan: coba server berikutnya */ }
    finally { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); }
  }
  return null;
}
const hoursKey = (d) => "tr_h:" + (d.osmRef ? d.osmRef.type + d.osmRef.id : (+d.lat).toFixed(4) + "," + (+d.lon).toFixed(4));
function hoursFromCache(d) {
  try {
    const c = JSON.parse(localStorage.getItem(hoursKey(d)) || "null");
    if (c && Date.now() - c.t < 12 * 3600e3) return { tag: c.tag, parsed: parseOpening(c.tag), via: c.via + " (tersimpan, diperbarui tiap 12 jam)", name: c.name };
  } catch { }
  return null;
}
function hoursToCache(d, h) { try { localStorage.setItem(hoursKey(d), JSON.stringify({ t: Date.now(), tag: h.tag, via: h.via, name: h.name })); } catch { } }

async function fetchHours(dest) {
  const tag = dest.extratags?.opening_hours;
  if (tag) return { tag, parsed: parseOpening(tag), via: "tag opening_hours OpenStreetMap (lewat Nominatim/Overpass)", name: null };
  if (isArea(dest)) return null;
  const cached = hoursFromCache(dest); if (cached) return cached;
  let found = null;
  if (dest.osmRef) {
    const t = (await overpass(`[out:json][timeout:15];${dest.osmRef.type}(${dest.osmRef.id});out tags;`))?.[0]?.tags;
    if (t?.opening_hours) found = { tag: t.opening_hours, parsed: parseOpening(t.opening_hours), via: "tag opening_hours OpenStreetMap pada tempat yang kamu pilih (lewat Overpass API)", name: t.name || null };
  }
  const want = nrm(shortName(dest));
  if (!found && want.length >= 3) {
    const els = await overpass(`[out:json][timeout:15];nwr(around:200,${dest.lat},${dest.lon})["opening_hours"]["name"];out tags 60;`);
    for (const e of els || []) {
      const names = [e.tags.name, e.tags["name:en"], e.tags["name:id"], e.tags.alt_name].filter(Boolean).map(nrm);
      if (names.some((n) => n && (n.includes(want) || want.includes(n)))) {
        found = { tag: e.tags.opening_hours, parsed: parseOpening(e.tags.opening_hours), via: "OpenStreetMap, dicari di sekitar titik tujuan lewat Overpass API", name: e.tags.name }; break;
      }
    }
  }
  if (found) { hoursToCache(dest, found); return found; }
  // Tidak ketemu (atau server sibuk): perlakuan SAMA, sehingga hasilnya tidak berubah-ubah.
  const type = dest.type || "";
  if (FALLBACK_HOURS[type]) return { tag: FALLBACK_HOURS[type], parsed: parseOpening(FALLBACK_HOURS[type]), via: "perkiraan sistem berdasarkan jenis tempat (" + type + ")", name: shortName(dest) };
  return null;
}

/* Cari tempat berdasarkan JENIS ("toko baju") di sekitar titik acuan, radius 5 km */
async function searchNearby(cat, [lat, lon], signal) {
  const els = await overpass(`[out:json][timeout:20];nwr(around:5000,${lat},${lon})${cat.f}[name];out center tags 80;`, { signal, ms: 15000 });
  if (els === null) throw new Error("Layanan data tempat sedang sibuk. Coba lagi sebentar.");
  const cc = S.origin?.address?.country_code || "";
  return els.filter((e) => (e.lat ?? e.center?.lat) != null).map((e) => {
    const t = e.tags || {}, la = e.lat ?? e.center.lat, lo = e.lon ?? e.center.lon;
    const addr = [t["addr:street"], t["addr:housenumber"], t["addr:suburb"] || t["addr:district"], t["addr:city"]].filter(Boolean).join(", ");
    return { lat: String(la), lon: String(lo), name: t.name, display_name: [t.name, addr].filter(Boolean).join(", "), category: t.shop ? "shop" : "amenity", type: t.shop || t.amenity,
      extratags: t, osmRef: { type: e.type, id: e.id }, address: { country_code: cc, road: t["addr:street"], city: t["addr:city"] }, distKm: haversine([lat, lon], [la, lo]) };
  }).sort((a, b) => a.distKm - b.distKm).slice(0, 15);
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

