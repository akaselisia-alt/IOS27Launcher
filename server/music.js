'use strict';
/*
 * Fmusic module: anyone with an account can post songs; everyone can stream them.
 *
 *   MAX_AUDIO_MB   largest song file (default 30)       ADMIN_IDS   (same as the store) can hide or remove any song
 * Rules: uploaders must confirm they own the rights; 3 different people reporting a song hides it until an admin looks.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pipeline, Transform } = require('stream');

const GENRES = ['Afrobeats', 'Hip-Hop', 'Gospel', 'Highlife', 'R&B', 'Pop', 'Reggae', 'Dancehall', 'Amapiano', 'Rock', 'Electronic', 'Jazz', 'Classical', 'Other'];

module.exports = function createMusic(ctx) {
  const { extra, save, authed, readBody, send, fail, limited, DATA_DIR, clientIp } = ctx;
  const env = process.env;
  const ADMINS = new Set((env.ADMIN_IDS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
  const MAX_AUDIO = Math.max(1, parseInt(env.MAX_AUDIO_MB || '30', 10)) * 1024 * 1024;
  const MAX_COVER = 400 * 1024;

  extra.songs = extra.songs || {};       // id -> song
  extra.mlikes = extra.mlikes || {};     // "user:song" -> 1
  extra.mplaylists = extra.mplaylists || {}; // id -> {id, owner, name, songs[]}
  extra.mreports = extra.mreports || {}; // songId -> { reporterId: reason }

  const AUDIO_DIR = path.join(DATA_DIR, 'songs'), COVER_DIR = path.join(DATA_DIR, 'covers'), TMP_DIR = path.join(DATA_DIR, 'tmp');
  [AUDIO_DIR, COVER_DIR, TMP_DIR].forEach((d) => fs.mkdirSync(d, { recursive: true }));

  const rid = () => crypto.randomBytes(8).toString('hex');
  const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '');
  const isAdmin = (id) => ADMINS.has(id);
  const optAuth = (req) => { try { return authed(req).id; } catch (e) { return ''; } };
  const ID = /^[0-9a-f]{16}$/;
  function song(id) { const s = extra.songs[id]; if (!ID.test(id) || !s) throw fail(404, 'Song not found'); return s; }
  const live = (s) => s.status === 'live';
  function likesOf(id) { let n = 0; const suf = ':' + id; for (const k in extra.mlikes) if (k.endsWith(suf)) n++; return n; }
  function pub(s) {
    return { id: s.id, title: s.title, artist: s.artist, album: s.album, genre: s.genre, owner: s.owner, duration: s.dur, size: s.size, cover: !!s.cover, plays: s.plays, likes: s.likes || 0, at: s.at };
  }

  function receive(req, max, magicOk) {
    return new Promise((resolve, reject) => {
      const tmp = path.join(TMP_DIR, rid() + '.part');
      let size = 0, head = Buffer.alloc(0), over = false;
      const counter = new Transform({
        transform(chunk, _e, cb) {
          size += chunk.length;
          if (size > max) { over = true; return cb(new Error('too big')); }
          if (head.length < 16) head = Buffer.concat([head, chunk]).subarray(0, 16);
          cb(null, chunk);
        }
      });
      pipeline(req, counter, fs.createWriteStream(tmp, { mode: 0o600 }), (err) => {
        if (err || !size) { fs.unlink(tmp, () => {}); return reject(fail(over ? 413 : 400, over ? 'File too large' : 'Upload failed')); }
        const kind = magicOk(head);
        if (!kind) { fs.unlink(tmp, () => {}); return reject(fail(400, 'That is not a supported file')); }
        resolve({ tmp, size, kind });
      });
    });
  }
  // recognises mp3, m4a/mp4, ogg, wav, flac by their first bytes
  function audioKind(h) {
    if (h.length < 12) return '';
    if (h.slice(0, 3).toString() === 'ID3' || (h[0] === 0xff && (h[1] & 0xe0) === 0xe0)) return 'mp3';
    if (h.slice(4, 8).toString() === 'ftyp') return 'm4a';
    if (h.slice(0, 4).toString() === 'OggS') return 'ogg';
    if (h.slice(0, 4).toString() === 'RIFF' && h.slice(8, 12).toString() === 'WAVE') return 'wav';
    if (h.slice(0, 4).toString() === 'fLaC') return 'flac';
    return '';
  }
  const MIME = { mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac' };

  function streamFile(req, res, file, mime) {
    let st; try { st = fs.statSync(file); } catch (e) { throw fail(404, 'File missing'); }
    const hdr = { 'Content-Type': mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' };
    const r = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    let start = 0, end = st.size - 1, code = 200;
    if (r && (r[1] || r[2])) {
      if (r[1]) { start = parseInt(r[1], 10); end = r[2] ? Math.min(parseInt(r[2], 10), st.size - 1) : st.size - 1; }
      else { start = Math.max(0, st.size - parseInt(r[2], 10)); }
      if (start > end || start >= st.size) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); res.end(); return; }
      code = 206; hdr['Content-Range'] = 'bytes ' + start + '-' + end + '/' + st.size;
    }
    hdr['Content-Length'] = end - start + 1;
    res.writeHead(code, hdr);
    if (req.method === 'HEAD') return res.end();
    const rs = fs.createReadStream(file, { start, end });
    rs.on('error', () => res.destroy());
    res.on('close', () => rs.destroy());
    rs.pipe(res);
  }

  function lister(arr, url) {
    const off = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10) || 0);
    return { songs: arr.slice(off, off + 30).map(pub), more: arr.length > off + 30 };
  }

  return async function route(req, res, p, url) {
    const m = req.method;
    let mt;
    if (!p.startsWith('/api/music') && !p.startsWith('/api/admin/music')) return false;

    if (m === 'GET' && p === '/api/music/config') return send(res, 200, { genres: GENRES, maxMb: MAX_AUDIO / 1048576 }), true;

    if (m === 'GET' && p === '/api/music/feed') {
      const q = str(url.searchParams.get('q') || '', 60).toLowerCase(), g = str(url.searchParams.get('genre') || '', 30), sort = url.searchParams.get('sort');
      let a = Object.values(extra.songs).filter(live);
      if (g && g !== 'All') a = a.filter((s) => s.genre === g);
      if (q) a = a.filter((s) => (s.title + ' ' + s.artist + ' ' + s.album + ' ' + s.owner).toLowerCase().includes(q));
      a.sort(sort === 'top' ? (x, y) => (y.plays + (y.likes || 0) * 5) - (x.plays + (x.likes || 0) * 5) : (x, y) => y.at - x.at);
      return send(res, 200, lister(a, url)), true;
    }
    if (m === 'GET' && (mt = /^\/api\/music\/artist\/([a-z0-9_.-]{3,32})$/.exec(p))) {
      const a = Object.values(extra.songs).filter((s) => live(s) && s.owner === mt[1]).sort((x, y) => y.at - x.at);
      return send(res, 200, Object.assign({ artist: mt[1] }, lister(a, url))), true;
    }
    if (m === 'GET' && (mt = /^\/api\/music\/songs\/([0-9a-f]{16})$/.exec(p))) {
      const s = song(mt[1]), me = optAuth(req);
      if (!live(s) && s.owner !== me && !isAdmin(me)) throw fail(404, 'Song not found');
      return send(res, 200, Object.assign(pub(s), { liked: !!(me && extra.mlikes[me + ':' + s.id]), status: s.status })), true;
    }
    if ((m === 'GET' || m === 'HEAD') && (mt = /^\/api\/music\/songs\/([0-9a-f]{16})\/stream$/.exec(p))) {
      const s = song(mt[1]);
      if (!live(s) || !s.file) throw fail(404, 'Song not found');
      return streamFile(req, res, path.join(AUDIO_DIR, s.file), MIME[s.kind] || 'application/octet-stream'), true;
    }
    if (m === 'GET' && (mt = /^\/api\/music\/songs\/([0-9a-f]{16})\/cover$/.exec(p))) {
      const s = song(mt[1]); if (!s.cover) throw fail(404, 'No cover');
      return streamFile(req, res, path.join(COVER_DIR, s.cover), s.cover.endsWith('.png') ? 'image/png' : 'image/jpeg'), true;
    }
    if (m === 'POST' && (mt = /^\/api\/music\/songs\/([0-9a-f]{16})\/play$/.exec(p))) {
      const s = song(mt[1]);
      if (!live(s)) throw fail(404, 'Song not found');
      if (!limited('pl:' + clientIp(req) + ':' + s.id, 3, 3600000)) { s.plays = (s.plays || 0) + 1; save(); }
      return send(res, 200, { ok: true }), true;
    }

    /* ---- everything below needs an account ---- */
    const me = authed(req).id;

    if (m === 'POST' && p === '/api/music/songs') {
      const b = await readBody(req);
      if (b.rights !== true) throw fail(400, 'Confirm that you own the rights to this song');
      const title = str(b.title, 80), artist = str(b.artist, 60) || me;
      if (title.length < 1) throw fail(400, 'Give the song a title');
      if (Object.values(extra.songs).filter((s) => s.owner === me).length >= 40) throw fail(400, 'You have reached the limit of 40 songs');
      const genre = GENRES.includes(b.genre) ? b.genre : 'Other';
      const s = { id: rid(), owner: me, title, artist, album: str(b.album, 60), genre, dur: Math.max(0, Math.min(7200, Math.round(Number(b.duration) || 0))), file: '', kind: '', size: 0, cover: '', plays: 0, likes: 0, status: 'draft', at: Date.now() };
      extra.songs[s.id] = s; save();
      return send(res, 201, { id: s.id }), true;
    }
    if (m === 'PUT' && (mt = /^\/api\/music\/songs\/([0-9a-f]{16})$/.exec(p))) {
      const s = song(mt[1]); if (s.owner !== me && !isAdmin(me)) throw fail(403, 'Not your song');
      const b = await readBody(req);
      if (b.title !== undefined) { const t = str(b.title, 80); if (!t) throw fail(400, 'Give the song a title'); s.title = t; }
      if (b.artist !== undefined) s.artist = str(b.artist, 60) || s.owner;
      if (b.album !== undefined) s.album = str(b.album, 60);
      if (GENRES.includes(b.genre)) s.genre = b.genre;
      save(); return send(res, 200, { ok: true }), true;
    }
    if (m === 'PUT' && (mt = /^\/api\/music\/songs\/([0-9a-f]{16})\/audio$/.exec(p))) {
      const s = song(mt[1]); if (s.owner !== me) throw fail(403, 'Not your song');
      if (limited('mu:' + me, 10, 24 * 3600000)) throw fail(429, 'Upload limit reached for today');
      const got = await receive(req, MAX_AUDIO, audioKind);
      const file = s.id + '-' + crypto.randomBytes(4).toString('hex') + '.' + got.kind;
      fs.renameSync(got.tmp, path.join(AUDIO_DIR, file));
      if (s.file) fs.unlink(path.join(AUDIO_DIR, s.file), () => {});
      s.file = file; s.kind = got.kind; s.size = got.size;
      if (s.status === 'draft') s.status = 'live';
      save(); return send(res, 201, { ok: true, status: s.status }), true;
    }
    if (m === 'PUT' && (mt = /^\/api\/music\/songs\/([0-9a-f]{16})\/cover$/.exec(p))) {
      const s = song(mt[1]); if (s.owner !== me) throw fail(403, 'Not your song');
      const got = await receive(req, MAX_COVER, (h) => (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47 ? 'png' : (h[0] === 0xff && h[1] === 0xd8 ? 'jpg' : '')));
      const file = s.id + '-' + crypto.randomBytes(4).toString('hex') + '.' + got.kind;
      fs.renameSync(got.tmp, path.join(COVER_DIR, file));
      if (s.cover) fs.unlink(path.join(COVER_DIR, s.cover), () => {});
      s.cover = file; save(); return send(res, 200, { ok: true }), true;
    }
    if (m === 'POST' && (mt = /^\/api\/music\/songs\/([0-9a-f]{16})\/delete$/.exec(p))) {
      const s = song(mt[1]); if (s.owner !== me && !isAdmin(me)) throw fail(403, 'Not your song');
      if (s.file) fs.unlink(path.join(AUDIO_DIR, s.file), () => {});
      if (s.cover) fs.unlink(path.join(COVER_DIR, s.cover), () => {});
      delete extra.songs[s.id]; delete extra.mreports[s.id];
      Object.keys(extra.mlikes).forEach((k) => { if (k.endsWith(':' + s.id)) delete extra.mlikes[k]; });
      Object.values(extra.mplaylists).forEach((pl) => { pl.songs = pl.songs.filter((x) => x !== s.id); });
      save(); return send(res, 200, { ok: true }), true;
    }
    if (m === 'POST' && (mt = /^\/api\/music\/songs\/([0-9a-f]{16})\/like$/.exec(p))) {
      const s = song(mt[1]); if (!live(s)) throw fail(404, 'Song not found');
      const k = me + ':' + s.id;
      if (extra.mlikes[k]) delete extra.mlikes[k]; else extra.mlikes[k] = 1;
      s.likes = likesOf(s.id); save();
      return send(res, 200, { liked: !!extra.mlikes[k], likes: s.likes }), true;
    }
    if (m === 'POST' && p === '/api/music/report') {
      const b = await readBody(req), s = song(String(b.id || ''));
      if (limited('mr:' + me, 20, 24 * 3600000)) throw fail(429, 'Too many reports today');
      const r = (extra.mreports[s.id] = extra.mreports[s.id] || {});
      r[me] = str(b.reason, 200) || 'Reported';
      if (Object.keys(r).length >= 3 && s.status === 'live') s.status = 'hidden';
      save(); return send(res, 200, { ok: true }), true;
    }
    if (m === 'GET' && p === '/api/music/library') {
      const liked = Object.keys(extra.mlikes).filter((k) => k.startsWith(me + ':')).map((k) => extra.songs[k.slice(me.length + 1)]).filter((s) => s && live(s)).map(pub);
      const mine = Object.values(extra.songs).filter((s) => s.owner === me).sort((a, b) => b.at - a.at).map((s) => Object.assign(pub(s), { status: s.status }));
      const lists = Object.values(extra.mplaylists).filter((l) => l.owner === me).map((l) => ({ id: l.id, name: l.name, count: l.songs.length }));
      return send(res, 200, { liked, mine, lists, admin: isAdmin(me) }), true;
    }
    if (m === 'POST' && p === '/api/music/playlists') {
      const b = await readBody(req), name = str(b.name, 50);
      if (!name) throw fail(400, 'Name the playlist');
      if (Object.values(extra.mplaylists).filter((l) => l.owner === me).length >= 30) throw fail(400, 'Too many playlists');
      const l = { id: rid(), owner: me, name, songs: [] }; extra.mplaylists[l.id] = l; save();
      return send(res, 201, { id: l.id }), true;
    }
    if (m === 'GET' && (mt = /^\/api\/music\/playlists\/([0-9a-f]{16})$/.exec(p))) {
      const l = extra.mplaylists[mt[1]]; if (!l || l.owner !== me) throw fail(404, 'Playlist not found');
      return send(res, 200, { id: l.id, name: l.name, songs: l.songs.map((i) => extra.songs[i]).filter((s) => s && live(s)).map(pub) }), true;
    }
    if (m === 'POST' && (mt = /^\/api\/music\/playlists\/([0-9a-f]{16})\/(add|remove|delete)$/.exec(p))) {
      const l = extra.mplaylists[mt[1]]; if (!l || l.owner !== me) throw fail(404, 'Playlist not found');
      if (mt[2] === 'delete') { delete extra.mplaylists[l.id]; save(); return send(res, 200, { ok: true }), true; }
      const b = await readBody(req), sid = String(b.song || '');
      if (mt[2] === 'add') { const s = song(sid); if (!live(s)) throw fail(404, 'Song not found'); if (l.songs.length >= 500) throw fail(400, 'Playlist is full'); if (!l.songs.includes(sid)) l.songs.push(sid); }
      else l.songs = l.songs.filter((x) => x !== sid);
      save(); return send(res, 200, { ok: true }), true;
    }

    /* ---- admin ---- */
    if (m === 'GET' && p === '/api/admin/music/flagged') {
      if (!isAdmin(me)) throw fail(403, 'Admins only');
      return send(res, 200, { songs: Object.values(extra.songs).filter((s) => s.status === 'hidden').map((s) => Object.assign(pub(s), { reports: extra.mreports[s.id] || {} })) }), true;
    }
    if (m === 'POST' && (mt = /^\/api\/admin\/music\/([0-9a-f]{16})\/(hide|restore)$/.exec(p))) {
      if (!isAdmin(me)) throw fail(403, 'Admins only');
      const s = song(mt[1]); s.status = mt[2] === 'hide' ? 'hidden' : (s.file ? 'live' : 'draft');
      if (mt[2] === 'restore') delete extra.mreports[s.id];
      save(); return send(res, 200, { ok: true }), true;
    }
    throw fail(404, 'Not found');
  };
};
