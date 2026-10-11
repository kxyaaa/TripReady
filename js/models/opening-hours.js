"use strict";
/* Model: parser jam operasional OpenStreetMap */
/* ---------- Jam operasional (parser sederhana) ---------- */
const ORD = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
function parseDays(s) {
  s = s.replace(/\s/g, "");
  if (!s) return new Set([0, 1, 2, 3, 4, 5, 6]);
  const out = new Set(); let onlyPH = true;
  for (const part of s.split(",")) {
    if (/^(PH|SH)$/i.test(part)) continue;
    onlyPH = false;
    const m = part.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/);
    if (!m) return null;
    let a = ORD.indexOf(m[1]); const b = m[2] ? ORD.indexOf(m[2]) : a;
    for (let guard = 0; guard < 8; guard++) { out.add((a + 1) % 7); if (a === b) break; a = (a + 1) % 7; }
  }
  return onlyPH ? "PH" : out;
}
function parseOpening(str) {
  const s = String(str || "").trim();
  if (!s) return null;
  if (/^24\/7$/i.test(s)) return { isOpen: () => true, text: () => "24 jam" };
  const rules = [];
  for (let raw of s.split(";")) {
    raw = raw.trim(); if (!raw) continue;
    const m = raw.match(/^([A-Za-z,\- ]*?)\s*(off|closed|\d{1,2}:\d{2}.*)$/i);
    if (!m) return null;
    const days = parseDays(m[1]);
    if (days === null) return null;
    if (days === "PH") continue;
    let ivs = [];
    if (!/^(off|closed)$/i.test(m[2].trim())) {
      for (const seg of m[2].split(",")) {
        const t = seg.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
        if (!t) return null;
        const a = +t[1] * 60 + +t[2]; let b = +t[3] * 60 + +t[4];
        if (b <= a) b += 1440;
        ivs.push([a, b]);
      }
    }
    rules.push({ days, ivs });
  }
  if (!rules.length) return null;
  const curOf = (day) => { let c = null; for (const r of rules) if (r.days.has(day)) c = r.ivs; return c; };
  return {
    isOpen: (day, min) => {
      let prev = null; for (const r of rules) if (r.days.has((day + 6) % 7)) prev = r.ivs;
      const cur = curOf(day);
      let open = !!cur && cur.some(([a, b]) => min >= a && min < b);
      if (prev && prev.some(([a, b]) => b > 1440 && min + 1440 >= a && min + 1440 < b)) open = true;
      return open;
    },
    text: (day) => { const c = curOf(day); return c && c.length ? c.map(([a, b]) => `${fmtT(minToStr(a))}–${fmtT(minToStr(b))}`).join(", ") : "Tutup"; }
  };
}

