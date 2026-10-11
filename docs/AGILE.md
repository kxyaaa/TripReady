# Git & Agile — Panduan Kerja Tim

> Isi bagian bertanda ✏️ dengan data nyata tim. Riwayat commit, sprint, dan board harus mencerminkan pekerjaan yang benar-benar dilakukan.

## Alur Git
- `main` = stabil/rilis · `develop` = integrasi · `feature/<nama>-<topik>` = pekerjaan harian
- Semua perubahan lewat **Pull Request** ke `develop`, minimal 1 reviewer, `node tests/smoke.test.js` harus lolos
- Commit kecil dan sering, format **Conventional Commits**: `feat: tambah panel asal angka`, `fix: perbaiki zona waktu`, `docs: ...`, `refactor: ...`, `test: ...`
- Rilis: merge `develop` → `main` dan beri tag `v1.0.0`

## Agile (Scrum ringan)
- Sprint 1 minggu; board **GitHub Projects**/Trello kolom: Backlog → Sprint → Doing → Review → Done
- Backlog berupa *user story*: "Sebagai <peran>, saya ingin <fitur> agar <manfaat>" (template di `.github/ISSUE_TEMPLATE`)
- Ritual: planning (awal), daily singkat/chat, review & retrospektif (akhir)

## Definition of Done
Fitur berjalan · lolos review PR · smoke test lolos · dokumentasi terkait diperbarui.

## ✏️ Rencana sprint (contoh format)
| Sprint | Tujuan | Story | PIC | Status |
|---|---|---|---|---|
| 1 | Fondasi pencarian & cuaca | FR-01, FR-04 | ✏️ | ✏️ |
| 2 | Rute, jam buka, skor risiko | FR-05–FR-08 | ✏️ | ✏️ |
| 3 | Checklist, kalender, pengingat | FR-09–FR-11 | ✏️ | ✏️ |
| 4 | Refactor, dokumentasi, tes | NFR-03, dokumen | ✏️ | ✏️ |

## ✏️ Pembagian peran
| Anggota | Peran | Fokus |
|---|---|---|
| ✏️ | ✏️ | ✏️ |
