// Smoke test tanpa dependensi: node tests/smoke.test.js
const fs = require("fs"), vm = require("vm"), path = require("path"), assert = require("assert");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script src="(js\/[^"]+)"/g)].map((m) => m[1]);
assert(scripts.length > 0, "tidak ada skrip js/ di index.html");
const dom = () => new Proxy(function () {}, {
  get: (t, k) => k === "then" ? undefined : k === Symbol.toPrimitive ? () => "" : k === "classList" ? { add() {}, remove() {}, toggle() {}, contains: () => false }
    : k === "style" || k === "dataset" ? {} : ["value", "textContent", "innerHTML"].includes(k) ? "" : dom(),
  apply: () => dom(), set: () => true });
const ctx = { document: { getElementById: () => dom(), querySelectorAll: () => [], addEventListener() {}, createElement: () => dom(), body: dom() },
  location: { hash: "" }, navigator: {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, Notification: { permission: "default" },
  AbortController, URL, setInterval: () => 0, setTimeout: () => 0, clearTimeout() {}, addEventListener() {}, scrollTo() {}, console };
ctx.window = ctx; vm.createContext(ctx);
for (const s of scripts) vm.runInContext(fs.readFileSync(path.join(root, s), "utf8"), ctx, { filename: s });
const ev = (code) => vm.runInContext(code, ctx);
assert.strictEqual(ev('esc("<b>")'), "&lt;b&gt;");
assert.strictEqual(ev('minToStr(1500)'), "01:00");
assert.ok(Math.abs(ev('haversine([0,0],[0,1])') - 111.19) < 0.5);
assert.strictEqual(ev('parseOpening("Mo-Fr 08:00-17:00").isOpen(1, 600)'), true);
assert.strictEqual(ev('parseOpening("Mo-Fr 08:00-17:00").isOpen(0, 600)'), false);
assert.strictEqual(ev('parseOpening("24/7").isOpen(3, 30)'), true);
assert.strictEqual(ev('sevOf(95)'), 4);
(async () => {
  const place = '({ lat: "3.5", lon: "98.6", name: "Apotek X", type: "pharmacy", category: "amenity", display_name: "Apotek X, Medan", extratags: {}, osmRef: { type: "node", id: 1 } })';
  ctx.fetch = async () => new Response(JSON.stringify({ elements: [] }), { status: 200 });
  const ok = await ev(`fetchHours(${place})`);
  ctx.fetch = async () => { throw new Error("jaringan"); };
  const gagal = await ev(`fetchHours(${place})`);
  assert.strictEqual(ok?.tag, "08:00-21:00");
  assert.strictEqual(gagal?.tag, ok?.tag, "server Overpass sibuk atau tidak, hasil jam buka harus sama");
  console.log(`OK: ${scripts.length} skrip termuat berurutan, 9 pengecekan lolos.`);
})().catch((e) => { console.error(e); process.exit(1); });
