/* TripReady service worker: menampilkan notifikasi & menangani klik.
   Handler "push" disiapkan untuk Web Push (butuh server kecil) bila nanti dipakai. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { }
  e.waitUntil(self.registration.showNotification(d.title || "TripReady — waktunya bersiap!", {
    body: d.body || "Perjalananmu segera dimulai. Buka TripReady untuk cek cuaca dan persiapan.",
    tag: "tripready-reminder", requireInteraction: true
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if ("focus" in c) return c.focus();
    return self.clients.openWindow("./#pengingat");
  }));
});
