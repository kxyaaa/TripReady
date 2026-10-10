# TripReady

TripReady adalah aplikasi web interaktif yang dirancang untuk membantu pengguna merencanakan perjalanan secara komprehensif. Aplikasi ini menyediakan analisis cuaca, peluang hujan, kualitas udara, status operasional destinasi, serta perhitungan estimasi rute perjalanan secara real-time sebelum keberangkatan.

Proyek ini dikembangkan menggunakan Vanilla JavaScript, HTML5, dan CSS3 tanpa ketergantungan pada database backend (100% sisi klien).

## Fitur Utama

- **Peta & Rute Interaktif:** Visualisasi peta berbasis tile interaktif dan integrasi mesin perutean untuk estimasi jalur perjalanan.
- **Integrasi Cuaca & Kualitas Udara:** Pemantauan suhu, indeks UV, kecepatan angin, peluang hujan, dan indeks AQI melalui Open-Meteo API.
- **Analisis Risiko & Rekomendasi Waktu:** Sistem penilaian otomatis untuk kelayakan waktu keberangkatan berdasarkan kondisi cuaca, hari libur nasional (Nager.Date), dan jam operasional tempat tujuan.
- **Smart Packing Checklist:** Generator otomatis daftar perlengkapan perjalanan yang disesuaikan dengan destinasi, kondisi cuaca, moda transportasi, dan durasi kunjungan.
- **Ekspor Kalender & Pengingat:** Fitur ekspor jadwal ke format kalender (.ics), Google Calendar, serta pengingat berbasis notifikasi browser.

## Teknologi yang Digunakan

- **Frontend:** HTML5, CSS3, JavaScript (ES6+)
- **Peta & Geospasial:** Leaflet.js, OpenStreetMap Tiles, Nominatim API (Geocoding), OSRM (Open Source Routing Machine).
- **Layanan API Publik:** 
  - Open-Meteo (Weather & Air Quality API)
  - Nager.Date API (Public Holidays)

## Cara Menjalankan

1. Clone repository ini:
   ```bash
   git clone [https://github.com/username-kamu/TripReady.git](https://github.com/username-kamu/TripReady.git)