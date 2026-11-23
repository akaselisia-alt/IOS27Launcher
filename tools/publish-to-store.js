// Publishes APKs to your own store server. Run by the GitHub workflow after each build.
// Needs env: STORE_SERVER, STORE_ID, STORE_PASSWORD (an ADMIN_IDS account, so uploads are approved at once).
// Usage: node publish-to-store.js "Name|package|file.apk|Category|Description" ...
const fs = require('fs');
const BASE = (process.env.STORE_SERVER || '').replace(/\/$/, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, path, token, body, raw) {
  let last;
  for (let i = 0; i < 6; i++) {            // a sleeping free server needs a minute to wake up
    try {
      const r = await fetch(BASE + path, {
        method,
        headers: Object.assign({}, token ? { authorization: 'Bearer ' + token } : {}, raw ? { 'content-type': 'application/octet-stream' } : { 'content-type': 'application/json' }),
        body: raw || (body ? JSON.stringify(body) : undefined)
      });
      const j = await r.json().catch(() => ({}));
      if (r.status >= 502 && r.status <= 504) { last = new Error('server busy ' + r.status); await sleep(15000); continue; }
      return [r.status, j];
    } catch (e) { last = e; await sleep(15000); }
  }
  throw last;
}

(async () => {
  if (!BASE || !process.env.STORE_ID || !process.env.STORE_PASSWORD) { console.log('Store publishing skipped (STORE_SERVER / STORE_ID / STORE_PASSWORD not set).'); return; }
  const [ls, lj] = await call('POST', '/api/login', null, { id: process.env.STORE_ID, password: process.env.STORE_PASSWORD });
  if (ls !== 200) throw new Error('Store login failed (' + ls + '): ' + (lj.error || ''));
  const tok = lj.token;
  const version = '1.0.' + (process.env.GITHUB_RUN_NUMBER || '1');
  for (const spec of process.argv.slice(2)) {
    const [name, pkg, file, category, description] = spec.split('|');
    if (!fs.existsSync(file)) { console.log('skip, missing', file); continue; }
    const [ms, mine] = await call('GET', '/api/store/mine', tok);
    if (ms !== 200) throw new Error('mine failed ' + ms);
    let app = (mine.apps || []).find((a) => (a.pkg || '').toLowerCase() === pkg.toLowerCase());
    let id = app && app.id;
    if (!id) {
      const [cs, cj] = await call('POST', '/api/store/apps', tok, { name, pkg, category, description, priceMinor: 0 });
      if (cs !== 201) throw new Error('create ' + pkg + ' failed (' + cs + '): ' + (cj.error || ''));
      id = cj.id;
    }
    const [us, uj] = await call('PUT', '/api/store/apps/' + id + '/apk?versionName=' + version, tok, null, fs.readFileSync(file));
    if (us !== 201) throw new Error('upload ' + pkg + ' failed (' + us + '): ' + (uj.error || ''));
    console.log('Published', name, version, '->', uj.status);
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
