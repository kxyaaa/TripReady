"use strict";
/* Service: Service Worker dan notifikasi */
/* ---------- Service Worker & notifikasi ---------- */
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => { }));
async function showNotif(title, body) {
  try {
    const reg = await Promise.race([navigator.serviceWorker?.ready, new Promise((r) => setTimeout(r, 1500))]);
    if (reg?.showNotification) return await reg.showNotification(title, { body, tag: "tripready-reminder", requireInteraction: true });
  } catch { }
  try { new Notification(title, { body }); } catch { }
}

