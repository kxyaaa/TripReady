"use strict";
/* View: menampilkan checklist barang */
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

