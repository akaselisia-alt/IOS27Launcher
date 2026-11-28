/* Fmusic: stream songs posted by people on your server, and post your own.
 *   MusicUI.mount(host, env) -> { open(), back(), depth(), resumed() }
 *   env = { A, api(method, path, body, cb(status, json)), server(), acct(), refreshAcct(), close(), active() }
 */
(function () {
  'use strict';
  var CSS = [
    ':host{display:block;position:absolute;inset:0;--bg:#fff;--card:#f2f2f7;--text:#111;--sub:#6e6e73;--line:rgba(60,60,67,.18);--tint:#fa2d48;--fill:rgba(120,120,128,.16);--red:#ff3b30;',
    'font:400 17px/1.3 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--text);background:var(--bg);-webkit-font-smoothing:antialiased;user-select:none;-webkit-user-select:none}',
    '@media (prefers-color-scheme:dark){:host{--bg:#000;--card:#1c1c1e;--text:#fff;--sub:#98989f;--line:rgba(235,235,245,.18);--fill:rgba(120,120,128,.3)}}',
    '*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}',
    '.root{position:absolute;inset:0;overflow:hidden;display:flex;flex-direction:column}',
    '.hd{flex:none;display:flex;align-items:center;justify-content:space-between;padding:calc(10px + env(safe-area-inset-top)) 16px 4px}.hd b{font-size:15px;color:var(--tint);font-weight:600;cursor:pointer;padding:6px 0 6px 10px}',
    '.hd .bk{color:var(--tint);font-weight:500;cursor:pointer;padding:6px 10px 6px 0}',
    '.sc{flex:1;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:0 16px 24px}',
    'h1{font-size:34px;font-weight:800;letter-spacing:-.6px;margin:2px 0 10px}h2{font-size:21px;font-weight:700;margin:20px 0 8px}',
    '.tabs{flex:none;display:flex;border-top:.5px solid var(--line);background:var(--bg);padding-bottom:env(safe-area-inset-bottom)}',
    '.tab{flex:1;text-align:center;padding:7px 0 5px;font-size:10.5px;color:var(--sub);cursor:pointer}.tab svg{display:block;margin:0 auto 2px;width:25px;height:25px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.tab.on{color:var(--tint)}',
    '.chips{display:flex;gap:8px;overflow-x:auto;padding:2px 0 8px;scrollbar-width:none}.chips::-webkit-scrollbar{display:none}.chip{flex:none;padding:7px 14px;border-radius:16px;background:var(--fill);font-size:14px;font-weight:500;cursor:pointer}.chip.on{background:var(--tint);color:#fff}',
    '.row{display:flex;align-items:center;gap:12px;padding:8px 0;position:relative;cursor:pointer}.row:active{opacity:.6}',
    '.art{width:54px;height:54px;border-radius:8px;flex:none;overflow:hidden;background:var(--fill);position:relative}.art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}',
    '.m{flex:1;min-width:0}.t{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.s{color:var(--sub);font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.dots{padding:8px 4px;color:var(--sub);font-size:20px;line-height:1}',
    '.hz{display:flex;gap:14px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none}.hz::-webkit-scrollbar{display:none}.cd{flex:none;width:140px;cursor:pointer}.cd .art{width:140px;height:140px;border-radius:12px}.cd .t{margin-top:6px;font-size:15px}',
    '.in{width:100%;border:0;outline:0;background:var(--fill);color:var(--text);font:inherit;padding:11px 14px;border-radius:12px;margin-bottom:10px;user-select:text;-webkit-user-select:text}',
    '.btn{display:block;width:100%;text-align:center;padding:13px;border-radius:13px;background:var(--tint);color:#fff;font-weight:600;margin:8px 0;cursor:pointer}.btn.alt{background:var(--fill);color:var(--tint)}.btn.red{background:var(--red)}.btn:active{opacity:.8}.btn.dis{opacity:.5;pointer-events:none}',
    '.empty{text-align:center;color:var(--sub);padding:40px 10px}.card{background:var(--card);border-radius:14px;padding:14px;margin-bottom:12px}',
    '.mini{flex:none;margin:0 8px 6px;border-radius:14px;background:var(--card);box-shadow:0 2px 14px rgba(0,0,0,.18);display:flex;align-items:center;gap:10px;padding:7px 10px;cursor:pointer;position:relative;overflow:hidden}',
    '.mini .art{width:42px;height:42px}.mini .pp{font-size:22px;padding:6px 10px}.mini .pr{position:absolute;left:0;bottom:0;height:2px;background:var(--tint);width:0}',
    '.pl{position:absolute;inset:0;background:var(--bg);z-index:5;display:flex;flex-direction:column;padding:calc(12px + env(safe-area-inset-top)) 28px calc(26px + env(safe-area-inset-bottom));transform:translateY(100%);transition:transform .35s cubic-bezier(.25,.9,.3,1)}.pl.on{transform:none}',
    '.pl .cv{width:100%;aspect-ratio:1;border-radius:18px;margin:14px 0 20px;box-shadow:0 14px 40px rgba(0,0,0,.3);overflow:hidden;position:relative;background:var(--fill)}.pl .cv img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}',
    '.pl .tt{font-size:22px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pl .ar{font-size:18px;color:var(--tint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}',
    'input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:5px;border-radius:3px;background:var(--fill);outline:0;margin:18px 0 4px}input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:var(--text)}',
    '.tm{display:flex;justify-content:space-between;font-size:12px;color:var(--sub);font-variant-numeric:tabular-nums}',
    '.ct{display:flex;align-items:center;justify-content:center;gap:34px;margin:14px 0;font-size:32px}.ct .big{font-size:56px;width:84px;height:84px;border-radius:50%;background:var(--tint);color:#fff;display:grid;place-items:center;font-size:36px}',
    '.ex{display:flex;justify-content:space-around;margin-top:auto;color:var(--sub);font-size:14px}.ex button{padding:8px 10px}',
    '.sheet{position:absolute;left:0;right:0;bottom:0;z-index:8;background:var(--card);border-radius:20px 20px 0 0;padding:14px 16px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.35)}.sheet .btn{margin:6px 0}',
    '.scrim{position:absolute;inset:0;background:rgba(0,0,0,.4);z-index:7}',
    '.toast{position:absolute;left:50%;bottom:110px;transform:translateX(-50%);background:rgba(30,30,34,.95);color:#fff;padding:10px 16px;border-radius:14px;font-size:14px;max-width:86%;text-align:center;opacity:0;pointer-events:none;transition:opacity .2s;z-index:20}.toast.on{opacity:1}',
    '.bar2{height:6px;border-radius:3px;background:var(--fill);overflow:hidden;margin:8px 0}.bar2 i{display:block;height:100%;width:0;background:var(--tint);transition:width .2s}',
    '.tag{font-size:11px;padding:2px 7px;border-radius:7px;background:var(--fill);margin-left:6px;text-transform:uppercase;color:var(--sub)}',
    '.chk{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:var(--sub);margin:6px 0 10px;user-select:text;-webkit-user-select:text}.chk input{margin-top:3px;width:20px;height:20px;flex:none}'
  ].join('');

  var GRAD = [['#ff5e8a', '#ff2d55'], ['#667eea', '#764ba2'], ['#00c2ff', '#2a5cff'], ['#ff9a3c', '#ff4e50'], ['#43e97b', '#38f9d7'], ['#a18cd1', '#fbc2eb'], ['#f093fb', '#f5576c'], ['#0ba360', '#3cba92']];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function fmt(t) { t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2); }

  function mount(host, env) {
    var sh = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    sh.innerHTML = '<style>' + CSS + '</style><div class="root" id="root"></div>';
    var root = sh.getElementById('root'), A = env.A, api = env.api;
    var tab = 'listen', stack = [], queue = [], qi = -1, genre = 'All', cfg = { genres: ['All'] }, audio = new Audio(), tt, reqN = 1000000, upCb = {}, pickInfo = {}, playerEl = null, sheetEl = null, lib = null;
    audio.preload = 'none';

    function E(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
    function toast(t) { var e = root.querySelector('.toast'); if (!e) { e = E('div', 'toast'); root.appendChild(e); } e.textContent = t; e.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { e.classList.remove('on'); }, 2000); }
    function signed() { return !!(env.acct() && env.acct().signedIn); }
    function base() { return env.server() || ''; }
    function artEl(s, cls) {
      var d = E('div', cls || 'art'), g = GRAD[hash(s.id || s.title || 'x') % GRAD.length];
      d.style.background = 'linear-gradient(150deg,' + g[0] + ',' + g[1] + ')';
      if (s.cover) { var i = new Image(); i.alt = ''; i.src = base() + '/api/music/songs/' + s.id + '/cover'; i.onerror = function () { i.remove(); }; d.appendChild(i); }
      return d;
    }

    /* ---------- playback ---------- */
    function cur() { return queue[qi] || null; }
    function playAt(list, i) {
      queue = list.slice(); qi = i; var s = cur(); if (!s) return;
      audio.src = base() + '/api/music/songs/' + s.id + '/stream';
      var p = audio.play(); if (p && p.catch) p.catch(function () { toast('Can’t play this song'); });
      api('POST', '/api/music/songs/' + s.id + '/play', null, function () {});
      paint();
    }
    function next(dir) { if (!queue.length) return; var n = qi + dir; if (n < 0) n = 0; if (n >= queue.length) { audio.pause(); audio.currentTime = 0; paint(); return; } playAt(queue, n); }
    audio.onended = function () { next(1); };
    audio.onerror = function () { if (cur()) toast('Can’t play this song'); };
    audio.ontimeupdate = function () {
      var pr = root.querySelector('.mini .pr'); if (pr && audio.duration) pr.style.width = (audio.currentTime / audio.duration * 100) + '%';
      if (playerEl) { var sk = playerEl.querySelector('#sk'), a = playerEl.querySelector('#t1'), b = playerEl.querySelector('#t2'); if (sk && !sk._drag && audio.duration) sk.value = audio.currentTime / audio.duration * 1000; if (a) a.textContent = fmt(audio.currentTime); if (b) b.textContent = '-' + fmt((audio.duration || 0) - audio.currentTime); }
    };
    audio.onplay = audio.onpause = function () { paintBtns(); };
    function paintBtns() { var pp = root.querySelectorAll('.pp'); [].forEach.call(pp, function (b) { b.textContent = audio.paused ? '▶' : '⏸'; }); }
    function toggle() { if (!cur()) return; if (audio.paused) { var p = audio.play(); if (p && p.catch) p.catch(function () {}); } else audio.pause(); }
    if ('mediaSession' in navigator) { try { navigator.mediaSession.setActionHandler('play', toggle); navigator.mediaSession.setActionHandler('pause', toggle); navigator.mediaSession.setActionHandler('nexttrack', function () { next(1); }); navigator.mediaSession.setActionHandler('previoustrack', function () { next(-1); }); } catch (e) {} }

    /* ---------- shell ---------- */
    var ICON = {
      listen: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M10 8.5l5.5 3.5-5.5 3.5z"/></svg>',
      search: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>',
      lib: '<svg viewBox="0 0 24 24"><path d="M5 4v16M10 4v16M15.5 5.5l4 13"/></svg>',
      post: '<svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M5 20h14"/></svg>'
    };
    function shell() {
      root.innerHTML = '<div class="hd"><span class="bk" id="bk"></span><b id="dn">Done</b></div><div class="sc" id="sc"></div><div id="mp"></div><div class="tabs" id="tabs"></div>';
      var tabs = root.querySelector('#tabs');
      [['listen', 'Listen Now'], ['search', 'Search'], ['lib', 'Library'], ['post', 'Post']].forEach(function (t) {
        var b = E('div', 'tab' + (tab === t[0] ? ' on' : ''), ICON[t[0]] + t[1]); b.onclick = function () { tab = t[0]; stack = []; shell(); show(); }; tabs.appendChild(b);
      });
      var dn = root.querySelector('#dn'); dn.onclick = function () { if (env.close) env.close(); }; if (!env.close) dn.style.display = 'none';
      var bk = root.querySelector('#bk'); bk.onclick = pop;
      paintMini();
    }
    function paintMini() {
      var mp = root.querySelector('#mp'); if (!mp) return; mp.innerHTML = '';
      var s = cur(); if (!s) return;
      var m = E('div', 'mini'); m.appendChild(artEl(s));
      m.appendChild(E('div', 'm', '<div class="t">' + esc(s.title) + '</div><div class="s">' + esc(s.artist) + '</div>'));
      var pp = E('button', 'pp', audio.paused ? '▶' : '⏸'); pp.onclick = function (e) { e.stopPropagation(); toggle(); }; m.appendChild(pp);
      var nx = E('button', 'pp', '⏭'); nx.onclick = function (e) { e.stopPropagation(); next(1); }; m.appendChild(nx);
      m.appendChild(E('div', 'pr')); m.onclick = openPlayer; mp.appendChild(m);
    }
    function paint() { paintMini(); paintBtns(); if (playerEl) openPlayer(true); }
    function show() {
      var sc = root.querySelector('#sc'); sc.innerHTML = '';
      var top = stack[stack.length - 1];
      root.querySelector('#bk').textContent = top ? '‹ Back' : '';
      if (top) { top.render(sc); return; }
      if (tab === 'listen') listen(sc); else if (tab === 'search') search(sc); else if (tab === 'lib') library(sc); else post(sc);
    }
    function push(render) { stack.push({ render: render }); show(); }
    function pop() { if (playerEl) { closePlayer(); return true; } if (sheetEl) { closeSheet(); return true; } if (stack.length) { stack.pop(); show(); return true; } return false; }

    /* ---------- lists ---------- */
    function songRow(list, i, opt) {
      var s = list[i], r = E('div', 'row'); r.appendChild(artEl(s));
      r.appendChild(E('div', 'm', '<div class="t">' + esc(s.title) + (opt && opt.status && s.status && s.status !== 'live' ? '<span class="tag">' + esc(s.status) + '</span>' : '') + '</div><div class="s">' + esc(s.artist) + (s.genre ? ' · ' + esc(s.genre) : '') + '</div>'));
      var d = E('button', 'dots', '⋯'); d.onclick = function (e) { e.stopPropagation(); actions(s, opt); }; r.appendChild(d);
      r.onclick = function () { playAt(list, i); }; return r;
    }
    function listOf(sc, list, empty, opt) { if (!list.length) { sc.appendChild(E('div', 'empty', empty)); return; } list.forEach(function (s, i) { sc.appendChild(songRow(list, i, opt)); }); }
    function needServer(sc) { if (base()) return false; sc.appendChild(E('div', 'empty', 'No server is set up yet.<br>Add your server address in Settings.')); return true; }

    function listen(sc) {
      sc.appendChild(E('h1', '', 'Listen Now'));
      if (needServer(sc)) return;
      var ch = E('div', 'chips'); ['All'].concat(cfg.genres.filter(function (g) { return g !== 'All'; })).forEach(function (g) { var c = E('div', 'chip' + (g === genre ? ' on' : ''), esc(g)); c.onclick = function () { genre = g; show(); }; ch.appendChild(c); }); sc.appendChild(ch);
      var q = genre === 'All' ? '' : '&genre=' + encodeURIComponent(genre);
      var tr = E('div'), nw = E('div'); sc.appendChild(tr); sc.appendChild(nw);
      api('GET', '/api/music/feed?sort=top' + q, null, function (s, j) {
        if (s !== 200 || !j.songs || !j.songs.length) return; tr.appendChild(E('h2', '', 'Trending'));
        var hz = E('div', 'hz'); j.songs.slice(0, 10).forEach(function (x, i) { var c = E('div', 'cd'); c.appendChild(artEl(x)); c.appendChild(E('div', 't', esc(x.title))); c.appendChild(E('div', 's', esc(x.artist))); c.onclick = function () { playAt(j.songs, i); }; hz.appendChild(c); }); tr.appendChild(hz);
      });
      api('GET', '/api/music/feed?sort=new' + q, null, function (s, j) {
        nw.appendChild(E('h2', '', 'New Releases'));
        if (s !== 200) { nw.appendChild(E('div', 'empty', s === 0 ? 'No connection' : 'Couldn’t load songs')); return; }
        listOf(nw, j.songs || [], 'No songs yet. Be the first to post one in the Post tab.');
      });
    }
    function search(sc) {
      sc.appendChild(E('h1', '', 'Search'));
      var i = E('input', 'in'); i.placeholder = 'Songs, artists, albums'; i.autocomplete = 'off'; sc.appendChild(i); var res = E('div'); sc.appendChild(res);
      if (needServer(res)) return; var tm;
      function go() { var v = i.value.trim(); res.innerHTML = ''; if (!v) { res.appendChild(E('div', 'empty', 'Search everything people have posted.')); return; } api('GET', '/api/music/feed?q=' + encodeURIComponent(v), null, function (s, j) { res.innerHTML = ''; listOf(res, j.songs || [], 'No results'); }); }
      i.oninput = function () { clearTimeout(tm); tm = setTimeout(go, 300); }; go();
    }
    function artistPage(name) {
      push(function (sc) {
        sc.appendChild(E('h1', '', esc(name))); var box = E('div'); sc.appendChild(box);
        api('GET', '/api/music/artist/' + encodeURIComponent(name), null, function (s, j) { listOf(box, j.songs || [], 'No songs'); });
      });
    }

    /* ---------- account ---------- */
    function signIn(sc, why) {
      sc.appendChild(E('h1', '', 'Sign in')); sc.appendChild(E('div', 's', why || 'Use your launcher account.'));
      if (needServer(sc)) return;
      var id = E('input', 'in'); id.placeholder = 'ID'; id.autocapitalize = 'off'; id.autocomplete = 'username'; id.style.marginTop = '14px';
      var pw = E('input', 'in'); pw.type = 'password'; pw.placeholder = 'Password'; pw.autocomplete = 'current-password';
      var msg = E('div', 's'); msg.style.cssText = 'color:var(--red);min-height:20px';
      function go(kind) {
        var body = { id: id.value.trim().toLowerCase(), password: pw.value };
        api('POST', '/api/' + kind, body, function (s, j) {
          if (s === 200 || s === 201) { env.refreshAcct(); if (j.recovery) recoveryPage(j.recovery); else { stack = []; shell(); show(); } }
          else msg.textContent = (j && j.error) || (s === 0 ? 'No connection' : 'Error ' + s);
        });
      }
      var a = E('div', 'btn', 'Sign in'); a.onclick = function () { go('login'); };
      var b = E('div', 'btn alt', 'Create account'); b.onclick = function () { go('register'); };
      [id, pw, msg, a, b].forEach(function (x) { sc.appendChild(x); });
    }
    function recoveryPage(code) {
      stack = []; shell(); var sc = root.querySelector('#sc'); sc.innerHTML = '';
      sc.appendChild(E('h1', '', 'Save this code')); sc.appendChild(E('div', 's', 'This recovery code is the only way to reset a forgotten password. It is shown once.'));
      var c = E('div', 'card', '<div style="font:700 22px/1.4 ui-monospace,Menlo,monospace;letter-spacing:1px;text-align:center;user-select:text;-webkit-user-select:text">' + esc(code) + '</div>'); c.style.marginTop = '16px'; sc.appendChild(c);
      var d = E('div', 'btn', 'I saved it'); d.onclick = function () { shell(); show(); }; sc.appendChild(d);
    }

    /* ---------- library ---------- */
    function library(sc) {
      sc.appendChild(E('h1', '', 'Library'));
      if (!signed()) { signIn(sc, 'Sign in to keep liked songs and playlists.'); return; }
      var box = E('div'); sc.appendChild(box);
      api('GET', '/api/music/library', null, function (s, j) {
        if (s !== 200) { box.appendChild(E('div', 'empty', (j && j.error) || 'Couldn’t load your library')); return; }
        lib = j;
        var lk = E('div', 'row', '<div class="art" style="display:grid;place-items:center;background:linear-gradient(150deg,#ff5e8a,#ff2d55);color:#fff;font-size:24px">♥</div><div class="m"><div class="t">Liked Songs</div><div class="s">' + j.liked.length + ' songs</div></div>');
        lk.onclick = function () { push(function (p) { p.appendChild(E('h1', '', 'Liked Songs')); listOf(p, j.liked, 'Tap the heart on a song to like it.'); }); }; box.appendChild(lk);
        j.lists.forEach(function (l) { var r = E('div', 'row', '<div class="art" style="display:grid;place-items:center;font-size:22px">♫</div><div class="m"><div class="t">' + esc(l.name) + '</div><div class="s">' + l.count + ' songs</div></div>'); r.onclick = function () { playlistPage(l); }; box.appendChild(r); });
        var np = E('div', 'btn alt', '+ New playlist'); np.onclick = function () { namePrompt('New playlist', '', function (name) { api('POST', '/api/music/playlists', { name: name }, function (st, jj) { if (st === 201) show(); else toast(jj.error || 'Failed'); }); }); }; box.appendChild(np);
        box.appendChild(E('h2', '', 'My Songs')); listOf(box, j.mine, 'Songs you post will appear here.', { mine: true, status: true });
        var so = E('div', 'btn alt', 'Sign out'); so.onclick = function () { if (A) A.acctSignOut(); env.refreshAcct(); lib = null; show(); }; box.appendChild(so);
      });
    }
    function playlistPage(l) {
      push(function (sc) {
        sc.appendChild(E('h1', '', esc(l.name))); var box = E('div'); sc.appendChild(box);
        api('GET', '/api/music/playlists/' + l.id, null, function (s, j) {
          listOf(box, j.songs || [], 'Add songs with the ⋯ button.', { plist: l.id });
          var d = E('div', 'btn red', 'Delete playlist'); d.onclick = function () { api('POST', '/api/music/playlists/' + l.id + '/delete', {}, function () { stack.pop(); show(); }); }; box.appendChild(d);
        });
      });
    }

    /* ---------- sheets ---------- */
    function closeSheet() { if (sheetEl) { sheetEl.sc.remove(); sheetEl.el.remove(); sheetEl = null; } }
    function openSheet(build) {
      closeSheet(); var sc = E('div', 'scrim'), el = E('div', 'sheet'); sc.onclick = closeSheet; root.appendChild(sc); root.appendChild(el); sheetEl = { sc: sc, el: el }; build(el);
    }
    function namePrompt(title, val, cb) {
      openSheet(function (el) { el.appendChild(E('b', '', esc(title))); var i = E('input', 'in'); i.style.margin = '10px 0'; i.value = val; i.placeholder = 'Name'; el.appendChild(i); var ok = E('div', 'btn', 'Save'); ok.onclick = function () { var v = i.value.trim(); if (v) { closeSheet(); cb(v); } }; el.appendChild(ok); setTimeout(function () { i.focus(); }, 50); });
    }
    function actions(s, opt) {
      opt = opt || {};
      openSheet(function (el) {
        el.appendChild(E('div', 't', esc(s.title))); el.appendChild(E('div', 's', esc(s.artist))); el.lastChild.style.marginBottom = '8px';
        function add(label, cls, fn) { var b = E('div', 'btn ' + cls, label); b.onclick = function () { closeSheet(); fn(); }; el.appendChild(b); }
        add('Play next', 'alt', function () { if (!queue.length) playAt([s], 0); else { queue.splice(qi + 1, 0, s); toast('Playing next'); } });
        add('♥ Like / Unlike', 'alt', function () { if (!signed()) { toast('Sign in from the Library tab'); return; } api('POST', '/api/music/songs/' + s.id + '/like', {}, function (st, j) { toast(st === 200 ? (j.liked ? 'Added to Liked Songs' : 'Removed from Liked Songs') : (j.error || 'Failed')); }); });
        add('Add to playlist', 'alt', function () { addToList(s); });
        add('Go to artist', 'alt', function () { artistPage(s.owner || s.artist); });
        if (opt.plist) add('Remove from this playlist', 'alt', function () { api('POST', '/api/music/playlists/' + opt.plist + '/remove', { song: s.id }, function () { show(); }); });
        if (opt.mine) add('Delete song', 'red', function () { api('POST', '/api/music/songs/' + s.id + '/delete', {}, function (st, j) { if (st === 200) show(); else toast(j.error || 'Failed'); }); });
        else add('Report', 'alt', function () { if (!signed()) { toast('Sign in to report a song'); return; } api('POST', '/api/music/report', { id: s.id, reason: 'Reported by a listener' }, function (st) { toast(st === 200 ? 'Thanks, we’ll look into it' : 'Couldn’t send'); }); });
      });
    }
    function addToList(s) {
      if (!signed()) { toast('Sign in from the Library tab'); return; }
      api('GET', '/api/music/library', null, function (st, j) {
        if (st !== 200) { toast('Couldn’t load playlists'); return; }
        openSheet(function (el) {
          el.appendChild(E('b', '', 'Add to playlist'));
          j.lists.forEach(function (l) { var b = E('div', 'btn alt', esc(l.name)); b.onclick = function () { closeSheet(); api('POST', '/api/music/playlists/' + l.id + '/add', { song: s.id }, function (x, y) { toast(x === 200 ? 'Added to ' + l.name : (y.error || 'Failed')); }); }; el.appendChild(b); });
          var n = E('div', 'btn', '+ New playlist'); n.onclick = function () { namePrompt('New playlist', '', function (name) { api('POST', '/api/music/playlists', { name: name }, function (x, y) { if (x !== 201) { toast(y.error || 'Failed'); return; } api('POST', '/api/music/playlists/' + y.id + '/add', { song: s.id }, function () { toast('Added to ' + name); }); }); }); }; el.appendChild(n);
        });
      });
    }

    /* ---------- full player ---------- */
    function closePlayer() { if (playerEl) { var p = playerEl; playerEl = null; p.classList.remove('on'); setTimeout(function () { p.remove(); }, 350); } }
    function openPlayer(refreshOnly) {
      var s = cur(); if (!s) return; var existing = playerEl;
      var p = E('div', 'pl'); p.appendChild(E('div', '', '')); var top = E('div'); top.style.cssText = 'display:flex;justify-content:center'; var grab = E('div'); grab.style.cssText = 'width:40px;height:5px;border-radius:3px;background:var(--fill);cursor:pointer'; grab.onclick = closePlayer; top.appendChild(grab); p.firstChild.replaceWith(top);
      var cv = E('div', 'cv'); var g = GRAD[hash(s.id) % GRAD.length]; cv.style.background = 'linear-gradient(150deg,' + g[0] + ',' + g[1] + ')'; if (s.cover) { var im = new Image(); im.alt = ''; im.src = base() + '/api/music/songs/' + s.id + '/cover'; im.onerror = function () { im.remove(); }; cv.appendChild(im); } p.appendChild(cv);
      p.appendChild(E('div', 'tt', esc(s.title))); var ar = E('div', 'ar', esc(s.artist)); ar.onclick = function () { closePlayer(); artistPage(s.owner || s.artist); }; p.appendChild(ar);
      var sk = E('input'); sk.type = 'range'; sk.id = 'sk'; sk.min = 0; sk.max = 1000; sk.value = audio.duration ? audio.currentTime / audio.duration * 1000 : 0;
      sk.oninput = function () { sk._drag = true; }; sk.onchange = function () { if (audio.duration) audio.currentTime = sk.value / 1000 * audio.duration; sk._drag = false; }; p.appendChild(sk);
      p.appendChild(E('div', 'tm', '<span id="t1">' + fmt(audio.currentTime) + '</span><span id="t2">-' + fmt((audio.duration || 0) - audio.currentTime) + '</span>'));
      var ct = E('div', 'ct'); var pv = E('button', '', '⏮'); pv.onclick = function () { if (audio.currentTime > 4) audio.currentTime = 0; else next(-1); }; var pp = E('button', 'big pp', audio.paused ? '▶' : '⏸'); pp.onclick = toggle; var nx = E('button', '', '⏭'); nx.onclick = function () { next(1); }; ct.appendChild(pv); ct.appendChild(pp); ct.appendChild(nx); p.appendChild(ct);
      var ex = E('div', 'ex'); var lk = E('button', '', '♥ Like'); lk.onclick = function () { if (!signed()) { toast('Sign in from the Library tab'); return; } api('POST', '/api/music/songs/' + s.id + '/like', {}, function (st, j) { if (st === 200) { lk.textContent = j.liked ? '♥ Liked' : '♥ Like'; lk.style.color = j.liked ? 'var(--tint)' : ''; } else toast(j.error || 'Failed'); }); };
      var ad = E('button', '', '+ Playlist'); ad.onclick = function () { addToList(s); }; var mo = E('button', '', '⋯ More'); mo.onclick = function () { actions(s, {}); }; ex.appendChild(lk); ex.appendChild(ad); ex.appendChild(mo); p.appendChild(ex);
      if (existing) existing.remove(); root.appendChild(p); playerEl = p; if (refreshOnly === true) p.classList.add('on'); else requestAnimationFrame(function () { requestAnimationFrame(function () { p.classList.add('on'); }); });
      if (signed()) api('GET', '/api/music/songs/' + s.id, null, function (st, j) { if (st === 200 && j.liked && playerEl === p) { lk.textContent = '♥ Liked'; lk.style.color = 'var(--tint)'; } });
    }

    /* ---------- post a song ---------- */
    function post(sc) {
      sc.appendChild(E('h1', '', 'Post a Song'));
      if (!signed()) { signIn(sc, 'Sign in to post your music.'); return; }
      if (needServer(sc)) return;
      var st = { audio: '', cover: '' }, busy = false;
      sc.appendChild(E('div', 's', 'Upload a song for everyone to stream. Up to ' + (cfg.maxMb || 30) + ' MB (mp3, m4a, ogg, wav or flac).'));
      var pa = E('div', 'btn alt', 'Choose audio file'); pa.style.marginTop = '14px';
      var pc = E('div', 'btn alt', 'Choose cover art (optional)');
      var ti = E('input', 'in'); ti.placeholder = 'Title'; var ar = E('input', 'in'); ar.placeholder = 'Artist name'; ar.value = (env.acct() && env.acct().id) || ''; var al = E('input', 'in'); al.placeholder = 'Album (optional)';
      var ge = E('select', 'in'); (cfg.genres || []).filter(function (g) { return g !== 'All'; }).forEach(function (g) { ge.appendChild(E('option', '', esc(g))); });
      var chk = E('label', 'chk', '<input type="checkbox" id="rt"><span>I own the rights to this song, or have permission to share it. Songs that break copyright can be removed.</span>');
      var bar = E('div', 'bar2', '<i></i>'); bar.style.display = 'none'; var msg = E('div', 's'); msg.style.cssText = 'min-height:20px;margin-bottom:6px';
      var go = E('div', 'btn', 'Post song');
      pickInfo.audio = function (name) { st.audio = name; pa.textContent = '♪ ' + name; if (!ti.value) ti.value = name.replace(/\.[A-Za-z0-9]+$/, '').replace(/[_]+/g, ' ').slice(0, 80); };
      pickInfo.image = function (name) { st.cover = name; pc.textContent = '🖼 ' + name; };
      pa.onclick = function () { if (A && A.storePick) A.storePick('audio'); else toast('Only works inside the app'); };
      pc.onclick = function () { if (A && A.storePick) A.storePick('image'); else toast('Only works inside the app'); };
      [pa, ti, ar, al, ge, pc, chk, bar, msg, go].forEach(function (x) { sc.appendChild(x); });
      function up(kind, path, label, cb) {
        var id = ++reqN; msg.textContent = label; bar.style.display = '';
        upCb[id] = function (state, pct, text) { if (state === 'progress') bar.firstChild.style.width = Math.max(2, pct) + '%'; else { delete upCb[id]; if (state === 'done') cb(true); else cb(false, text); } };
        A.storeUpload(id, kind, path);
      }
      go.onclick = function () {
        if (busy) return;
        if (!st.audio) { msg.textContent = 'Choose an audio file first.'; return; }
        if (!ti.value.trim()) { msg.textContent = 'Give the song a title.'; return; }
        if (!sh.getElementById('rt').checked) { msg.textContent = 'Confirm that you own the rights.'; return; }
        busy = true; go.classList.add('dis'); msg.textContent = 'Creating…';
        api('POST', '/api/music/songs', { title: ti.value, artist: ar.value, album: al.value, genre: ge.value, rights: true }, function (s, j) {
          if (s !== 201) { busy = false; go.classList.remove('dis'); msg.textContent = (j && j.error) || 'Failed'; return; }
          up('audio', '/api/music/songs/' + j.id + '/audio', 'Uploading song…', function (ok, err) {
            if (!ok) { busy = false; go.classList.remove('dis'); msg.textContent = err || 'Upload failed'; bar.style.display = 'none'; api('POST', '/api/music/songs/' + j.id + '/delete', {}, function () {}); return; }
            function finish() { busy = false; toast('Your song is live'); tab = 'lib'; stack = []; shell(); show(); }
            if (st.cover) up('image', '/api/music/songs/' + j.id + '/cover', 'Uploading cover…', function () { finish(); }); else finish();
          });
        });
      };
    }

    /* ---------- native callbacks (chained so Store and Fmusic can both live in one page) ---------- */
    var prevPick = window.onStorePicked, prevUp = window.onStoreUpload;
    window.onStorePicked = function (kind, name, size) { var f = (!env.active || env.active()) ? pickInfo[kind] : null; if (f) f(name, size); else if (prevPick) prevPick(kind, name, size); };
    window.onStoreUpload = function (id, state, pct, text) { var f = upCb[id]; if (f) f(state, pct, text); else if (prevUp) prevUp(id, state, pct, text); };

    function init() {
      shell(); show();
      if (base()) api('GET', '/api/music/config', null, function (s, j) { if (s === 200 && j.genres) { cfg = { genres: ['All'].concat(j.genres), maxMb: j.maxMb }; if (!stack.length && (tab === 'listen' || tab === 'post')) show(); } });
    }
    init();
    return {
      open: function () { env.refreshAcct(); if (!stack.length) { shell(); show(); } },
      back: function () { return pop(); },
      depth: function () { return (playerEl || sheetEl || stack.length) ? 2 : 1; },
      resumed: function () { env.refreshAcct(); }
    };
  }
  window.MusicUI = { mount: mount };
})();
