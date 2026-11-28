/* Built-in apps for icons whose real app is not on the phone: Notes, Calculator, Clock, Calendar, Compass, Health, Wallet.
 *   BuiltinUI.open(host, id, { close }) shows the app full screen inside host. Data stays in this phone's local storage. */
(function () {
  'use strict';
  var CSS = ':host{display:block;position:absolute;inset:0;--ink:#0b0d12;--ink2:rgba(60,60,67,.62);--sheet:#f2f2f7;--card:#fff;--line:rgba(60,60,67,.18);--accent:#0a84ff;--good:#30d158;--bad:#ff453a;--disp:-apple-system,BlinkMacSystemFont,"SF Pro Display","Inter","Segoe UI",Roboto,sans-serif;font:16px/1.3 -apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink);-webkit-font-smoothing:antialiased;user-select:none;-webkit-user-select:none}' +
    '@media (prefers-color-scheme:dark){:host{--ink:#f5f6fa;--ink2:rgba(235,235,245,.6);--sheet:#000;--card:#1c1c1e;--line:rgba(235,235,245,.18)}}' +
    '*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}button{font:inherit;color:inherit;border:0;background:none;cursor:pointer}input,textarea{font:inherit;color:inherit}' +
    '.win{position:absolute;inset:0;background:var(--sheet);display:flex;flex-direction:column;overflow:hidden}.win .top{height:calc(8px + env(safe-area-inset-top));flex:none}' +
    '.sub{color:var(--ink2)}.empty{text-align:center}.toast{position:absolute;left:50%;bottom:90px;transform:translateX(-50%);background:rgba(30,30,34,.95);color:#fff;padding:10px 16px;border-radius:14px;font-size:14px;opacity:0;transition:opacity .2s;pointer-events:none;z-index:9}.toast.on{opacity:1}' +
    "/* app windows */ .win{position:absolute;inset:0;z-index:30;background:var(--sheet);color:var(--ink);display:flex;flex-direction:column;overflow:hidden;will-change:transform,border-radius} .win.opening{transition:transform .42s cubic-bezier(.2,.85,.25,1),border-radius .42s,opacity .3s} .win .top{height:54px;flex:none} .nav{flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 16px;height:46px;font-weight:600} .nav .l,.nav .r{min-width:70px;color:var(--accent);font-weight:500;cursor:pointer}.nav .r{text-align:right} .body{flex:1;overflow:auto;overscroll-behavior:contain;padding:0 16px 120px;-webkit-overflow-scrolling:touch} h1.lg{font-family:var(--disp);font-size:34px;letter-spacing:-.6px;margin:2px 0 12px} .card{background:var(--card);border-radius:16px;overflow:hidden}.row{display:flex;align-items:center;gap:12px;padding:12px 16px;min-height:48px;position:relative}.row+.row::before{content:\"\";position:absolute;top:0;left:16px;right:0;height:.5px;background:var(--line)} .row .sp{flex:1}.row .sub{color:var(--ink2);font-size:15px} .grp{margin:0 0 22px}.cap{font-size:13px;color:var(--ink2);text-transform:uppercase;letter-spacing:.4px;margin:0 16px 7px} .sw{width:51px;height:31px;border-radius:16px;background:rgba(120,120,128,.32);position:relative;transition:.25s;flex:none}.sw::after{content:\"\";position:absolute;left:2px;top:2px;width:27px;height:27px;border-radius:50%;background:#fff;box-shadow:0 2px 5px rgba(0,0,0,.3);transition:.25s}.sw.on{background:var(--good)}.sw.on::after{transform:translateX(20px)} .ico{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;flex:none}.ico svg{width:18px;height:18px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round} input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:3px;background:rgba(120,120,128,.32);outline:0} input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.35)} input[type=range]::-moz-range-thumb{width:26px;height:26px;border:0;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.35)} .seg{display:flex;background:rgba(120,120,128,.18);border-radius:10px;padding:2px}.seg button{flex:1;padding:6px 4px;border-radius:8px;font-size:14px;font-weight:500}.seg button.on{background:var(--card);box-shadow:0 1px 4px rgba(0,0,0,.18)} .tabbar{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-around;padding:8px 8px 26px;background:var(--glass2);backdrop-filter:blur(24px) saturate(1.8);-webkit-backdrop-filter:blur(24px) saturate(1.8);border-top:.5px solid var(--line)} .tabbar button{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:10.5px;color:var(--ink2);flex:1}.tabbar button.on{color:var(--accent)}.tabbar svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}  /* calculator */ .calc{background:#000;color:#fff}.calc .body{display:flex;flex-direction:column;justify-content:flex-end;padding:0 14px 40px;overflow:hidden} .calc .disp{text-align:right;font-size:84px;font-weight:300;padding:0 10px 10px;white-space:nowrap;overflow:hidden;font-variant-numeric:tabular-nums;letter-spacing:-2px} .keys{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.keys button{aspect-ratio:1;border-radius:50%;font-size:32px;background:#333;color:#fff;transition:filter .1s}.keys button:active{filter:brightness(1.6)} .keys .fn{background:#a5a5a5;color:#000}.keys .op{background:var(--accent);color:#fff}.keys .op.sel{background:#fff;color:var(--accent)}.keys .z{grid-column:span 2;aspect-ratio:auto;border-radius:40px;text-align:left;padding-left:30px}  /* misc */ .cc{position:absolute;inset:0;z-index:85;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .3s;padding:60px 18px 30px} .cc.on{opacity:1;pointer-events:auto} .cc .bk{position:absolute;inset:0;background:rgba(0,0,0,.35);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)} .ccg{position:relative;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:12px;transform:scale(.92) translateY(-14px);transition:transform .4s cubic-bezier(.2,.9,.25,1);color:var(--ink)} .cc.on .ccg{transform:none} .ccg .tile{border-radius:30px;padding:14px;min-height:92px} .tg{display:grid;grid-template-columns:1fr 1fr;gap:10px}.tg button{border-radius:50%;aspect-ratio:1;display:grid;place-items:center;background:rgba(120,120,128,.3)}.tg button.on{background:var(--accent);color:#fff}.tg svg,.sl svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round} .sl{position:relative;border-radius:28px;overflow:hidden;min-height:150px;background:rgba(120,120,128,.28)}.sl .f{position:absolute;left:0;right:0;bottom:0;background:rgba(255,255,255,.85);transition:none}.sl svg{position:absolute;left:50%;bottom:16px;margin-left:-11px;color:#222;z-index:1} .sl input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:ns-resize;writing-mode:vertical-lr;direction:rtl;-webkit-appearance:slider-vertical} .mini{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:600;text-align:center;cursor:pointer}.mini svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}  .shade{position:absolute;inset:0;z-index:84;transform:translateY(-100%);transition:transform .45s cubic-bezier(.2,.85,.25,1);padding:62px 14px 24px;display:flex;flex-direction:column;gap:8px;overflow:auto;background:rgba(10,12,20,.35);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);color:#fff} .shade.on{transform:none}.shade h2{margin:6px 6px 4px;font-family:var(--disp);font-size:28px} .shade .none{text-align:center;opacity:.7;margin-top:30vh}  #spot{position:absolute;inset:0;z-index:83;padding:70px 16px 16px;background:rgba(0,0,0,.28);backdrop-filter:blur(26px);-webkit-backdrop-filter:blur(26px);opacity:0;pointer-events:none;transition:opacity .25s;display:flex;flex-direction:column;gap:12px} #spot.on{opacity:1;pointer-events:auto} #spot input{width:100%;border:0;outline:0;padding:13px 16px;border-radius:16px;font-size:17px;color:var(--ink);background:var(--glass2)} #spot .res{display:flex;flex-direction:column;overflow:auto;border-radius:20px;color:var(--ink)} #spot .res .row{cursor:pointer}  #sw{position:absolute;inset:0;z-index:82;background:rgba(0,0,0,.45);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);display:none;align-items:center;gap:16px;padding:90px 26px 90px;overflow-x:auto;scroll-snap-type:x mandatory} #sw.on{display:flex} .card-sw{flex:none;width:66%;height:100%;scroll-snap-align:center;border-radius:30px;overflow:hidden;position:relative;background:var(--sheet);color:var(--ink);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;box-shadow:0 10px 40px rgba(0,0,0,.4)} .card-sw .sq{width:88px;height:88px;border-radius:21px}.card-sw .sq svg{width:48px;height:48px}.card-sw b{font-size:19px}.card-sw small{color:var(--ink2)} .card-sw .x{position:absolute;top:10px;right:10px;width:30px;height:30px;border-radius:50%;background:rgba(120,120,128,.25);display:grid;place-items:center} #sw .empty{margin:auto;color:#fff;font-size:17px;font-weight:500} #toast{position:absolute;left:50%;bottom:118px;transform:translate(-50%,20px);z-index:95;padding:10px 18px;border-radius:20px;color:var(--ink);font-size:14px;font-weight:500;opacity:0;transition:.3s;pointer-events:none;white-space:nowrap} #toast.on{opacity:1;transform:translate(-50%,0)}  .photos{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin:0 -16px}.photos button{aspect-ratio:1;border-radius:0} .pv{position:absolute;inset:0;z-index:5;background:#000;display:flex;align-items:center;justify-content:center;color:#fff}.pv .im{width:100%;aspect-ratio:3/4;max-height:80%}.pv .cl{position:absolute;top:60px;right:18px;padding:8px 14px;border-radius:18px} .cal{display:grid;grid-template-columns:repeat(7,1fr);text-align:center;gap:4px 0}.cal b{font-size:12px;color:var(--ink2);padding:6px 0}.cal span{padding:9px 0;font-size:17px;border-radius:50%;width:40px;height:40px;margin:0 auto;display:grid;place-items:center}.cal .td{background:var(--accent);color:#fff;font-weight:700}.cal .ev{position:relative}.cal .ev::after{content:\"\";position:absolute;bottom:3px;width:5px;height:5px;border-radius:50%;background:var(--bad)} textarea.ed{width:100%;height:100%;min-height:50vh;border:0;outline:0;background:none;resize:none;font-size:17px;line-height:1.45;padding:6px 2px;user-select:text;-webkit-user-select:text} .wx{background:linear-gradient(#3a7bd5,#6dd5fa);color:#fff}.wx .nav .l{color:#fff}.wx .big{font-family:var(--disp);font-size:96px;font-weight:300;text-align:center;line-height:1;margin-top:6px}.wx .c{text-align:center}.wx .hr{display:flex;gap:18px;overflow:auto;padding:14px;border-radius:20px;background:rgba(255,255,255,.2);margin:22px 0 12px}.wx .hr div{text-align:center;flex:none;font-size:14px}.wx .day{display:flex;justify-content:space-between;padding:11px 14px;border-bottom:.5px solid rgba(255,255,255,.3)} ";

  function p2(n) { return n < 10 ? '0' + n : '' + n; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var store = { get: function (k, d) { try { var v = localStorage.getItem('bi.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set: function (k, v) { try { localStorage.setItem('bi.' + k, JSON.stringify(v)); } catch (e) {} } };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var APPS = {}, toastEl = null, toastT = 0, closeFn = null;
  function toast(t) { if (!toastEl) return; toastEl.textContent = t; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 1800); }
  function nav(w, title) { var n = document.createElement('div'); n.className = 'nav'; n.innerHTML = '<span class="l"></span><span>' + esc(title || '') + '</span><span class="r"></span>'; w.appendChild(n); return n; }
  function bodyEl(w) { var b = document.createElement('div'); b.className = 'body'; w.appendChild(b); return b; }
  var NAMES = { notes: 'Notes', calc: 'Calculator', clock: 'Clock', cal: 'Calendar', compass: 'Compass', health: 'Health', wallet: 'Wallet' };
APPS.calc=function(w){
  nav(w,'');var b=bodyEl(w);
  b.innerHTML='<div class="disp" id="cd">0</div><div class="keys"></div>';
  var cur='0',acc=null,op=null,fresh=true,keys=$('.keys',b),cd=$('#cd',b);
  var L=['AC','±','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','.','='];
  L.forEach(function(k){var e=document.createElement('button');e.textContent=k;if('÷×−+='.indexOf(k)>-1&&k.length===1)e.className='op';else if(k==='AC'||k==='±'||k==='%')e.className='fn';if(k==='0')e.classList.add('z');e.onclick=function(){press(k,e)};keys.appendChild(e)});
  function show(v){var s=String(v);if(s.length>9&&s.indexOf('e')<0){var n=parseFloat(v);s=Math.abs(n)>=1e9||Math.abs(n)<1e-6&&n!==0?n.toExponential(4):String(parseFloat(n.toPrecision(9)))}cd.textContent=s.replace(/\B(?=(\d{3})+(?!\d))/g,function(m,o,str){return str.indexOf('.')>-1&&o>str.indexOf('.')?'':','});cd.style.fontSize=cd.textContent.length>9?'52px':cd.textContent.length>6?'68px':'84px'}
  function calc(a,o,b){a=+a;b=+b;return o==='+'?a+b:o==='−'?a-b:o==='×'?a*b:b===0?'Error':a/b}
  function sel(o){[].forEach.call(keys.children,function(x){x.classList.toggle('sel',x.textContent===o&&x.classList.contains('op')&&o!=='=')})}
  function press(k){
    if(/^\d$/.test(k)){cur=fresh||cur==='0'?k:cur+k;fresh=false;sel(null)}
    else if(k==='.'){if(fresh){cur='0.';fresh=false}else if(cur.indexOf('.')<0)cur+='.'}
    else if(k==='AC'){cur='0';acc=null;op=null;fresh=true;sel(null)}
    else if(k==='±'){cur=String(-parseFloat(cur)||0)}
    else if(k==='%'){cur=String(parseFloat(cur)/100)}
    else if(k==='='){if(op!==null&&acc!==null){cur=String(calc(acc,op,cur));acc=null;op=null;fresh=true;sel(null)}}
    else{if(op!==null&&!fresh){cur=String(calc(acc,op,cur))}acc=cur;op=k;fresh=true;sel(k)}
    if(cur==='Error'){show('Error');cur='0';acc=null;op=null;fresh=true;return}
    show(cur);
  }
};

APPS.notes=function(w){
  var list=store.get('notes',[{id:1,t:'Welcome to Notes\nTap + to write a note. Everything is saved in this browser.',at:Date.now()}]);
  var n=nav(w,'Notes');var b=bodyEl(w);
  function persist(){store.set('notes',list)}
  function home(){
    n.children[0].textContent='';n.children[1].textContent='Notes';n.children[2].innerHTML='New';n.children[2].onclick=function(){var x={id:Date.now(),t:'',at:Date.now()};list.unshift(x);persist();edit(x)};
    b.innerHTML='<h1 class="lg">Notes</h1><div class="card" id="nl"></div>';
    var c=$('#nl',b);if(!list.length)c.innerHTML='<div class="row"><span class="sub">No notes yet</span></div>';
    list.forEach(function(x){var lines=x.t.split('\n'),r=document.createElement('div');r.className='row';r.style.cursor='pointer';r.innerHTML='<div style="min-width:0;flex:1"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(lines[0]||'New note')+'</b><span class="sub" style="font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block">'+new Date(x.at).toLocaleDateString()+'  '+esc(lines[1]||'No additional text')+'</span></div><button class="del" aria-label="Delete" style="color:var(--bad);padding:6px">✕</button>';
      r.onclick=function(e){if(e.target.closest('.del')){list=list.filter(function(y){return y!==x});persist();home();return}edit(x)};c.appendChild(r)});
  }
  function edit(x){
    n.children[0].textContent='‹ Notes';n.children[0].onclick=function(){if(!x.t.trim())list=list.filter(function(y){return y!==x});persist();home()};n.children[2].textContent='';n.children[2].onclick=null;
    b.innerHTML='<textarea class="ed" id="ta" placeholder="Start typing"></textarea>';var ta=$('#ta',b);ta.value=x.t;ta.focus();
    ta.oninput=function(){x.t=ta.value;x.at=Date.now();persist()};
  }
  home();
};

APPS.clock=function(w){
  var tab='world';var n=nav(w,'Clock');var b=bodyEl(w);
  var tb=document.createElement('div');tb.className='tabbar';tb.innerHTML=['world|World','stop|Stopwatch','timer|Timer'].map(function(s){var p=s.split('|');return '<button data-t="'+p[0]+'"><svg viewBox="0 0 24 24">'+({world:'<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17"/>',stop:'<circle cx="12" cy="13.5" r="7"/><path d="M12 9.5v4l2 1.5M10 3h4"/>',timer:'<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9"/>'})[p[0]]+'</svg>'+p[1]+'</button>'}).join('');w.appendChild(tb);
  var zones=[['Local',undefined],['Accra','Africa/Accra'],['London','Europe/London'],['New York','America/New_York'],['Tokyo','Asia/Tokyo'],['Sydney','Australia/Sydney']];
  var iv,sw={t:0,run:0,laps:[],last:0},tm={s:300,run:0,end:0};
  function fmt(ms){var c=Math.floor(ms/10)%100,s=Math.floor(ms/1000)%60,m=Math.floor(ms/60000);return p2(m)+':'+p2(s)+'.'+p2(c)}
  function draw(){
    clearInterval(iv);[].forEach.call(tb.children,function(x){x.classList.toggle('on',x.dataset.t===tab)});
    if(tab==='world'){b.innerHTML='<h1 class="lg">World Clock</h1><div class="card" id="wc"></div>';var c=$('#wc',b);function up(){c.innerHTML=zones.map(function(z){var o=z[1]?{timeZone:z[1]}:{};var d=new Date();return '<div class="row"><div><b style="font-size:20px">'+z[0]+'</b></div><span class="sp"></span><span style="font-family:var(--disp);font-size:34px;font-variant-numeric:tabular-nums;font-weight:300">'+d.toLocaleTimeString([],Object.assign({hour:'numeric',minute:'2-digit'},o))+'</span></div>'}).join('')}up();iv=setInterval(up,5000)}
    if(tab==='stop'){b.innerHTML='<div style="text-align:center;font-family:var(--disp);font-size:78px;font-weight:300;margin:36px 0;font-variant-numeric:tabular-nums" id="sd">00:00.00</div><div style="display:flex;justify-content:space-between;padding:0 10px"><button id="sl" class="qbtn" style="width:84px;height:84px;border-radius:50%;background:rgba(120,120,128,.25);font-size:16px">Lap</button><button id="ss" style="width:84px;height:84px;border-radius:50%;font-size:16px;font-weight:600"></button></div><div class="card" id="lp" style="margin-top:28px"></div>';
      var sd=$('#sd',b),ss=$('#ss',b);function cu(){return sw.t+(sw.run?Date.now()-sw.run:0)}function pt(){sd.textContent=fmt(cu());ss.textContent=sw.run?'Stop':'Start';ss.style.background=sw.run?'rgba(255,69,58,.25)':'rgba(48,209,88,.25)';ss.style.color=sw.run?'var(--bad)':'var(--good)'}
      function laps(){$('#lp',b).innerHTML=sw.laps.map(function(l,i){return '<div class="row"><span>Lap '+(sw.laps.length-i)+'</span><span class="sp"></span><span style="font-variant-numeric:tabular-nums">'+fmt(l)+'</span></div>'}).join('')}
      ss.onclick=function(){if(sw.run){sw.t+=Date.now()-sw.run;sw.run=0}else sw.run=Date.now();pt()};
      $('#sl',b).onclick=function(){if(sw.run){var c=cu();sw.laps.unshift(c-sw.last);sw.last=c;laps()}else{sw={t:0,run:0,laps:[],last:0};laps();pt()}};
      pt();laps();iv=setInterval(pt,40)}
    if(tab==='timer'){b.innerHTML='<h1 class="lg">Timer</h1><div style="text-align:center;font-family:var(--disp);font-size:78px;font-weight:300;margin:20px 0;font-variant-numeric:tabular-nums" id="td"></div><div class="card" style="padding:14px 16px"><input type="range" id="tr" min="1" max="60" aria-label="Minutes"><div class="sub" style="text-align:center;margin-top:8px" id="tl"></div></div><button id="tb" class="btn" style="margin:22px auto;display:block;padding:14px 40px;border-radius:30px;background:var(--accent);color:#fff;font-weight:600"></button>';
      var td=$('#td',b),tr=$('#tr',b),tbn=$('#tb',b);tr.value=Math.round(tm.s/60);
      function left(){return tm.run?Math.max(0,Math.ceil((tm.end-Date.now())/1000)):tm.s}
      function pt(){var l=left();td.textContent=p2(Math.floor(l/60))+':'+p2(l%60);$('#tl',b).textContent=tm.run?'Running':tr.value+' min';tbn.textContent=tm.run?'Cancel':'Start';if(tm.run&&l===0){tm.run=0;toast('Timer finished');pt()}}
      tr.oninput=function(){if(!tm.run){tm.s=tr.value*60;pt()}};tbn.onclick=function(){if(tm.run){tm.run=0}else{tm.run=1;tm.end=Date.now()+tm.s*1000}pt()};pt();iv=setInterval(pt,500)}
  }
  [].forEach.call(tb.children,function(x){x.onclick=function(){tab=x.dataset.t;draw()}});draw();
};

APPS.cal=function(w){
  var d=new Date(),y=d.getFullYear(),m=d.getMonth(),today=d.getDate(),thisM=m,thisY=y;nav(w,'');var b=bodyEl(w);
  var ev={5:1,12:1,19:1,26:1};
  function draw(){
    var first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();
    var h='<div style="display:flex;align-items:center;justify-content:space-between;margin:4px 0 14px"><h1 class="lg" style="margin:0">'+new Date(y,m,1).toLocaleDateString(undefined,{month:'long',year:'numeric'})+'</h1><span><button id="pm" style="color:var(--accent);padding:8px 12px;font-size:22px" aria-label="Previous">‹</button><button id="nm" style="color:var(--accent);padding:8px 12px;font-size:22px" aria-label="Next">›</button></span></div><div class="cal">'+['S','M','T','W','T','F','S'].map(function(x){return '<b>'+x+'</b>'}).join('');
    for(var i=0;i<first;i++)h+='<span></span>';
    for(var k=1;k<=days;k++)h+='<span class="'+(k===today&&m===thisM&&y===thisY?'td':'')+(ev[k]&&!(k===today&&m===thisM&&y===thisY)?' ev':'')+'">'+k+'</span>';
    h+='</div><h2 style="font-family:var(--disp);margin:26px 0 8px">Upcoming</h2><div class="card"><div class="row"><span style="width:4px;height:34px;border-radius:2px;background:var(--bad)"></span><div><b>Design review</b><div class="sub">10:00 – 11:00</div></div></div><div class="row"><span style="width:4px;height:34px;border-radius:2px;background:var(--accent)"></span><div><b>Lunch with Ama</b><div class="sub">13:00 – 14:00</div></div></div></div>';
    b.innerHTML=h;$('#pm',b).onclick=function(){m--;if(m<0){m=11;y--}draw()};$('#nm',b).onclick=function(){m++;if(m>11){m=0;y++}draw()};
  }draw();
};



/* ---- Compass ---- */
APPS.compass=function(w){
  nav(w,'');var b=bodyEl(w);var heading=null,ok=false;
  b.innerHTML='<h1 class="lg" style="text-align:center">Compass</h1><div style="position:relative;width:min(78vw,300px);aspect-ratio:1;margin:30px auto"><div id="dial" style="position:absolute;inset:0;border-radius:50%;background:var(--card);box-shadow:0 8px 30px rgba(0,0,0,.2);transition:transform .15s linear"></div><div style="position:absolute;left:50%;top:-6px;margin-left:-8px;width:0;height:0;border:8px solid transparent;border-bottom:14px solid var(--bad);border-top:0"></div><div id="hd" style="position:absolute;inset:0;display:grid;place-items:center;font-size:44px;font-weight:300;font-variant-numeric:tabular-nums">--</div></div><p class="sub" id="cm" style="text-align:center;padding:0 20px">Hold the phone flat. Move it in a figure 8 if the reading looks wrong.</p>';
  var dial=$('#dial',b),hd=$('#hd',b),cm=$('#cm',b);
  var h='';for(var i=0;i<72;i++){var a=i*5,long=i%6===0;h+='<div style="position:absolute;left:50%;top:0;height:50%;width:0;transform-origin:50% 100%;transform:rotate('+a+'deg)"><div style="margin-left:-1px;width:'+(long?3:1.5)+'px;height:'+(long?14:7)+'px;background:'+(i===0?'var(--bad)':'var(--ink2)')+'"></div></div>'}
  [['N',0],['E',90],['S',180],['W',270]].forEach(function(c){h+='<div style="position:absolute;left:50%;top:0;height:50%;width:0;transform-origin:50% 100%;transform:rotate('+c[1]+'deg)"><div style="transform:translate(-50%,22px) rotate(-'+c[1]+'deg);font-weight:700;font-size:20px;color:'+(c[0]==='N'?'var(--bad)':'var(--ink)')+'">'+c[0]+'</div></div>'});
  dial.innerHTML=h;
  var names=['N','NE','E','SE','S','SW','W','NW'];
  function on(e){
    var hh=null;if(typeof e.webkitCompassHeading==='number')hh=e.webkitCompassHeading;else if(e.absolute&&e.alpha!=null)hh=(360-e.alpha)%360;else if(e.alpha!=null&&e.type==='deviceorientationabsolute')hh=(360-e.alpha)%360;
    if(hh==null)return;ok=true;heading=hh;dial.style.transform='rotate('+(-hh)+'deg)';hd.textContent=Math.round(hh)+'° '+names[Math.round(hh/45)%8];
  }
  window.addEventListener('deviceorientationabsolute',on,true);window.addEventListener('deviceorientation',on,true);
  w._cleanup=function(){window.removeEventListener('deviceorientationabsolute',on,true);window.removeEventListener('deviceorientation',on,true)};
  setTimeout(function(){if(!ok)cm.textContent='This phone did not report a compass sensor.'},2500);
};

/* ---- Health (a private daily tracker kept on this phone) ---- */
APPS.health=function(w){
  nav(w,'');var b=bodyEl(w);var log=store.get('health',{});
  function key(d){return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())}
  var today=key(new Date());log[today]=log[today]||{water:0,sleep:0,weight:0,steps:0};
  function save(){store.set('health',log)}
  function draw(){
    var t=log[today],days=[];for(var i=6;i>=0;i--){var d=new Date(Date.now()-i*86400000);days.push([d.toLocaleDateString([],{weekday:'narrow'}),(log[key(d)]||{}).water||0])}
    var max=Math.max(8,Math.max.apply(null,days.map(function(x){return x[1]})));
    function tile(label,val,unit,color,k,step){return '<div class="card" style="margin-bottom:12px"><div style="display:flex;align-items:center;gap:12px"><div style="flex:1"><div style="font-size:13px;font-weight:600;color:'+color+'">'+label+'</div><div style="font-size:30px;font-weight:700;margin-top:2px">'+val+'<span class="sub" style="font-size:15px;font-weight:500"> '+unit+'</span></div></div><button data-k="'+k+'" data-d="-'+step+'" style="width:42px;height:42px;border-radius:50%;background:rgba(120,120,128,.18);font-size:22px">−</button><button data-k="'+k+'" data-d="'+step+'" style="width:42px;height:42px;border-radius:50%;background:'+color+';color:#fff;font-size:22px">+</button></div></div>'}
    b.innerHTML='<h1 class="lg">Health</h1><div class="sub" style="margin:-6px 0 14px">Today · saved only on this phone</div>'+tile('Water',t.water,'glasses','#0a84ff','water',1)+tile('Sleep',t.sleep,'hours','#5e5ce6','sleep',0.5)+tile('Steps',t.steps,'steps','#30d158','steps',500)+tile('Weight',t.weight||'--','kg','#ff9f0a','weight',0.5)+
      '<div class="card"><div style="font-size:13px;font-weight:600;color:#0a84ff">Water, last 7 days</div><div style="display:flex;align-items:flex-end;gap:8px;height:90px;margin-top:12px">'+days.map(function(x){return '<div style="flex:1;text-align:center"><div style="height:'+Math.max(3,x[1]/max*70)+'px;background:#0a84ff;border-radius:5px"></div><div class="sub" style="font-size:11px;margin-top:4px">'+x[0]+'</div></div>'}).join('')+'</div></div><p class="sub" style="font-size:12px;text-align:center">You enter these numbers yourself. This is not a medical device.</p>';
    [].forEach.call(b.querySelectorAll('button[data-k]'),function(x){x.onclick=function(){var k=x.dataset.k,d=parseFloat(x.dataset.d),v=(t[k]||(k==='weight'?60:0))+d;t[k]=Math.max(0,Math.round(v*10)/10);save();draw()}});
  }
  draw();
};

/* ---- Wallet (loyalty and membership cards, stored on this phone) ---- */
APPS.wallet=function(w){
  var n=nav(w,'');var b=bodyEl(w);var cards=store.get('cards',[]);var colors=['#0a84ff,#5e5ce6','#ff9f0a,#ff375f','#30d158,#0a9d8f','#5e5ce6,#bf5af2','#636366,#1c1c1e'];
  function persist(){store.set('cards',cards)}
  function bars(code){var h='',s=0;for(var i=0;i<code.length;i++)s=(s*31+code.charCodeAt(i))>>>0;var x=s||7;for(var k=0;k<46;k++){x=(x*1103515245+12345)>>>0;h+='<i style="flex:'+(1+(x>>16)%3)+';background:'+(k%2?'transparent':'#000')+'"></i>'}return '<div style="display:flex;height:64px;background:#fff;padding:8px 12px;border-radius:10px">'+h+'</div>'}
  function home(){
    n.children[0].textContent='';n.children[0].onclick=null;n.children[1].textContent='Wallet';n.children[2].textContent='Add';n.children[2].onclick=add;
    b.innerHTML='<h1 class="lg">Wallet</h1>'+(cards.length?'':'<div class="empty" style="text-align:center;padding:40px 10px" ><p class="sub">No cards yet. Add a loyalty or membership card.</p></div>')+'<div id="cl"></div><p class="sub" style="font-size:12px;text-align:center;margin-top:16px">For loyalty, library and membership cards. Do not add bank card numbers: this is not secure storage and cannot make payments.</p>';
    var cl=$('#cl',b);cards.forEach(function(c,i){var d=document.createElement('div');d.style.cssText='border-radius:18px;padding:18px;color:#fff;margin-bottom:14px;height:150px;display:flex;flex-direction:column;justify-content:space-between;cursor:pointer;background:linear-gradient(135deg,'+c.col+');box-shadow:0 8px 20px rgba(0,0,0,.2)';d.innerHTML='<div style="font-weight:700;font-size:20px">'+esc(c.name)+'</div><div style="font-size:15px;letter-spacing:2px;opacity:.9">'+esc(c.code)+'</div>';d.onclick=function(){show(i)};cl.appendChild(d)});
  }
  function show(i){var c=cards[i];n.children[0].textContent='‹ Wallet';n.children[0].onclick=home;n.children[2].textContent='Delete';n.children[2].onclick=function(){cards.splice(i,1);persist();home()};
    b.innerHTML='<div style="border-radius:20px;padding:20px;color:#fff;background:linear-gradient(135deg,'+c.col+');margin-top:10px"><div style="font-weight:700;font-size:24px;margin-bottom:22px">'+esc(c.name)+'</div>'+bars(c.code)+'<div style="text-align:center;margin-top:10px;letter-spacing:3px;font-size:16px">'+esc(c.code)+'</div></div>'}
  function add(){
    n.children[0].textContent='‹ Cancel';n.children[0].onclick=home;n.children[2].textContent='';n.children[2].onclick=null;
    b.innerHTML='<h1 class="lg">New card</h1><input id="cn" placeholder="Card name (e.g. Gym)" style="width:100%;padding:12px 14px;border-radius:12px;border:0;outline:0;background:rgba(120,120,128,.18);font-size:17px;margin-bottom:10px;user-select:text;-webkit-user-select:text"><input id="cc" placeholder="Card number / code" style="width:100%;padding:12px 14px;border-radius:12px;border:0;outline:0;background:rgba(120,120,128,.18);font-size:17px;margin-bottom:14px;user-select:text;-webkit-user-select:text"><div id="co" style="display:flex;gap:12px;margin-bottom:20px"></div><button id="sv" style="width:100%;padding:14px;border-radius:13px;background:var(--accent);color:#fff;font-weight:600">Save card</button>';
    var sel=0;colors.forEach(function(c,i){var e=document.createElement('button');e.style.cssText='width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,'+c+');outline:'+(i===0?'3px solid var(--accent)':'none')+';outline-offset:2px';e.onclick=function(){sel=i;[].forEach.call($('#co',b).children,function(x,k){x.style.outline=k===i?'3px solid var(--accent)':'none'})};$('#co',b).appendChild(e)});
    $('#sv',b).onclick=function(){var nm=$('#cn',b).value.trim().slice(0,30),cd=$('#cc',b).value.trim().slice(0,40);if(!nm||!cd){toast('Enter a name and a code');return}if(/^\d{13,19}$/.test(cd.replace(/[\s-]/g,''))&&/^(4|5[1-5]|3[47]|6)/.test(cd.replace(/[\s-]/g,''))){toast('That looks like a bank card. Not saved.');return}cards.push({name:nm,code:cd,col:colors[sel]});persist();home()};
  }
  home();
};

  var cur = null;
  function open(host, id, env) {
    if (!APPS[id]) return false;
    var sh = host.shadowRoot || host.attachShadow({ mode: 'open' });
    if (cur && cur._cleanup) { try { cur._cleanup(); } catch (e) {} }
    sh.innerHTML = '<style>' + CSS + '</style>';
    var w = document.createElement('div'); w.className = 'win' + (id === 'calc' ? ' calc' : ''); w.innerHTML = '<div class="top"></div>';
    sh.appendChild(w); cur = w; closeFn = env && env.close;
    var $sh = function (s, r) { return (r || sh).querySelector(s); };
    toastEl = document.createElement('div'); toastEl.className = 'toast'; sh.appendChild(toastEl);
    var d = document.createElement('div'); d.style.cssText = 'position:absolute;right:14px;top:calc(10px + env(safe-area-inset-top));z-index:6;padding:6px 12px;border-radius:14px;background:rgba(120,120,128,.25);font-size:14px;font-weight:600;cursor:pointer;color:var(--accent)'; d.textContent = 'Done'; d.onclick = function () { if (closeFn) closeFn(); };
    sh.appendChild(d);
    var saved$ = $; $ = $sh;
    try { APPS[id](w); } finally { $ = saved$; }
    // the app functions captured $ at call time, so keep the shadow-aware lookup for later events
    $ = $sh;
    return true;
  }
  window.BuiltinUI = { open: open, names: NAMES, close: function () { if (cur && cur._cleanup) { try { cur._cleanup(); } catch (e) {} } cur = null; } };
})();
