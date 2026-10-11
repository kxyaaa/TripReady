"use strict";
/* Controller: pengingat perjalanan */
/* ---------- Pengingat (hanya atas izin & klik pengguna) ---------- */
const LEADS = [[30, "30 menit sebelum berangkat"], [60, "1 jam sebelum berangkat"], [180, "3 jam sebelum berangkat"], [1440, "1 hari sebelum berangkat"]];
const fmtDT = (ts) => new Date(ts).toLocaleString("id-ID", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).replace(/\./g, ":");
function armTimer(rem) {
  clearTimeout(S.timer);
  const wait = rem.ts - rem.lead * 60000 - Date.now();
  if (wait <= 0) return false;
  S.timer = setTimeout(() => {
    const body = `Perjalanan ke ${rem.place} dimulai ${rem.lead >= 1440 ? "besok" : rem.lead >= 60 ? `sekitar ${rem.lead / 60} jam lagi` : `${rem.lead} menit lagi`}. Cek cuaca dan persiapanmu.`;
    showNotif("TripReady — waktunya bersiap!", body);
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
    txt.textContent = `Pengingat aktif: ${LEADS.find(([m]) => m === lead)[1]} (${fmtDT(plan.ts)}). Biarkan halaman ini tetap terbuka, atau pasang alarm kalender agar tetap bunyi saat web ditutup.`;
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
      $("reminderText").textContent = `Pengingat aktif untuk perjalanan ke ${rem.place} (${fmtDT(rem.ts)}). Biarkan halaman ini tetap terbuka, atau pasang alarm kalender agar tetap bunyi saat web ditutup.`;
    } else localStorage.removeItem("tr_reminder");
  } catch { }
})();

