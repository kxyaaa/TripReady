# Referensi API Eksternal
Semua API gratis dan tanpa API key.

| API | Kegunaan | Endpoint | Dipakai di |
|---|---|---|---|
| Photon | Autocomplete tempat | `GET photon.komoot.io/api/?q=&limit=&lat=&lon=` | `controllers/location.js` (`searchPlaces`) |
| Nominatim | Geocoding cadangan & reverse geocoding | `GET nominatim.openstreetmap.org/search` · `/reverse` | `location.js` (`geocode`, `reverseGeocode`) |
| Open-Meteo Forecast | Cuaca per jam, UV, angin, zona waktu | `GET api.open-meteo.com/v1/forecast?latitude=&longitude=&hourly=...&forecast_days=16` | `services/api.js` (`fetchWeather`, `fetchOffset`) |
| Open-Meteo Air Quality | AQI AS per jam | `GET air-quality-api.open-meteo.com/v1/air-quality?hourly=us_aqi` | `fetchAir` |
| OSRM | Rute & durasi (mobil/sepeda/jalan kaki) | `GET router.project-osrm.org/route/v1/driving/{lon,lat;lon,lat}?overview=full&geometries=geojson` | `fetchRoute` |
| Overpass | Tag `opening_hours` OSM | `GET overpass-api.de/api/interpreter?data=...` (+2 server cadangan, timeout 12 dtk) | `fetchHours` |
| Nager.Date | Hari libur nasional | `GET date.nager.at/api/v3/PublicHolidays/{tahun}/{negara}` | `fetchHolidays` |
| Esri World Street Map | Peta dasar (Leaflet) | `server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}` | `views/map-view.js` |
| Worker TripReady (milik sendiri) | Simpan/hapus jadwal Web Push | `POST /subscribe {subscription, fireAt}` · `POST /unsubscribe {endpoint}` | `services/notification.js` (`schedulePush`) |
| Layanan Web Push peramban (FCM dll.) | Mengantar push ke perangkat | `POST <endpoint langganan>` dengan header VAPID | `worker/worker.mjs` (`sendDue`) |

**Penanganan galat:** kegagalan jaringan/HTTP dilempar sebagai `Error` berpesan Indonesia dan ditampilkan lewat `setStatus()` + `toast()`. API opsional (udara, libur, jam buka) gagal secara senyap sehingga hasil tetap tampil.
**Batasan:** Nominatim dan OSRM publik punya rate limit; untuk produksi gunakan server sendiri.
