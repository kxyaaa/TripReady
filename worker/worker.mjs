/* Cloudflare Worker: penjadwal Web Push untuk TripReady (tanpa dependensi).
   Menyimpan jadwal di KV (binding REMINDERS) dan, via cron, mengirim push KOSONG bertanda tangan VAPID
   saat waktunya tiba. Teks notifikasi ditentukan oleh sw.js, jadi tidak perlu enkripsi payload. */
const enc = new TextEncoder();
const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function idOf(endpoint) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(endpoint));
  return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function vapidAuth(endpoint, env) {
  const head = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT })));
  const key = await crypto.subtle.importKey("jwk", JSON.parse(env.VAPID_PRIVATE_JWK), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${head}.${claims}`));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${env.VAPID_PUBLIC}`;
}

async function sendDue(env) {
  const now = Date.now();
  const { keys } = await env.REMINDERS.list({ prefix: "r:" });
  for (const { name } of keys) {
    const at = Number(name.slice(2, 17));
    if (at > now) break; // kunci terurut menurut waktu
    const endpoint = await env.REMINDERS.get(name);
    await env.REMINDERS.delete(name);
    await env.REMINDERS.delete("e:" + name.slice(18));
    if (!endpoint || now - at > 30 * 60000) continue; // terlalu basi: buang saja
    try {
      const r = await fetch(endpoint, { method: "POST", headers: { Authorization: await vapidAuth(endpoint, env), TTL: "3600", Urgency: "high" } });
      console.log("push", r.status, (await r.text()).slice(0, 200));
    } catch (e) { console.log("push gagal", String(e)); }
  }
}

export default {
  async fetch(req, env) {
    const cors = { "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
    const reply = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return reply({ ok: true, service: "tripready-push" });
    if (req.headers.get("Origin") !== env.ALLOWED_ORIGIN) return reply({ error: "origin ditolak" }, 403);
    let body;
    try { const t = await req.text(); if (t.length > 4000) throw 0; body = JSON.parse(t); } catch { return reply({ error: "body tidak valid" }, 400); }
    const path = new URL(req.url).pathname;

    if (path === "/subscribe") {
      const endpoint = body?.subscription?.endpoint, at = Math.floor(Number(body?.fireAt));
      const okTime = at > Date.now() - 60000 && at < Date.now() + 17 * 86400000;
      if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || !okTime) return reply({ error: "data tidak valid" }, 400);
      const id = await idOf(endpoint), old = await env.REMINDERS.get("e:" + id);
      if (old) await env.REMINDERS.delete(old); // satu langganan = satu jadwal aktif
      const key = `r:${String(at).padStart(15, "0")}:${id}`, ttl = { expirationTtl: 18 * 86400 };
      await env.REMINDERS.put(key, endpoint, ttl);
      await env.REMINDERS.put("e:" + id, key, ttl);
      return reply({ ok: true });
    }
    if (path === "/unsubscribe") {
      if (typeof body?.endpoint !== "string") return reply({ error: "data tidak valid" }, 400);
      const id = await idOf(body.endpoint), key = await env.REMINDERS.get("e:" + id);
      if (key) await env.REMINDERS.delete(key);
      await env.REMINDERS.delete("e:" + id);
      return reply({ ok: true });
    }
    if (path === "/test") { // diagnosa: kirim push sekarang ke langganan ini dan tampilkan balasan layanan push
      const endpoint = body?.subscription?.endpoint;
      if (typeof endpoint !== "string" || !endpoint.startsWith("https://")) return reply({ error: "data tidak valid" }, 400);
      try {
        const r = await fetch(endpoint, { method: "POST", headers: { Authorization: await vapidAuth(endpoint, env), TTL: "60", Urgency: "high" } });
        return reply({ status: r.status, body: (await r.text()).slice(0, 300) });
      } catch (e) { return reply({ error: String(e) }, 500); }
    }
    return reply({ error: "tidak ditemukan" }, 404);
  },
  async scheduled(_event, env, ctx) { ctx.waitUntil(sendDue(env)); },
};