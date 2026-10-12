# TripReady — Ready Before You Go

Aplikasi web untuk memutuskan **kapan dan apakah layak berangkat**: menggabungkan prakiraan cuaca, jam buka tempat, hari libur, dan estimasi rute menjadi satu rekomendasi (Plan A/B/C). Tanpa akun dan tanpa database; semua data diambil dari API publik. Notifikasi saat web ditutup memakai Web Push lewat satu Cloudflare Worker kecil (opsional).

## Fitur
- Pencarian tujuan & lokasi awal dengan autocomplete, lokasi perangkat, dan pemilih titik di peta
- Cuaca per jam, indeks UV, kualitas udara, peringatan hujan/badai
- Estimasi perjalanan (motor, mobil, bus, kereta, pesawat, kapal, sepeda, jalan kaki)
- Jam buka tempat (OpenStreetMap) dan hari libur nasional
- Skor risiko + perbandingan waktu berangkat (Plan A/B/C)
- Checklist barang bawaan untuk wisata
- Ekspor ke kalender (.ics / Google Calendar) dan notifikasi pengingat (Web Push)
- Panel "Asal angka" yang menjelaskan sumber tiap angka

## Menjalankan
Service Worker butuh `https://` atau `localhost`:
```bash
python -m http.server 8000   # lalu buka http://localhost:8000
node tests/smoke.test.js     # uji cepat (opsional)
```

## Struktur proyek
```
index.html  style.css  sw.js
js/
  core/         konstanta, helper, state global S
  models/       logika murni: assessment (skor risiko), opening-hours, packing
  services/     api (HTTP ke API publik), calendar, notification
  views/        render DOM: ui, results-view, packing-view, map-view
  controllers/  alur & event: location, reminder, trip (alur utama)
docs/           SRS, ARSITEKTUR, ERD, API, USER_MANUAL, AGILE
worker/         (opsional) Cloudflare Worker untuk Web Push + ujinya
tests/          smoke.test.js
```
Urutan `<script>` di `index.html` penting (tanpa bundler).

## Dokumentasi
[SRS](docs/SRS.md) · [Arsitektur](docs/ARSITEKTUR.md) · [ERD](docs/ERD.md) · [API](docs/API.md) · [Panduan Pengguna](docs/USER_MANUAL.md) · [Web Push](docs/PUSH_SETUP.md) · [Git & Agile](docs/AGILE.md)

## Keamanan
- Semua teks dari API/pengguna yang masuk ke HTML melewati `esc()` (anti-XSS)
- Tidak ada kunci API, kredensial, atau data pribadi yang disimpan; hanya jadwal pengingat di `localStorage`
- Tile peta memakai Esri World Street Map dengan atribusi (OSM memblokir tile bila dibuka tanpa Referer, mis. lewat `file://`)

## Batasan yang diketahui
- Prakiraan hanya 16 hari; API gratis bisa kena rate limit
- Jam buka bergantung pada data sukarelawan OSM (ada perkiraan berdasarkan jenis tempat)
- Notifikasi saat web ditutup butuh Worker Web Push (opsional, lihat docs/PUSH_SETUP.md; bisa telat hingga ±2 menit); tanpa itu pengingat hanya bunyi selama halaman terbuka
- Kode berlapis (model/service/view/controller) namun masih berbagi state global `S`
