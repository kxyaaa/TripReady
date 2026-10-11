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


/* ---------- Web Push (butuh Worker, lihat worker/worker.mjs) ---------- */
const pushReady = () => !!(PUSH_API && VAPID_PUBLIC && "serviceWorker" in navigator && "PushManager" in window);
const b64uToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(s.length + (4 - (s.length % 4)) % 4, "=")), (c) => c.charCodeAt(0));
const pushPost = (path, body) => fetch(PUSH_API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
async function schedulePush(fireAt) {
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(VAPID_PUBLIC) });
  const r = await pushPost("/subscribe", { subscription: sub.toJSON(), fireAt });
  if (!r.ok) throw new Error("server menolak (" + r.status + ")");
}
async function cancelPush() {
  try {
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if (sub) await pushPost("/unsubscribe", { endpoint: sub.endpoint });
  } catch { }
}
