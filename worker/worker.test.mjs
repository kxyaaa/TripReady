// Uji lokal Worker dengan KV tiruan: node worker/worker.test.mjs
import assert from "node:assert";
import worker from "./worker.mjs";
const b64u = (b) => Buffer.from(b).toString("base64url");
const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const store = new Map();
const kv = { get: async (k) => store.get(k) ?? null, put: async (k, v) => void store.set(k, v), delete: async (k) => void store.delete(k),
  list: async ({ prefix }) => ({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).sort().map((name) => ({ name })) }) };
const O = "https://kxyaaa.github.io";
const env = { REMINDERS: kv, ALLOWED_ORIGIN: O, VAPID_SUBJECT: "mailto:a@b.c", VAPID_PUBLIC: b64u(await crypto.subtle.exportKey("raw", kp.publicKey)),
  VAPID_PRIVATE_JWK: JSON.stringify(await crypto.subtle.exportKey("jwk", kp.privateKey)) };
const post = (path, body, origin = O) => worker.fetch(new Request("https://w.dev" + path, { method: "POST", headers: { Origin: origin }, body: JSON.stringify(body) }), env);
const sub = (ep) => ({ endpoint: ep });

assert.strictEqual((await post("/subscribe", { subscription: sub("https://push.example/a"), fireAt: Date.now() + 1e6 }, "https://evil.com")).status, 403);
assert.strictEqual((await post("/subscribe", { subscription: sub("http://x"), fireAt: Date.now() + 1e6 })).status, 400);
assert.strictEqual((await post("/subscribe", { subscription: sub("https://push.example/a"), fireAt: 5 })).status, 400);
assert.strictEqual((await post("/subscribe", { subscription: sub("https://push.example/a"), fireAt: Date.now() + 1e6 })).status, 200);
assert.strictEqual((await post("/subscribe", { subscription: sub("https://push.example/a"), fireAt: Date.now() + 2e6 })).status, 200);
assert.strictEqual([...store.keys()].filter((k) => k.startsWith("r:")).length, 1, "jadwal lama harus diganti");
await post("/unsubscribe", { endpoint: "https://push.example/a" });
assert.strictEqual(store.size, 0, "unsubscribe harus membersihkan KV");

await post("/subscribe", { subscription: sub("https://push.example/due"), fireAt: Date.now() - 1000 });
await post("/subscribe", { subscription: sub("https://push.example/later"), fireAt: Date.now() + 3600e3 });
const calls = []; globalThis.fetch = async (url, init) => { calls.push({ url, init }); return new Response(null, { status: 201 }); };
await worker.scheduled({}, env, { waitUntil: (p) => p.then?.(() => { }) ?? p }).then?.(() => { });
await new Promise((r) => setTimeout(r, 200));
assert.strictEqual(calls.length, 1, "hanya yang jatuh tempo yang dikirim");
assert.strictEqual(calls[0].url, "https://push.example/due");
const m = calls[0].init.headers.Authorization.match(/^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=(.+)$/);
assert.ok(m, "format header VAPID");
const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, kp.publicKey, Buffer.from(m[3], "base64url"), new TextEncoder().encode(`${m[1]}.${m[2]}`));
assert.ok(ok, "tanda tangan JWT harus valid");
assert.strictEqual(JSON.parse(Buffer.from(m[2], "base64url")).aud, "https://push.example");
assert.strictEqual([...store.keys()].filter((k) => k.startsWith("r:")).length, 1, "yang belum jatuh tempo tetap tersimpan");
console.log("OK: Worker lolos 9 pengecekan (CORS, validasi, ganti jadwal, hapus, kirim tepat waktu, tanda tangan VAPID).");
