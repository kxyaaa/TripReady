"use strict";
/* Model: logika penyusunan checklist barang bawaan */
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
