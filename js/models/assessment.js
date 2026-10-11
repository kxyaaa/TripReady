"use strict";
/* Model: perhitungan skor risiko dan verdict */
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

