"use strict";
/* Controller: alur utama rencana perjalanan + panel asal angka */
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
