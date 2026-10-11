# Spesifikasi Kebutuhan Perangkat Lunak (SRS) — TripReady

## 1. Pendahuluan
**Tujuan:** membantu pengguna menilai kelayakan dan waktu terbaik berangkat ke suatu tujuan.
**Pengguna:** masyarakat umum (pelajar, pekerja, wisatawan). **Platform:** peramban modern (desktop & mobile).

## 2. Kebutuhan Fungsional
| ID | Kebutuhan |
|---|---|
| FR-01 | Pengguna dapat mencari tujuan dan lokasi awal dengan autocomplete |
| FR-02 | Pengguna dapat memakai lokasi perangkat atau memilih titik di peta |
| FR-03 | Pengguna memilih aktivitas, transportasi, tanggal, jam berangkat, dan lama wisata |
| FR-04 | Sistem menampilkan cuaca per jam, UV, kualitas udara, dan peringatan |
| FR-05 | Sistem menghitung estimasi perjalanan dan menampilkan rute di peta |
| FR-06 | Sistem menampilkan status buka/tutup tempat saat tiba |
| FR-07 | Sistem memberi tahu tanggal merah dan akhir pekan |
| FR-08 | Sistem memberi verdict (layak / perlu antisipasi / kurang disarankan) dan Plan A/B/C |
| FR-09 | Sistem membuat checklist barang untuk aktivitas wisata |
| FR-10 | Pengguna dapat mengekspor rencana ke kalender (.ics, Google Calendar) |
| FR-11 | Pengguna dapat mengaktifkan pengingat notifikasi yang tetap muncul saat web ditutup (Web Push) |
| FR-12 | Sistem menjelaskan asal setiap angka (panel "Asal angka") |

## 3. Kebutuhan Non-Fungsional
| ID | Kebutuhan |
|---|---|
| NFR-01 | Responsif pada layar ponsel dan desktop |
| NFR-02 | Tanpa akun dan tanpa database; satu-satunya data yang dikirim ke server milik aplikasi adalah alamat langganan push dan waktu pengingat, hanya jika pengguna mengaktifkan notifikasi |
| NFR-03 | Input/output ke HTML di-escape untuk mencegah XSS |
| NFR-04 | Pesan galat yang jelas bila API tidak tersedia |
| NFR-05 | Ketergantungan hanya pada API publik gratis tanpa API key |

## 4. Use Case Utama
**UC-01 Membuat rencana perjalanan.** Aktor: Pengguna. Alur: isi tujuan → pilih aktivitas/transportasi/tanggal/jam → tekan "Lihat Rekomendasi" → sistem mengambil data API → menampilkan verdict, Plan A/B/C, peta, cuaca, checklist.
*Alternatif:* tujuan ambigu → sistem meminta memilih dari daftar; API gagal → pesan galat.
**UC-02 Mengatur pengingat.** Setelah UC-01, pilih waktu pengingat → unduh .ics ke kalender atau aktifkan notifikasi peramban.

## 5. Batasan
Prakiraan maksimal 16 hari; kualitas udara ±5 hari; data jam buka tergantung OpenStreetMap; estimasi pesawat/kapal/kereta bukan jadwal resmi.
