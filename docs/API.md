# Referensi API Eksternal
Semua API gratis dan tanpa API key.

| API | Kegunaan | Endpoint | Dipakai di |
|---|---|---|---|
| Photon | Autocomplete tempat | `GET photon.komoot.io/api/?q=&limit=&lat=&lon=` | `controllers/location.js` (`searchPlaces`) |
| Nominatim | Geocoding cadangan & reverse geocoding | `GET nominatim.openstreetmap.org/search` · `/reverse` | `location.js` (`geocode`, `reverseGeocode`) |
| Open-Meteo Forecast | Cuaca per jam, UV, angin, zona waktu | `GET api.open-meteo.com/v1/forecast?latitude=&longitude=&hourly=...&forecast_days=16` | `services/api.js` (`fetchWeather`, `fetchOffset`) |
| Open-Meteo Air Quality | AQI AS per jam | `GET air-quality-api.open-meteo.com/v1/air-quality?hourly=us_aqi` | `fetchAir` |
| OSRM | Rute & durasi (mobil/sepeda/jalan kaki) | `GET router.project-osrm.org/route/v1/driving/{lon,lat;lon,lat}?overview=full&geometries=geojson` | `fetchRoute` |
| Overpass | Tag `opening_hours` OSM | `GET overpass-api.de/api/interpreter?data=...` | `fetchHours` |
| Nager.Date | Hari libur nasional | `GET date.nager.at/api/v3/PublicHolidays/{tahun}/{negara}` | `fetchHolidays` |
| OpenStreetMap Tiles | Peta dasar (Leaflet) | `tile.openstreetmap.org/{z}/{x}/{y}.png` | `views/map-view.js` |

**Penanganan galat:** kegagalan jaringan/HTTP dilempar sebagai `Error` berpesan Indonesia dan ditampilkan lewat `setStatus()` + `toast()`. API opsional (udara, libur, jam buka) gagal secara senyap sehingga hasil tetap tampil.
**Batasan:** Nominatim dan OSRM publik punya rate limit; untuk produksi gunakan server sendiri.
