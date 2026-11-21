'use strict';
/*
 * iOS 27 Launcher account server.
 * Zero dependencies (Node 18+). Stores launcher IDs, salted password hashes and synced launcher settings.
 *
 *   PORT        port to listen on                      (default 8080)
 *   DATA_DIR    folder for db.json - put it on a disk that survives restarts  (default ./data)
 *   TRUST_PROXY set to 1 ONLY when running behind an HTTPS proxy that sets X-Forwarded-For
 *   MAX_USERS   safety cap on accounts                 (default 10000)
 */
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '8080', 10);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const MAX_USERS = parseInt(process.env.MAX_USERS || '10000', 10);
const DB_FILE = path.join(DATA_DIR, 'db.json');
const MAX_BODY = 100 * 1024;
const MAX_SETTINGS = 64 * 1024;
const TOKEN_TTL = 90 * 24 * 3600 * 1000;
const ID_RE = /^[a-z0-9_.]{3,24}$/;

fs.mkdirSync(DATA_DIR, { recursive: true });

// Maps (not plain objects) so an ID like "__proto__" can never touch Object.prototype.
let users = new Map();
let tokens = new Map();
try {
  const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  users = new Map(Object.entries(raw.users || {}));
  tokens = new Map(Object.entries(raw.tokens || {}));
} catch (e) {
  if (e.code !== 'ENOENT') { console.error('Could not read database:', e.message); process.exit(1); }
}

let writing = false, dirty = false;
function save() { dirty = true; if (!writing) flush(); }
function flush() {
  writing = true; dirty = false;
  const tmp = DB_FILE + '.tmp';
  const data = JSON.stringify({ users: Object.fromEntries(users), tokens: Object.fromEntries(tokens) });
  fs.writeFile(tmp, data, { mode: 0o600 }, (err) => {
    if (err) { console.error('save failed:', err.message); writing = false; return; }
    fs.rename(tmp, DB_FILE, (err2) => {
      if (err2) console.error('save failed:', err2.message);
      writing = false;
      if (dirty) flush();
    });
  });
}
function flushSync() { try { fs.writeFileSync(DB_FILE, JSON.stringify({ users: Object.fromEntries(users), tokens: Object.fromEntries(tokens) }), { mode: 0o600 }); } catch (e) { console.error(e.message); } }

// ---- rate limiting ----
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  let h = hits.get(key);
  if (!h || h.reset < now) { h = { n: 0, reset: now + windowMs }; hits.set(key, h); }
  h.n++;
  return h.n > max;
}
const fails = new Map(); // per-account lockout
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  for (const [k, v] of fails) if (v.until < now && v.n === 0) fails.delete(k);
  let changed = false;
  for (const [k, v] of tokens) if (v.exp < now) { tokens.delete(k); changed = true; }
  if (changed) save();
}, 60 * 1000).unref();

// ---- helpers ----
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
function kdf(password, saltHex) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? reject(e) : resolve(k)));
  });
}
const DUMMY_SALT = crypto.randomBytes(16).toString('hex');
async function passwordOk(user, password) {
  // Always do the same amount of work, so timing doesn't reveal whether an ID exists.
  const derived = await kdf(password, user ? user.salt : DUMMY_SALT);
  if (!user) return false;
  const want = Buffer.from(user.hash, 'hex');
  return want.length === derived.length && crypto.timingSafeEqual(want, derived);
}
function clientIp(req) {
  if (TRUST_PROXY) {
    const x = req.headers['x-forwarded-for'];
    if (x) return String(x).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}
function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Strict-Transport-Security': 'max-age=15552000',
    ...(status === 413 ? { Connection: 'close' } : {})
  });
  res.end(body);
  if (status === 413) res.on('finish', () => { if (res.socket) res.socket.end(); });
}
const fail = (status, message) => Object.assign(new Error(message), { status });

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0, over = false;
    const chunks = [];
    req.on('data', (c) => {
      if (over) return;                       // keep draining, but store nothing
      size += c.length;
      if (size > MAX_BODY) { over = true; chunks.length = 0; reject(fail(413, 'Request too large')); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('shape');
        resolve(v);
      } catch (e) { reject(fail(400, 'Bad JSON')); }
    });
    req.on('error', () => reject(fail(400, 'Bad request')));
  });
}

function issueToken(id) {
  const t = crypto.randomBytes(32).toString('base64url');
  tokens.set(sha(t), { id, exp: Date.now() + TOKEN_TTL });
  const mine = [...tokens.entries()].filter(([, v]) => v.id === id).sort((a, b) => a[1].exp - b[1].exp);
  while (mine.length > 10) tokens.delete(mine.shift()[0]); // keep the 10 newest sign-ins
  return t;
}
function authed(req) {
  const m = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(req.headers['authorization'] || '');
  if (!m) throw fail(401, 'Please sign in');
  const key = sha(m[1]);
  const t = tokens.get(key);
  if (!t || t.exp < Date.now() || !users.has(t.id)) throw fail(401, 'Please sign in again');
  return { id: t.id, user: users.get(t.id), key };
}
function validId(v) { return typeof v === 'string' && ID_RE.test(v.trim().toLowerCase()); }
function validPw(v) { return typeof v === 'string' && v.length >= 8 && v.length <= 128; }
function dropTokens(id, exceptKey) {
  for (const [k, v] of tokens) if (v.id === id && k !== exceptKey) tokens.delete(k);
}

// ---- routes ----
async function route(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const ip = clientIp(req);

  if (req.method === 'GET' && p === '/health') return send(res, 200, { ok: true });

  if (req.method === 'POST' && p === '/api/register') {
    if (limited('reg:' + ip, 10, 3600 * 1000)) throw fail(429, 'Too many sign-ups from here, try later');
    const b = await readBody(req);
    if (!validId(b.id)) throw fail(400, 'ID must be 3-24 letters, numbers, dot or underscore');
    if (!validPw(b.password)) throw fail(400, 'Password must be 8-128 characters');
    const id = b.id.trim().toLowerCase();
    if (users.has(id)) throw fail(409, 'That ID is taken');
    if (users.size >= MAX_USERS) throw fail(503, 'This server is full');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = (await kdf(b.password, salt)).toString('hex');
    if (users.has(id)) throw fail(409, 'That ID is taken'); // re-check after the slow hash
    users.set(id, { salt, hash, createdAt: Date.now(), settings: null, updatedAt: 0 });
    const token = issueToken(id);
    save();
    return send(res, 201, { id, token });
  }

  if (req.method === 'POST' && p === '/api/login') {
    if (limited('auth:' + ip, 30, 15 * 60 * 1000)) throw fail(429, 'Too many attempts, try again in a few minutes');
    const b = await readBody(req);
    if (typeof b.id !== 'string' || typeof b.password !== 'string' || b.password.length > 128) throw fail(400, 'Enter your ID and password');
    const id = b.id.trim().toLowerCase();
    const f = fails.get(id) || { n: 0, until: 0 };
    if (f.until > Date.now()) throw fail(429, 'Too many wrong passwords. Try again in 15 minutes');
    const user = users.get(id);
    const ok = await passwordOk(user, b.password);
    if (!ok) {
      f.n++;
      if (f.n >= 8) { f.n = 0; f.until = Date.now() + 15 * 60 * 1000; }
      fails.set(id, f);
      throw fail(401, 'Wrong ID or password');
    }
    fails.delete(id);
    const token = issueToken(id);
    save();
    return send(res, 200, { id, token });
  }

  // everything below needs a signed-in session
  if (p.startsWith('/api/')) {
    const a = authed(req);
    if (limited('api:' + a.id, 300, 60 * 1000)) throw fail(429, 'Slow down');

    if (req.method === 'GET' && p === '/api/me') return send(res, 200, { id: a.id, createdAt: a.user.createdAt });

    if (req.method === 'GET' && p === '/api/settings') return send(res, 200, { settings: a.user.settings, updatedAt: a.user.updatedAt });

    if (req.method === 'PUT' && p === '/api/settings') {
      const b = await readBody(req);
      const s = b.settings;
      if (!s || typeof s !== 'object' || Array.isArray(s)) throw fail(400, 'settings must be an object');
      const text = JSON.stringify(s);
      if (text.length > MAX_SETTINGS) throw fail(413, 'Settings too large');
      a.user.settings = JSON.parse(text);
      a.user.updatedAt = Date.now();
      save();
      return send(res, 200, { updatedAt: a.user.updatedAt });
    }

    if (req.method === 'POST' && p === '/api/logout') {
      tokens.delete(a.key); save();
      return send(res, 200, { ok: true });
    }

    if (req.method === 'POST' && p === '/api/password') {
      const b = await readBody(req);
      if (!validPw(b.newPassword)) throw fail(400, 'New password must be 8-128 characters');
      if (typeof b.oldPassword !== 'string' || !(await passwordOk(a.user, b.oldPassword))) throw fail(403, 'Old password is wrong');
      a.user.salt = crypto.randomBytes(16).toString('hex');
      a.user.hash = (await kdf(b.newPassword, a.user.salt)).toString('hex');
      dropTokens(a.id, a.key); // sign out every other device
      save();
      return send(res, 200, { ok: true });
    }

    if (req.method === 'POST' && p === '/api/account/delete') {
      const b = await readBody(req);
      if (typeof b.password !== 'string' || !(await passwordOk(a.user, b.password))) throw fail(403, 'Password is wrong');
      users.delete(a.id);
      dropTokens(a.id, null);
      save();
      return send(res, 200, { ok: true });
    }
  }

  throw fail(404, 'Not found');
}

const server = http.createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (e) {
    if (e && e.status) return send(res, e.status, { error: e.message });
    console.error(e);
    send(res, 500, { error: 'Server error' });
  }
});
server.requestTimeout = 20000;
server.headersTimeout = 10000;
server.listen(PORT, () => console.log('iOS 27 Launcher server listening on :' + PORT + ' (data: ' + DATA_DIR + ')'));

for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { flushSync(); process.exit(0); });
