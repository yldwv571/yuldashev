const $ = id => document.getElementById(id);
const root = document.documentElement;
const synth = window.speechSynthesis;
const SAMPLE = "Assalomu alaykum! Bu Voice Studio Pro — matnni ovozga aylantiruvchi dastur. Matn yozing, ovozni tanlang va tinglang.";
const PAUSE_ICON = '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>', PLAY_ICON = '<path d="M6 4l14 8-14 8z"/>';
let devVoices = [], session = 0, text = "", paused = false, audio = null;

const store = {
  get(k){ try { return localStorage.getItem('vsp:'+k); } catch(e){ return null; } },
  set(k,v){ try { localStorage.setItem('vsp:'+k, v); } catch(e){} }
};

/* ---------- Mavzu va rejim ---------- */
function setAccent(a){
  root.dataset.accent = a; store.set('accent', a);
  document.querySelectorAll('#dots button').forEach(b => b.classList.toggle('on', b.dataset.a === a));
}
$('dots').addEventListener('click', e => { if(e.target.dataset.a) setAccent(e.target.dataset.a); });
setAccent(store.get('accent') || 'ocean');
if(store.get('mode')) root.dataset.theme = store.get('mode');
$('mode').addEventListener('click', () => {
  const now = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  root.dataset.theme = now === 'dark' ? 'light' : 'dark';
  store.set('mode', root.dataset.theme);
});

/* ---------- Ovozlar ---------- */
function addOpt(parent, value, label){
  const o = document.createElement('option');
  o.value = value; o.textContent = label; parent.appendChild(o);
}
function note(){
  const v = $('voices').value || '';
  let msg = '';
  if(v.startsWith('net:')){
    msg = "Internet ovozi (O'zbekcha): mukammal o'qiydi. Tezlik va balandlik ishlaydi.";
  } else if(v.startsWith('dev:')){
    const dv = devVoices.find(x => x.name === v.slice(4));
    if(dv && !dv.lang.toLowerCase().startsWith('uz')) msg = "Bu qurilma ovozi. Toza o'zbekcha uchun ro'yxatning boshidagi 'O'zbekcha (internet)' ovozini tanlang.";
  }
  $('hint').textContent = msg;
}
function loadVoices(){
  const sel = $('voices');
  const prev = store.get('voice') || sel.value;
  const rank = l => ({uz:0, ru:1, en:2})[(l||'').slice(0,2).toLowerCase()] ?? 3;
  
  if (synth) {
    devVoices = synth.getVoices().slice();
  }
  devVoices.sort((a,b) => rank(a.lang)-rank(b.lang) || a.name.localeCompare(b.name));
  
  sel.innerHTML = '';
  const g1 = document.createElement('optgroup'); g1.label = 'Internet ovozlari (Tavsiya etiladi)';
  addOpt(g1, 'net:uz', "O'zbekcha (Internet ovozi - Tavsiya)");
  addOpt(g1, 'net:ru', 'Ruscha (internet)');
  addOpt(g1, 'net:en', 'Inglizcha (internet)');
  sel.appendChild(g1);
  
  if(devVoices.length){
    const g2 = document.createElement('optgroup'); g2.label = 'Qurilma ovozlari';
    devVoices.forEach(v => addOpt(g2, 'dev:' + v.name, `${v.name} (${v.lang})`));
    sel.appendChild(g2);
  }
  
  const values = [...sel.options].map(o => o.value);
  sel.value = values.includes(prev) ? prev : 'net:uz';
  note();
}

if(synth){
  loadVoices();
  if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = loadVoices;
  }
}

$('voices').addEventListener('change', () => { store.set('voice',$('voices').value); note(); });

/* ---------- Matn va sozlamalar ---------- */
$('text').value = store.get('text') || SAMPLE;
function upd(){
  const t = $('text').value;
  const words = t.trim().split(/\s+/).filter(Boolean).length;
  const sec = Math.round(words / (2.5 * parseFloat($('rate').value)));$('count').textContent = `${t.length.toLocaleString()} belgi · ≈ ${sec} soniya`;
  store.set('text', t);
}
$('text').addEventListener('input', upd);

[['rate','rateL',v=>v.toFixed(1)+'x'],['pitch','pitchL',v=>v.toFixed(1)],['vol','volL',v=>Math.round(v*100)+'%']].forEach(([id,lab,fmt]) => {
  const el = $(id), s = store.get(id);
  if(s !== null) el.value = s;
  const sync = () => { $(lab).textContent = fmt(parseFloat(el.value)); store.set(id, el.value); upd(); };
  el.addEventListener('input', sync); sync();
});
document.querySelectorAll('.chips button').forEach(b => b.addEventListener('click', () => {
  $('rate').value = b.dataset.r; $('rate').dispatchEvent(new Event('input'));
}));
if(store.get('gender')) $('gender').value = store.get('gender');
$('gender').addEventListener('change', () => store.set('gender',$('gender').value));

$('paste').addEventListener('click', () => {
  navigator.clipboard.readText().then(t => { $('text').value = t; upd(); })
    .catch(() => { $('hint').textContent = "Joylashtirish uchun brauzer ruxsati kerak. Matnni Ctrl + V bilan qo'ying."; });
});
$('copy').addEventListener('click', () => { navigator.clipboard.writeText($('text').value).catch(() => {}); });$('clear').addEventListener('click', () => { $('text').value = ''; upd();$('text').focus(); });

/* ---------- Yordamchi funksiyalar ---------- */
function chunk(t, max){
  const out = [], re = /[^.!?\n]+[.!?]*\s*/g;
  let m;
  while((m = re.exec(t))){
    let s = m[0], off = m.index;
    while(s.length > max){
      let cut = s.lastIndexOf(' ', max); if(cut < 40) cut = max;
      out.push({s:s.slice(0,cut), o:off}); s = s.slice(cut); off += cut;
    }
    if(s.trim()) out.push({s, o:off});
  }
  return out;
}
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function highlightRange(a, b){
  $('reader').innerHTML = esc(text.slice(0,a)) + '<mark>' + esc(text.slice(a,b)) + '</mark>' + esc(text.slice(b));
  const mk = $('reader').querySelector('mark'); if(mk) mk.scrollIntoView({block:'nearest'});$('bar').style.width = Math.min(100, a / Math.max(1, text.length) * 100) + '%';
}
function highlightWord(pos){
  const w = text.slice(pos).match(/^\S+/);
  highlightRange(pos, pos + (w ? w[0].length : 1));
}
function setState(on){
  document.body.classList.toggle('speaking', on);
  document.body.classList.remove('paused');
  paused = false;
  $('pause').disabled = !on;
  $('pTxt').textContent = 'Pauza';$('pIcon').innerHTML = PAUSE_ICON;
  if(!on) $('bar').style.width = '0';
}
function killAudio(){
  if(audio){
    const a = audio; audio = null;
    a.onended = a.onerror = a.onplay = null;
    try { a.pause(); a.removeAttribute('src'); a.load(); } catch(e){}
  }
}

/* ---------- Ijro ---------- */
function playChunk(q, i, id){
  if(id !== session) return;
  if(i >= q.length){ setState(false); return; }
  const v = $('voices').value;
  if(v.startsWith('net:')) playNet(q, i, id, v.slice(4));
  else playDev(q, i, id, v.slice(4));
}

function playDev(q, i, id, name){
  const u = new SpeechSynthesisUtterance(q[i].s);
  const voice = devVoices.find(x => x.name === name);
  if(voice){ u.voice = voice; u.lang = voice.lang; }
  u.rate = parseFloat($('rate').value);
  u.volume = parseFloat($('vol').value);
  const off = {female:0.3, male:-0.3}[$('gender').value] || 0;
  u.pitch = Math.min(2, Math.max(0.1, parseFloat($('pitch').value) + off));
  u.onstart = () => highlightWord(q[i].o);
  u.onboundary = e => { if(!e.name || e.name === 'word') highlightWord(q[i].o + e.charIndex); };
  u.onend = () => playChunk(q, i+1, id);
  u.onerror = e => {
    if(e.error === 'interrupted' || e.error === 'canceled' || id !== session) return;
    $('hint').textContent = "Ovozda xatolik: " + (e.error || "noma'lum") + ". Boshqa ovozni tanlab ko'ring.";
    setState(false);
  };
  synth.speak(u);
}

function playNet(q, i, id, lang){
  const c = q[i];
  const a = new Audio();
  audio = a;
  let failed = false;
  const fail = () => { if(failed || id !== session) return; failed = true; netFail(q, i, id); };
  try { a.referrerPolicy = 'no-referrer'; } catch(e){}
  a.src = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=' + lang + '&q=' + encodeURIComponent(c.s);
  a.playbackRate = parseFloat($('rate').value);
  a.volume = parseFloat($('vol').value);
  a.onplay = () => highlightRange(c.o, c.o + c.s.length);
  a.onended = () => playChunk(q, i+1, id);
  a.onerror = fail;
  a.play().catch(fail);
}

function netFail(q, i, id){
  killAudio();
  const want = $('voices').value.slice(4);
  const v = devVoices.find(x => x.lang.toLowerCase().startsWith(want)) || devVoices[0];
  if(!v){
    $('hint').textContent = "Internet ovozi ishlamadi. Internet aloqasini tekshiring.";
    setState(false); return;
  }
  $('hint').textContent = "Internet ovozi ishlamadi — qurilma ovoziga o'tildi (" + v.name + ").";
  $('voices').value = 'dev:' + v.name;
  playChunk(q, i, id);
}

function start(){
  text = $('text').value;
  if(!text.trim()) return;
  killAudio();
  session++;
  if(synth) synth.cancel();
  setState(true);
  const id = session;
  const max = $('voices').value.startsWith('net:') ? 180 : 220;
  const q = chunk(text, max);
  highlightRange(0, 0);
  setTimeout(() => playChunk(q, 0, id), 60);
}
function stop(){
  session++; killAudio();
  if(synth) synth.cancel();
  setState(false);
}
function togglePause(){
  if(!document.body.classList.contains('speaking')) return;
  paused = !paused;
  if(audio){ paused ? audio.pause() : audio.play().catch(() => {}); }
  else if(synth){ paused ? synth.pause() : synth.resume(); }
  document.body.classList.toggle('paused', paused);
  $('pTxt').textContent = paused ? 'Davom' : 'Pauza';
  $('pIcon').innerHTML = paused ? PLAY_ICON : PAUSE_ICON;
}

$('speak').addEventListener('click', start);$('stop').addEventListener('click', stop);
$('pause').addEventListener('click', togglePause);$('reader').addEventListener('click', stop);
document.addEventListener('keydown', e => {
  if(e.ctrlKey && e.key === 'Enter') start();
  if(e.key === 'Escape') stop();
});
window.addEventListener('beforeunload', () => { killAudio(); if(synth) synth.cancel(); });
upd();