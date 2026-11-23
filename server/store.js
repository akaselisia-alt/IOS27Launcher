'use strict';
/*
 * App store module: developers upload APKs, an admin reviews them, people browse / download / buy.
 *
 *   ADMIN_IDS            comma separated launcher IDs allowed to review apps and pay developers   (REQUIRED to publish anything)
 *   PUBLIC_URL           https address of this server (used for payment redirects)
 *   PAYMENT_PROVIDER     none (default, free apps only) | paystack | flutterwave | mock (testing only)
 *   PAYSTACK_SECRET      sk_live_... / sk_test_...
 *   FLW_SECRET           Flutterwave secret key         FLW_WEBHOOK_HASH  the "secret hash" you set in the Flutterwave dashboard
 *   CURRENCY             currency of all prices (default GHS)
 *   PLATFORM_FEE_PERCENT your cut of every sale (default 30)
 *   MAX_APK_MB           largest APK accepted (default 150)
 *   AUTO_APPROVE         1 = skip review (testing only, never in production)
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pipeline, Transform } = require('stream');

const CATEGORIES = ['Games', 'Social', 'Tools', 'Media', 'Productivity', 'Education', 'Finance', 'Lifestyle', 'Other'];
const RESERVED_PKG = /^(android|com\.android\.|com\.google\.|com\.samsung\.|com\.ios27\.|com\.apple\.|com\.whatsapp|com\.facebook\.|com\.instagram\.)/i;
const PKG_RE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;

module.exports = function createStore(ctx) {
  const { extra, save, authed, readBody, send, fail, limited, DATA_DIR, clientIp, users } = ctx;
  const env = process.env;
  const ADMINS = new Set((env.ADMIN_IDS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
  const PROVIDER = (env.PAYMENT_PROVIDER || 'none').toLowerCase();
  const CURRENCY = (env.CURRENCY || 'GHS').toUpperCase();
  const FEE = Math.min(95, Math.max(0, parseFloat(env.PLATFORM_FEE_PERCENT || '30')));
  const MAX_APK = Math.max(1, parseInt(env.MAX_APK_MB || '150', 10)) * 1024 * 1024;
  const MAX_ICON = 400 * 1024;
  const AUTO = env.AUTO_APPROVE === '1';
  const PUBLIC_URL = (env.PUBLIC_URL || '').replace(/\/$/, '');
  const EMAIL_DOMAIN = env.PAYMENT_EMAIL_DOMAIN || 'launcher-user.example.com';

  extra.apps = extra.apps || {};        // id -> app
  extra.purchases = extra.purchases || {}; // ref -> purchase
  extra.ledger = extra.ledger || [];    // sales
  extra.payouts = extra.payouts || [];  // money paid out to developers
  extra.reports = extra.reports || [];
  extra.reviews = extra.reviews || {};  // appId -> { userId: {rating,text,at} }
  extra.got = extra.got || {};          // "user:app" -> 1 (downloaded or bought)
  extra.payinfo = extra.payinfo || {};  // dev -> {method, details}

  const APK_DIR = path.join(DATA_DIR, 'apks'), ICON_DIR = path.join(DATA_DIR, 'icons'), TMP_DIR = path.join(DATA_DIR, 'tmp');
  [APK_DIR, ICON_DIR, TMP_DIR].forEach((d) => fs.mkdirSync(d, { recursive: true }));
  try { fs.readdirSync(TMP_DIR).forEach((f) => fs.unlinkSync(path.join(TMP_DIR, f))); } catch (e) {}

  const rid = () => crypto.randomBytes(8).toString('hex');
  const isAdmin = (id) => ADMINS.has(id);
  const zeroDec = (c) => ['XOF', 'XAF', 'RWF', 'UGX', 'GNF'].includes(c);
  const major = (minor) => (zeroDec(CURRENCY) ? minor : minor / 100);
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

  const latestApproved = (a) => { for (let i = a.versions.length - 1; i >= 0; i--) if (a.versions[i].status === 'approved') return a.versions[i]; return null; };
  function pub(a, full) {
    const v = latestApproved(a);
    const o = {
      id: a.id, name: a.name, pkg: a.pkg, category: a.category, priceMinor: a.priceMinor, currency: CURRENCY, developer: a.owner,
      icon: !!a.icon, downloads: a.downloads, rating: a.ratingCount ? Math.round(a.ratingSum / a.ratingCount * 10) / 10 : 0, ratings: a.ratingCount,
      version: v ? v.name : '', size: v ? v.size : 0, sha256: v ? v.sha256 : '', updatedAt: v ? v.at : a.createdAt
    };
    if (full) o.description = a.desc;
    return o;
  }
  function visible(a) { return a.status === 'approved' && !!latestApproved(a); }
  function owns(a, id) { return a.owner === id; }
  function bought(user, a) { return a.priceMinor === 0 || owns(a, user) || isAdmin(user) || Object.values(extra.purchases).some((p) => p.user === user && p.app === a.id && p.status === 'paid'); }
  function optAuth(req) { try { return authed(req).id; } catch (e) { return ''; } }
  function needAdmin(req) { const a = authed(req); if (!isAdmin(a.id)) throw fail(403, 'Admins only'); return a; }
  function getApp(id) { const a = extra.apps[id]; if (!a || !/^[0-9a-f]{16}$/.test(id)) throw fail(404, 'App not found'); return a; }

  /* ---------- file handling ---------- */
  function receive(req, max, magicOk) {
    return new Promise((resolve, reject) => {
      const tmp = path.join(TMP_DIR, rid() + '.part');
      const hash = crypto.createHash('sha256');
      let size = 0, head = Buffer.alloc(0), over = false;
      const counter = new Transform({
        transform(chunk, _e, cb) {
          size += chunk.length;
          if (size > max) { over = true; return cb(new Error('too big')); }
          if (head.length < 16) head = Buffer.concat([head, chunk]).subarray(0, 16);
          hash.update(chunk); cb(null, chunk);
        }
      });
      pipeline(req, counter, fs.createWriteStream(tmp, { mode: 0o600 }), (err) => {
        if (err || !size) { fs.unlink(tmp, () => {}); return reject(fail(over ? 413 : 400, over ? 'File too large' : 'Upload failed')); }
        if (!magicOk(head)) { fs.unlink(tmp, () => {}); return reject(fail(400, 'Not a valid file')); }
        resolve({ tmp, size, sha256: hash.digest('hex') });
      });
    });
  }
  // lists the entry names of a zip (an APK is a zip) from its central directory
  function zipNames(file) {
    const fd = fs.openSync(file, 'r');
    try {
      const st = fs.fstatSync(fd), tailLen = Math.min(st.size, 70000), tail = Buffer.alloc(tailLen);
      fs.readSync(fd, tail, 0, tailLen, st.size - tailLen);
      let p = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
      if (p < 0) return null;
      const total = tail.readUInt16LE(p + 10), cdSize = tail.readUInt32LE(p + 12), cdOff = tail.readUInt32LE(p + 16);
      if (cdOff + cdSize > st.size || cdSize > 8 * 1024 * 1024) return null;
      const cd = Buffer.alloc(cdSize); fs.readSync(fd, cd, 0, cdSize, cdOff);
      const names = []; let o = 0;
      for (let i = 0; i < total && o + 46 <= cd.length; i++) {
        if (cd.readUInt32LE(o) !== 0x02014b50) return null;
        const n = cd.readUInt16LE(o + 28), m = cd.readUInt16LE(o + 30), k = cd.readUInt16LE(o + 32);
        names.push(cd.toString('utf8', o + 46, o + 46 + n)); o += 46 + n + m + k;
      }
      return names;
    } finally { fs.closeSync(fd); }
  }
  const unlinkQuiet = (f) => fs.unlink(f, () => {});

  /* ---------- payments ---------- */
  async function jfetch(url, opt) {
    const r = await fetch(url, Object.assign({ signal: AbortSignal.timeout(15000) }, opt));
    let j = {}; try { j = await r.json(); } catch (e) {}
    return { ok: r.ok, j };
  }
  async function providerInit(p, a) {
    const email = p.user + '@' + EMAIL_DOMAIN;
    if (PROVIDER === 'mock') return PUBLIC_URL + '/api/store/mock/pay?ref=' + p.ref;
    if (PROVIDER === 'paystack') {
      const r = await jfetch('https://api.paystack.co/transaction/initialize', { method: 'POST', headers: { Authorization: 'Bearer ' + env.PAYSTACK_SECRET, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, amount: p.amount, currency: CURRENCY, reference: p.ref, callback_url: PUBLIC_URL + '/api/store/pay/return', metadata: { app: a.id, user: p.user } }) });
      if (!r.ok || !r.j.data || !r.j.data.authorization_url) throw fail(502, 'Payment provider error');
      return r.j.data.authorization_url;
    }
    if (PROVIDER === 'flutterwave') {
      const r = await jfetch('https://api.flutterwave.com/v3/payments', { method: 'POST', headers: { Authorization: 'Bearer ' + env.FLW_SECRET, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tx_ref: p.ref, amount: major(p.amount), currency: CURRENCY, redirect_url: PUBLIC_URL + '/api/store/pay/return?ref=' + p.ref, customer: { email, name: p.user }, customizations: { title: a.name.slice(0, 40) } }) });
      if (!r.ok || !r.j.data || !r.j.data.link) throw fail(502, 'Payment provider error');
      return r.j.data.link;
    }
    throw fail(503, 'Payments are not enabled on this server');
  }
  async function providerVerified(p) {            // ask the provider (never trust the browser or the webhook body alone)
    if (PROVIDER === 'mock') return true;
    if (PROVIDER === 'paystack') {
      const r = await jfetch('https://api.paystack.co/transaction/verify/' + encodeURIComponent(p.ref), { headers: { Authorization: 'Bearer ' + env.PAYSTACK_SECRET } });
      const d = r.j.data || {};
      return r.ok && d.status === 'success' && d.amount === p.amount && String(d.currency).toUpperCase() === CURRENCY;
    }
    if (PROVIDER === 'flutterwave') {
      const r = await jfetch('https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=' + encodeURIComponent(p.ref), { headers: { Authorization: 'Bearer ' + env.FLW_SECRET } });
      const d = r.j.data || {};
      return r.ok && d.status === 'successful' && Number(d.amount) >= major(p.amount) && String(d.currency).toUpperCase() === CURRENCY;
    }
    return false;
  }
  async function fulfil(ref) {
    const p = extra.purchases[ref];
    if (!p) return false;
    if (p.status === 'paid') return true;
    if (p.status !== 'pending') return false;
    if (!(await providerVerified(p))) return false;
    if (p.status !== 'pending') return p.status === 'paid';
    p.status = 'paid'; p.paidAt = Date.now();
    const fee = Math.floor(p.amount * FEE / 100);
    extra.ledger.push({ id: rid(), ref, dev: p.dev, app: p.app, user: p.user, gross: p.amount, fee, net: p.amount - fee, at: p.paidAt, refunded: false });
    extra.got[p.user + ':' + p.app] = 1;
    save();
    return true;
  }
  function balanceOf(dev) {
    const earned = extra.ledger.filter((l) => l.dev === dev && !l.refunded).reduce((s, l) => s + l.net, 0);
    const paid = extra.payouts.filter((x) => x.dev === dev).reduce((s, x) => s + x.amount, 0);
    return { earned, paid, balance: earned - paid };
  }
  async function rawBody(req, max) {
    return new Promise((resolve, reject) => {
      const c = []; let n = 0;
      req.on('data', (d) => { n += d.length; if (n > max) { reject(fail(413, 'Too large')); req.destroy(); } else c.push(d); });
      req.on('end', () => resolve(Buffer.concat(c)));
      req.on('error', () => reject(fail(400, 'Bad request')));
    });
  }
  const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
  const page = (res, title, body) => {
    const h = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '</title><body style="font:17px system-ui;max-width:480px;margin:60px auto;padding:0 18px;text-align:center">' + body;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(h), 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" });
    res.end(h);
  };

  /* ---------- routes ---------- */
  return async function route(req, res, p, url) {
    const m = req.method;
    let mt;

    if (m === 'GET' && (p === '/developer' || p === '/admin')) {
      const f = path.join(__dirname, 'public', p.slice(1) + '.html');
      let body; try { body = fs.readFileSync(f); } catch (e) { throw fail(404, 'Not found'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': body.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:" });
      res.end(body); return true;
    }
    if (!p.startsWith('/api/store') && !p.startsWith('/api/admin')) return false;

    if (m === 'GET' && p === '/api/store/config') return send(res, 200, { categories: CATEGORIES, currency: CURRENCY, payments: PROVIDER !== 'none', feePercent: FEE, maxApkMB: Math.round(MAX_APK / 1048576) }), true;

    /* ----- browse ----- */
    if (m === 'GET' && p === '/api/store/apps') {
      if (limited('browse:' + clientIp(req), 240, 60000)) throw fail(429, 'Slow down');
      const q = str(url.searchParams.get('q') || '', 60).toLowerCase(), cat = url.searchParams.get('category') || '', sort = url.searchParams.get('sort') || 'top';
      const page_ = Math.max(0, parseInt(url.searchParams.get('page') || '0', 10) || 0);
      let list = Object.values(extra.apps).filter(visible);
      if (cat && CATEGORIES.includes(cat)) list = list.filter((a) => a.category === cat);
      if (q) list = list.filter((a) => (a.name + ' ' + a.pkg + ' ' + a.desc).toLowerCase().includes(q));
      const score = { new: (a) => latestApproved(a).at, top: (a) => a.downloads, rating: (a) => (a.ratingCount ? a.ratingSum / a.ratingCount : 0) * 1000 + a.ratingCount };
      const f = score[sort] || score.top;
      list.sort((x, y) => f(y) - f(x));
      return send(res, 200, { apps: list.slice(page_ * 20, page_ * 20 + 20).map((a) => pub(a)), more: list.length > page_ * 20 + 20 }), true;
    }
    if (m === 'GET' && (mt = /^\/api\/store\/apps\/([0-9a-f]{16})$/.exec(p))) {
      const a = getApp(mt[1]), me = optAuth(req);
      if (!visible(a) && !(me && (owns(a, me) || isAdmin(me)))) throw fail(404, 'App not found');
      const rv = extra.reviews[a.id] || {};
      const reviews = Object.entries(rv).sort((x, y) => y[1].at - x[1].at).slice(0, 20).map(([u, r]) => ({ user: u, rating: r.rating, text: r.text, at: r.at }));
      return send(res, 200, Object.assign(pub(a, true), { status: a.status, owned: me ? bought(me, a) : a.priceMinor === 0, reviews, mine: me && rv[me] ? rv[me] : null })), true;
    }
    if (m === 'GET' && (mt = /^\/api\/store\/apps\/([0-9a-f]{16})\/icon$/.exec(p))) {
      const a = getApp(mt[1]); if (!a.icon) throw fail(404, 'No icon');
      const f = path.join(ICON_DIR, a.icon);
      let body; try { body = fs.readFileSync(f); } catch (e) { throw fail(404, 'No icon'); }
      res.writeHead(200, { 'Content-Type': a.icon.endsWith('.png') ? 'image/png' : 'image/jpeg', 'Content-Length': body.length, 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
      res.end(body); return true;
    }
    if (m === 'GET' && (mt = /^\/api\/store\/apps\/([0-9a-f]{16})\/download$/.exec(p))) {
      if (limited('dl:' + clientIp(req), 60, 3600000)) throw fail(429, 'Too many downloads, try later');
      const a = getApp(mt[1]), me = optAuth(req);
      let v = latestApproved(a);
      const want = parseInt(url.searchParams.get('v') || '-1', 10);
      if (want >= 0 && a.versions[want] && me && (owns(a, me) || isAdmin(me))) v = a.versions[want];   // owners and admins may fetch pending builds to test or review
      if (!v || (a.status !== 'approved' && !(me && (owns(a, me) || isAdmin(me))))) throw fail(404, 'App not found');
      if (a.priceMinor > 0) { if (!me) throw fail(401, 'Please sign in to download'); if (!bought(me, a)) throw fail(402, 'Buy this app first'); }
      const f = path.join(APK_DIR, v.file);
      let st; try { st = fs.statSync(f); } catch (e) { throw fail(404, 'File missing'); }
      if (me) extra.got[me + ':' + a.id] = 1;
      if (v.status === 'approved') { a.downloads++; save(); }
      res.writeHead(200, { 'Content-Type': 'application/vnd.android.package-archive', 'Content-Length': st.size, 'Content-Disposition': 'attachment; filename="' + a.pkg + '-' + v.name.replace(/[^\w.-]/g, '_') + '.apk"', 'X-Content-Type-Options': 'nosniff', 'X-APK-SHA256': v.sha256 });
      fs.createReadStream(f).pipe(res); return true;
    }

    /* ----- payments (webhooks / return pages use their own checks) ----- */
    if (m === 'POST' && p === '/api/store/webhook/paystack' && PROVIDER === 'paystack') {
      const raw = await rawBody(req, 100 * 1024);
      const sig = crypto.createHmac('sha512', env.PAYSTACK_SECRET || '').update(raw).digest('hex');
      if (!safeEq(sig, req.headers['x-paystack-signature'] || '')) throw fail(401, 'Bad signature');
      try { const ev = JSON.parse(raw.toString('utf8')); if (ev.event === 'charge.success' && ev.data && ev.data.reference) await fulfil(String(ev.data.reference)); } catch (e) {}
      return send(res, 200, { ok: true }), true;
    }
    if (m === 'POST' && p === '/api/store/webhook/flutterwave' && PROVIDER === 'flutterwave') {
      const raw = await rawBody(req, 100 * 1024);
      if (!env.FLW_WEBHOOK_HASH || !safeEq(req.headers['verif-hash'] || '', env.FLW_WEBHOOK_HASH)) throw fail(401, 'Bad signature');
      try { const ev = JSON.parse(raw.toString('utf8')); const ref = ev.data && (ev.data.tx_ref || ev.txRef); if (ref) await fulfil(String(ref)); } catch (e) {}
      return send(res, 200, { ok: true }), true;
    }
    if (m === 'GET' && p === '/api/store/pay/return') {
      const ref = String(url.searchParams.get('ref') || url.searchParams.get('reference') || url.searchParams.get('tx_ref') || '');
      let ok = false; try { ok = /^[0-9a-f]{24}$/.test(ref) && (await fulfil(ref)); } catch (e) {}
      return page(res, 'Payment', ok ? '<h2>Payment received &#10003;</h2><p>Go back to the Store app. Your download is unlocked.</p>' : '<h2>We could not confirm the payment yet</h2><p>If you were charged, wait a minute and open the Store again.</p>'), true;
    }
    if (m === 'GET' && p === '/api/store/mock/pay' && PROVIDER === 'mock') {
      const ref = String(url.searchParams.get('ref') || '');
      const ok = /^[0-9a-f]{24}$/.test(ref) && (await fulfil(ref));
      return page(res, 'Test payment', ok ? '<h2>Test payment done</h2>' : '<h2>Unknown payment</h2>'), true;
    }

    /* ----- everything below needs a signed-in user ----- */
    const a0 = authed(req), me = a0.id;
    if (limited('store:' + me, 300, 60000)) throw fail(429, 'Slow down');

    if (m === 'POST' && (mt = /^\/api\/store\/apps\/([0-9a-f]{16})\/buy$/.exec(p))) {
      const a = getApp(mt[1]);
      if (!visible(a)) throw fail(404, 'App not found');
      if (a.priceMinor === 0 || bought(me, a)) return send(res, 200, { owned: true }), true;
      if (limited('buy:' + me, 20, 3600000)) throw fail(429, 'Too many attempts');
      const pr = { ref: crypto.randomBytes(12).toString('hex'), user: me, app: a.id, dev: a.owner, amount: a.priceMinor, status: 'pending', at: Date.now() };
      const link = await providerInit(pr, a);
      extra.purchases[pr.ref] = pr; save();
      return send(res, 200, { url: link, ref: pr.ref }), true;
    }
    if (m === 'GET' && (mt = /^\/api\/store\/purchases\/([0-9a-f]{24})$/.exec(p))) {      // the app polls this after the payment page
      const pr = extra.purchases[mt[1]];
      if (!pr || pr.user !== me) throw fail(404, 'Not found');
      if (pr.status === 'pending') { try { await fulfil(pr.ref); } catch (e) {} }
      return send(res, 200, { status: pr.status }), true;
    }
    if (m === 'GET' && p === '/api/store/library') {
      const ids = new Set(Object.keys(extra.got).filter((k) => k.startsWith(me + ':')).map((k) => k.split(':')[1]));
      return send(res, 200, { apps: [...ids].map((id) => extra.apps[id]).filter((a) => a && visible(a)).map((a) => pub(a)) }), true;
    }
    if (m === 'POST' && (mt = /^\/api\/store\/apps\/([0-9a-f]{16})\/reviews$/.exec(p))) {
      const a = getApp(mt[1]); const b = await readBody(req);
      if (!extra.got[me + ':' + a.id]) throw fail(403, 'Install the app before reviewing it');
      const rating = Math.round(Number(b.rating)); if (!(rating >= 1 && rating <= 5)) throw fail(400, 'Rating must be 1 to 5');
      const rv = (extra.reviews[a.id] = extra.reviews[a.id] || {});
      rv[me] = { rating, text: str(b.text, 600), at: Date.now() };
      const vals = Object.values(rv); a.ratingCount = vals.length; a.ratingSum = vals.reduce((s, r) => s + r.rating, 0);
      save(); return send(res, 200, { ok: true }), true;
    }
    if (m === 'POST' && (mt = /^\/api\/store\/apps\/([0-9a-f]{16})\/report$/.exec(p))) {
      const a = getApp(mt[1]); const b = await readBody(req);
      if (limited('rep:' + me, 10, 3600000)) throw fail(429, 'Too many reports');
      if (!extra.reports.some((r) => r.app === a.id && r.user === me)) extra.reports.push({ app: a.id, user: me, reason: str(b.reason, 300) || 'No reason', at: Date.now() });
      const n = new Set(extra.reports.filter((r) => r.app === a.id).map((r) => r.user)).size;
      if (n >= 5 && a.status === 'approved') a.status = 'suspended';      // many people flagged it: hide until an admin looks
      save(); return send(res, 200, { ok: true }), true;
    }

    /* ----- developer ----- */
    if (m === 'GET' && p === '/api/store/mine') {
      const mine = Object.values(extra.apps).filter((a) => owns(a, me)).map((a) => Object.assign(pub(a, true), { status: a.status, note: a.note || '', versions: a.versions.map((v, i) => ({ i, name: v.name, size: v.size, status: v.status, at: v.at })) }));
      return send(res, 200, { apps: mine, earnings: balanceOf(me), payinfo: extra.payinfo[me] || null, admin: isAdmin(me) }), true;
    }
    if (m === 'PUT' && p === '/api/store/payout-info') {
      const b = await readBody(req);
      extra.payinfo[me] = { method: str(b.method, 20), details: str(b.details, 200) }; save();
      return send(res, 200, { ok: true }), true;
    }
    if (m === 'GET' && p === '/api/store/earnings') {
      const sales = extra.ledger.filter((l) => l.dev === me).slice(-50).reverse().map((l) => ({ app: l.app, gross: l.gross, fee: l.fee, net: l.net, at: l.at, refunded: l.refunded }));
      return send(res, 200, Object.assign(balanceOf(me), { currency: CURRENCY, sales }) ), true;
    }
    if (m === 'POST' && p === '/api/store/apps') {
      const b = await readBody(req);
      if (Object.values(extra.apps).filter((a) => owns(a, me)).length >= 20) throw fail(400, 'You have reached the limit of 20 apps');
      const name = str(b.name, 40), pkg = str(b.pkg, 150), desc = str(b.description, 4000), cat = CATEGORIES.includes(b.category) ? b.category : 'Other';
      let price = Math.round(Number(b.priceMinor) || 0);
      if (name.length < 2) throw fail(400, 'Name is too short');
      if (!PKG_RE.test(pkg)) throw fail(400, 'Package name looks like com.yourname.app');
      if (RESERVED_PKG.test(pkg) && !isAdmin(me)) throw fail(400, 'That package name is reserved');
      if (Object.values(extra.apps).some((a) => a.pkg.toLowerCase() === pkg.toLowerCase())) throw fail(409, 'That package name is already on the store');
      if (price < 0 || price > 100000000) throw fail(400, 'Bad price');
      if (price > 0 && PROVIDER === 'none') throw fail(400, 'Paid apps need payments to be enabled on this server');
      const app = { id: rid(), owner: me, name, pkg, desc, category: cat, priceMinor: price, status: 'draft', createdAt: Date.now(), downloads: 0, ratingSum: 0, ratingCount: 0, icon: null, versions: [] };
      extra.apps[app.id] = app; save();
      return send(res, 201, { id: app.id }), true;
    }
    if (m === 'PUT' && (mt = /^\/api\/store\/apps\/([0-9a-f]{16})$/.exec(p))) {
      const a = getApp(mt[1]); if (!owns(a, me)) throw fail(403, 'Not your app');
      const b = await readBody(req);
      if (b.name !== undefined) { const n = str(b.name, 40); if (n.length < 2) throw fail(400, 'Name is too short'); a.name = n; }
      if (b.description !== undefined) a.desc = str(b.description, 4000);
      if (CATEGORIES.includes(b.category)) a.category = b.category;
      if (b.priceMinor !== undefined) { const pr = Math.round(Number(b.priceMinor)); if (!(pr >= 0 && pr <= 100000000)) throw fail(400, 'Bad price'); if (pr > 0 && PROVIDER === 'none') throw fail(400, 'Payments are not enabled'); a.priceMinor = pr; }
      save(); return send(res, 200, { ok: true }), true;
    }
    if (m === 'PUT' && (mt = /^\/api\/store\/apps\/([0-9a-f]{16})\/apk$/.exec(p))) {
      const a = getApp(mt[1]); if (!owns(a, me)) throw fail(403, 'Not your app');
      if (limited('up:' + me, 12, 24 * 3600000)) throw fail(429, 'Upload limit reached for today');
      if (a.versions.length >= 60) throw fail(400, 'Too many versions');
      const vname = str(url.searchParams.get('versionName') || '', 30).replace(/[^\w.+-]/g, '') || '1.0';
      const got = await receive(req, MAX_APK, (h) => h.length >= 4 && h[0] === 0x50 && h[1] === 0x4b && h[2] === 3 && h[3] === 4);
      let names; try { names = zipNames(got.tmp); } catch (e) { names = null; }
      if (!names || !names.includes('AndroidManifest.xml') || !names.some((n) => /^classes\d*\.dex$/.test(n) || n.startsWith('lib/'))) { unlinkQuiet(got.tmp); throw fail(400, 'That does not look like an Android APK'); }
      if (names.length > 20000) { unlinkQuiet(got.tmp); throw fail(400, 'APK has too many files'); }
      const file = a.id + '-' + a.versions.length + '-' + got.sha256.slice(0, 12) + '.apk';
      fs.renameSync(got.tmp, path.join(APK_DIR, file));
      const approved = AUTO || isAdmin(me);
      a.versions.push({ name: vname, file, sha256: got.sha256, size: got.size, status: approved ? 'approved' : 'pending', at: Date.now() });
      if (a.status === 'draft') a.status = approved ? 'approved' : 'pending';
      save(); return send(res, 201, { version: a.versions.length - 1, sha256: got.sha256, status: a.versions[a.versions.length - 1].status }), true;
    }
    if (m === 'PUT' && (mt = /^\/api\/store\/apps\/([0-9a-f]{16})\/icon$/.exec(p))) {
      const a = getApp(mt[1]); if (!owns(a, me)) throw fail(403, 'Not your app');
      let kind = '';
      const got = await receive(req, MAX_ICON, (h) => { if (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47) { kind = 'png'; return true; } if (h[0] === 0xff && h[1] === 0xd8) { kind = 'jpg'; return true; } return false; });
      const file = a.id + '-' + got.sha256.slice(0, 8) + '.' + kind;
      fs.renameSync(got.tmp, path.join(ICON_DIR, file));
      if (a.icon) unlinkQuiet(path.join(ICON_DIR, a.icon));
      a.icon = file; save(); return send(res, 200, { ok: true }), true;
    }
    if (m === 'POST' && (mt = /^\/api\/store\/apps\/([0-9a-f]{16})\/delete$/.exec(p))) {
      const a = getApp(mt[1]); if (!owns(a, me) && !isAdmin(me)) throw fail(403, 'Not your app');
      a.versions.forEach((v) => unlinkQuiet(path.join(APK_DIR, v.file))); if (a.icon) unlinkQuiet(path.join(ICON_DIR, a.icon));
      delete extra.apps[a.id]; delete extra.reviews[a.id]; save();
      return send(res, 200, { ok: true }), true;
    }

    /* ----- admin ----- */
    if (m === 'GET' && p === '/api/admin/pending') {
      needAdmin(req);
      const out = [];
      Object.values(extra.apps).forEach((a) => a.versions.forEach((v, i) => { if (v.status === 'pending') out.push({ app: a.id, name: a.name, pkg: a.pkg, dev: a.owner, version: i, versionName: v.name, size: v.size, sha256: v.sha256, at: v.at, price: a.priceMinor }); }));
      const susp = Object.values(extra.apps).filter((a) => a.status === 'suspended').map((a) => ({ app: a.id, name: a.name, pkg: a.pkg, dev: a.owner, reports: extra.reports.filter((r) => r.app === a.id).map((r) => r.reason).slice(0, 10) }));
      return send(res, 200, { pending: out, suspended: susp, reports: extra.reports.slice(-50) }), true;
    }
    if (m === 'POST' && (mt = /^\/api\/admin\/apps\/([0-9a-f]{16})\/review$/.exec(p))) {
      needAdmin(req); const a = getApp(mt[1]); const b = await readBody(req);
      const vi = Number.isInteger(b.version) ? b.version : a.versions.length - 1;
      if (b.action === 'approve') { if (!a.versions[vi]) throw fail(400, 'No such version'); a.versions[vi].status = 'approved'; a.status = 'approved'; extra.reports = extra.reports.filter((r) => r.app !== a.id); }
      else if (b.action === 'reject') { if (!a.versions[vi]) throw fail(400, 'No such version'); a.versions[vi].status = 'rejected'; if (!latestApproved(a)) a.status = 'rejected'; }
      else if (b.action === 'suspend') a.status = 'suspended';
      else throw fail(400, 'Unknown action');
      a.note = str(b.note, 300); save(); return send(res, 200, { ok: true }), true;
    }
    if (m === 'GET' && p === '/api/admin/payouts') {
      needAdmin(req);
      const devs = new Set(extra.ledger.map((l) => l.dev));
      return send(res, 200, { currency: CURRENCY, devs: [...devs].map((d) => Object.assign({ dev: d, info: extra.payinfo[d] || null }, balanceOf(d))).filter((x) => x.balance > 0 || x.paid > 0), history: extra.payouts.slice(-50) }), true;
    }
    if (m === 'POST' && p === '/api/admin/payout') {
      needAdmin(req); const b = await readBody(req);
      const dev = str(b.dev, 24).toLowerCase(), amount = Math.round(Number(b.amount));
      if (!users.has(dev) || !(amount > 0)) throw fail(400, 'Bad payout');
      if (amount > balanceOf(dev).balance) throw fail(400, 'More than the developer is owed');
      extra.payouts.push({ id: rid(), dev, amount, note: str(b.note, 200), at: Date.now() }); save();
      return send(res, 200, { ok: true }), true;
    }
    if (m === 'POST' && (mt = /^\/api\/admin\/purchases\/([0-9a-f]{24})\/refund$/.exec(p))) {
      needAdmin(req);
      const pr = extra.purchases[mt[1]]; if (!pr || pr.status !== 'paid') throw fail(404, 'No such paid purchase');
      pr.status = 'refunded'; delete extra.got[pr.user + ':' + pr.app];
      extra.ledger.forEach((l) => { if (l.ref === pr.ref) l.refunded = true; });
      save(); return send(res, 200, { ok: true, note: 'Remember to refund the money in your payment provider dashboard.' }), true;
    }
    throw fail(404, 'Not found');
  };
};
