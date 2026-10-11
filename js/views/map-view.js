"use strict";
/* View: peta Leaflet */
/* ---------- Peta (Leaflet) ---------- */
function initMap() {
  if (typeof L === "undefined") { $("mapCaption").textContent = "Peta tidak bisa dimuat (periksa koneksi internet). Gunakan tautan OpenStreetMap di hasil rekomendasi."; return; }
  S.map = L.map("map", { scrollWheelZoom: false, minZoom: 2, worldCopyJump: true }).setView([15, 20], 2);

  L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTR }).addTo(S.map);

  S.layer = L.layerGroup().addTo(S.map);
}
const pin = (emoji, size) => L.divIcon({ className: "", html: `<div class="pin" style="font-size:${size}px">${emoji}</div>`, iconSize: [size, size], iconAnchor: [size / 2, size] });
function showOnMap(dest, origin, route) {
  if (!S.map) return;
  S.layer.clearLayers();
  let d = [Number(dest.lat), Number(dest.lon)];
  if (route?.dashed && route.geometry?.length) d = route.geometry[route.geometry.length - 1];
  L.marker(d, { icon: pin("📍", 28) }).addTo(S.layer).bindPopup(esc(shortName(dest)));
  let bounds = null;
  if (origin) {
    const o = [Number(origin.lat), Number(origin.lon)];
    L.marker(o, { icon: pin("🟢", 18) }).addTo(S.layer).bindPopup("Lokasi awal");
    const dashed = { color: "#9aa3c7", weight: 3, dashArray: "8 8" };
    const line = route?.geometry?.length
      ? L.polyline(route.geometry, route.dashed ? dashed : { color: "#5b7cf0", weight: 5, opacity: 0.85 })
      : L.polyline([o, d], dashed);
    bounds = line.addTo(S.layer).getBounds();
  }
  S.fit = () => { S.map.invalidateSize(); if (bounds) S.map.fitBounds(bounds, { padding: [40, 40] }); else S.map.setView(d, 15); };
  S.fit();
}

