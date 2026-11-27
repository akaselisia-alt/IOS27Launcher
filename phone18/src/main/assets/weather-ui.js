/* iOS 27 Weather: live data from Open-Meteo (free, no key). WeatherUI.mount(host, {close}) -> {open(), back()} */
(function () {
  'use strict';
  var CSS = [
    ':host{display:block;position:absolute;inset:0;color:#fff;font:400 17px/1.3 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;user-select:none;-webkit-user-select:none}',
    '*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}',
    '.root{position:absolute;inset:0;background:linear-gradient(#2f6fe0,#6ec1ff);transition:background .6s;display:flex;flex-direction:column}',
    '.root.night{background:linear-gradient(#0b1230,#2b3a78)}.root.gray{background:linear-gradient(#4a5568,#8a97ab)}',
    '.top{flex:none;height:calc(46px + env(safe-area-inset-top));padding-top:env(safe-area-inset-top);display:flex;align-items:center;justify-content:space-between;padding-left:8px;padding-right:8px}',
    '.top button{height:44px;min-width:44px;padding:0 12px;font:inherit;font-weight:600;color:#fff;background:none;border:0;cursor:pointer}',
    '.sc{flex:1;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:0 16px 30px}',
    '.hd{text-align:center;padding-top:4px}.hd .city{font-size:30px;font-weight:600}.hd .big{font-size:96px;font-weight:200;line-height:1.05;margin-top:2px}.hd .cond{font-size:20px;opacity:.95}.hd .hl{opacity:.9;margin-top:2px}',
    '.pan{border-radius:20px;background:rgba(255,255,255,.2);border:.5px solid rgba(255,255,255,.3);margin-top:14px;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}',
    '.cap{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;opacity:.75;padding:12px 14px 0}',
    '.hr{display:flex;gap:18px;overflow-x:auto;padding:12px 14px 14px;scrollbar-width:none}.hr::-webkit-scrollbar{display:none}.hr div{flex:none;text-align:center;font-size:14px}.hr .e{font-size:24px;margin:6px 0}',
    '.day{display:flex;align-items:center;gap:8px;padding:11px 14px;border-top:.5px solid rgba(255,255,255,.25)}.day:first-of-type{border-top:0}.day .n{width:60px}.day .e{flex:1}.day .lo{opacity:.7;width:42px;text-align:right}.day .hi{width:42px;text-align:right;font-weight:600}',
    '.g{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.g div{border-radius:20px;background:rgba(255,255,255,.2);border:.5px solid rgba(255,255,255,.3);padding:12px 14px}.g small{font-size:12px;text-transform:uppercase;letter-spacing:.5px;opacity:.75;font-weight:600;display:block}.g b{display:block;font-size:26px;font-weight:600;margin-top:6px}',
    '.note{text-align:center;opacity:.8;font-size:12px;margin:18px 0}.msg{text-align:center;margin-top:30vh}',
    'input{width:100%;border:0;outline:0;border-radius:14px;padding:12px 14px;font:inherit;color:#fff;background:rgba(255,255,255,.25);user-select:text;-webkit-user-select:text}input::placeholder{color:rgba(255,255,255,.7)}',
    '.sr{display:flex;justify-content:space-between;padding:14px;border-top:.5px solid rgba(255,255,255,.25);cursor:pointer}.sr:first-child{border:0}.sr:active{background:rgba(255,255,255,.15)}.sr span{opacity:.7;font-size:14px}',
    'h1{font-size:30px;font-weight:700;margin:4px 0 12px}'
  ].join('');
  var WMO = { 0: ['Clear', '☀︎'], 1: ['Mostly clear', '☀︎'], 2: ['Partly cloudy', '⛅︎'], 3: ['Overcast', '☁︎'], 45: ['Fog', '🌫︎'], 48: ['Fog', '🌫︎'], 51: ['Drizzle', '🌦︎'], 53: ['Drizzle', '🌦︎'], 55: ['Heavy drizzle', '🌧︎'], 61: ['Light rain', '🌧︎'], 63: ['Rain', '🌧︎'], 65: ['Heavy rain', '🌧︎'], 71: ['Light snow', '❄︎'], 73: ['Snow', '❄︎'], 75: ['Heavy snow', '❄︎'], 80: ['Showers', '🌦︎'], 81: ['Showers', '🌧︎'], 82: ['Heavy showers', '⛈︎'], 95: ['Thunderstorm', '⛈︎'], 96: ['Thunderstorm', '⛈︎'], 99: ['Thunderstorm', '⛈︎'] };
  function wmo(c) { return WMO[c] || WMO[c >= 95 ? 95 : c >= 80 ? 80 : c >= 71 ? 71 : c >= 61 ? 61 : c >= 51 ? 51 : 3]; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ls(k, d) { try { var v = localStorage.getItem('wx.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lw(k, v) { try { localStorage.setItem('wx.' + k, JSON.stringify(v)); } catch (e) {} }

  function mount(host, env) {
    var sh = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    sh.innerHTML = '<style>' + CSS + '</style><div class="root"><div class="top"><button id="l"></button><span style="flex:1"></span><button id="r"></button><button id="d">Done</button></div><div class="sc" id="sc"></div></div>';
    var $ = function (s) { return sh.querySelector(s); };
    var root = $('.root'), sc = $('#sc'), L = $('#l'), R = $('#r'); $('#d').onclick = function () { if (env && env.close) env.close(); };
    var place = ls('place', null), unit = ls('unit', 'c'), cache = ls('cache', null), view = 'main', seq = 0;

    function T(c) { return Math.round(unit === 'f' ? c * 9 / 5 + 32 : c) + '°'; }
    function getJSON(u) {
      return new Promise(function (ok, no) {
        var x = new XMLHttpRequest(); x.open('GET', u); x.timeout = 15000;
        x.onload = function () { if (x.status === 200) { try { ok(JSON.parse(x.responseText)); } catch (e) { no(e); } } else no(new Error('HTTP ' + x.status)); };
        x.onerror = x.ontimeout = function () { no(new Error('network')); }; x.send();
      });
    }
    function msg(t) { sc.innerHTML = '<div class="msg">' + t + '</div>'; }
    function top(left, right, lf, rf) { L.textContent = left; R.textContent = right; L.onclick = lf || null; R.onclick = rf || null; }

    function searchView() {
      view = 'search'; root.className = 'root';
      top('‹ Back', '', function () { if (place) load(); else if (env.close) env.close(); });
      var cities = ls('saved', []);
      sc.innerHTML = '<h1>Weather</h1><input id="q" placeholder="Search for a city" autocomplete="off"><div class="pan" id="res"></div>';
      var q = sc.querySelector('#q'), res = sc.querySelector('#res'), tm;
      function saved() { res.innerHTML = cities.length ? cities.map(function (c, i) { return '<div class="sr" data-i="' + i + '">' + esc(c.name) + '<span>' + esc(c.sub || '') + '</span></div>'; }).join('') : '<div class="sr" style="cursor:default">Type a city name above</div>'; [].forEach.call(res.querySelectorAll('[data-i]'), function (e) { e.onclick = function () { pick(cities[+e.dataset.i]); }; }); }
      saved();
      q.oninput = function () {
        clearTimeout(tm); var v = q.value.trim(); if (v.length < 2) { saved(); return; }
        tm = setTimeout(function () {
          getJSON('https://geocoding-api.open-meteo.com/v1/search?count=8&language=en&name=' + encodeURIComponent(v)).then(function (j) {
            var r = j.results || []; res.innerHTML = r.length ? r.map(function (p, i) { return '<div class="sr" data-i="' + i + '">' + esc(p.name) + '<span>' + esc([p.admin1, p.country].filter(Boolean).join(', ')) + '</span></div>'; }).join('') : '<div class="sr" style="cursor:default">No matches</div>';
            [].forEach.call(res.querySelectorAll('[data-i]'), function (e) { var p = r[+e.dataset.i]; e.onclick = function () { pick({ name: p.name, sub: [p.admin1, p.country].filter(Boolean).join(', '), lat: p.latitude, lon: p.longitude }); }; });
          }).catch(function () { res.innerHTML = '<div class="sr" style="cursor:default">No connection</div>'; });
        }, 300);
      };
    }
    function pick(p) {
      place = p; lw('place', p);
      var c = ls('saved', []).filter(function (x) { return x.name !== p.name || x.sub !== p.sub; }); c.unshift(p); lw('saved', c.slice(0, 8));
      load();
    }

    function render(d, fresh) {
      view = 'main';
      var c = d.current, h = d.hourly, dl = d.daily, wm = wmo(c.weather_code);
      root.className = 'root' + (c.is_day === 0 ? ' night' : (c.weather_code >= 3 && c.weather_code !== 0 ? ' gray' : ''));
      top('☰ Cities', unit === 'c' ? '°F' : '°C', searchView, function () { unit = unit === 'c' ? 'f' : 'c'; lw('unit', unit); render(d, fresh); });
      var i0 = 0, nowT = new Date(c.time).getTime();
      for (var i = 0; i < h.time.length; i++) { if (new Date(h.time[i]).getTime() >= nowT - 3600000) { i0 = i; break; } }
      var hrs = '';
      for (var k = i0; k < i0 + 24 && k < h.time.length; k++) {
        var pp = h.precipitation_probability ? h.precipitation_probability[k] : 0;
        hrs += '<div><div>' + (k === i0 ? 'Now' : new Date(h.time[k]).getHours() + 'h') + '</div><div class="e">' + wmo(h.weather_code[k])[1] + '</div><b>' + T(h.temperature_2m[k]) + '</b>' + (pp > 20 ? '<div style="font-size:11px;color:#bfe3ff">' + pp + '%</div>' : '') + '</div>';
      }
      function hm(t) { return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
      sc.innerHTML = '<div class="hd"><div class="city">' + esc(place.name) + '</div><div class="big">' + T(c.temperature_2m) + '</div><div class="cond">' + wm[1] + ' ' + wm[0] + '</div><div class="hl">H:' + T(dl.temperature_2m_max[0]) + '  L:' + T(dl.temperature_2m_min[0]) + '</div></div>' +
        '<div class="pan"><div class="cap">Hourly forecast</div><div class="hr">' + hrs + '</div></div>' +
        '<div class="pan"><div class="cap">7-day forecast</div>' + dl.time.map(function (t, i) { return '<div class="day"><span class="n">' + (i === 0 ? 'Today' : new Date(t + 'T12:00').toLocaleDateString([], { weekday: 'short' })) + '</span><span class="e">' + wmo(dl.weather_code[i])[1] + '</span><span class="lo">' + T(dl.temperature_2m_min[i]) + '</span><span class="hi">' + T(dl.temperature_2m_max[i]) + '</span></div>'; }).join('') + '</div>' +
        '<div class="g"><div><small>Feels like</small><b>' + T(c.apparent_temperature) + '</b></div><div><small>Humidity</small><b>' + Math.round(c.relative_humidity_2m) + '%</b></div><div><small>Wind</small><b>' + Math.round(c.wind_speed_10m) + ' km/h</b></div><div><small>Pressure</small><b>' + Math.round(c.pressure_msl) + ' hPa</b></div><div><small>UV index</small><b>' + Math.round(dl.uv_index_max[0]) + '</b></div><div><small>Rain chance</small><b>' + (dl.precipitation_probability_max[0] || 0) + '%</b></div><div><small>Sunrise</small><b>' + hm(dl.sunrise[0]) + '</b></div><div><small>Sunset</small><b>' + hm(dl.sunset[0]) + '</b></div></div>' +
        '<div class="note">' + (fresh ? 'Updated ' : 'Saved copy from ') + new Date(cache ? cache.at : Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ' · Data by Open-Meteo</div>';
    }
    function load() {
      if (!place) { searchView(); return; }
      var key = place.lat + ',' + place.lon, my = ++seq;
      var have = cache && cache.key === key;
      if (have) render(cache.d, Date.now() - cache.at < 600000); else { top('☰ Cities', '', searchView); root.className = 'root'; msg('Loading weather…'); }
      if (have && Date.now() - cache.at < 600000) return;
      getJSON('https://api.open-meteo.com/v1/forecast?latitude=' + place.lat + '&longitude=' + place.lon + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,is_day,weather_code,wind_speed_10m,pressure_msl&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max&timezone=auto&forecast_days=7')
        .then(function (d) { if (my !== seq) return; cache = { key: key, at: Date.now(), d: d }; lw('cache', cache); render(d, true); })
        .catch(function () { if (my !== seq) return; if (have) return; top('☰ Cities', '', searchView); msg('Can’t load the weather.<br><br>Check your internet connection, then reopen Weather.'); });
    }
    function guess() {
      var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
      var city = tz.split('/').pop().replace(/_/g, ' ');
      if (!city || city === 'UTC' || city === 'GMT') { searchView(); return; }
      top('', '', null); msg('Finding your city…');
      getJSON('https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=' + encodeURIComponent(city)).then(function (j) {
        var p = (j.results || [])[0]; if (p) pick({ name: p.name, sub: [p.admin1, p.country].filter(Boolean).join(', '), lat: p.latitude, lon: p.longitude }); else searchView();
      }).catch(function () { searchView(); });
    }
    if (place) load(); else guess();
    return {
      open: function () { if (view === 'main' && place) load(); },
      back: function () { if (view === 'search' && place) { load(); return true; } return false; },
      depth: function () { return view === 'search' && place ? 2 : 1; }
    };
  }
  window.WeatherUI = { mount: mount };
})();
