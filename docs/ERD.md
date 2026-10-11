# ERD Konseptual TripReady

TripReady tidak memakai database. Diagram ini adalah **model data konseptual**: entitas yang diolah aplikasi saat membuat rencana. Data diambil dari API publik dan disimpan di memori selama sesi; hanya `REMINDER` yang disimpan, di `localStorage` peramban dan (bila Web Push aktif) di KV Cloudflare.

```mermaid
erDiagram
  TRIP_PLAN }o--|| PLACE : "menuju (tujuan)"
  TRIP_PLAN }o--o| PLACE : "berangkat dari (asal)"
  TRIP_PLAN ||--o{ ASSESSMENT : "dinilai (Plan A/B/C)"
  TRIP_PLAN |o--o| ROUTE : "memiliki"
  TRIP_PLAN ||--o{ PACKING_ITEM : "menghasilkan"
  TRIP_PLAN |o--o| REMINDER : "diingatkan lewat"
  PLACE ||--o{ WEATHER_HOUR : "prakiraan"
  PLACE |o--o| OPENING_HOURS : "punya"
  PLACE }o--o{ HOLIDAY : "negara memiliki"

  PLACE {
    string name
    string display_name
    float lat
    float lon
    string category
    string type
    string country_code
  }
  TRIP_PLAN {
    string activity
    string transport
    date trip_date
    time departure_time
    int nights
  }
  WEATHER_HOUR {
    datetime time
    int weather_code
    float temperature
    int rain_probability
    float wind_speed
    float uv_index
    int us_aqi
  }
  ROUTE {
    float distance_km
    int duration_min
    string profile
    string source
  }
  OPENING_HOURS {
    string osm_tag
    string source
  }
  HOLIDAY {
    date holiday_date
    string local_name
    string country_code
  }
  ASSESSMENT {
    string plan
    int depart_min
    float score
    string level
    string reasons
  }
  PACKING_ITEM {
    string group
    string item
    string note
  }
  REMINDER {
    timestamp depart_ts
    int lead_minutes
    string place_name
  }
```

| Entitas | Sumber | Disimpan di |
|---|---|---|
| PLACE | Photon / Nominatim | Memori (`S.dest`, `S.origin`) |
| TRIP_PLAN | Input form | Memori |
| WEATHER_HOUR | Open-Meteo | Memori |
| ROUTE | OSRM / estimasi | Memori |
| OPENING_HOURS | OpenStreetMap (Overpass) | Memori |
| HOLIDAY | Nager.Date | Memori (cache per negara & tahun) |
| ASSESSMENT | Dihitung `models/assessment.js` | Memori |
| PACKING_ITEM | Dihitung `models/packing.js` | Memori |
| REMINDER | Pilihan pengguna | `localStorage` (`tr_reminder`) + Worker KV (bila Web Push aktif) |

*Catatan:* nama atribut disederhanakan dari objek di kode agar mudah dibaca.
