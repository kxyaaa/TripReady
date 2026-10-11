"use strict";
/* Model: memetakan kata kunci jenis tempat ("toko baju") ke filter OpenStreetMap */
const CATEGORIES = [
  [/^(toko )?(baju|pakaian|fashion|butik|distro)$/, "Toko pakaian", '["shop"~"^(clothes|boutique|fashion_accessories)$"]'],
  [/^(toko )?(sepatu|sandal)$/, "Toko sepatu", '["shop"="shoes"]'],
  [/^(minimarket|mini market|toko kelontong|swalayan)$/, "Minimarket", '["shop"~"^(convenience|supermarket|general)$"]'],
  [/^(supermarket|hypermarket)$/, "Supermarket", '["shop"="supermarket"]'],
  [/^(mall|pusat perbelanjaan)$/, "Mall", '["shop"="mall"]'],
  [/^(apotek|apotik)$/, "Apotek", '["amenity"="pharmacy"]'],
  [/^toko buku$/, "Toko buku", '["shop"="books"]'],
  [/^(toko )?(elektronik|hp|handphone|ponsel)$/, "Toko elektronik", '["shop"~"^(electronics|mobile_phone|computer)$"]'],
  [/^(toko )?(kue|roti)$|^bakery$/, "Toko roti & kue", '["shop"~"^(bakery|pastry)$"]'],
  [/^(salon|barbershop|barber)$/, "Salon", '["shop"~"^(hairdresser|beauty)$"]'],
  [/^laundry$/, "Laundry", '["shop"~"^(laundry|dry_cleaning)$"]'],
  [/^toko bangunan$/, "Toko bangunan", '["shop"~"^(doityourself|hardware|building_materials)$"]'],
  [/^(bank|atm)$/, "Bank & ATM", '["amenity"~"^(bank|atm)$"]'],
  [/^(spbu|pom bensin|pompa bensin)$/, "SPBU", '["amenity"="fuel"]'],
  [/^(kafe|cafe|kedai kopi|warung kopi|coffee shop)$/, "Kafe", '["amenity"="cafe"]'],
  [/^(restoran|rumah makan|restaurant)$/, "Restoran", '["amenity"~"^(restaurant|fast_food)$"]'],
  [/^(rumah sakit|rs)$/, "Rumah sakit", '["amenity"="hospital"]'],
  [/^(klinik|dokter)$/, "Klinik", '["amenity"~"^(clinic|doctors)$"]'],
  [/^(masjid|mesjid)$/, "Masjid", '["amenity"="place_of_worship"]["religion"="muslim"]'],
  [/^toko$/, "Toko", '["shop"]']
];
/* "Toko Baju terdekat" -> { label, f } ; nama tempat biasa (mis. "Zara") -> null */
function matchCategory(q) {
  const t = nrm(q).replace(/\b(terdekat|dekat sini|di sekitar sini|sekitar)\b/g, " ").replace(/\s+/g, " ").trim();
  const c = CATEGORIES.find(([re]) => re.test(t));
  return c ? { label: c[1], f: c[2] } : null;
}
