// Stealth X — website + key system + stats. Tanpa dependency, Node >= 18.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const BASE_URL = (process.env.BASE_URL || "").replace(/\/$/, "");
const ROOT = __dirname;
const SITE = path.join(ROOT, "site");
const DAY = 864e5;

// ───────────────────────── data ─────────────────────────
const DB_FILE = path.join(ROOT, "data", "db.json");
let db = { keys: {}, ips: {}, events: [], online: {} };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")) }; } catch {}
let dirty = false;
const save = () => { dirty = true; };
function flush() {
  if (!dirty) return;
  dirty = false;
  if (db.events.length > 100000) db.events = db.events.slice(-100000);
  fs.writeFileSync(DB_FILE + ".tmp", JSON.stringify(db));
  fs.renameSync(DB_FILE + ".tmp", DB_FILE);
}
setInterval(flush, 5000).unref();
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => { flush(); process.exit(0); });

const games = () => JSON.parse(fs.readFileSync(path.join(ROOT, "data", "games.json"), "utf8"));
const byPlace = (p) => games().find((g) => String(g.place_id) === String(p));
const byName = (n) => games().find((g) => g.name === n);

// ───────────────────────── auth ─────────────────────────
function check(key, hwid) {
  const k = db.keys[key];
  if (!k) return { ok: false, code: "KEY_INVALID", status: 404 };
  if (k.blacklisted) return { ok: false, code: "KEY_BLACKLISTED", status: 403 };
  if (k.expires && Date.now() > k.expires) return { ok: false, code: "KEY_EXPIRED", status: 403 };
  if (hwid) {
    if (!k.hwid) { k.hwid = hwid; save(); }
    else if (k.hwid !== hwid) return { ok: false, code: "KEY_HWID_LOCKED", status: 403 };
  }
  return { ok: true, code: "KEY_VALID", tier: k.tier, expires: k.expires, status: 200 };
}
const part = () => crypto.randomBytes(2).toString("hex").toUpperCase();
const newKey = () => `SX-${part()}-${part()}-${part()}`;

// ───────────────────────── helpers ─────────────────────────
const json = (res, code, obj) => {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(obj));
};
const ip = (req) => (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
const day = (t) => new Date(t).toISOString().slice(0, 10);
const readBody = (req) => new Promise((ok, no) => {
  let b = ""; req.on("data", (c) => { b += c; if (b.length > 1e5) { no(new Error("too large")); req.destroy(); } });
  req.on("end", () => { try { ok(b ? JSON.parse(b) : {}); } catch { ok({}); } });
});

const cache = new Map();
async function robloxImage(place, kind) {
  const ck = kind + place;
  if (cache.has(ck)) return cache.get(ck);
  let url = null;
  try {
    const u = await (await fetch(`https://apis.roblox.com/universes/v1/places/${place}/universe`)).json();
    const api = kind === "icon"
      ? `https://thumbnails.roblox.com/v1/games/icons?universeIds=${u.universeId}&size=256x256&format=Png`
      : `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${u.universeId}&countPerUniverse=1&size=768x432&format=Webp`;
    const t = await (await fetch(api)).json();
    url = kind === "icon" ? t.data?.[0]?.imageUrl : t.data?.[0]?.thumbnails?.[0]?.imageUrl;
  } catch {}
  if (url) cache.set(ck, url);
  return url;
}

// ───────────────────────── API ─────────────────────────
async function api(req, res, u) {
  const q = u.searchParams;
  const p = u.pathname.replace(/^\/api/, "");

  if (p === "/health") return json(res, 200, { ok: true, supported_games: games().length });
  if (p === "/games") return json(res, 200, { games: games().map(({ name, place_id }) => ({ name, place_id })) });

  if (p === "/key" && req.method === "POST") {
    const who = ip(req);
    if (db.ips[who] && Date.now() - db.ips[who] < DAY)
      return json(res, 429, { ok: false, error: "Key gratis cuma bisa diambil sekali per 24 jam." });
    const key = newKey();
    db.keys[key] = { tier: "free", hwid: null, expires: Date.now() + DAY };
    db.ips[who] = Date.now(); save();
    return json(res, 200, { ok: true, key, expires: db.keys[key].expires });
  }

  if (p === "/validate") {
    const { status, ...body } = check(q.get("key") || "", q.get("hwid"));
    return json(res, status, body);
  }

  if (p === "/script") {
    const r = check(q.get("key") || "", q.get("hwid") || "");
    if (!r.ok) return json(res, r.status, { ok: false, code: r.code });
    const g = q.get("place") != null ? (byPlace(q.get("place")) || byPlace(0)) : { script: q.get("id") };
    const id = g && g.script;
    if (!id || !/^[a-z0-9_-]+$/i.test(id)) return json(res, 404, { ok: false, code: "SCRIPT_NOT_FOUND" });
    const file = path.join(ROOT, "scripts", id + ".lua");
    if (!fs.existsSync(file)) return json(res, 404, { ok: false, code: "SCRIPT_NOT_FOUND" });
    const src = fs.readFileSync(file, "utf8");
    if (src.startsWith("--@premium") && r.tier !== "premium") return json(res, 403, { ok: false, code: "PREMIUM_ONLY" });
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    return res.end(src);
  }

  if (p === "/track") {
    const hwid = q.get("hwid") || "";
    const r = check(q.get("key") || "", hwid);
    if (!r.ok) return json(res, r.status, { ok: false, code: r.code });
    const g = byPlace(q.get("place"));
    const name = (g ? g.name : q.get("name") || "Unknown").slice(0, 60);
    const exec = (q.get("exec") || "Unknown").slice(0, 40);
    const now = Date.now();
    if (!q.get("beat")) db.events.push([now, name, hwid, exec]);
    db.online[hwid] = [now, name, exec];
    for (const h in db.online) if (now - db.online[h][0] > 5 * 60e3) delete db.online[h];
    save();
    return json(res, 200, { ok: true });
  }

  // ── bentuk respons mengikuti frontend statistik ──
  if (p === "/stats") {
    const period = q.get("period") || "daily";
    const days = { daily: 1, weekly: 7, monthly: 30 }[period];
    const end = day(Date.now());
    const start = days ? day(Date.now() - (days - 1) * DAY) : null;
    const ev = days ? db.events.filter((e) => day(e[0]) >= start) : db.events;
    const c = {};
    for (const e of ev) c[e[1]] = (c[e[1]] || 0) + 1;
    const list = Object.entries(c).sort((a, b) => b[1] - a[1])
      .map(([name, launches]) => ({ name, launches, place_id: byName(name)?.place_id || null }));
    return json(res, 200, { period: days ? period : "total", start_date: start, end_date: end, total: ev.length, games: list });
  }

  if (p === "/game") {
    const name = q.get("name") || "";
    const days = Math.min(Math.max(parseInt(q.get("days")) || 30, 1), 365);
    const series = [];
    for (let i = days - 1; i >= 0; i--) series.push({ date: day(Date.now() - i * DAY), launches: 0 });
    const idx = Object.fromEntries(series.map((s, i) => [s.date, i]));
    let total = 0;
    for (const e of db.events) {
      if (e[1] !== name) continue;
      const i = idx[day(e[0])];
      if (i !== undefined) { series[i].launches++; total++; }
    }
    const pid = byName(name)?.place_id;
    return json(res, 200, { name, place_id: pid || null, days, start_date: series[0].date, end_date: series[series.length - 1].date, total, series });
  }

  if (p === "/online") {
    const now = Date.now(), g = {}, x = {};
    let total = 0;
    for (const [t, name, exec] of Object.values(db.online)) {
      if (now - t > 120e3) continue;
      total++; g[name] = (g[name] || 0) + 1; x[exec] = (x[exec] || 0) + 1;
    }
    const sort = (o, k, f) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([n, count]) => ({ [k]: n, count, ...f(n) }));
    return json(res, 200, { total, games: sort(g, "name", (n) => ({ place_id: byName(n)?.place_id || null })), executors: sort(x, "executor", () => ({})) });
  }

  const img = p.match(/^\/(icon|banner)\/(.+)\.(png|webp)$/);
  if (img) {
    const g = byName(decodeURIComponent(img[2]));
    const url = g && g.place_id && (await robloxImage(g.place_id, img[1]));
    if (!url) { res.writeHead(404); return res.end(); }
    res.writeHead(302, { location: url, "cache-control": "public, max-age=3600" });
    return res.end();
  }

  if (p === "/admin" && req.method === "POST") {
    if (!ADMIN_TOKEN || req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) return json(res, 401, { ok: false, error: "unauthorized" });
    const b = await readBody(req);
    if (b.action === "create") {
      const keys = [];
      for (let i = 0; i < Math.min(b.count || 1, 100); i++) {
        const key = newKey();
        db.keys[key] = { tier: b.tier || "premium", hwid: null, expires: b.days ? Date.now() + b.days * DAY : null };
        keys.push(key);
      }
      save(); return json(res, 200, { ok: true, keys });
    }
    const k = db.keys[b.key];
    if (!k) return json(res, 404, { ok: false, error: "key tidak ada" });
    if (b.action === "reset_hwid") k.hwid = null;
    else if (b.action === "blacklist") k.blacklisted = true;
    else if (b.action === "unblacklist") k.blacklisted = false;
    else if (b.action === "delete") delete db.keys[b.key];
    else return json(res, 400, { ok: false, error: "action tidak dikenal" });
    save(); return json(res, 200, { ok: true });
  }

  return json(res, 404, { ok: false, error: "not found" });
}

// ───────────────────────── static ─────────────────────────
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json", ".txt": "text/plain; charset=utf-8" };

function serveFile(res, file, headers = {}) {
  let type = TYPES[path.extname(file)];
  if (!type) type = "text/html; charset=utf-8"; // halaman tanpa ekstensi (terms, privacy, docs/...) = HTML
  const long = file.includes(`${path.sep}_next${path.sep}`) || file.includes(`${path.sep}assets${path.sep}fonts`);
  res.writeHead(200, {
    "content-type": type,
    "cache-control": long ? "public, max-age=31536000, immutable" : "no-cache",
    "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin", ...headers,
  });
  fs.createReadStream(file).pipe(res);
}

function resolveStatic(pathname) {
  let rel = decodeURIComponent(pathname).replace(/\/+$/, "") || "/index";
  const base = path.normalize(path.join(SITE, rel));
  if (!base.startsWith(SITE)) return null;
  for (const c of [base, base + ".html", path.join(base, "index.html")]) {
    try { if (fs.statSync(c).isFile()) return c; } catch {}
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, "http://x");
    if (u.pathname.startsWith("/api/")) return await api(req, res, u);

    if (u.pathname === "/sdk.lua" || u.pathname === "/loader.lua") {
      let src = fs.readFileSync(path.join(ROOT, "lua", u.pathname.slice(1)), "utf8");
      if (BASE_URL) src = src.replaceAll("https://stealth-x.com", BASE_URL);
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache" });
      return res.end(src);
    }

    const file = resolveStatic(u.pathname);
    if (file) return serveFile(res, file);
    const nf = path.join(SITE, "404.html");
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    fs.existsSync(nf) ? fs.createReadStream(nf).pipe(res) : res.end("Not found");
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { ok: false, error: "server error" });
  }
});
server.listen(PORT, () => console.log(`Stealth X jalan di http://localhost:${PORT}`));
