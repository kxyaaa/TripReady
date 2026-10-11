"use strict";
/* View: render Plan A/B/C dan cuaca per jam */
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

