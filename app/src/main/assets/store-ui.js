/* iOS 27 Store UI. One file, used by the launcher (as a sheet) and by the separate Store app.
 *   StoreUI.mount(hostElement, env) -> { open(), resumed(), back() }
 *   env = { A, api(method, path, body, cb(status, json)), server(), acct(), refreshAcct(), close(), toast(text) }
 */
(function () {
  'use strict';
  var CSS = [
    ':host{display:block;position:absolute;inset:0;--bg:#f2f2f7;--card:#fff;--text:#000;--sub:#6d6d72;--line:#c6c6c8;--tint:#007aff;--fill:#e9e9ee;--green:#34c759;--red:#ff3b30;',
    'font:400 17px/1.3 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:var(--text);background:var(--bg);-webkit-font-smoothing:antialiased;user-select:none;-webkit-user-select:none}',
    '@media (prefers-color-scheme:dark){:host{--bg:#000;--card:#1c1c1e;--text:#fff;--sub:#8e8e93;--line:#38383a;--tint:#0a84ff;--fill:#2c2c2e;--green:#30d158;--red:#ff453a}}',
    '*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}',
    '.root{position:absolute;inset:0;overflow:hidden}',
    '.page{position:absolute;inset:0;background:var(--bg);display:flex;flex-direction:column;transform:translateX(100%);transition:transform .3s cubic-bezier(.25,.1,.25,1);will-change:transform}',
    '.page.on{transform:none}.page.under{transform:translateX(-30%)}.page.base{transform:none;transition:none}',
    '.bar{flex:none;height:calc(44px + env(safe-area-inset-top));padding-top:env(safe-area-inset-top);display:flex;align-items:center;position:relative}',
    '.bar .t{position:absolute;left:0;right:0;text-align:center;font-weight:600;opacity:0;pointer-events:none}.bar.line .t{opacity:1}',
    '.bar::after{content:"";position:absolute;left:0;right:0;bottom:0;height:.5px;background:var(--line);opacity:0}.bar.line::after{opacity:1}',
    '.back{display:flex;align-items:center;gap:4px;color:var(--tint);padding:0 10px;height:44px;cursor:pointer;z-index:1}.back svg{width:13px;height:22px}',
    '.x{position:absolute;right:0;top:env(safe-area-inset-top);height:44px;padding:0 16px;display:flex;align-items:center;color:var(--tint);font-weight:600;cursor:pointer;z-index:2}',
    '.scroll{flex:1;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:0 16px 28px}',
    'h1{font-size:34px;line-height:41px;font-weight:700;letter-spacing:.3px;padding:4px 0 10px}h2{font-size:22px;font-weight:700;margin:20px 0 8px}',
    '.tabs{flex:none;display:flex;background:var(--card);border-top:.5px solid var(--line);padding-bottom:env(safe-area-inset-bottom)}',
    '.tab{flex:1;text-align:center;padding:8px 0 6px;font-size:10.5px;color:var(--sub);cursor:pointer}.tab svg{display:block;margin:0 auto 2px;width:25px;height:25px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.tab.on{color:var(--tint)}',
    '.chips{display:flex;gap:8px;overflow-x:auto;padding:2px 0 12px;scrollbar-width:none}.chips::-webkit-scrollbar{display:none}',
    '.chip{flex:none;padding:7px 14px;border-radius:16px;background:var(--fill);font-size:14px;font-weight:500;cursor:pointer}.chip.on{background:var(--tint);color:#fff}',
    '.list{background:var(--card);border-radius:14px;overflow:hidden}',
    '.app{display:flex;gap:12px;align-items:center;padding:10px 12px;position:relative;cursor:pointer}.app+.app::before{content:"";position:absolute;top:0;left:84px;right:0;height:.5px;background:var(--line)}',
    '.app:active{background:var(--fill)}.ico{width:60px;height:60px;border-radius:14px;flex:none;background:var(--fill);overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;color:#fff}.ico img{width:100%;height:100%;object-fit:cover;display:block}',
    '.app .m{flex:1;min-width:0}.app .n{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sub{color:var(--sub);font-size:13px}',
    '.get{flex:none;min-width:70px;text-align:center;padding:7px 14px;border-radius:15px;background:var(--fill);color:var(--tint);font-weight:700;font-size:15px;cursor:pointer;text-transform:uppercase}.get.big{padding:10px 26px;font-size:16px}.get.dis{opacity:.55}',
    '.input{width:100%;border:0;outline:0;background:var(--card);color:var(--text);font:inherit;padding:12px 14px;border-radius:12px;margin-bottom:10px;user-select:text;-webkit-user-select:text}textarea.input{resize:none;min-height:96px}',
    '.btn{display:block;width:100%;text-align:center;padding:13px;border-radius:13px;background:var(--tint);color:#fff;font-weight:600;margin:8px 0;cursor:pointer}.btn.alt{background:var(--fill);color:var(--tint)}.btn.red{background:var(--red)}.btn:active{opacity:.8}',
    '.card{background:var(--card);border-radius:14px;padding:14px;margin-bottom:12px}.row{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:.5px solid var(--line)}.row:last-child{border:0}',
    '.hero{display:flex;gap:16px;align-items:center;padding:8px 0 14px}.hero .ico{width:96px;height:96px;border-radius:22px;font-size:40px}.hero .n{font-size:22px;font-weight:700}',
    '.stats{display:flex;background:var(--card);border-radius:14px;margin:6px 0 14px}.stat{flex:1;text-align:center;padding:10px 4px;border-right:.5px solid var(--line)}.stat:last-child{border:0}.stat b{display:block;font-size:17px}.stat span{font-size:11px;color:var(--sub);text-transform:uppercase}',
    '.desc{white-space:pre-wrap;line-height:1.4;font-size:15px;user-select:text;-webkit-user-select:text}.bar2{height:6px;border-radius:3px;background:var(--fill);overflow:hidden;margin-top:8px}.bar2 i{display:block;height:100%;width:0;background:var(--tint);transition:width .2s}',
    '.empty{text-align:center;color:var(--sub);padding:40px 10px}.star{color:#ff9f0a}.tag{font-size:11px;padding:2px 7px;border-radius:7px;background:var(--fill);margin-left:6px;text-transform:uppercase;color:var(--sub)}.tag.ok{background:rgba(52,199,89,.2);color:var(--green)}.tag.bad{background:rgba(255,59,48,.2);color:var(--red)}',
    '.rate{display:flex;gap:6px;font-size:30px;margin:6px 0}.rate span{cursor:pointer;color:var(--fill)}.rate span.on{color:#ff9f0a}',
    '.toast{position:absolute;left:50%;bottom:90px;transform:translateX(-50%);background:rgba(30,30,34,.95);color:#fff;padding:10px 16px;border-radius:14px;font-size:14px;max-width:86%;text-align:center;opacity:0;pointer-events:none;transition:opacity .2s;z-index:9}.toast.on{opacity:1}',
    'select.input{appearance:none}'
  ].join('\n');
  var BACKI = '<svg viewBox="0 0 13 22"><path d="M11 2L2 11l9 9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var TABI = {
    today: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/></svg>',
    library: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M4 20h16"/></svg>',
    me: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>'
  };
  var COLORS = ['#ff6b6b', '#4dabf7', '#51cf66', '#ffa94d', '#9775fa', '#f06595', '#22b8cf', '#fcc419'];

  function E(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function mount(host, env) {
    var A = env.A, shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<style>' + CSS + '</style><div class="root" id="root"></div><div class="toast" id="toast"></div>';
    var root = shadow.getElementById('root'), toastEl = shadow.getElementById('toast');
    var stack = [], cfg = { categories: [], currency: '', payments: false }, tab = 'today', toastT;
    var st = { cat: '', sort: 'top', q: '' };
    var installReq = {}, reqN = 0, pickInfo = {}, upCb = {};

    function toast(t) { toastEl.textContent = t; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 2600); }
    function acct() { try { return env.acct() || {}; } catch (e) { return {}; } }
    function money(minor) { if (!minor) return 'Free'; var c = cfg.currency; return (c === 'XOF' ? minor : (minor / 100).toFixed(2)) + ' ' + c; }
    function api(m, p, b, cb) { env.api(m, p, b, function (s, j) { cb(s, j || {}); }); }
    function iconEl(a, cls) {
      var d = E('div', cls || 'ico');
      if (a.icon && env.server()) { var im = document.createElement('img'); im.loading = 'lazy'; im.src = env.server() + '/api/store/apps/' + a.id + '/icon'; im.onerror = function () { im.remove(); fb(); }; d.appendChild(im); }
      else fb();
      function fb() { d.style.background = COLORS[(a.name.charCodeAt(0) || 0) % COLORS.length]; d.textContent = (a.name[0] || '?').toUpperCase(); }
      return d;
    }
    function installed(a) { try { return A && A.storeInstalled ? A.storeInstalled(a.pkg) : ''; } catch (e) { return ''; } }
    function stars(r) { var s = ''; for (var i = 1; i <= 5; i++) s += i <= Math.round(r) ? '★' : '☆'; return s; }

    /* ----- navigation ----- */
    function pageEl(title, isBase) {
      var p = E('div', 'page' + (isBase ? ' base' : '')), bar = E('div', 'bar');
      if (!isBase) { var b = E('div', 'back'); b.innerHTML = BACKI + '<span>' + (stack.length > 1 ? 'Back' : 'Store') + '</span>'; b.onclick = pop; bar.appendChild(b); }
      bar.appendChild(E('div', 't', title));
      var sc = E('div', 'scroll'); p.appendChild(bar); p.appendChild(sc);
      var tk = false; sc.addEventListener('scroll', function () { if (tk) return; tk = true; requestAnimationFrame(function () { tk = false; bar.classList.toggle('line', sc.scrollTop > 40); }); }, { passive: true });
      return { el: p, body: sc, title: title, bar: bar };
    }
    function push(page) {
      root.appendChild(page.el); var below = stack[stack.length - 1]; void page.el.offsetWidth;
      page.el.classList.add('on'); if (below) below.el.classList.add('under'); stack.push(page); return page;
    }
    function pop() {
      if (stack.length < 2) return false;
      var top = stack.pop(), below = stack[stack.length - 1]; top.el.classList.remove('on'); below.el.classList.remove('under');
      if (top.onPop) top.onPop();
      setTimeout(function () { if (top.el.parentNode) top.el.parentNode.removeChild(top.el); }, 320); return true;
    }

    /* ----- shell with tabs ----- */
    var shell = null, content = null, tabsEl = null;
    function buildShell() {
      root.innerHTML = ''; stack = [];
      shell = E('div', 'page base'); shell.style.display = 'flex';
      content = E('div', ''); content.style.cssText = 'flex:1;position:relative;overflow:hidden';
      tabsEl = E('div', 'tabs');
      [['today', 'Today'], ['search', 'Search'], ['library', 'Library'], ['me', 'Account']].forEach(function (t) {
        var d = E('div', 'tab' + (t[0] === tab ? ' on' : '')); d.innerHTML = TABI[t[0]] + t[1]; d.setAttribute('data-t', t[0]);
        d.onclick = function () { tab = t[0]; [].forEach.call(tabsEl.children, function (c) { c.classList.toggle('on', c === d); }); showTab(); }; tabsEl.appendChild(d);
      });
      shell.appendChild(content); shell.appendChild(tabsEl);
      var x = E('div', 'x', 'Done'); x.onclick = function () { env.close(); }; if (env.close) shell.appendChild(x);
      root.appendChild(shell); stack.push({ el: shell, title: 'Store', base: true });
    }
    function showTab() {
      content.innerHTML = '';
      var pg = E('div', ''); pg.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column';
      var bar = E('div', 'bar'); bar.style.cssText = 'height:calc(44px + env(safe-area-inset-top))'; pg.appendChild(bar);
      var sc = E('div', 'scroll'); pg.appendChild(sc); content.appendChild(pg);
      sc.appendChild(E('h1', '', { today: 'Store', search: 'Search', library: 'Library', me: 'Account' }[tab]));
      ({ today: tabToday, search: tabSearch, library: tabLibrary, me: tabMe })[tab](sc);
    }

    /* ----- Today ----- */
    function appRow(a, onTap) {
      var r = E('div', 'app'); r.appendChild(iconEl(a));
      var m = E('div', 'm'); m.appendChild(E('div', 'n', a.name));
      m.appendChild(E('div', 'sub', a.category + (a.ratings ? ' · ' + a.rating + '★' : '') + ' · ' + a.downloads + ' installs'));
      r.appendChild(m);
      var g = E('div', 'get', labelFor(a)); r.appendChild(g);
      r.onclick = function () { detail(a.id); }; g.onclick = function (e) { e.stopPropagation(); detail(a.id); };
      return r;
    }
    function labelFor(a) { var v = installed(a); if (v) return v !== a.version ? 'Update' : 'Open'; return a.priceMinor ? money(a.priceMinor) : 'Get'; }
    function loadList(sc, listEl, q) {
      listEl.innerHTML = ''; listEl.appendChild(E('div', 'empty', 'Loading…'));
      var qs = '?sort=' + st.sort + (st.cat ? '&category=' + encodeURIComponent(st.cat) : '') + (q ? '&q=' + encodeURIComponent(q) : '');
      api('GET', '/api/store/apps' + qs, null, function (s, j) {
        listEl.innerHTML = '';
        if (s !== 200) { listEl.appendChild(E('div', 'empty', s === 0 ? 'No connection to the store server.' : (j.error || 'Could not load.'))); return; }
        if (!j.apps.length) { listEl.appendChild(E('div', 'empty', q ? 'No apps found.' : 'No apps yet. Be the first to publish one!')); return; }
        var l = E('div', 'list'); j.apps.forEach(function (a) { l.appendChild(appRow(a)); }); listEl.appendChild(l);
      });
    }
    function tabToday(sc) {
      var chips = E('div', 'chips');
      function drawChips() {
        chips.innerHTML = '';
        [['top', 'Top'], ['new', 'New'], ['rating', 'Best rated']].forEach(function (s) { var c = E('div', 'chip' + (st.sort === s[0] ? ' on' : ''), s[1]); c.onclick = function () { st.sort = s[0]; drawChips(); loadList(sc, listEl); }; chips.appendChild(c); });
        [''].concat(cfg.categories).forEach(function (c) { var d = E('div', 'chip' + (st.cat === c ? ' on' : ''), c || 'All'); d.onclick = function () { st.cat = c; drawChips(); loadList(sc, listEl); }; chips.appendChild(d); });
      }
      var listEl = E('div', ''); sc.appendChild(chips); sc.appendChild(listEl);
      drawChips(); loadList(sc, listEl);
    }
    function tabSearch(sc) {
      var i = E('input', 'input'); i.placeholder = 'Search apps'; i.type = 'search'; var listEl = E('div', ''), t;
      i.oninput = function () { clearTimeout(t); t = setTimeout(function () { if (i.value.trim().length < 2) { listEl.innerHTML = ''; return; } loadList(sc, listEl, i.value.trim()); }, 350); };
      sc.appendChild(i); sc.appendChild(listEl);
    }
    function tabLibrary(sc) {
      var a = acct();
      if (!a.signedIn) { sc.appendChild(E('div', 'empty', 'Sign in (Account tab) to see apps you have installed or bought.')); return; }
      var listEl = E('div', ''); sc.appendChild(listEl); listEl.appendChild(E('div', 'empty', 'Loading…'));
      api('GET', '/api/store/library', null, function (s, j) {
        listEl.innerHTML = ''; if (s !== 200 || !j.apps.length) { listEl.appendChild(E('div', 'empty', s === 200 ? 'Nothing here yet.' : (j.error || 'Could not load.'))); return; }
        var l = E('div', 'list'); j.apps.forEach(function (x) { l.appendChild(appRow(x)); }); listEl.appendChild(l);
      });
    }

    /* ----- App detail, install, buy ----- */
    function detail(id) {
      var pg = push(pageEl('App')), body = pg.body, poll = null;
      body.appendChild(E('div', 'empty', 'Loading…'));
      pg.onPop = function () { clearInterval(poll); };
      function load() {
        api('GET', '/api/store/apps/' + id, null, function (s, a) {
          body.innerHTML = '';
          if (s !== 200) { body.appendChild(E('div', 'empty', a.error || 'Could not load.')); return; }
          pg.bar.querySelector('.t').textContent = a.name;
          var hero = E('div', 'hero'); hero.appendChild(iconEl(a));
          var hm = E('div', ''); hm.appendChild(E('div', 'n', a.name)); hm.appendChild(E('div', 'sub', a.developer + ' · ' + a.category));
          var btn = E('div', 'get big'); hm.appendChild(btn); hero.appendChild(hm); body.appendChild(hero);
          if (a.status && a.status !== 'approved') body.appendChild(E('div', 'card', 'Status: ' + a.status + (a.status === 'pending' ? ' (waiting for review, only you can see this)' : '')));
          var stats = E('div', 'stats');
          [[a.ratings ? a.rating + '★' : '—', a.ratings + ' ratings'], [String(a.downloads), 'installs'], [a.size ? (a.size / 1048576).toFixed(1) + ' MB' : '—', 'size'], [a.version || '—', 'version']].forEach(function (x) { var d = E('div', 'stat'); d.appendChild(E('b', '', x[0])); d.appendChild(E('span', '', x[1])); stats.appendChild(d); });
          body.appendChild(stats);
          var prog = E('div', 'bar2'), pi = E('i'); prog.appendChild(pi); prog.style.display = 'none'; body.appendChild(prog);
          var note = E('div', 'sub', ''); body.appendChild(note);
          body.appendChild(E('h2', '', 'About')); var d = E('div', 'desc', a.description || 'No description.'); body.appendChild(d);
          if (a.priceMinor && !cfg.payments) note.textContent = 'Payments are not enabled on this server yet.';

          function setBtn() {
            var v = installed(a), own = a.owned;
            btn.textContent = v ? (v !== a.version ? 'Update' : 'Open') : (!own && a.priceMinor ? 'Buy ' + money(a.priceMinor) : 'Get');
          }
          setBtn();
          btn.onclick = function () {
            var v = installed(a);
            if (v && v === a.version) { if (A && A.storeOpen) A.storeOpen(a.pkg); return; }
            if (!A || !A.storeInstall) { toast('Installing works inside the Android app'); return; }
            if (!a.owned && a.priceMinor) return buy(a, load, poll, function (p) { poll = p; });
            if (a.priceMinor && !acct().signedIn) { toast('Sign in first (Account tab)'); return; }
            var rid = ++reqN; prog.style.display = 'block'; pi.style.width = '2%'; btn.classList.add('dis'); note.textContent = 'Starting…';
            installReq[rid] = function (state, pct, text) {
              if (state === 'download') { pi.style.width = Math.max(2, pct) + '%'; note.textContent = 'Downloading ' + pct + '%'; }
              else if (state === 'install') { pi.style.width = '100%'; note.textContent = 'Installing… confirm on the screen that appears.'; }
              else if (state === 'done') { delete installReq[rid]; prog.style.display = 'none'; btn.classList.remove('dis'); note.textContent = 'Installed ✓'; setBtn(); toast('Installed'); }
              else if (state === 'permission') { btn.classList.remove('dis'); prog.style.display = 'none'; note.textContent = 'Allow installs from this app in the settings page that opened, then tap Get again.'; }
              else { delete installReq[rid]; prog.style.display = 'none'; btn.classList.remove('dis'); note.textContent = text || 'Install failed.'; setBtn(); }
            };
            A.storeInstall(rid, a.id, a.sha256, a.pkg);
          };
          var more = E('div', 'list'); more.style.marginTop = '14px';
          var un = E('div', 'app'); un.appendChild(E('div', 'm', 'Uninstall')); un.onclick = function () { if (A && A.storeUninstall && installed(a)) A.storeUninstall(a.pkg); else toast('Not installed'); }; more.appendChild(un);
          var rp = E('div', 'app'); rp.appendChild(E('div', 'm', 'Report a problem')); rp.onclick = function () { reportApp(a); }; more.appendChild(rp); body.appendChild(more);
          body.appendChild(E('h2', '', 'Ratings & reviews'));
          if (acct().signedIn) { var wr = E('div', 'btn alt', a.mine ? 'Edit your review' : 'Write a review'); wr.onclick = function () { reviewPage(a, load); }; body.appendChild(wr); }
          if (!a.reviews.length) body.appendChild(E('div', 'sub', 'No reviews yet.'));
          a.reviews.forEach(function (r) { var c = E('div', 'card'); c.appendChild(E('div', 'star', stars(r.rating))); c.appendChild(E('div', 'sub', r.user)); if (r.text) c.appendChild(E('div', 'desc', r.text)); body.appendChild(c); });
          pg.refresh = setBtn;
        });
      }
      load(); pg.reload = load;
    }
    function buy(a, reload, oldPoll, setPoll) {
      if (!acct().signedIn) { toast('Sign in first (Account tab)'); return; }
      if (!cfg.payments) { toast('Payments are not enabled on this server'); return; }
      toast('Opening payment…');
      api('POST', '/api/store/apps/' + a.id + '/buy', {}, function (s, j) {
        if (s !== 200) { toast(j.error || 'Could not start payment'); return; }
        if (j.owned) { reload(); return; }
        if (A && A.openUrl) A.openUrl(j.url); else window.open(j.url);
        var n = 0, p = setInterval(function () {
          if (++n > 100) { clearInterval(p); return; }
          api('GET', '/api/store/purchases/' + j.ref, null, function (s2, j2) { if (s2 === 200 && j2.status === 'paid') { clearInterval(p); toast('Payment received'); reload(); } });
        }, 3000);
        if (setPoll) setPoll(p);
      });
    }
    function reportApp(a) {
      var pg = push(pageEl('Report')); pg.body.appendChild(E('h1', '', 'Report')); pg.body.appendChild(E('div', 'sub', 'Tell us what is wrong with ' + a.name + ' (malware, scam, copied app, offensive content).'));
      var t = E('textarea', 'input'); t.placeholder = 'What happened?'; t.maxLength = 300; t.style.marginTop = '12px'; pg.body.appendChild(t);
      var b = E('div', 'btn red', 'Send report'); b.onclick = function () { if (!acct().signedIn) { toast('Sign in first'); return; } api('POST', '/api/store/apps/' + a.id + '/report', { reason: t.value }, function (s, j) { toast(s === 200 ? 'Thanks, we will look at it' : (j.error || 'Failed')); if (s === 200) pop(); }); }; pg.body.appendChild(b);
    }
    function reviewPage(a, reload) {
      var pg = push(pageEl('Review')), r = a.mine ? a.mine.rating : 5; pg.body.appendChild(E('h1', '', 'Review'));
      var rate = E('div', 'rate'); function draw() { rate.innerHTML = ''; for (var i = 1; i <= 5; i++) (function (i) { var s = E('span', i <= r ? 'on' : '', '★'); s.onclick = function () { r = i; draw(); }; rate.appendChild(s); })(i); } draw(); pg.body.appendChild(rate);
      var t = E('textarea', 'input'); t.placeholder = 'Say something about this app (optional)'; t.maxLength = 600; t.value = a.mine ? a.mine.text : ''; pg.body.appendChild(t);
      var b = E('div', 'btn', 'Submit'); b.onclick = function () { api('POST', '/api/store/apps/' + a.id + '/reviews', { rating: r, text: t.value }, function (s, j) { if (s === 200) { pop(); reload(); toast('Thanks!'); } else toast(j.error || 'Failed'); }); }; pg.body.appendChild(b);
    }

    /* ----- Account + developer ----- */
    function tabMe(sc) {
      var a = acct();
      if (!env.server()) { sc.appendChild(E('div', 'empty', 'No store server is set up yet.')); if (env.openSettings) { var b = E('div', 'btn', 'Open launcher Settings'); b.onclick = env.openSettings; sc.appendChild(b); } else if (env.setServer) serverForm(sc); return; }
      if (!a.signedIn) { signInForm(sc); return; }
      var c = E('div', 'card'); c.appendChild(E('b', '', 'Signed in as ' + a.id)); sc.appendChild(c);
      var out = E('div', 'btn alt', 'Sign out'); out.onclick = function () { api('POST', '/api/logout', {}, function () { if (A && A.acctSignOut) A.acctSignOut(); env.refreshAcct(); showTab(); }); }; sc.appendChild(out);
      sc.appendChild(E('h2', '', 'Developer'));
      var dv = E('div', ''); sc.appendChild(dv); dv.appendChild(E('div', 'sub', 'Loading…'));
      function loadDev() {
        api('GET', '/api/store/mine', null, function (s, j) {
          dv.innerHTML = ''; if (s !== 200) { dv.appendChild(E('div', 'sub', j.error || 'Could not load.')); return; }
          var e = j.earnings; var cc = E('div', 'card'); cc.appendChild(E('div', '', 'Balance: ' + money(e.balance))); cc.appendChild(E('div', 'sub', 'Earned ' + money(e.earned) + ' · paid out ' + money(e.paid) + ' · the store keeps ' + (cfg.feePercent || 30) + '% of each sale')); dv.appendChild(cc);
          var nb = E('div', 'btn', 'Publish a new app'); nb.onclick = function () { newApp(loadDev); }; dv.appendChild(nb);
          if (j.apps.length) { var l = E('div', 'list'); j.apps.forEach(function (x) { var r = appRow(x); r.onclick = function () { manage(x.id, loadDev); }; var g = r.querySelector('.get'); g.textContent = x.status; g.style.fontSize = '11px'; g.onclick = function (ev) { ev.stopPropagation(); manage(x.id, loadDev); }; l.appendChild(r); }); dv.appendChild(l); }
          dv.appendChild(E('div', 'sub', 'You can also publish from a computer at ' + env.server() + '/developer'));
        });
      }
      loadDev();
    }
    function signInForm(sc) {
      var idI = E('input', 'input'), pwI = E('input', 'input'); idI.placeholder = 'Launcher ID'; idI.autocapitalize = 'off'; pwI.type = 'password'; pwI.placeholder = 'Password (8+ characters)';
      sc.appendChild(E('div', 'sub', 'Sign in with your launcher ID to install paid apps, review apps and publish your own. No Google account needed.')); sc.appendChild(E('div', '', '')).style.height = '10px';
      sc.appendChild(idI); sc.appendChild(pwI); var msg = E('div', 'sub', '');
      function go(path) {
        var id = idI.value.trim().toLowerCase(), pw = pwI.value; if (!/^[a-z0-9_.]{3,24}$/.test(id) || pw.length < 8) { msg.textContent = 'ID 3–24 letters/numbers, password 8+ characters.'; return; }
        msg.textContent = 'Please wait…';
        api('POST', path, { id: id, password: pw }, function (s, j) {
          if (s !== 200 && s !== 201) { msg.textContent = j.error || 'Failed'; return; }
          env.refreshAcct();
          if (j.recovery) { var pg = push(pageEl('Recovery code')); pg.body.appendChild(E('h1', '', 'Recovery code')); pg.body.appendChild(E('div', 'sub', 'Save this code. It is the only way to reset your password. It is shown once.')); var c = E('div', 'card', j.recovery); c.style.cssText = 'font-size:20px;font-weight:600;letter-spacing:1px;user-select:all;-webkit-user-select:all;margin-top:12px'; pg.body.appendChild(c); var ok = E('div', 'btn', 'I saved it'); ok.onclick = function () { pop(); showTab(); }; pg.body.appendChild(ok); }
          else showTab();
        });
      }
      var b1 = E('div', 'btn', 'Sign in'), b2 = E('div', 'btn alt', 'Create account'); b1.onclick = function () { go('/api/login'); }; b2.onclick = function () { go('/api/register'); };
      sc.appendChild(b1); sc.appendChild(b2); sc.appendChild(msg);
    }
    function serverForm(sc) {
      var i = E('input', 'input'); i.placeholder = 'https://your-server.example.com'; i.autocapitalize = 'off'; sc.appendChild(i);
      var b = E('div', 'btn', 'Save server'); b.onclick = function () { var e = env.setServer(i.value); if (e) toast(e); else { env.refreshAcct(); init(); } }; sc.appendChild(b);
    }
    function newApp(done) {
      var pg = push(pageEl('New app')); pg.body.appendChild(E('h1', '', 'New app'));
      var n = E('input', 'input'), k = E('input', 'input'), d = E('textarea', 'input'), c = E('select', 'input'), p = E('input', 'input');
      n.placeholder = 'App name'; k.placeholder = 'Package name (com.yourname.app)'; k.autocapitalize = 'off'; d.placeholder = 'Description'; p.placeholder = 'Price in ' + cfg.currency + ' (0 = free)'; p.type = 'number'; p.min = '0';
      cfg.categories.forEach(function (x) { var o = E('option', '', x); c.appendChild(o); });
      [n, k, c, d, p].forEach(function (x) { pg.body.appendChild(x); });
      pg.body.appendChild(E('div', 'sub', 'New apps and every new version are reviewed before they appear in the store.'));
      var b = E('div', 'btn', 'Create'); b.onclick = function () {
        var pr = parseFloat(p.value || '0') || 0, minor = cfg.currency === 'XOF' ? Math.round(pr) : Math.round(pr * 100);
        api('POST', '/api/store/apps', { name: n.value, pkg: k.value, category: c.value, description: d.value, priceMinor: minor }, function (s, j) { if (s === 201) { pop(); done(); manage(j.id, done); } else toast(j.error || 'Failed'); });
      }; pg.body.appendChild(b);
    }
    function manage(id, done) {
      var pg = push(pageEl('Manage')); pg.body.appendChild(E('h1', '', 'Manage app'));
      var holder = E('div', ''); pg.body.appendChild(holder);
      function load() {
        api('GET', '/api/store/mine', null, function (s, j) {
          holder.innerHTML = ''; var a = (j.apps || []).filter(function (x) { return x.id === id; })[0]; if (!a) { holder.appendChild(E('div', 'empty', 'Not found')); return; }
          var h = E('div', 'hero'); h.appendChild(iconEl(a)); var hm = E('div', ''); hm.appendChild(E('div', 'n', a.name)); hm.appendChild(E('div', 'sub', a.pkg + ' · ' + (a.priceMinor ? money(a.priceMinor) : 'Free'))); var t = E('span', 'tag ' + (a.status === 'approved' ? 'ok' : a.status === 'rejected' || a.status === 'suspended' ? 'bad' : ''), a.status); hm.appendChild(t); h.appendChild(hm); holder.appendChild(h);
          if (a.note) holder.appendChild(E('div', 'card', 'Reviewer note: ' + a.note));
          a.versions.forEach(function (v) { holder.appendChild(E('div', 'sub', 'v' + v.name + ' · ' + (v.size / 1048576).toFixed(1) + ' MB · ' + v.status)); });
          holder.appendChild(E('h2', '', 'Upload'));
          var ver = E('input', 'input'); ver.placeholder = 'Version name, e.g. 1.0.3'; holder.appendChild(ver);
          pickRow(holder, 'apk', 'Choose APK file', function (info) { return upload('/api/store/apps/' + id + '/apk?versionName=' + encodeURIComponent(ver.value || '1.0'), 'apk', info, load); });
          pickRow(holder, 'image', 'Choose icon (PNG/JPG)', function (info) { return upload('/api/store/apps/' + id + '/icon', 'image', info, load); });
          var del = E('div', 'btn red', 'Delete app'); del.onclick = function () { if (!confirm('Delete ' + a.name + '?')) return; api('POST', '/api/store/apps/' + id + '/delete', {}, function (s2) { if (s2 === 200) { pop(); done(); } }); }; holder.appendChild(del);
        });
      }
      load();
    }
    function pickRow(parent, kind, label, onUpload) {
      var box = E('div', 'card'), name = E('div', 'sub', 'No file chosen'), pick = E('div', 'btn alt', label), up = E('div', 'btn', 'Upload'), prog = E('div', 'bar2'), pi = E('i'); prog.appendChild(pi); prog.style.display = 'none';
      pick.onclick = function () { if (!A || !A.storePick) { toast('Choose files inside the Android app, or use the website'); return; } pickInfo[kind] = function (n, size) { name.textContent = n + ' (' + (size / 1048576).toFixed(1) + ' MB)'; }; A.storePick(kind); };
      up.onclick = function () { prog.style.display = 'block'; pi.style.width = '2%'; onUpload({ bar: pi, done: function (ok, text) { prog.style.display = 'none'; toast(ok ? 'Uploaded' : text || 'Upload failed'); if (ok) { name.textContent = 'No file chosen'; } } }); };
      box.appendChild(pick); box.appendChild(name); box.appendChild(up); box.appendChild(prog); parent.appendChild(box);
    }
    function upload(path, kind, info, reload) {
      var id = ++reqN; upCb[id] = function (state, pct, text) {
        if (state === 'progress') info.bar.style.width = Math.max(2, pct) + '%';
        else { delete upCb[id]; var ok = state === 'done'; info.done(ok, text); if (ok) reload(); }
      };
      if (A && A.storeUpload) A.storeUpload(id, kind, path); else { delete upCb[id]; info.done(false, 'Not available here'); }
    }

    /* ----- native callbacks ----- */
    var prevProg = window.onStoreProgress, prevPick = window.onStorePicked, prevUp = window.onStoreUpload;
    window.onStoreProgress = function (id, state, pct, text) { var f = installReq[id]; if (f) f(state, pct, text); else if (prevProg) prevProg(id, state, pct, text); };
    window.onStorePicked = function (kind, name, size) { var f = (!env.active || env.active()) ? pickInfo[kind] : null; if (f) f(name, size); else if (prevPick) prevPick(kind, name, size); };
    window.onStoreUpload = function (id, state, pct, text) { var f = upCb[id]; if (f) f(state, pct, text); else if (prevUp) prevUp(id, state, pct, text); };

    function init() {
      buildShell();
      if (!env.server()) { showTab(); return; }
      api('GET', '/api/store/config', null, function (s, j) { if (s === 200) cfg = j; showTab(); });
    }
    init();
    return {
      open: function () { env.refreshAcct(); init(); },
      resumed: function () { var top = stack[stack.length - 1]; if (top && top.refresh) top.refresh(); if (top && top.reload) top.reload(); },
      back: function () { return pop(); },
      depth: function () { return stack.length; }
    };
  }
  window.StoreUI = { mount: mount };
})();
