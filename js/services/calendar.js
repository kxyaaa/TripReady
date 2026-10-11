"use strict";
/* Service: ekspor .ics dan Google Calendar */
/* ---------- Kalender (.ics & Google Calendar) ---------- */
function downloadICS(lead = 30) {
  const c = S.cal; if (!c) { toast("Buat rencana dulu."); return; }
  const clean = (s) => String(s).replace(/[,;]/g, " ");
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TripReady//ID", "BEGIN:VEVENT", `UID:${Date.now()}@tripready`, `DTSTAMP:${c.stamp(new Date())}`,
    `DTSTART:${c.start}`, `DTEND:${c.end}`, `SUMMARY:${clean(c.title)}`, `LOCATION:${clean(c.loc)}`, `DESCRIPTION:${clean(c.note)}`,
    "BEGIN:VALARM", `TRIGGER:-PT${lead}M`, "ACTION:DISPLAY", "DESCRIPTION:Waktunya bersiap", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" })); a.download = "perjalanan-tripready.ics";
  document.body.appendChild(a); a.click(); a.remove();
  toast("Buka file .ics-nya lalu simpan ke kalender.");
}

function setupCalendar(C, A, dest) {
  const startD = new Date(C.depTs);
  const endD = new Date(startD.getTime() + (A.eta + DUR[C.act]) * 60000);
  const stamp = (d) => d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const title = `Berangkat ke ${shortName(dest)} (${ACT_NAME[C.act]})`;
  const note = `Rencana dari TripReady. ${A.reasons.length ? "Catatan: " + A.reasons.join(", ") + "." : "Prakiraan cuaca mendukung."}`;
  S.cal = { stamp, start: stamp(startD), end: stamp(endD), title, note, loc: dest.display_name };
  $("icsBtn").onclick = () => downloadICS(30);
  $("gcalBtn").href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${stamp(startD)}/${stamp(endD)}&details=${encodeURIComponent(note)}&location=${encodeURIComponent(dest.display_name)}`;
}

