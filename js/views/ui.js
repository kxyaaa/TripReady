"use strict";
/* View: UI dasar, notifikasi catatan, menu, dan router halaman */
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

