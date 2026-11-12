/* Jhon Fit — app principal (vanilla JS, offline-first).
   Os dados ficam no aparelho (localStorage) e, com login, são sincronizados com a nuvem (ver cloud.js). */
'use strict';
(function () {

/* =========================================================
   Utilidades
   ========================================================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const DAY = 864e5;
const KEY0 = 'jhonfit.v1';
let KEY = KEY0;   // com login vira 'jhonfit.v1.<id do usuário>': cada conta tem seus dados no aparelho
const Cloud = window.JFCloud || { enabled: false, user: null, status: 'local', pending: false, markDirty() { }, syncNow() { return Promise.resolve(false); } };
const VERSION = self.JF_VERSION || 'dev';
const IMG_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : 0; };
const nf = (n, d = 0) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const sum = a => a.reduce((x, y) => x + y, 0);
const mean = a => a.length ? sum(a) / a.length : 0;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const pad2 = n => String(n).padStart(2, '0');
const dayKey = ts => { const d = new Date(ts); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
const startOfDay = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const startOfWeek = ts => { const d = new Date(startOfDay(ts)); const w = (d.getDay() + 6) % 7; return d.getTime() - w * DAY; };
const fmtKg = v => v >= 10000 ? nf(v / 1000, 1) + ' t' : nf(v) + ' kg';
const fmtDur = ms => { if (!ms || ms < 0) return '0 min'; const m = Math.round(ms / 6e4); const h = Math.floor(m / 60); return h ? `${h}h ${pad2(m % 60)}min` : `${m} min`; };
const fmtClock = ms => { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return (h ? h + ':' + pad2(m) : m) + ':' + pad2(ss); };
const fmtDate = (ts, o = { day: '2-digit', month: 'short' }) => new Date(ts).toLocaleDateString('pt-BR', o).replace('.', '');
const relDay = ts => { const d = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / DAY); return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`; };
const WD = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const epley = (w, r) => r > 0 && w > 0 ? (r === 1 ? w : w * (1 + r / 30)) : 0;

/* ícones (traço 24x24) */
const P = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  dumbbell: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11',
  body: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM7.5 10.5a6 6 0 0 1 9 0M12 12.5l1.8-3.3',
  chart: 'M3 20h18M7 16v-5M12 16V6M17 16v-8',
  plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', check: 'M5 12.5l4.5 4.5L19 7.5',
  left: 'M15 18l-6-6 6-6', right: 'M9 18l6-6-6-6', down: 'M6 9l6 6 6-6', x: 'M6 6l12 12M18 6 6 18',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  flame: 'M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  play: 'M7 4.5v15l12.5-7.5z',
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  up: 'M12 19V5M6 11l6-6 6 6', dn: 'M12 5v14M6 13l6 6 6-6',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 7.5v.5',
  timer: 'M12 8v5l2.5 1.5M9 2h6M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
  more: 'M12 5h.01M12 12h.01M12 19h.01',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14', upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  calendar: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M8 3v4M16 3v4',
  zap: 'M13 3 5 14h6l-1 7 8-11h-6z', trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  layers: 'M12 3 3 8l9 5 9-5zM3 13l9 5 9-5', copy: 'M8 8h11v12H8zM5 16V4h11',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.5 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  logout: 'M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M15 8l4 4-4 4M19 12H9',
  refresh: 'M20 11a8 8 0 0 0-14.3-4.3L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.3 4.3L20 15.5M20 20v-4.5h-4.5',
  mail: 'M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM3.5 7.5l8.5 6 8.5-6',
  lock: 'M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM8 11V8a4 4 0 0 1 8 0v3',
  alert: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5v5.5M12 16v.5',
};
const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"${n === 'more' ? ' style="stroke-width:3"' : ''}><path d="${P[n]}"${n === 'play' ? ' fill="currentColor" stroke="none"' : ''}/></svg>`;

/* =========================================================
   Base de exercícios
   ========================================================= */
const EX = new Map();
(window.EX_DB || []).forEach(e => EX.set(e.i, e));
const GROUPS = ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Quadríceps', 'Posterior', 'Glúteos', 'Panturrilha', 'Abdômen', 'Trapézio', 'Antebraço', 'Lombar', 'Adutores', 'Pescoço'];
const EQUIPS = ['Halter', 'Barra', 'Cabo', 'Aparelho', 'Smith', 'Peso corporal', 'Barra W', 'Elástico', 'Kettlebell', 'Outro'];
function getEx(id) { return EX.get(id) || { i: id, n: 'Exercício removido', e: '', g: 'Outros', s: [], t: 1 }; }
function imgUrl(ex, f = 0) { return ex.img ? ex.img : IMG_BASE + encodeURIComponent(ex.im || ex.i) + '/' + f + '.jpg'; }
function initials(n) { return String(n).split(/\s+/).filter(w => w.length > 2).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'; }
function thumb(ex, cls = '') {
  return `<div class="thumb ${cls}" data-init="${esc(initials(ex.n))}"><img loading="lazy" crossorigin="anonymous" alt="" src="${esc(imgUrl(ex))}"></div>`;
}
const exTitle = ex => `${esc(ex.n)} <span class="eq">· ${esc(ex.e)}</span>`;

/* =========================================================
   Estado + persistência
   ========================================================= */
function seedRoutines() {
  const R = (name, color, list) => ({ id: uid(), name, color, items: list.map(([exId, sets, reps, ss]) => ({ uid: uid(), exId, sets, reps, rest: 90, ss: !!ss })) });
  return [
    R('Perna', '#22C3A6', [['Smith_Single-Leg_Split_Squat', 4, 10, 1], ['Smith_Machine_Squat', 4, 10], ['Leg_Press', 3, 10], ['Leg_Extensions', 3, 12],
      ['Stiff-Legged_Barbell_Deadlift', 3, 10], ['Seated_Leg_Curl', 3, 10], ['Seated_Calf_Raise', 3, 12, 1], ['Standing_Dumbbell_Calf_Raise', 3, 12]]),
    R('Ombros', '#FF8A3D', [['Side_Lateral_Raise', 2, 15], ['x_Lateral_Raise_Machine', 3, 10, 1], ['Front_Dumbbell_Raise', 3, 10], ['Side_Lateral_Raise', 3, 10, 1],
      ['Seated_Dumbbell_Press', 3, 10], ['Arnold_Dumbbell_Press', 3, 10], ['Standing_Low-Pulley_Deltoid_Raise', 3, 10], ['Upright_Barbell_Row', 3, 10], ['Jackknife_Sit-Up', 3, 20]]),
    R('Costas e Bíceps', '#5B6CFF', [['Seated_Cable_Rows', 4, 10], ['Wide-Grip_Lat_Pulldown', 3, 8], ['Face_Pull', 3, 8], ['Leverage_Iso_Row', 3, 8], ['Chin-Up', 3, 10],
      ['Standing_Biceps_Cable_Curl', 3, 10], ['Barbell_Curl', 3, 10], ['Concentration_Curls', 3, 8]]),
    R('Peito e Tríceps', '#E2557B', [['External_Rotation_with_Cable', 2, 15], ['Barbell_Incline_Bench_Press_-_Medium_Grip', 3, 8], ['Barbell_Bench_Press_-_Medium_Grip', 3, 10],
      ['Low_Cable_Crossover', 3, 10], ['Cross_Over_-_With_Bands', 3, 10], ['Reverse_Machine_Flyes', 3, 10], ['Machine_Bench_Press', 3, 8], ['x_Triceps_Kickback_Cable', 3, 10],
      ['Triceps_Pushdown', 3, 10], ['Standing_Dumbbell_Triceps_Extension', 3, 10]]),
  ];
}
const PALETTE = ['#5B6CFF', '#22C3A6', '#FF8A3D', '#E2557B', '#B07CFF', '#3DB8FF', '#E5B32E'];
const PALETTE_NAMES = ['azul', 'verde', 'laranja', 'rosa', 'roxa', 'azul-clara', 'amarela'];
function defaults() {
  return { v: 1, onboarded: false, profile: { name: '', sex: 'M', birth: '', height: '' },
    settings: { rest: 90, goal: 4, sound: true, vibrate: true },
    routines: seedRoutines(), sessions: [], body: [], custom: [], active: null };
}
let S;
/* Garante que um objeto de dados (do aparelho, da nuvem ou de um backup) tenha todos os campos esperados */
function normalize(o) {
  const d = defaults();
  if (!o || typeof o !== 'object') return d;
  for (const k in d) if (o[k] === undefined || (Array.isArray(d[k]) && !Array.isArray(o[k]))) o[k] = d[k];
  o.settings = Object.assign(d.settings, o.settings); o.profile = Object.assign(d.profile, o.profile);
  return o;
}
function loadState() {
  let o = null;
  try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { o = null; }
  S = normalize(o); S.custom.forEach(c => EX.set(c.i, c));
}
loadState();
let saveT = null;
function save(now) {
  clearTimeout(saveT);
  const w = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Não foi possível salvar (armazenamento cheio?)'); } Cloud.markDirty(); };
  if (now === false) saveT = setTimeout(w, 400); else w();
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* =========================================================
   Consultas sobre o histórico
   ========================================================= */
const sessionsDesc = () => [...S.sessions].sort((a, b) => b.start - a.start);
const vol = sets => sum(sets.map(s => num(s.w) * num(s.r)));
const sessVol = s => sum(s.items.map(i => vol(i.sets)));
const sessSets = s => sum(s.items.map(i => i.sets.length));
function lastPerf(exId) {
  for (const s of sessionsDesc()) { const it = s.items.find(i => i.exId === exId && i.sets.length); if (it) return { date: s.start, sets: it.sets }; }
  return null;
}
function bestOf(exId, before = Infinity) {
  let w = 0, rm = 0;
  S.sessions.forEach(s => { if (s.start >= before) return; s.items.forEach(i => { if (i.exId !== exId) return; i.sets.forEach(st => { w = Math.max(w, num(st.w)); rm = Math.max(rm, epley(num(st.w), num(st.r))); }); }); });
  return { w, rm };
}
const routineSessions = rid => S.sessions.filter(s => s.routineId === rid);
const lastDone = rid => Math.max(0, ...routineSessions(rid).map(s => s.start));
function blocks(items) { const out = []; let cur = null; items.forEach((it, i) => { if (!cur) { cur = [it]; out.push(cur); } else cur.push(it); if (!it.ss || i === items.length - 1) cur = null; }); return out; }
const latestBody = () => [...S.body].sort((a, b) => b.date.localeCompare(a.date))[0] || null;
// Circunferências (cm). dir: -1 = diminuir é bom, 1 = aumentar é bom, 0 = neutro
const MEASURES = [
  { k: 'waist', l: 'Cintura', s: 'cintura', hint: 'na altura do umbigo', dir: -1 },
  { k: 'neck', l: 'Pescoço', s: 'pescoço', hint: 'abaixo do pomo', dir: 0 },
  { k: 'hip', l: 'Quadril', s: 'quadril', hint: 'parte mais larga', dir: 0 },
  { k: 'armR', l: 'Braço relaxado', s: 'braço', hint: 'meio do braço', dir: 1 },
  { k: 'armF', l: 'Braço contraído', s: 'braço contr.', hint: 'pico do bíceps', dir: 1 },
  { k: 'thigh', l: 'Coxa', s: 'coxa', hint: 'parte mais larga', dir: 1 },
  { k: 'calf', l: 'Panturrilha', s: 'panturrilha', hint: 'parte mais larga', dir: 1 },
  { k: 'wrist', l: 'Punho', s: 'punho', hint: 'acima do osso', dir: 0 },
];
const lastMeasure = (k, before) => [...S.body].filter(b => num(b[k]) > 0 && (!before || b.date < before)).sort((a, b) => b.date.localeCompare(a.date))[0];
function age() { if (!S.profile.birth) return null; const b = new Date(S.profile.birth); const n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a > 0 && a < 120 ? a : null; }
function estimateBF(e) {
  const h = num(S.profile.height), male = S.profile.sex !== 'F';
  if (num(e.bfManual) > 0) return { bf: num(e.bfManual), method: 'Informado' };
  const waist = num(e.waist), neck = num(e.neck), hip = num(e.hip);
  if (h && waist && neck && waist > neck) {
    let bf = null;
    if (male) bf = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(h)) - 450;
    else if (hip) bf = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.221 * Math.log10(h)) - 450;
    if (bf != null && bf > 2 && bf < 70) return { bf, method: 'Marinha (medidas)' };
  }
  const a = age(), w = num(e.weight);
  if (h && w && a) { const bmi = w / Math.pow(h / 100, 2); return { bf: 1.2 * bmi + 0.23 * a - 10.8 * (male ? 1 : 0) - 5.4, method: 'IMC + idade' }; }
  return { bf: null, method: '' };
}

/* =========================================================
   Roteamento e render
   ========================================================= */
let charts = [];
let justFinished = null;
const route = () => { const h = location.hash.replace(/^#\/?/, '') || 'home'; const [name, arg] = h.split('/'); return { name, arg: arg ? decodeURIComponent(arg) : '' }; };
const go = p => { location.hash = '#/' + p; };
const TAB_OF = { home: 'home', routines: 'routines', routine: 'routines', edit: 'routines', session: 'routines', body: 'body', reports: 'reports', settings: 'home' };

const TITLES = { home: 'Início', routines: 'Treinos', routine: 'Treino', edit: 'Editar treino', workout: 'Treino em andamento', session: 'Resumo do treino', body: 'Corpo', reports: 'Relatórios', settings: 'Ajustes' };
let GATE = null;   // quando preenchido, o app mostra a tela de login/carregamento em vez das telas normais
function render(keepScroll) {
  if (GATE) { renderGate(); return; }
  const { name, arg } = route();
  const y = window.scrollY;
  charts = [];
  const v = VIEWS[name] ? name : 'home';
  const view = $('#view');
  view.classList.remove('gate');
  view.innerHTML = VIEWS[v](arg);
  document.title = (TITLES[v] ? TITLES[v] + ' · ' : '') + 'Jhon Fit';
  const noNav = ['workout', 'edit', 'routine'].includes(v);
  view.classList.toggle('no-nav', noNav);
  $('#nav').style.display = noNav ? 'none' : '';
  $('#nav').innerHTML = `<div class="inner">${[['home', 'home', 'Início'], ['routines', 'dumbbell', 'Treinos'], ['body', 'body', 'Corpo'], ['reports', 'chart', 'Relatórios']]
    .map(([r, i, l]) => `<a href="#/${r}" class="${TAB_OF[v] === r ? 'on' : ''}"${TAB_OF[v] === r ? ' aria-current="page"' : ''}><span class="ic">${ic(i)}</span>${l}</a>`).join('')}</div>`;
  mountCharts();
  window.scrollTo(0, keepScroll ? y : 0);
  if (!keepScroll && !sheetOpen) view.focus({ preventScroll: true });   // leitores de tela anunciam a nova tela
  renderLive(); renderRest(); tick(); paintSync();
}
window.addEventListener('hashchange', () => render(false));

function renderLive() {
  const el = $('#live'); const { name } = route();
  if (!S.active || name === 'workout') { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="live" data-a="go" data-to="workout"><span class="dot"></span><div class="grow"><b>${esc(S.active.name)}</b><small>Treino em andamento · <span data-clock></span></small></div>${ic('right')}</div>`;
}

/* =========================================================
   Feedback: toast, sheet, confirm
   ========================================================= */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }

let sheetOpen = false, afterPop = null, sheetOnClose = null, lastFocus = null;
function openSheet(html, opts = {}) {
  const root = $('#sheet-root');
  if (!sheetOpen) lastFocus = document.activeElement;
  root.innerHTML = `<div class="ov" data-a="closeSheet"></div><div class="sheet ${opts.full ? 'full' : ''}" role="dialog" aria-modal="true" tabindex="-1"><div class="grab"></div>${html}</div>`;
  root.classList.add('open'); document.body.classList.add('noscroll');
  sheetOnClose = opts.onClose || null;
  const sh = $('.sheet', root), h = $('h3', sh);
  if (h) { h.id = 'sheet-title'; sh.setAttribute('aria-labelledby', 'sheet-title'); }
  sh.focus({ preventScroll: true });
  if (!sheetOpen) { history.pushState({ sheet: 1 }, ''); sheetOpen = true; }
}
function hideSheet() {
  const root = $('#sheet-root'); root.classList.remove('open'); root.innerHTML = ''; document.body.classList.remove('noscroll');
  sheetOpen = false; const f = sheetOnClose; sheetOnClose = null; if (f) f();
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  lastFocus = null;
}
function closeSheet(cb) { if (!sheetOpen) { if (cb) cb(); return; } hideSheet(); afterPop = cb || null; history.back(); }
window.addEventListener('popstate', () => { if (sheetOpen) hideSheet(); if (afterPop) { const f = afterPop; afterPop = null; setTimeout(f, 0); } });

function confirmSheet({ title, text = '', ok = 'Confirmar', cancel = 'Cancelar', danger = false }) {
  return new Promise(res => {
    let done = false; const fin = v => { if (done) return; done = true; res(v); };
    openSheet(`<h3>${esc(title)}</h3>${text ? `<p class="sub">${text}</p>` : ''}<div class="sp"></div>
      <div class="stack"><button class="btn ${danger ? 'danger' : 'primary'}" id="cf-ok">${esc(ok)}</button><button class="btn" id="cf-no">${esc(cancel)}</button></div>`,
      { onClose: () => fin(false) });
    $('#cf-ok').onclick = () => { fin(true); closeSheet(); };
    $('#cf-no').onclick = () => { fin(false); closeSheet(); };
  });
}

/* =========================================================
   Gráficos (SVG leve, com toque para ver valores)
   ========================================================= */
function chart(type, data, opts = {}) { const id = 'ch' + charts.length + uid(); charts.push({ id, type, data, opts }); return `<div class="chart" id="${id}"></div>`; }
function mountCharts() { charts.forEach(c => { const el = document.getElementById(c.id); if (el) try { CH[c.type](el, c.data, c.opts); } catch (e) { console.error(e); } }); }
function niceScale(min, max, n = 4) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) || mag * 10;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step; const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(6));
  return { lo, hi, ticks };
}
function attachTip(el, svg, xs, show) {
  const tip = document.createElement('div'); tip.className = 'tip'; tip.style.display = 'none'; el.appendChild(tip);
  const pick = ev => { const r = svg.getBoundingClientRect(); const x = ev.clientX - r.left; let bi = 0, bd = Infinity; xs.forEach((v, i) => { const d = Math.abs(v - x); if (d < bd) { bd = d; bi = i; } }); show(bi, tip); };
  svg.addEventListener('pointerdown', pick); svg.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.buttons) pick(e); });
  svg.addEventListener('pointerleave', () => { tip.style.display = 'none'; show(-1, tip); });
}
const CH = {
  line(el, pts, o) {
    const W = el.clientWidth || 320, H = o.h || 170, pl = 38, pr = 14, pt = 14, pb = 24;
    if (!pts.length) { el.innerHTML = `<div class="empty" style="padding:20px">Sem dados no período</div>`; return; }
    const ys = pts.map(p => p.y); const sc = niceScale(Math.min(...ys), Math.max(...ys), 3);
    const x0 = pts[0].x, x1 = pts[pts.length - 1].x;
    const X = x => pts.length === 1 ? (pl + W - pr) / 2 : pl + (x - x0) / (x1 - x0 || 1) * (W - pl - pr);
    const Y = y => pt + (1 - (y - sc.lo) / (sc.hi - sc.lo || 1)) * (H - pt - pb);
    const color = o.color || 'var(--accent)'; const gid = 'g' + uid();
    let s = `<svg width="${W}" height="${H}" role="img" aria-label="${esc(o.label || 'Gráfico')}"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5B6CFF" stop-opacity=".28"/><stop offset="1" stop-color="#5B6CFF" stop-opacity="0"/></linearGradient></defs>`;
    sc.ticks.forEach(t => { s += `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ax" x="${pl - 6}" y="${Y(t) + 3.5}" text-anchor="end">${nf(t, 1)}</text>`; });
    const xl = pts.length === 1 ? [0] : [0, Math.floor((pts.length - 1) / 2), pts.length - 1].filter((v, i, a) => a.indexOf(v) === i);
    xl.forEach((i, k) => { s += `<text class="ax" x="${X(pts[i].x)}" y="${H - 6}" text-anchor="${pts.length === 1 ? 'middle' : k === 0 ? 'start' : k === xl.length - 1 ? 'end' : 'middle'}">${fmtDate(pts[i].x, { day: '2-digit', month: '2-digit' })}</text>`; });
    const d = pts.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join('');
    if (pts.length > 1) s += `<path d="${d}L${X(x1)} ${H - pb}L${X(x0)} ${H - pb}Z" fill="url(#${gid})"/>`;
    s += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (pts.length <= 40) pts.forEach(p => { s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="3.5" fill="${color}" stroke="var(--surface)" stroke-width="2"/>`; });
    const lp = pts[pts.length - 1];
    s += `<text class="dl" x="${Math.min(X(lp.x), W - pr)}" y="${Y(lp.y) - 10}" text-anchor="end">${nf(lp.y, o.d ?? 1)}${o.unit || ''}</text>`;
    s += `<line class="xh" x1="0" x2="0" y1="${pt}" y2="${H - pb}" stroke="var(--text2)" stroke-dasharray="3 3" style="display:none"/><circle class="hd" r="6" fill="${color}" stroke="var(--surface)" stroke-width="2.5" style="display:none"/>`;
    s += `<rect x="0" y="0" width="${W}" height="${H}" fill="transparent"/></svg>`;
    el.innerHTML = s; const svg = el.querySelector('svg'); const xh = svg.querySelector('.xh'), hd = svg.querySelector('.hd');
    attachTip(el, svg, pts.map(p => X(p.x)), (i, tip) => {
      if (i < 0) { xh.style.display = hd.style.display = 'none'; return; }
      const p = pts[i], x = X(p.x), y = Y(p.y);
      xh.setAttribute('x1', x); xh.setAttribute('x2', x); hd.setAttribute('cx', x); hd.setAttribute('cy', y); xh.style.display = hd.style.display = '';
      tip.innerHTML = `<b>${nf(p.y, o.d ?? 1)}${o.unit || ''}</b><span>${p.t || fmtDate(p.x, { day: '2-digit', month: 'short', year: '2-digit' })}</span>`;
      tip.style.display = ''; tip.style.left = clamp(x, 50, W - 50) + 'px'; tip.style.top = (y - 10) + 'px';
    });
  },
  bar(el, bars, o) {
    const W = el.clientWidth || 320, H = o.h || 170, pl = 38, pr = 8, pt = 14, pb = 24;
    if (!bars.length || !bars.some(b => b.v)) { el.innerHTML = `<div class="empty" style="padding:20px">Sem dados no período</div>`; return; }
    const sc = niceScale(0, Math.max(...bars.map(b => b.v)), 3);
    const n = bars.length, slot = (W - pl - pr) / n, bw = Math.max(3, Math.min(34, slot - 2 - slot * .25));
    const Y = v => pt + (1 - v / (sc.hi || 1)) * (H - pt - pb);
    let s = `<svg width="${W}" height="${H}" role="img" aria-label="${esc(o.label || 'Gráfico')}">`;
    sc.ticks.forEach(t => { s += `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ax" x="${pl - 6}" y="${Y(t) + 3.5}" text-anchor="end">${o.fmtAx ? o.fmtAx(t) : nf(t)}</text>`; });
    const every = Math.ceil(n / Math.floor((W - pl) / 44));
    const xs = [];
    bars.forEach((b, i) => {
      const cx = pl + slot * i + slot / 2; xs.push(cx); const x = cx - bw / 2, y = Y(b.v), h = H - pb - y, r = Math.min(4, bw / 2, h);
      if (b.v > 0) s += `<path class="bb" data-i="${i}" d="M${x} ${H - pb}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + bw - r}Q${x + bw} ${y} ${x + bw} ${y + r}V${H - pb}Z" fill="${b.c || 'var(--accent)'}"/>`;
      if (i % every === 0) s += `<text class="ax" x="${cx}" y="${H - 6}" text-anchor="middle">${esc(b.l)}</text>`;
    });
    s += `<rect x="0" y="0" width="${W}" height="${H}" fill="transparent"/></svg>`;
    el.innerHTML = s; const svg = el.querySelector('svg');
    attachTip(el, svg, xs, (i, tip) => {
      svg.querySelectorAll('.bb').forEach(p => p.style.opacity = i < 0 || +p.dataset.i === i ? 1 : .45);
      if (i < 0) return; const b = bars[i];
      tip.innerHTML = `<b>${o.fmt ? o.fmt(b.v) : nf(b.v)}</b><span>${esc(b.tip || b.l)}</span>`;
      tip.style.display = ''; tip.style.left = clamp(xs[i], 50, W - 50) + 'px'; tip.style.top = (Y(b.v) - 8) + 'px';
    });
  },
};
function hbars(rows, fmt = v => nf(v)) {
  if (!rows.length) return `<div class="empty" style="padding:16px">Sem dados no período</div>`;
  const mx = Math.max(...rows.map(r => r.v)) || 1;
  return `<div class="hb" style="margin-top:12px">${rows.map(r => `<div class="hl">${esc(r.l)}</div><div class="hv">${fmt(r.v)}</div><div class="ht"><div style="width:${Math.max(2, r.v / mx * 100)}%;${r.c ? 'background:' + r.c : ''}"></div></div>`).join('')}</div>`;
}

/* =========================================================
   VIEWS
   ========================================================= */
const VIEWS = {};

/* ---------- Início ---------- */
VIEWS.home = () => {
  const now = Date.now(), h = new Date().getHours();
  const greet = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const wk0 = startOfWeek(now);
  const trainedDays = new Set(S.sessions.filter(s => s.start >= wk0).map(s => dayKey(s.start)));
  const weekCount = S.sessions.filter(s => s.start >= wk0).length;
  const goal = S.settings.goal || 4, pct = Math.min(1, weekCount / goal), C = 2 * Math.PI * 26;
  const last30 = S.sessions.filter(s => s.start >= now - 30 * DAY);
  const lb = latestBody(); const bodyAll = [...S.body].sort((a, b) => a.date.localeCompare(b.date));
  const w30 = bodyAll.filter(b => new Date(b.date).getTime() <= now - 25 * DAY).pop();
  const dW = lb && w30 ? num(lb.weight) - num(w30.weight) : null;
  const sorted = [...S.routines].sort((a, b) => lastDone(a.id) - lastDone(b.id));
  const next = sorted[0];
  const recent = sessionsDesc().slice(0, 4);
  return `
  <header class="top"><div><div class="eyebrow">${fmtDate(now, { weekday: 'long', day: 'numeric', month: 'long' })}</div><h1>${greet}${S.profile.name ? ', ' + esc(S.profile.name) : ''}</h1></div>
    <button class="icon-btn" data-a="go" data-to="settings" aria-label="Ajustes e conta">${ic('sliders')}<span class="sync-dot" data-syncdot></span></button></header>
  ${S.active ? `<div class="card tap" data-a="go" data-to="workout" style="border-color:#3A44A8;background:linear-gradient(135deg,#1F2552,#171B33)">
     <div class="row"><span class="play" style="background:var(--lime);color:var(--lime-ink)">${ic('timer', 'sm')}</span><div class="grow"><div class="muted" style="font-size:12.5px;font-weight:700">EM ANDAMENTO</div>
     <b style="font-size:17px">${esc(S.active.name)}</b></div><div class="num" style="font-size:22px;font-weight:850" data-clock></div></div></div><div class="sp"></div>` : ''}
  <div class="card">
    <div class="goal"><div class="ring"><svg viewBox="0 0 62 62"><circle cx="31" cy="31" r="26" stroke="var(--surface2)" stroke-width="7" fill="none"/>
      <circle cx="31" cy="31" r="26" stroke="var(--lime)" stroke-width="7" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg><span>${weekCount}/${goal}</span></div>
      <div class="grow"><b style="font-size:16px">${weekCount >= goal ? 'Meta da semana batida!' : (goal - weekCount > 1 ? `Faltam ${goal - weekCount} treinos` : 'Falta 1 treino')}</b><div class="muted" style="font-size:13px">Meta semanal de ${goal} treinos</div></div></div>
    <div class="sp"></div>
    <div class="week">${WD.map((d, i) => { const ts = wk0 + i * DAY; const k = dayKey(ts); return `<div class="d ${trainedDays.has(k) ? 'done' : ''} ${k === dayKey(now) ? 'today' : ''}">${d}<span class="c">${trainedDays.has(k) ? ic('check', 'xs') : new Date(ts).getDate()}</span></div>`; }).join('')}</div>
  </div>
  ${next && !S.active ? `<div class="sp"></div><div class="next">
    <div class="k">Próximo sugerido</div><h3>${esc(next.name)}</h3>
    <div class="t2" style="font-size:13.5px">${next.items.length} exercícios · ${lastDone(next.id) ? 'último ' + relDay(lastDone(next.id)) : 'ainda não realizado'}</div>
    <div class="thumbs">${next.items.slice(0, 6).map(it => thumb(getEx(it.exId))).join('')}</div>
    <button class="btn primary" data-a="start" data-id="${next.id}">${ic('play', 'sm')} Iniciar treino</button></div>` : ''}
  <div class="section-h"><h2>Últimos 30 dias</h2><a href="#/reports">Relatórios</a></div>
  <div class="grid2">
    <div class="stat"><div class="lbl">${ic('flame', 'xs')} Treinos</div><div class="val">${last30.length}</div><div class="sub">${nf(last30.length / (30 / 7), 1)} por semana</div></div>
    <div class="stat"><div class="lbl">${ic('clock', 'xs')} Duração média</div><div class="val">${last30.length ? fmtDur(mean(last30.map(s => s.end - s.start))) : '—'}</div><div class="sub">por treino</div></div>
    <div class="stat tap" data-a="go" data-to="body"><div class="lbl">${ic('body', 'xs')} Peso</div><div class="val">${lb ? nf(lb.weight, 1) + '<small>kg</small>' : '—'}</div>
      <div class="sub">${dW == null ? (lb ? fmtDate(new Date(lb.date + 'T12:00').getTime()) : 'Registre seu peso') : (dW > 0 ? '+' : '') + nf(dW, 1) + ' kg em 30 dias'}</div></div>
    <div class="stat tap" data-a="go" data-to="body"><div class="lbl">${ic('target', 'xs')} Gordura est.</div><div class="val">${lb && lb.bf ? nf(lb.bf, 1) + '<small>%</small>' : '—'}</div><div class="sub">${lb && lb.bf ? esc(lb.method || '') : 'Adicione medidas'}</div></div>
  </div>
  <div class="section-h"><h2>Meus treinos</h2><a href="#/routines">Ver todos</a></div>
  ${S.routines.length ? `<div class="list">${S.routines.map(routineRow).join('')}</div>` : `<div class="card empty"><div class="ill">${ic('plus', 'lg')}</div><h4>Nenhum treino criado</h4>Monte seu primeiro treino escolhendo os exercícios.<div class="sp"></div><button class="btn primary auto" data-a="go" data-to="edit/new">${ic('plus', 'sm')} Criar treino</button></div>`}
  <div class="section-h"><h2>Atividade recente</h2>${recent.length ? '<a href="#/routines/hist">Histórico</a>' : ''}</div>
  ${recent.length ? `<div class="list">${recent.map(histRow).join('')}</div>` : `<div class="card empty"><div class="ill">${ic('dumbbell', 'lg')}</div><h4>Nenhum treino registrado ainda</h4>Escolha um treino e toque em iniciar. O app cronometra e guarda tudo.</div>`}
  `;
};
function routineRow(r) {
  const n = routineSessions(r.id).length, ld = lastDone(r.id);
  return `<div class="r-item" role="group" aria-label="${esc(r.name)}" style="padding:12px 14px;cursor:pointer" data-a="go" data-to="routine/${r.id}">
    <div class="r-main" data-a="go" data-to="routine/${r.id}"><div class="r-badge" aria-hidden="true" style="background:${r.color || PALETTE[0]}">${esc(initials(r.name).slice(0, 2) || r.name[0])}</div>
    <div class="grow"><h4 class="ellipsis">${esc(r.name)}</h4><p>${r.items.length} exercícios · ${n ? `${n}× · ${relDay(ld)}` : 'nunca realizado'}</p></div></div>
    <button class="play" data-a="start" data-id="${r.id}" aria-label="Iniciar ${esc(r.name)}">${ic('play', 'sm')}</button></div>`;
}
function histRow(s) {
  return `<div class="hist-row" data-a="go" data-to="session/${s.id}" style="cursor:pointer"><div class="date"><b>${new Date(s.start).getDate()}</b><span>${fmtDate(s.start, { month: 'short' })}</span></div>
    <div class="grow"><h4 class="ellipsis">${esc(s.name)}</h4><p>${fmtDur(s.end - s.start)} · ${fmtKg(sessVol(s))} · ${sessSets(s)} séries</p></div>${ic('right', 'sm')}</div>`;
}

/* ---------- Treinos (rotinas + histórico) ---------- */
VIEWS.routines = arg => {
  const hist = arg === 'hist';
  let body;
  if (!hist) {
    body = `${S.routines.length ? '' : `<div class="card empty"><div class="ill">${ic('dumbbell', 'lg')}</div><h4>Nenhum treino criado</h4>Crie um treino com seus exercícios ou comece um treino livre.</div><div class="sp"></div>`}<div class="stack">${S.routines.map(r => {
      const n = routineSessions(r.id).length, ld = lastDone(r.id);
      const groups = [...new Set(r.items.map(i => getEx(i.exId).g))].slice(0, 4);
      return `<div class="card tap" role="group" aria-label="${esc(r.name)}" data-a="go" data-to="routine/${r.id}" style="padding:16px">
        <div class="r-item"><div class="r-main" data-a="go" data-to="routine/${r.id}"><div class="r-badge" aria-hidden="true" style="background:${r.color || PALETTE[0]}">${esc(initials(r.name).slice(0, 2) || r.name[0])}</div>
        <div class="grow"><h4>${esc(r.name)}</h4><p>${r.items.length} exercícios · ${n ? `feito ${n}× · último ${relDay(ld)}` : 'nunca realizado'}</p></div></div>
        <button class="play" data-a="start" data-id="${r.id}" aria-label="Iniciar ${esc(r.name)}">${ic('play', 'sm')}</button></div>
        <div class="badges">${groups.map(g => `<span class="badge">${esc(g)}</span>`).join('')}</div></div>`;
    }).join('')}</div>
    <div class="sp"></div>
    <div class="btn-row"><button class="btn" data-a="go" data-to="edit/new">${ic('plus', 'sm')} Criar treino</button><button class="btn" data-a="startFree">${ic('zap', 'sm')} Treino livre</button></div>`;
  } else {
    const ss = sessionsDesc();
    if (!ss.length) body = `<div class="card empty"><div class="ill">${ic('calendar', 'lg')}</div><h4>Sem histórico ainda</h4>Os treinos finalizados aparecem aqui.</div>`;
    else {
      const byM = {}; ss.forEach(s => { const k = fmtDate(s.start, { month: 'long', year: 'numeric' }); (byM[k] = byM[k] || []).push(s); });
      body = Object.entries(byM).map(([m, list]) => `<div class="pk-label" style="margin-left:2px">${esc(m)} · ${list.length} treino${list.length > 1 ? 's' : ''}</div><div class="list">${list.map(histRow).join('')}</div>`).join('');
    }
  }
  return `<header class="top"><h1>Treinos</h1></header>
    <div class="seg"><button class="${hist ? '' : 'on'}" data-a="go" data-to="routines">Rotinas</button><button class="${hist ? 'on' : ''}" data-a="go" data-to="routines/hist">Histórico</button></div>
    <div class="sp"></div>${body}`;
};

/* ---------- Detalhe da rotina ---------- */
VIEWS.routine = id => {
  const r = S.routines.find(x => x.id === id); if (!r) return VIEWS.routines();
  const ss = routineSessions(r.id), tot = sum(ss.map(sessVol));
  const est = sum(r.items.map(i => i.sets)) * 1.6 + r.items.length * 1.5;
  return `<div class="hero"><div class="bar"><button class="icon-btn" data-a="back" aria-label="Voltar">${ic('left')}</button>
    <button class="icon-btn" data-a="routineMenu" data-id="${r.id}" aria-label="Mais">${ic('more')}</button></div>
    <h1>${esc(r.name)}</h1><p>${ss.length ? `Concluído ${ss.length} ${ss.length === 1 ? 'vez' : 'vezes'} · ${nf(tot)} kg levantados no total` : 'Ainda não realizado'}</p>
    <div class="chips-h"><span class="pill">${ic('dumbbell', 'xs')} ${r.items.length} exercícios</span><span class="pill">${ic('clock', 'xs')} ~${Math.round(est)} min</span>${ss.length ? `<span class="pill">${ic('calendar', 'xs')} ${relDay(lastDone(r.id))}</span>` : ''}</div></div>
    <div class="sp"></div>
    ${blocks(r.items).map(b => `<div class="block ${b.length > 1 ? 'ss' : ''}">${b.length > 1 ? '<span class="ss-tag">SUPERSÉRIE</span>' : ''}${b.map(it => {
      const ex = getEx(it.exId), lp = lastPerf(it.exId);
      const lastTxt = lp ? ` · última: ${nf(Math.max(...lp.sets.map(s => num(s.w))), 1)} kg` : '';
      return `<div class="ex-row" data-a="exInfo" data-id="${esc(it.exId)}" style="cursor:pointer">${thumb(ex)}<div class="grow"><div class="nm">${exTitle(ex)}</div>
        <div class="meta">${it.sets} séries × ${it.reps} reps${lastTxt}</div></div></div>`;
    }).join('')}</div>`).join('')}
    <div class="dock"><div class="inner"><button class="btn primary" data-a="start" data-id="${r.id}">${ic('play', 'sm')} Iniciar treino</button>
    <button class="btn" data-a="go" data-to="edit/${r.id}">${ic('edit', 'sm')} Editar</button></div></div>`;
};

/* ---------- Editor de rotina ---------- */
let draft = null;
VIEWS.edit = id => {
  if (!draft || draft._for !== id) {
    const r = S.routines.find(x => x.id === id);
    draft = r ? JSON.parse(JSON.stringify(r)) : { id: uid(), name: '', color: PALETTE[S.routines.length % PALETTE.length], items: [] };
    draft._for = id;
  }
  const d = draft;
  return `<header class="top"><button class="icon-btn" data-a="cancelEdit" aria-label="Cancelar">${ic('x')}</button><h1 style="font-size:20px">${id === 'new' ? 'Novo treino' : 'Editar treino'}</h1>
    <button class="btn sm primary" data-a="saveEdit">Salvar</button></header>
    <label class="field"><span>Nome do treino</span><input class="input big" id="ed-name" placeholder="Ex.: Peito e Tríceps" value="${esc(d.name)}" data-c="draftName"></label>
    <div class="sp-s"></div>
    <div class="row" style="gap:12px;flex-wrap:wrap" role="group" aria-label="Cor do treino">${PALETTE.map((c, i) => `<button class="swatch ${d.color === c ? 'on' : ''}" data-a="draftColor" data-c="${c}" aria-label="Cor ${PALETTE_NAMES[i]}" aria-pressed="${d.color === c}" style="background:${c}"></button>`).join('')}</div>
    <div class="section-h"><h2>Exercícios <span class="muted" style="font-weight:600">${d.items.length}</span></h2></div>
    ${d.items.length ? '' : `<div class="card empty"><div class="ill">${ic('dumbbell', 'lg')}</div><h4>Adicione exercícios</h4>Escolha na lista com mais de 880 exercícios ilustrados.</div>`}
    ${blocks(d.items).map(b => `<div class="block ${b.length > 1 ? 'ss' : ''}">${b.length > 1 ? '<span class="ss-tag">SUPERSÉRIE</span>' : ''}${b.map(it => {
      const ex = getEx(it.exId), idx = d.items.indexOf(it);
      return `<div class="ed-item" style="${it !== b[0] ? 'border-top:1px dashed var(--line)' : ''}"><div class="row">${thumb(ex, 'sm')}<div class="grow"><div style="font-weight:700;line-height:1.25">${exTitle(ex)}</div><div class="muted" style="font-size:12.5px">${esc(ex.g)}</div></div></div>
        <div class="ctrl">
          <div><span class="lbl-mini">Séries</span>${stepper('sets', it, it.sets)}</div>
          <div><span class="lbl-mini">Reps</span>${stepper('reps', it, it.reps)}</div>
          <div><span class="lbl-mini">Descanso</span>${stepper('rest', it, it.rest, 's')}</div>
          <div class="tools">
            <button data-a="edMove" data-u="${it.uid}" data-d="-1" aria-label="Subir" ${idx === 0 ? 'disabled style="opacity:.3"' : ''}>${ic('up', 'sm')}</button>
            <button data-a="edMove" data-u="${it.uid}" data-d="1" aria-label="Descer" ${idx === d.items.length - 1 ? 'disabled style="opacity:.3"' : ''}>${ic('dn', 'sm')}</button>
            ${idx < d.items.length - 1 ? `<button class="${it.ss ? 'on' : ''}" data-a="edSS" data-u="${it.uid}" aria-label="Supersérie com o próximo">${ic('link', 'sm')}</button>` : ''}
            <button data-a="edDel" data-u="${it.uid}" aria-label="Remover">${ic('trash', 'sm')}</button></div></div></div>`;
    }).join('')}</div>`).join('')}
    <div class="sp"></div><button class="btn" data-a="edAdd">${ic('plus', 'sm')} Adicionar exercícios</button>
    <p class="hint" style="text-align:center;margin-top:10px">${ic('link', 'xs')} Toque no ícone de corrente para unir o exercício ao próximo em supersérie.</p>`;
};
const STEP_LBL = { sets: 'séries', reps: 'repetições', rest: 'descanso', goal: 'meta semanal' };
function stepper(k, it, v, unit = '') {
  return `<div class="stepper"><button data-a="edStep" data-k="${k}" data-u="${it.uid}" data-d="-1" aria-label="Diminuir ${STEP_LBL[k]}">${ic('minus', 'xs')}</button><b aria-live="polite">${v}</b>${unit ? `<small>${unit}</small>` : ''}<button data-a="edStep" data-k="${k}" data-u="${it.uid}" data-d="1" aria-label="Aumentar ${STEP_LBL[k]}">${ic('plus', 'xs')}</button></div>`;
}

/* ---------- Treino em andamento ---------- */
let openU = null;
VIEWS.workout = () => {
  const a = S.active;
  if (!a) { setTimeout(() => go('home'), 0); return ''; }
  const total = a.items.length, doneN = a.items.filter(i => i.done).length;
  const doneSets = a.items.flatMap(i => i.sets.filter(s => s.done));
  if (openU && !a.items.find(i => i.uid === openU)) openU = null;
  if (openU === null) { const f = a.items.find(i => !i.done); openU = f ? f.uid : ''; }
  return `<div class="wk-head"><div class="r1"><button class="icon-btn" data-a="go" data-to="home" aria-label="Minimizar">${ic('down')}</button>
    <div class="ttl"><small class="ellipsis">${esc(a.name)}</small><div class="clock" data-clock>0:00</div></div>
    <button class="btn sm lime" data-a="finish">Finalizar</button></div>
    <div class="prog"><div style="width:${total ? doneN / total * 100 : 0}%"></div></div>
    <div class="wk-meta"><span><b>${doneN}</b> de ${total} exercícios</span><span><b>${doneSets.length}</b> ${doneSets.length === 1 ? 'série' : 'séries'} · <b>${fmtKg(vol(doneSets))}</b></span></div></div>
    <div class="sp"></div>
    ${total ? '' : `<div class="card empty"><div class="ill">${ic('zap', 'lg')}</div><h4>Treino livre</h4>Adicione exercícios conforme for treinando.</div>`}
    ${blocks(a.items).map(b => `<div class="block ${b.length > 1 ? 'ss' : ''}">${b.length > 1 ? '<span class="ss-tag">SUPERSÉRIE</span>' : ''}${b.map((it, k) => wcard(it, k)).join('')}</div>`).join('')}
    <div class="sp"></div>
    <button class="btn" data-a="wkAdd">${ic('plus', 'sm')} Adicionar exercício</button>
    <div class="sp-s"></div>
    <button class="btn danger" data-a="wkCancel">${ic('trash', 'sm')} Descartar treino</button>`;
};
function wcard(it, k) {
  const ex = getEx(it.exId), open = openU === it.uid, prev = it.prev || [];
  const ds = it.sets.filter(s => s.done).length;
  const maxW = Math.max(0, ...it.sets.map(s => num(s.w)));
  const meta = `${ds}/${it.sets.length} séries${maxW ? ' · ' + nf(maxW, 1) + ' kg' : ''}${it.prevDate ? ' · última ' + relDay(it.prevDate) : ''}`;
  return `<div class="wcard ${it.done ? 'done' : ''}" style="${k ? 'border-top:1px dashed var(--line)' : ''}">
    <div class="head" role="group" aria-label="${esc(ex.n)}" data-a="wkOpen" data-u="${it.uid}"><div class="r-main" data-a="wkOpen" data-u="${it.uid}" role="button" tabindex="0" aria-expanded="${open}">${thumb(ex, 'sm')}<div class="grow"><div class="nm">${exTitle(ex)}</div><div class="meta">${meta}</div></div></div>
    <button class="chk ${it.done ? 'on' : ''}" data-a="wkDone" data-u="${it.uid}" aria-label="${it.done ? 'Desmarcar' : 'Concluir'} ${esc(ex.n)}" aria-pressed="${!!it.done}">${ic('check', 'sm')}</button></div>
    ${open ? `<div class="sets"><div class="sh"><span>Série</span><span>Anterior</span><span>kg</span><span>Reps</span><span></span></div>
      ${it.sets.map((s, i) => `<div class="st ${s.done ? 'on' : ''}"><span class="n">${i + 1}</span><span class="prev">${prev[i] ? nf(prev[i].w, 1) + '×' + prev[i].r : '—'}</span>
        <input inputmode="decimal" enterkeyhint="next" data-f="w" data-u="${it.uid}" data-i="${i}" value="${esc(s.w)}" placeholder="0" aria-label="Peso série ${i + 1}">
        <input inputmode="numeric" enterkeyhint="done" data-f="r" data-u="${it.uid}" data-i="${i}" value="${esc(s.r)}" placeholder="0" aria-label="Repetições série ${i + 1}">
        <button class="sc" data-a="wkSet" data-u="${it.uid}" data-i="${i}" aria-label="Concluir série">${ic('check', 'sm')}</button></div>`).join('')}
      <div class="set-act"><button data-a="wkAddSet" data-u="${it.uid}">${ic('plus', 'xs')} Série</button><button data-a="wkRmSet" data-u="${it.uid}">${ic('minus', 'xs')} Série</button>
        <button data-a="exInfo" data-id="${esc(it.exId)}">${ic('info', 'xs')} Detalhes</button><button class="r text-danger" data-a="wkRmItem" data-u="${it.uid}" aria-label="Remover exercício do treino">${ic('trash', 'xs')}</button></div></div>` : ''}
  </div>`;
}

/* ---------- Resumo de sessão ---------- */
VIEWS.session = id => {
  const s = S.sessions.find(x => x.id === id); if (!s) return VIEWS.routines('hist');
  const fresh = justFinished === id;
  const reps = sum(s.items.flatMap(i => i.sets.map(x => num(x.r))));
  const prs = s.prs || [];
  return `<header class="top"><button class="icon-btn" data-a="${fresh ? 'go' : 'back'}" data-to="home" aria-label="Voltar">${ic(fresh ? 'x' : 'left')}</button>
    <div class="grow" style="text-align:center"><div class="eyebrow">${fmtDate(s.start, { weekday: 'long', day: 'numeric', month: 'long' })}</div><b>${esc(s.name)}</b></div>
    <button class="icon-btn" data-a="delSession" data-id="${s.id}" aria-label="Excluir">${ic('trash', 'sm')}</button></header>
    ${fresh ? `<div class="celebrate"><div class="trophy">${ic('trophy', 'lg')}</div><h1>Treino concluído!</h1><p class="muted">${prs.length ? `Você bateu ${prs.length} recorde${prs.length > 1 ? 's' : ''} hoje.` : 'Mais um pra conta. Constância é o que dá resultado.'}</p></div><div class="sp"></div>` : ''}
    <div class="grid2">
      <div class="stat"><div class="lbl">${ic('clock', 'xs')} Duração</div><div class="val">${fmtDur(s.end - s.start)}</div><div class="sub">${new Date(s.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} – ${new Date(s.end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div></div>
      <div class="stat"><div class="lbl">${ic('dumbbell', 'xs')} Volume</div><div class="val">${fmtKg(sessVol(s))}</div><div class="sub">peso × reps</div></div>
      <div class="stat"><div class="lbl">${ic('layers', 'xs')} Séries</div><div class="val">${sessSets(s)}</div><div class="sub">${s.items.length} exercício${s.items.length === 1 ? '' : 's'}</div></div>
      <div class="stat"><div class="lbl">${ic('repeat', 'xs')} Repetições</div><div class="val">${nf(reps)}</div><div class="sub">${nf(reps / (sessSets(s) || 1), 1)} por série</div></div>
    </div>
    ${prs.length ? `<div class="section-h"><h2>Recordes pessoais</h2></div><div class="list">${prs.map(p => `<div class="pr-row"><span class="play" style="background:var(--lime-soft);color:var(--lime)">${ic('trophy', 'sm')}</span>
      <div class="grow"><b class="ellipsis" style="display:block">${esc(getEx(p.exId).n)}</b><span class="muted" style="font-size:12.5px">antes: ${nf(p.prev, 1)} kg</span></div><span class="v">${nf(p.w, 1)} kg</span></div>`).join('')}</div>` : ''}
    <div class="section-h"><h2>Exercícios</h2></div>
    <div class="list">${s.items.map(i => { const ex = getEx(i.exId); const pr = prs.find(p => p.exId === i.exId);
      return `<div style="padding:12px 14px"><div class="row" data-a="exInfo" data-id="${esc(i.exId)}" style="cursor:pointer">${thumb(ex, 'sm')}<div class="grow"><div style="font-weight:700;line-height:1.25">${exTitle(ex)}</div>
        <div class="muted" style="font-size:12.5px">${i.sets.length} séries · ${fmtKg(vol(i.sets))}${i.time ? ' · ' + fmtDur(i.time) : ''}</div></div></div>
        <div class="set-chips">${i.sets.map(x => `<span class="${pr && num(x.w) === pr.w ? 'pr' : ''}">${nf(x.w, 1)} kg × ${nf(x.r)}</span>`).join('')}</div></div>`; }).join('')}</div>
    ${fresh ? `<div class="sp"></div><button class="btn primary" data-a="go" data-to="home">Concluir</button>` : ''}`;
};

/* ---------- Corpo ---------- */
let bodyTab = 'weight';
VIEWS.body = () => {
  const list = [...S.body].sort((a, b) => a.date.localeCompare(b.date));
  const lb = list[list.length - 1], first = list[0];
  const h = num(S.profile.height);
  const bmi = lb && h ? num(lb.weight) / Math.pow(h / 100, 2) : null;
  const fatKg = lb && lb.bf ? num(lb.weight) * lb.bf / 100 : null;
  const hasM = k => list.some(e => num(e[k]) > 0);
  const series = { weight: ['Peso', 'weight', ' kg'], bf: ['% Gordura', 'bf', '%'], lean: ['Massa magra', 'lean', ' kg'] };
  MEASURES.forEach(m => { if (hasM(m.k) || bodyTab === m.k) series[m.k] = [m.l, m.k, ' cm']; });
  if (!series[bodyTab]) bodyTab = 'weight';
  const [lbl, key, unit] = series[bodyTab];
  const meas = MEASURES.filter(m => hasM(m.k)).map(m => {
    const w = list.filter(e => num(e[m.k]) > 0); const a = num(w[0][m.k]), b = num(w[w.length - 1][m.k]);
    const d = b - a, cls = w.length < 2 || Math.abs(d) < 0.05 || !m.dir ? 'flat' : (d > 0) === (m.dir > 0) ? 'up' : 'down';
    return `<button class="meas ${bodyTab === m.k ? 'on' : ''}" data-a="bodyTab" data-k="${m.k}"><span class="ml">${m.l}</span><b>${nf(b, 1)}<small>cm</small></b>
      ${w.length > 1 ? `<span class="delta ${cls}">${d > 0 ? '▲' : d < 0 ? '▼' : '•'} ${nf(Math.abs(d), 1)}</span>` : `<span class="ms">1 registro</span>`}</button>`;
  });
  const pts = list.map(e => ({ x: new Date(e.date + 'T12:00').getTime(), y: key === 'lean' ? (e.bf ? num(e.weight) * (1 - e.bf / 100) : 0) : num(e[key]) })).filter(p => p.y > 0);
  const bmiTxt = bmi == null ? '' : bmi < 18.5 ? 'Abaixo do peso' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Sobrepeso' : 'Obesidade';
  return `<header class="top"><h1>Corpo</h1><button class="btn sm primary" data-a="bodyAdd">${ic('plus', 'sm')} Registrar</button></header>
    ${!h || !S.profile.birth ? `<div class="card tap" data-a="go" data-to="settings" style="border-color:#4B3A12;background:#1E1A10"><div class="row">${ic('info')}<div class="grow" style="font-size:14px">Complete <b>altura</b> e <b>data de nascimento</b> no perfil para estimar a gordura corporal.</div>${ic('right', 'sm')}</div></div><div class="sp"></div>` : ''}
    <div class="grid2">
      <div class="stat"><div class="lbl">Peso atual</div><div class="val">${lb ? nf(lb.weight, 1) + '<small>kg</small>' : '—'}</div>
        ${lb && first && first !== lb ? deltaBadge(num(lb.weight) - num(first.weight), ' kg', true, 'desde o início') : `<div class="sub">${lb ? fmtDate(new Date(lb.date + 'T12:00').getTime(), { day: '2-digit', month: 'short', year: 'numeric' }) : 'sem registros'}</div>`}</div>
      <div class="stat"><div class="lbl">Gordura corporal</div><div class="val">${lb && lb.bf ? nf(lb.bf, 1) + '<small>%</small>' : '—'}</div><div class="sub">${lb && lb.bf ? esc(lb.method) : 'estimativa'}</div></div>
      <div class="stat"><div class="lbl">IMC</div><div class="val">${bmi ? nf(bmi, 1) : '—'}</div><div class="sub">${bmiTxt || 'informe a altura'}</div></div>
      <div class="stat"><div class="lbl">Massa gorda / magra</div><div class="val" style="font-size:20px">${fatKg != null ? nf(fatKg, 1) + '<small>/</small>' + nf(num(lb.weight) - fatKg, 1) + '<small>kg</small>' : '—'}</div><div class="sub">estimativa</div></div>
    </div>
    <div class="sp"></div>
    ${meas.length ? `<div class="card"><div class="row"><h3 class="grow" style="font-size:16px">Medidas</h3><span class="muted" style="font-size:12px">cm · variação desde o 1º registro</span></div><div class="sp-s"></div><div class="meas-grid">${meas.join('')}</div></div><div class="sp"></div>` : ''}
    <div class="card chart-card"><div class="chips" style="margin:0 -14px;padding:0 14px">${Object.entries(series).map(([k, v]) => `<button class="chip ${bodyTab === k ? 'on' : ''}" data-a="bodyTab" data-k="${k}">${v[0]}</button>`).join('')}</div>
      <div class="sp-s"></div><h3>${lbl}</h3><div class="cs">${pts.length} registro${pts.length === 1 ? '' : 's'}</div>${chart('line', pts, { unit, d: 1 })}</div>
    <div class="section-h"><h2>Histórico</h2></div>
    ${list.length ? `<div class="list">${[...list].reverse().map(e => `<div class="hist-row" data-a="bodyEdit" data-id="${e.id}" style="cursor:pointer"><div class="date"><b>${new Date(e.date + 'T12:00').getDate()}</b><span>${fmtDate(new Date(e.date + 'T12:00').getTime(), { month: 'short' })}</span></div>
      <div class="grow"><h4>${nf(e.weight, 1)} kg${e.bf ? ` · ${nf(e.bf, 1)}% gordura` : ''}</h4><p class="clamp2">${MEASURES.filter(m => num(e[m.k]) > 0).map(m => m.s + ' ' + nf(e[m.k], 1)).join(' · ') || esc(e.method || '')}</p></div>${ic('right', 'sm')}</div>`).join('')}</div>`
      : `<div class="card empty"><div class="ill">${ic('body', 'lg')}</div><h4>Comece registrando seu peso</h4>Adicione cintura e pescoço para uma estimativa de gordura mais precisa (método da Marinha dos EUA).</div>`}`;
};
function deltaBadge(d, unit, lowerIsGood, label) {
  const cls = Math.abs(d) < 0.05 ? 'flat' : (d < 0) === !!lowerIsGood ? 'up' : 'down';
  return `<span class="delta ${cls}">${d > 0 ? '▲' : d < 0 ? '▼' : '•'} ${nf(Math.abs(d), 1)}${unit}</span>${label ? `<span class="muted" style="font-size:11.5px;margin-left:5px">${label}</span>` : ''}`;
}

/* ---------- Relatórios ---------- */
const RF = { period: '30', routine: 'all', ex: 'all' };
const PERIODS = [['7', '7 dias'], ['30', '30 dias'], ['90', '3 meses'], ['365', '12 meses'], ['all', 'Tudo']];
function filterSessions(offset = 0) {
  const now = Date.now(); const days = RF.period === 'all' ? null : +RF.period;
  return S.sessions.filter(s => {
    if (days) { const end = now - offset * days * DAY, st = end - days * DAY; if (s.start < st || s.start >= end) return false; } else if (offset) return false;
    if (RF.routine !== 'all' && s.routineId !== RF.routine) return false;
    if (RF.ex !== 'all' && !s.items.some(i => i.exId === RF.ex)) return false;
    return true;
  }).sort((a, b) => a.start - b.start);
}
function metrics(ss) {
  const items = ss.flatMap(s => s.items.filter(i => RF.ex === 'all' || i.exId === RF.ex));
  const sets = items.flatMap(i => i.sets);
  const ws = sets.map(s => num(s.w)).filter(w => w > 0);
  return { n: ss.length, dur: mean(ss.map(s => s.end - s.start)), total: sum(ss.map(s => s.end - s.start)), items, sets,
    vol: vol(sets), reps: mean(sets.map(s => num(s.r))), w: mean(ws), setsPer: ss.length ? sets.length / ss.length : 0,
    exTime: mean(items.map(i => i.time).filter(Boolean)),
    completion: sum(ss.map(s => s.planned || 0)) ? sum(ss.map(s => s.items.length)) / sum(ss.map(s => s.planned || s.items.length)) : null };
}
VIEWS.reports = () => {
  const ss = filterSessions(), prev = filterSessions(1);
  const m = metrics(ss), mp = metrics(prev);
  const days = RF.period === 'all' ? (ss.length ? Math.max(7, (Date.now() - ss[0].start) / DAY) : 7) : +RF.period;
  const usedEx = [...new Set(S.sessions.flatMap(s => s.items.map(i => i.exId)))].map(getEx).sort((a, b) => a.n.localeCompare(b.n));
  const cmp = (a, b) => RF.period === 'all' || !b ? '' : deltaBadge(b ? (a - b) / b * 100 : 0, '%', false, 'vs anterior');
  const filters = `<div class="filters"><div class="chips">${PERIODS.map(([k, l]) => `<button class="chip ${RF.period === k ? 'on' : ''}" data-a="rfPeriod" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="sp-s"></div><div class="grid2"><select class="select" data-c="rfRoutine" aria-label="Filtrar por treino"><option value="all">Todos os treinos</option>${S.routines.map(r => `<option value="${r.id}" ${RF.routine === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>
    <select class="select" data-c="rfEx" aria-label="Filtrar por exercício"><option value="all">Todos os exercícios</option>${usedEx.map(e => `<option value="${esc(e.i)}" ${RF.ex === e.i ? 'selected' : ''}>${esc(e.n)} · ${esc(e.e)}</option>`).join('')}</select></div></div>`;
  if (!S.sessions.length) return `<header class="top"><h1>Relatórios</h1></header>${filters}<div class="card empty"><div class="ill">${ic('chart', 'lg')}</div><h4>Seus números aparecem aqui</h4>Finalize alguns treinos para ver duração média, cargas, volume, recordes e tendências.</div>`;
  if (!ss.length) return `<header class="top"><h1>Relatórios</h1></header>${filters}<div class="card empty"><div class="ill">${ic('calendar', 'lg')}</div><h4>Nada neste filtro</h4>Tente um período maior ou outro treino.</div>`;

  // série temporal de volume
  const weekly = days > 31;
  const buckets = new Map();
  if (weekly) { for (let t = startOfWeek(Date.now() - days * DAY); t <= Date.now(); t += 7 * DAY) buckets.set(t, 0); }
  ss.forEach(s => { const k = weekly ? startOfWeek(s.start) : s.start; const v = vol(s.items.filter(i => RF.ex === 'all' || i.exId === RF.ex).flatMap(i => i.sets)); buckets.set(k, (buckets.get(k) || 0) + v); });
  const volBars = [...buckets.entries()].sort((a, b) => a[0] - b[0]).slice(-26).map(([t, v]) => ({ l: fmtDate(t, { day: '2-digit', month: '2-digit' }), v, tip: weekly ? 'semana de ' + fmtDate(t) : fmtDate(t, { weekday: 'short', day: '2-digit', month: 'short' }) }));
  // grupos
  const gC = {}; m.items.forEach(i => { const g = getEx(i.exId).g; gC[g] = (gC[g] || 0) + i.sets.length; });
  const groups = Object.entries(gC).sort((a, b) => b[1] - a[1]).map(([l, v]) => ({ l, v }));
  // dias da semana
  const wd = Array(7).fill(0); ss.forEach(s => wd[(new Date(s.start).getDay() + 6) % 7]++);
  // frequência por exercício
  const exC = {}; ss.forEach(s => new Set(s.items.map(i => i.exId)).forEach(id => { if (RF.ex === 'all' || id === RF.ex) exC[id] = (exC[id] || 0) + 1; }));
  const pool = new Set(Object.keys(exC));
  if (RF.ex === 'all') S.routines.filter(r => RF.routine === 'all' || r.id === RF.routine).forEach(r => r.items.forEach(i => pool.add(i.exId)));
  const freq = [...pool].map(id => ({ id, l: getEx(id).n + ' · ' + getEx(id).e, v: exC[id] || 0 }));
  const most = [...freq].sort((a, b) => b.v - a.v).slice(0, 6), least = [...freq].sort((a, b) => a.v - b.v).slice(0, 5);
  // recordes
  const prMap = {}; m.items.forEach(i => i.sets.forEach(s => { const w = num(s.w); if (w > (prMap[i.exId] || 0)) prMap[i.exId] = w; }));
  const prs = Object.entries(prMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  // heatmap (16 semanas)
  const wk0 = startOfWeek(Date.now()) - 15 * 7 * DAY, dayCnt = {};
  S.sessions.filter(s => RF.routine === 'all' || s.routineId === RF.routine).forEach(s => { const k = dayKey(s.start); dayCnt[k] = (dayCnt[k] || 0) + 1; });
  let heat = ''; for (let i = 0; i < 16 * 7; i++) { const t = wk0 + i * DAY; const c = dayCnt[dayKey(t)] || 0; heat += `<i class="${t > Date.now() ? 'fut' : c > 1 ? 'l2' : c ? 'l2' : ''}" title="${fmtDate(t)}${c ? ' · ' + c + ' treino' : ''}"></i>`; }
  const activeWeeks = new Set(S.sessions.map(s => startOfWeek(s.start)));
  let streak = 0, wt = startOfWeek(Date.now()); if (!activeWeeks.has(wt)) wt = startOfWeek(wt - 3 * DAY);
  while (activeWeeks.has(wt)) { streak++; wt = startOfWeek(wt - 3 * DAY); }

  const exSec = RF.ex !== 'all' ? exerciseSection(RF.ex, ss) : '';
  return `<header class="top"><h1>Relatórios</h1><span class="muted" style="font-size:13px">${ss.length} treino${ss.length > 1 ? 's' : ''}</span></header>${filters}
    <div class="sp-s"></div>
    ${exSec}
    <div class="grid2">
      <div class="stat"><div class="lbl">${ic('flame', 'xs')} Treinos</div><div class="val">${m.n}</div>${cmp(m.n, mp.n) || `<div class="sub">${nf(m.n / (days / 7), 1)} por semana</div>`}</div>
      <div class="stat"><div class="lbl">${ic('calendar', 'xs')} Frequência</div><div class="val">${nf(m.n / (days / 7), 1)}<small>/sem</small></div><div class="sub">meta ${S.settings.goal}/sem</div></div>
      <div class="stat"><div class="lbl">${ic('clock', 'xs')} Duração média</div><div class="val">${fmtDur(m.dur)}</div>${cmp(m.dur, mp.dur) || `<div class="sub">por treino</div>`}</div>
      <div class="stat"><div class="lbl">${ic('timer', 'xs')} Tempo total</div><div class="val">${fmtDur(m.total)}</div><div class="sub">em atividade</div></div>
      <div class="stat"><div class="lbl">${ic('zap', 'xs')} Tempo por exercício</div><div class="val">${m.exTime ? fmtDur(m.exTime) : '—'}</div><div class="sub">média, incluindo descanso</div></div>
      <div class="stat"><div class="lbl">${ic('dumbbell', 'xs')} Volume total</div><div class="val">${fmtKg(m.vol)}</div>${cmp(m.vol, mp.vol) || `<div class="sub">peso × repetições</div>`}</div>
      <div class="stat"><div class="lbl">${ic('trend', 'xs')} Volume / treino</div><div class="val">${fmtKg(m.n ? m.vol / m.n : 0)}</div><div class="sub">média</div></div>
      <div class="stat"><div class="lbl">${ic('layers', 'xs')} Séries / treino</div><div class="val">${nf(m.setsPer, 1)}</div><div class="sub">${nf(m.sets.length)} séries no total</div></div>
      <div class="stat"><div class="lbl">${ic('repeat', 'xs')} Reps médias</div><div class="val">${nf(m.reps, 1)}</div><div class="sub">por série</div></div>
      <div class="stat"><div class="lbl">${ic('target', 'xs')} Peso médio</div><div class="val">${nf(m.w, 1)}<small>kg</small></div><div class="sub">por série</div></div>
      <div class="stat"><div class="lbl">${ic('check', 'xs')} Conclusão</div><div class="val">${m.completion != null ? nf(Math.min(1, m.completion) * 100) + '<small>%</small>' : '—'}</div><div class="sub">exercícios planejados feitos</div></div>
      <div class="stat"><div class="lbl">${ic('flame', 'xs')} Sequência</div><div class="val">${streak}<small>sem</small></div><div class="sub">semanas seguidas treinando</div></div>
    </div>
    <div class="section-h"><h2>Sugestões e alertas</h2></div>
    <div class="list">${insights(ss, m).map(t => `<div class="insight"><span class="ii" style="background:${t.c}22;color:${t.c}">${ic(t.i, 'sm')}</span><p>${t.h}</p></div>`).join('')}</div>
    <div class="sp"></div>
    <div class="card chart-card"><h3>Volume ${weekly ? 'por semana' : 'por treino'}</h3><div class="cs">kg levantados (peso × reps)</div>${chart('bar', volBars, { fmt: v => fmtKg(v), fmtAx: v => v >= 1000 ? nf(v / 1000, 1) + 't' : nf(v) })}</div>
    <div class="sp"></div>
    <div class="card chart-card"><h3>Duração dos treinos</h3><div class="cs">minutos por sessão</div>${chart('line', ss.map(s => ({ x: s.start, y: (s.end - s.start) / 6e4, t: esc(s.name) + ' · ' + fmtDate(s.start) })), { unit: ' min', d: 0 })}</div>
    <div class="sp"></div>
    <div class="card chart-card"><h3>Séries por grupo muscular</h3><div class="cs">onde está o seu foco</div>${hbars(groups.slice(0, 10))}</div>
    <div class="sp"></div>
    <div class="card chart-card"><h3>Dias da semana</h3><div class="cs">quando você mais treina</div>${chart('bar', WD.map((l, i) => ({ l, v: wd[i], tip: l })), { h: 140, fmt: v => v + ' treino' + (v === 1 ? '' : 's') })}</div>
    <div class="sp"></div>
    <div class="card chart-card"><h3>Consistência</h3><div class="cs">últimas 16 semanas</div><div class="heat">${heat}</div>
      <div class="legend-s">menos <i style="background:var(--surface2)"></i><i style="background:var(--accent)"></i> treinou</div></div>
    ${RF.ex === 'all' ? `<div class="sp"></div>
    <div class="card chart-card"><h3>Exercícios mais realizados</h3><div class="cs">nº de treinos em que apareceram</div>${hbars(most.filter(x => x.v), v => v + '×')}</div>
    <div class="sp"></div>
    <div class="card chart-card"><h3>Exercícios menos realizados</h3><div class="cs">inclui exercícios das suas rotinas não feitos no período</div>${hbars(least, v => v + '×')}</div>
    <div class="sp"></div>
    <div class="card chart-card"><h3>Recordes de carga</h3><div class="cs">maior peso por exercício no período</div><div class="sp-s"></div>
      ${prs.map(([id, w]) => `<div class="pr-row" style="padding:8px 0" data-a="rfSetEx" data-id="${esc(id)}">${thumb(getEx(id), 'sm')}<div class="grow ellipsis" style="font-weight:650">${esc(getEx(id).n)} <span class="muted">· ${esc(getEx(id).e)}</span></div><span class="v">${nf(w, 1)} kg</span></div>`).join('') || '<div class="muted">Sem cargas registradas</div>'}</div>` : ''}
    <div class="sp"></div>`;
};
function exerciseSection(id, ss) {
  const ex = getEx(id);
  const per = ss.map(s => { const it = s.items.find(i => i.exId === id); return it ? { x: s.start, w: Math.max(0, ...it.sets.map(t => num(t.w))), rm: Math.max(0, ...it.sets.map(t => epley(num(t.w), num(t.r)))), v: vol(it.sets), sets: it.sets } : null; }).filter(Boolean);
  const best = Math.max(0, ...per.map(p => p.w)), bestRm = Math.max(0, ...per.map(p => p.rm));
  const firstW = per[0] ? per[0].w : 0, lastW = per.length ? per[per.length - 1].w : 0;
  const last = per[per.length - 1];
  return `<div class="card" style="padding:14px"><div class="row">${thumb(ex)}<div class="grow"><div style="font-weight:800;font-size:16.5px;line-height:1.25">${exTitle(ex)}</div><div class="muted" style="font-size:13px">${esc(ex.g)} · ${per.length} sessões no período</div></div>
    <button class="icon-btn ghost" data-a="rfSetEx" data-id="all" aria-label="Limpar filtro">${ic('x', 'sm')}</button></div>
    <div class="sp"></div><div class="grid3">
      <div><div class="lbl-mini">Recorde</div><b class="num" style="font-size:18px">${nf(best, 1)} kg</b></div>
      <div><div class="lbl-mini">1RM estimado</div><b class="num" style="font-size:18px">${nf(bestRm, 1)} kg</b></div>
      <div><div class="lbl-mini">Evolução</div><b class="num" style="font-size:18px;color:${lastW >= firstW ? 'var(--lime)' : '#FF8E99'}">${lastW - firstW >= 0 ? '+' : ''}${nf(lastW - firstW, 1)} kg</b></div></div>
    ${last ? `<div class="sp-s"></div><div class="lbl-mini">Última vez · ${fmtDate(last.x)}</div><div class="set-chips">${last.sets.map(x => `<span>${nf(x.w, 1)} kg × ${nf(x.r)}</span>`).join('')}</div>` : ''}</div>
    <div class="sp"></div>
    <div class="card chart-card"><h3>Carga máxima por sessão</h3><div class="cs">kg</div>${chart('line', per.map(p => ({ x: p.x, y: p.w })), { unit: ' kg' })}</div>
    <div class="sp"></div>
    <div class="card chart-card"><h3>1RM estimado (Epley)</h3><div class="cs">força máxima estimada para 1 repetição</div>${chart('line', per.map(p => ({ x: p.x, y: p.rm })), { unit: ' kg' })}</div>
    <div class="sp"></div>`;
}
function insights(ss, m) {
  const out = [], now = Date.now();
  const recent = S.sessions.filter(s => s.start >= now - 60 * DAY);
  const lastG = {}; recent.forEach(s => s.items.forEach(i => { const g = getEx(i.exId).g; lastG[g] = Math.max(lastG[g] || 0, s.start); }));
  const stale = Object.entries(lastG).filter(([, t]) => now - t > 10 * DAY).map(([g]) => g);
  if (stale.length) out.push({ i: 'calendar', c: '#FFB547', h: `<b>${stale.slice(0, 3).join(', ')}</b> ${stale.length > 1 ? 'estão' : 'está'} há mais de 10 dias sem treino.` });
  // progresso por exercício
  const prog = []; const stag = [];
  const exIds = [...new Set(ss.flatMap(s => s.items.map(i => i.exId)))];
  exIds.forEach(id => {
    const ws = ss.map(s => s.items.find(i => i.exId === id)).filter(Boolean).map(i => Math.max(0, ...i.sets.map(x => num(x.w)))).filter(w => w > 0);
    if (ws.length >= 2) prog.push({ id, d: ws[ws.length - 1] - ws[0], a: ws[0], b: ws[ws.length - 1] });
    if (ws.length >= 4) { const l4 = ws.slice(-4); if (Math.max(...l4) <= l4[0]) stag.push(id); }
  });
  const top = prog.filter(p => p.d > 0).sort((a, b) => b.d / b.a - a.d / a.a)[0];
  if (top) out.push({ i: 'trend', c: '#C6F432', h: `Maior evolução: <b>${esc(getEx(top.id).n)}</b> subiu de ${nf(top.a, 1)} para ${nf(top.b, 1)} kg (+${nf(top.d / top.a * 100)}%).` });
  if (stag.length) out.push({ i: 'zap', c: '#5B6CFF', h: `<b>${stag.slice(0, 2).map(id => esc(getEx(id).n)).join('</b> e <b>')}</b> sem aumento de carga nas últimas 4 sessões. Tente +1 repetição por série ou +2,5 kg (sobrecarga progressiva).` });
  // equilíbrio empurrar/puxar
  const push = sum(m.items.filter(i => ['Peito', 'Ombros', 'Tríceps'].includes(getEx(i.exId).g)).map(i => i.sets.length));
  const pull = sum(m.items.filter(i => ['Costas', 'Bíceps', 'Trapézio'].includes(getEx(i.exId).g)).map(i => i.sets.length));
  if (push && pull && (push / pull > 1.5 || pull / push > 1.5)) out.push({ i: 'target', c: '#E2557B', h: `Desequilíbrio: ${nf(push)} séries de <b>empurrar</b> vs ${nf(pull)} de <b>puxar</b>. Uma proporção próxima de 1:1 protege os ombros.` });
  const legs = sum(m.items.filter(i => ['Quadríceps', 'Posterior', 'Glúteos', 'Panturrilha'].includes(getEx(i.exId).g)).map(i => i.sets.length));
  if (m.sets.length > 30 && legs / m.sets.length < .2) out.push({ i: 'bulb', c: '#FFB547', h: `Pernas representam só <b>${nf(legs / m.sets.length * 100)}%</b> das suas séries. Considere mais volume de membros inferiores.` });
  // duração
  if (ss.length >= 6) { const a = mean(ss.slice(-3).map(s => s.end - s.start)), b = mean(ss.slice(-6, -3).map(s => s.end - s.start)); if (Math.abs(a - b) / b > .15) out.push({ i: 'clock', c: '#3DB8FF', h: `Seus últimos treinos estão <b>${a > b ? 'mais longos' : 'mais curtos'}</b> (${fmtDur(a)} vs ${fmtDur(b)}). ${a > b ? 'Fique de olho no tempo de descanso.' : ''}` }); }
  // meta
  const wk = S.sessions.filter(s => s.start >= now - 28 * DAY).length / 4;
  out.push({ i: 'flame', c: wk >= S.settings.goal ? '#C6F432' : '#FFB547', h: wk >= S.settings.goal ? `Você está acima da meta: <b>${nf(wk, 1)} treinos/semana</b> nas últimas 4 semanas. Excelente constância!` : `Média de <b>${nf(wk, 1)} treinos/semana</b> nas últimas 4 semanas — meta é ${S.settings.goal}.` });
  return out;
}

/* ---------- Ajustes ---------- */
VIEWS.settings = () => {
  const p = S.profile, st = S.settings;
  return `<header class="top"><button class="icon-btn" data-a="back" aria-label="Voltar">${ic('left')}</button><h1 style="font-size:22px">Ajustes</h1><span style="width:44px"></span></header>
    ${Cloud.enabled && Cloud.user ? `<div class="section-h" style="margin-top:6px"><h2>Conta</h2></div>
    <div class="card"><div class="acct"><div class="av" aria-hidden="true">${esc((p.name || Cloud.user.email || '?')[0].toUpperCase())}</div>
      <div class="grow"><b class="ellipsis" style="display:block">${esc(Cloud.user.email)}</b><span class="sync ${Cloud.status}" data-sync role="status"><i></i><span>${syncLabel()}</span></span></div></div>
      <div class="sp"></div><div class="btn-row"><button class="btn" data-a="syncNow">${ic('refresh', 'sm')} Sincronizar</button><button class="btn" data-a="signOut">${ic('logout', 'sm')} Sair</button></div>
      <div style="text-align:center;margin-top:6px"><button class="link-btn" data-a="changePass">Alterar senha</button></div></div>` : ''}
    <div class="section-h"${Cloud.enabled && Cloud.user ? '' : ' style="margin-top:6px"'}><h2>Perfil</h2></div>
    <div class="card stack">
      <label class="field"><span>Nome</span><input class="input" value="${esc(p.name)}" data-c="prof" data-k="name" autocomplete="given-name"></label>
      <div class="field"><span>Sexo (usado na estimativa de gordura)</span><div class="seg"><button class="${p.sex !== 'F' ? 'on' : ''}" data-a="setSex" data-k="M">Masculino</button><button class="${p.sex === 'F' ? 'on' : ''}" data-a="setSex" data-k="F">Feminino</button></div></div>
      <div class="grid2"><label class="field"><span>Nascimento</span><input class="input" type="date" value="${esc(p.birth)}" data-c="prof" data-k="birth"></label>
      <label class="field"><span>Altura (cm)</span><input class="input" inputmode="numeric" value="${esc(p.height)}" placeholder="175" data-c="prof" data-k="height"></label></div>
    </div>
    <div class="section-h"><h2>Treino</h2></div>
    <div class="list">
      <div class="set-row-line"><div class="l"><b>Meta semanal</b><small>treinos por semana</small></div>${setStepper('goal', st.goal)}</div>
      <div class="set-row-line"><div class="l"><b>Descanso padrão</b><small>segundos, para novos exercícios</small></div>${setStepper('rest', st.rest)}</div>
      <div class="set-row-line" data-a="setToggle" data-k="vibrate" role="switch" aria-checked="${!!st.vibrate}" tabindex="0"><div class="l"><b>Vibrar ao fim do descanso</b></div><span class="toggle ${st.vibrate ? 'on' : ''}"></span></div>
      <div class="set-row-line" data-a="setToggle" data-k="sound" role="switch" aria-checked="${!!st.sound}" tabindex="0"><div class="l"><b>Som ao fim do descanso</b></div><span class="toggle ${st.sound ? 'on' : ''}"></span></div>
    </div>
    <div class="section-h"><h2>Backup dos dados</h2></div>
    <p class="muted" style="font-size:13.5px;margin:-4px 0 12px">${Cloud.enabled && Cloud.user ? 'Seus dados são salvos na sua conta automaticamente. Um arquivo de backup é uma segurança extra e serve para trazer dados de outro aparelho.' : 'Seus dados ficam só neste aparelho. Exporte um backup de vez em quando (ex.: para o Google Drive).'}</p>
    <div class="btn-row"><button class="btn" data-a="exportData">${ic('download', 'sm')} Exportar</button><label class="btn" style="cursor:pointer">${ic('upload', 'sm')} Importar<input type="file" accept="application/json,.json" data-c="importData" hidden></label></div>
    <div class="section-h"><h2>Dados</h2></div>
    <div class="stack"><button class="btn" data-a="restoreSeed">${ic('copy', 'sm')} Adicionar treinos de exemplo</button><button class="btn danger" data-a="wipe">${ic('trash', 'sm')} Apagar todos os dados</button></div>
    <p class="muted" style="font-size:12px;text-align:center;margin-top:24px">Jhon Fit · versão ${esc(VERSION)}<br>Imagens dos exercícios: free-exercise-db (domínio público)</p>`;
};
function setStepper(k, v) { return `<div class="stepper"><button data-a="setStep" data-k="${k}" data-d="-1" aria-label="Diminuir ${STEP_LBL[k]}">${ic('minus', 'xs')}</button><b aria-live="polite">${v}</b><button data-a="setStep" data-k="${k}" data-d="1" aria-label="Aumentar ${STEP_LBL[k]}">${ic('plus', 'xs')}</button></div>`; }

/* =========================================================
   Seletor de exercícios
   ========================================================= */
const PK = { q: '', g: 'Todos', e: 'Todos', sel: [], limit: 60, cb: null, single: false };
let SEARCH_IDX = null;
function searchIdx() { if (!SEARCH_IDX || SEARCH_IDX.size !== EX.size) { SEARCH_IDX = new Map(); EX.forEach(e => SEARCH_IDX.set(e.i, norm(`${e.n} ${e.e} ${e.g} ${(e.s || []).join(' ')} ${e.i.replace(/[_-]/g, ' ')}`))); } return SEARCH_IDX; }
function openPicker(cb, title = 'Adicionar exercícios') {
  Object.assign(PK, { q: '', g: 'Todos', e: 'Todos', sel: [], limit: 60, cb });
  openSheet(`<div class="pk-top"><div class="row" style="justify-content:space-between;margin-bottom:12px"><h3>${esc(title)}</h3><button class="icon-btn ghost" data-a="closeSheet" aria-label="Fechar">${ic('x')}</button></div>
    <div class="search">${ic('search', 'sm')}<input class="input" id="pk-q" type="search" placeholder="Buscar (ex.: supino, rosca, leg)" autocomplete="off"></div>
    <div class="sp-s"></div><div class="chips" id="pk-g"></div><div class="sp-s"></div><div class="chips" id="pk-e"></div></div>
    <div class="pk-list" id="pk-list"></div>
    <div class="pk-dock"><div class="btn-row"><button class="btn auto" data-a="pkCustom" style="flex:none">${ic('plus', 'sm')} Criar</button><button class="btn primary" id="pk-go" data-a="pkDone" disabled>Adicionar</button></div></div>`, { full: true });
  $('#pk-q').addEventListener('input', e => { PK.q = e.target.value; PK.limit = 60; pkRender(); });
  pkChips(); pkRender();
}
function pkChips() {
  $('#pk-g').innerHTML = ['Todos', ...GROUPS, 'Cardio', 'Alongamento'].map(g => `<button class="chip ${PK.g === g ? 'on' : ''}" data-a="pkG" data-k="${g}">${g}</button>`).join('');
  $('#pk-e').innerHTML = ['Todos', ...EQUIPS].map(g => `<button class="chip ${PK.e === g ? 'on' : ''}" data-a="pkE" data-k="${g}" style="height:32px;font-size:12.5px">${g === 'Todos' ? 'Todo equipamento' : g}</button>`).join('');
}
function pkRender() {
  const idx = searchIdx(); const q = norm(PK.q.trim()).split(/\s+/).filter(Boolean);
  const used = {}; S.sessions.forEach(s => s.items.forEach(i => used[i.exId] = (used[i.exId] || 0) + 1)); S.routines.forEach(r => r.items.forEach(i => used[i.exId] = (used[i.exId] || 0) + .5));
  let list = [...EX.values()].filter(e => {
    if (PK.g === 'Cardio' || PK.g === 'Alongamento') { if (e.c !== PK.g) return false; } else if (PK.g !== 'Todos' && e.g !== PK.g) return false;
    if (PK.e !== 'Todos' && e.e !== PK.e) return false;
    if (q.length) { const s = idx.get(e.i); return q.every(w => s.includes(w)); }
    return true;
  });
  const qs = q.join(' ');
  list.sort((a, b) => (b.t - a.t) || ((used[b.i] || 0) - (used[a.i] || 0)) || ((qs && norm(b.n).startsWith(qs)) - (qs && norm(a.n).startsWith(qs))) || (a.c === 'Força' ? -1 : 0) - (b.c === 'Força' ? -1 : 0) || a.n.localeCompare(b.n));
  const total = list.length; list = list.slice(0, PK.limit);
  const row = e => `<div class="pk-item ${PK.sel.includes(e.i) ? 'on' : ''}" role="group" aria-label="${esc(e.n)}" data-a="pkTog" data-id="${esc(e.i)}"><div class="r-main" data-a="pkTog" data-id="${esc(e.i)}" role="button" tabindex="0" aria-pressed="${PK.sel.includes(e.i)}">${thumb(e, 'sm')}<div class="grow"><div class="nm">${esc(e.n)}${e.t ? '' : '<span class="tag">EN</span>'}</div>
    <div class="meta">${esc(e.e)} · ${esc(e.g)}${used[e.i] >= 1 ? ' · já usado' : ''}</div></div></div><button class="icon-btn ghost" data-a="exInfoPk" data-id="${esc(e.i)}" aria-label="Detalhes de ${esc(e.n)}">${ic('info', 'sm')}</button><span class="ck">${ic('check', 'xs')}</span></div>`;
  $('#pk-list').innerHTML = `<div class="pk-label">${total} exercício${total === 1 ? '' : 's'}</div>${list.map(row).join('')}${total > PK.limit ? `<button class="btn" data-a="pkMore" style="margin-top:10px">Mostrar mais (${total - PK.limit})</button>` : ''}${!total ? `<div class="empty">Nada encontrado.<br><button class="link-btn" data-a="pkCustom">Criar exercício "${esc(PK.q)}"</button></div>` : ''}`;
  const b = $('#pk-go'); b.disabled = !PK.sel.length; b.textContent = PK.sel.length ? `Adicionar (${PK.sel.length})` : 'Adicionar';
}
function customExerciseSheet(prefill, onDone) {
  openSheet(`<h3>Novo exercício</h3><p class="sub">Fica salvo na sua lista.</p><div class="sp"></div><div class="stack">
    <label class="field"><span>Nome</span><input class="input" id="cx-n" value="${esc(prefill || '')}" placeholder="Ex.: Remada articulada"></label>
    <div class="grid2"><label class="field"><span>Grupo muscular</span><select class="select" id="cx-g" style="height:50px">${GROUPS.map(g => `<option>${g}</option>`).join('')}</select></label>
    <label class="field"><span>Equipamento</span><select class="select" id="cx-e" style="height:50px">${EQUIPS.map(g => `<option>${g}</option>`).join('')}</select></label></div>
    <label class="field"><span>Foto (opcional)</span><input class="input" id="cx-img" type="file" accept="image/*" style="padding-top:12px"></label>
    <button class="btn primary" id="cx-ok">Salvar exercício</button></div>`);
  $('#cx-ok').onclick = async () => {
    const n = $('#cx-n').value.trim(); if (!n) { toast('Dê um nome ao exercício'); return; }
    const f = $('#cx-img').files[0]; let img = '';
    if (f) img = await resizeImage(f, 240).catch(() => '');
    const ex = { i: 'c_' + uid(), n, e: $('#cx-e').value, g: $('#cx-g').value, c: 'Força', t: 1, s: [], img };
    S.custom.push(ex); EX.set(ex.i, ex); save(); toast('Exercício criado');
    closeSheet(() => onDone && onDone(ex.i));
  };
}
function resizeImage(file, max) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .8)); }; im.onerror = rej; im.src = r.result; }; r.onerror = rej; r.readAsDataURL(file); });
}
function exInfoSheet(id, fromPicker) {
  const ex = getEx(id);
  const hist = S.sessions.filter(s => s.items.some(i => i.exId === id)).sort((a, b) => a.start - b.start);
  const pts = hist.map(s => ({ x: s.start, y: Math.max(0, ...s.items.filter(i => i.exId === id).flatMap(i => i.sets.map(t => num(t.w)))) }));
  const b = bestOf(id), lp = lastPerf(id);
  charts = charts.filter(c => document.getElementById(c.id));
  const html = `<div class="ex-anim">${ex.img ? `<img src="${esc(ex.img)}" alt="">` : `<img src="${esc(imgUrl(ex, 0))}" crossorigin="anonymous" alt="">${ex.i.startsWith('c_') ? '' : `<img class="f1" src="${esc(imgUrl(ex, 1))}" crossorigin="anonymous" alt="" data-rm-on-error">`}`}</div>
    <div class="sp"></div><h3>${esc(ex.n)}</h3><div class="badges"><span class="badge a">${esc(ex.g)}</span><span class="badge">${esc(ex.e)}</span>${(ex.s || []).map(s => `<span class="badge">${esc(s)}</span>`).join('')}</div>
    <div class="sp"></div>
    ${hist.length ? `<div class="grid3"><div class="stat" style="padding:10px"><div class="lbl">Vezes</div><div class="val" style="font-size:19px">${hist.length}</div></div>
      <div class="stat" style="padding:10px"><div class="lbl">Recorde</div><div class="val" style="font-size:19px">${nf(b.w, 1)}<small>kg</small></div></div>
      <div class="stat" style="padding:10px"><div class="lbl">1RM est.</div><div class="val" style="font-size:19px">${nf(b.rm, 0)}<small>kg</small></div></div></div>
      ${lp ? `<div class="sp-s"></div><div class="lbl-mini">Última vez · ${relDay(lp.date)}</div><div class="set-chips">${lp.sets.map(x => `<span>${nf(x.w, 1)} kg × ${nf(x.r)}</span>`).join('')}</div>` : ''}
      <div class="card chart-card" style="margin-top:12px;background:var(--surface2)"><h3>Carga máxima</h3>${chart('line', pts, { unit: ' kg', h: 140 })}</div>
      <div class="sp-s"></div>${fromPicker ? '' : `<button class="btn" data-a="exReport" data-id="${esc(id)}">${ic('chart', 'sm')} Ver relatório completo</button>`}`
      : `<p class="muted" style="font-size:14px">Você ainda não registrou este exercício. Depois do primeiro treino, aqui aparecem recorde, 1RM estimado e evolução de carga.</p>`}
    ${fromPicker ? `<div class="sp-s"></div><button class="btn primary" data-a="pkPickFromInfo" data-id="${esc(id)}">${PK.sel.includes(id) ? 'Selecionado ✓' : 'Selecionar este'}</button>` : ''}`;
  if (fromPicker) {
    // sobrepõe o seletor sem perder a seleção
    const sheet = $('#sheet-root .sheet'); const keep = sheet.innerHTML;
    sheet.classList.remove('full'); sheet.innerHTML = `<div class="grab"></div><button class="link-btn" data-a="pkBack">${ic('left', 'xs')} Voltar à lista</button><div class="sp-s"></div>` + html;
    PK._restore = () => { sheet.classList.add('full'); sheet.innerHTML = keep; $('#pk-q').value = PK.q; $('#pk-q').addEventListener('input', e => { PK.q = e.target.value; PK.limit = 60; pkRender(); }); pkChips(); pkRender(); };
  } else openSheet(html);
  mountCharts();
}

/* =========================================================
   Treino: lógica
   ========================================================= */
function newActiveItem(exId, sets, reps, rest, ss) {
  const lp = lastPerf(exId);
  const base = lp ? lp.sets.map(s => ({ w: s.w ? String(s.w) : '', r: String(s.r || reps || ''), done: false })) : Array.from({ length: sets || 3 }, () => ({ w: '', r: String(reps || 10), done: false }));
  return { uid: uid(), exId, ss: !!ss, rest: rest || S.settings.rest, done: false, doneAt: null, sets: base, prev: lp ? lp.sets : [], prevDate: lp ? lp.date : null };
}
async function startWorkout(rid) {
  if (S.active) {
    if (!(await confirmSheet({ title: 'Já existe um treino em andamento', text: `“${esc(S.active.name)}” está aberto. Descartar e iniciar outro?`, ok: 'Descartar e iniciar', danger: true }))) { go('workout'); return; }
  }
  const r = S.routines.find(x => x.id === rid);
  S.active = { id: uid(), routineId: r ? r.id : null, name: r ? r.name : 'Treino livre', start: Date.now(), restEnd: 0, restTotal: 0,
    items: r ? r.items.map(i => newActiveItem(i.exId, i.sets, i.reps, i.rest, i.ss)) : [] };
  openU = null; save(); wake(); go('workout');
  if (!r) setTimeout(() => A.wkAdd(), 300);
}
function findItem(u) { return S.active && S.active.items.find(i => i.uid === u); }
function markItemDone(it) {
  it.done = true; it.doneAt = Date.now();
  const nx = S.active.items.find(i => !i.done); openU = nx ? nx.uid : '';
}
function startRest(sec) { if (!sec) return; S.active.restEnd = Date.now() + sec * 1000; S.active.restTotal = sec; save(); renderRest(); }
function renderRest() {
  const el = $('#rest'); const a = S.active;
  if (!a || !a.restEnd || a.restEnd < Date.now() || route().name !== 'workout') { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="rest"><div><div class="rl">DESCANSO</div><div class="rt" data-rest>0:00</div></div><div class="grow"></div>
    <button class="rb" data-a="restAdd" data-d="-15" aria-label="Menos 15 segundos">−15</button><button class="rb" data-a="restAdd" data-d="15" aria-label="Mais 15 segundos">+15</button><button class="rb go" data-a="restSkip">Pular</button><div class="bar"><div data-restbar></div></div></div>`;
}
let actx = null;
function beep() {
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); [0, .22, .44].forEach((t, k) => { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = k === 2 ? 1320 : 880; o.connect(g); g.connect(actx.destination); g.gain.setValueAtTime(.0001, actx.currentTime + t); g.gain.exponentialRampToValueAtTime(.35, actx.currentTime + t + .02); g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + t + .18); o.start(actx.currentTime + t); o.stop(actx.currentTime + t + .2); }); } catch (e) { }
}
function tick() {
  const a = S.active;
  if (a) {
    const t = fmtClock(Date.now() - a.start); $$('[data-clock]').forEach(e => e.textContent = t);
    if (a.restEnd) {
      const left = a.restEnd - Date.now();
      if (left <= 0) {
        a.restEnd = 0; save(); renderRest();
        if (S.settings.vibrate && navigator.vibrate) navigator.vibrate([250, 120, 250]);
        if (S.settings.sound) beep();
        toast('Descanso finalizado — bora!');
      } else {
        const r = $('[data-rest]'); if (r) r.textContent = fmtClock(left + 999);
        const b = $('[data-restbar]'); if (b) b.style.width = (left / (a.restTotal * 1000) * 100) + '%';
      }
    }
  }
}
setInterval(tick, 1000);
let wl = null;
async function wake() { try { if (navigator.wakeLock && S.active) wl = await navigator.wakeLock.request('screen'); } catch (e) { } }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (S.active) wake(); tick(); } });

async function finishWorkout() {
  const a = S.active; if (!a) return;
  const doneSets = a.items.flatMap(i => i.sets.filter(s => s.done || i.done));
  if (!doneSets.length) {
    if (await confirmSheet({ title: 'Nenhuma série concluída', text: 'Marque os exercícios ou séries feitos antes de finalizar. Deseja descartar este treino?', ok: 'Descartar treino', cancel: 'Continuar treinando', danger: true })) discardWorkout();
    return;
  }
  const pend = a.items.filter(i => !i.done && !i.sets.some(s => s.done)).length;
  const r = S.routines.find(x => x.id === a.routineId);
  openSheet(`<h3>Finalizar treino?</h3><p class="sub">${fmtClock(Date.now() - a.start)} de treino · ${doneSets.length} ${doneSets.length === 1 ? 'série' : 'séries'} · ${fmtKg(vol(doneSets))}${pend ? `<br><span style="color:var(--warn)">${pend} exercício${pend > 1 ? 's' : ''} não ${pend > 1 ? 'foram marcados' : 'foi marcado'} e não ${pend > 1 ? 'serão salvos' : 'será salvo'}.</span>` : ''}</p>
    <div class="sp"></div>${r ? `<div class="set-row-line card" id="fin-upd" role="switch" aria-checked="false" tabindex="0" style="padding:14px"><div class="l"><b>Atualizar a rotina “${esc(r.name)}”</b><small>usar as séries e reps de hoje como padrão</small></div><span class="toggle"></span></div><div class="sp"></div>` : ''}
    <div class="stack"><button class="btn lime" id="fin-ok">${ic('check', 'sm')} Finalizar e salvar</button><button class="btn" data-a="closeSheet">Continuar treinando</button></div>`);
  let upd = false; const fu = $('#fin-upd'); if (fu) fu.onclick = () => { upd = !upd; fu.setAttribute('aria-checked', upd); fu.querySelector('.toggle').classList.toggle('on', upd); };
  $('#fin-ok').onclick = () => closeSheet(() => doFinish(upd));
}
function doFinish(updateRoutine) {
  const a = S.active, end = Date.now();
  a.items.forEach(i => { if (!i.done && i.sets.some(s => s.done)) { i.doneAt = i.doneAt || end; } });
  const used = a.items.filter(i => i.done || i.sets.some(s => s.done));
  let prevT = a.start;
  [...used].sort((x, y) => (x.doneAt || end) - (y.doneAt || end)).forEach(i => { const t = i.doneAt || end; i.time = Math.max(0, t - prevT); prevT = t; });
  const items = used.map(i => ({ exId: i.exId, ss: i.ss, time: i.time, sets: i.sets.filter(s => s.done || i.done).filter(s => num(s.r) > 0 || num(s.w) > 0).map(s => ({ w: num(s.w), r: num(s.r) })) })).filter(i => i.sets.length);
  const prs = [];
  items.forEach(i => { const mw = Math.max(...i.sets.map(s => s.w)); const b = bestOf(i.exId, a.start); if (b.w > 0 && mw > b.w && !prs.find(p => p.exId === i.exId)) prs.push({ exId: i.exId, w: mw, prev: b.w }); });
  const sess = { id: a.id, routineId: a.routineId, name: a.name, start: a.start, end, planned: a.items.length, items, prs };
  S.sessions.push(sess);
  if (updateRoutine) {
    const r = S.routines.find(x => x.id === a.routineId);
    if (r) r.items.forEach(ri => { const it = items.find(i => i.exId === ri.exId); if (it) { ri.sets = it.sets.length; const rs = it.sets.map(s => s.r); ri.reps = rs.sort((x, y) => rs.filter(v => v === y).length - rs.filter(v => v === x).length)[0] || ri.reps; } });
  }
  S.active = null; save(); if (wl) { wl.release().catch(() => { }); wl = null; }
  justFinished = sess.id; go('session/' + sess.id);
}
function discardWorkout() { S.active = null; save(); if (wl) { wl.release().catch(() => { }); wl = null; } toast('Treino descartado'); go('home'); }

/* =========================================================
   Corpo: formulário
   ========================================================= */
function bodySheet(entry) {
  const e = entry || { id: uid(), date: dayKey(Date.now()), weight: latestBody() ? latestBody().weight : '', waist: '', neck: '', hip: '', bfManual: '' };
  const female = S.profile.sex === 'F';
  // campos usados na estimativa (Marinha) ficam visíveis; demais circunferências num grupo recolhível
  const estKeys = female ? ['waist', 'neck', 'hip'] : ['waist', 'neck'];
  const mField = m => { const p = lastMeasure(m.k, entry ? e.date : null);
    return `<label class="field"><span>${m.l}</span><input class="input" inputmode="decimal" id="b-${m.k}" value="${esc(e[m.k] ?? '')}" placeholder="${p ? 'últ. ' + nf(p[m.k], 1) : esc(m.hint)}"></label>`; };
  const extra = MEASURES.filter(m => !estKeys.includes(m.k));
  const openExtra = extra.some(m => num(e[m.k]) > 0 || (!entry && lastMeasure(m.k)));
  openSheet(`<h3>${entry ? 'Editar registro' : 'Novo registro'}</h3><p class="sub">Peso e medidas (em cm). Só o peso é obrigatório.</p><div class="sp"></div>
    <div class="stack"><div class="grid2"><label class="field"><span>Data</span><input class="input" type="date" id="b-date" value="${esc(e.date)}"></label>
      <label class="field"><span>Peso (kg)</span><input class="input big" inputmode="decimal" id="b-weight" value="${esc(e.weight)}" placeholder="80,0"></label></div>
    <div class="${female ? 'grid3' : 'grid2'}">${MEASURES.filter(m => estKeys.includes(m.k)).map(mField).join('')}</div>
    <details class="fold"${openExtra ? ' open' : ''}><summary>Circunferências <span class="muted">· braço, quadril, coxa…</span>${ic('right', 'sm')}</summary>
      <div class="grid2" style="margin-top:12px">${extra.map(mField).join('')}</div>
      <p class="muted" style="font-size:12px;margin-top:10px">Dica: meça sempre do mesmo lado, com fita rente à pele e, se possível, pela manhã.</p></details>
    <label class="field"><span>% gordura medida (opcional — bioimpedância, adipômetro)</span><input class="input" inputmode="decimal" id="b-bf" value="${esc(e.bfManual)}" placeholder="deixe vazio para estimar"></label>
    <div class="card" style="background:var(--surface2)"><div class="row"><div class="grow"><div class="lbl-mini">Estimativa de gordura</div><b id="b-est" style="font-size:22px">—</b></div><span class="muted" id="b-met" style="font-size:12.5px;text-align:right"></span></div></div>
    <button class="btn primary" id="b-ok">Salvar</button>${entry ? `<button class="btn danger" id="b-del">${ic('trash', 'sm')} Excluir registro</button>` : ''}</div>`);
  const read = () => { const v = { ...e, date: $('#b-date').value || dayKey(Date.now()), weight: num($('#b-weight').value) || '', bfManual: num($('#b-bf').value) || '' };
    MEASURES.forEach(m => { v[m.k] = num($('#b-' + m.k).value) || ''; }); return v; };
  const upd = () => { const r = estimateBF(read()); $('#b-est').textContent = r.bf ? nf(r.bf, 1) + '%' : '—'; $('#b-met').textContent = r.bf ? r.method : 'informe peso + altura/idade ou medidas'; };
  $$('#sheet-root input').forEach(i => i.addEventListener('input', upd)); upd();
  $('#b-ok').onclick = () => {
    const v = read(); if (!v.weight) { toast('Informe o peso'); return; }
    const r = estimateBF(v); v.bf = r.bf ? +r.bf.toFixed(1) : null; v.method = r.method;
    S.body = S.body.filter(x => x.id !== v.id); S.body.push(v); save(); closeSheet(() => { render(true); toast('Registro salvo'); });
  };
  if (entry) $('#b-del').onclick = () => { S.body = S.body.filter(x => x.id !== e.id); save(); closeSheet(() => render(true)); };
}
function onboarding() {
  const canSeed = S.routines.length > 0 && !S.sessions.length;
  openSheet(`<div style="text-align:center;padding:6px 0 4px"><img src="icons/icon-192.png" alt="" style="width:72px;height:72px;border-radius:20px;margin:0 auto 12px">
    <h3>Boas-vindas ao Jhon Fit</h3><p class="sub">Complete seu perfil para personalizar o app e estimar a gordura corporal. Você pode mudar tudo depois em Ajustes.</p></div><div class="sp"></div>
    <div class="stack"><label class="field"><span>Como quer ser chamado(a)?</span><input class="input" id="o-name" value="${esc(S.profile.name)}" autocomplete="given-name" placeholder="Seu nome"></label>
    <div class="field"><span>Sexo (usado na estimativa de gordura)</span><div class="seg" id="o-sex"><button class="on" data-v="M">Masculino</button><button data-v="F">Feminino</button></div></div>
    <div class="grid2"><label class="field"><span>Nascimento</span><input class="input" type="date" id="o-birth"></label><label class="field"><span>Altura (cm)</span><input class="input" inputmode="numeric" id="o-h" placeholder="175"></label></div>
    <label class="field"><span>Peso atual (kg)</span><input class="input" inputmode="decimal" id="o-w" placeholder="70,0"></label>
    ${canSeed ? `<div class="set-row-line card" id="o-seed" role="switch" aria-checked="true" tabindex="0" style="padding:12px 14px"><div class="l"><b>Começar com treinos de exemplo</b><small>${S.routines.length} treinos prontos, que você pode editar ou excluir</small></div><span class="toggle on"></span></div>` : ''}
    <button class="btn primary" id="o-ok">Começar</button><button class="link-btn" id="o-skip" style="margin:0 auto;display:block">Pular por enquanto</button></div>`, { onClose: () => { S.onboarded = true; save(); } });
  let sex = 'M', keepSeed = true;
  const seedEl = $('#o-seed');
  if (seedEl) seedEl.onclick = () => { keepSeed = !keepSeed; seedEl.setAttribute('aria-checked', keepSeed); $('.toggle', seedEl).classList.toggle('on', keepSeed); };
  $$('#o-sex button').forEach(b => b.onclick = () => { sex = b.dataset.v; $$('#o-sex button').forEach(x => x.classList.toggle('on', x === b)); });
  $('#o-skip').onclick = () => closeSheet();
  $('#o-ok').onclick = () => {
    if (canSeed && !keepSeed) S.routines = [];
    Object.assign(S.profile, { name: $('#o-name').value.trim(), sex, birth: $('#o-birth').value, height: num($('#o-h').value) || '' });
    const w = num($('#o-w').value);
    if (w) { const e = { id: uid(), date: dayKey(Date.now()), weight: w, waist: '', neck: '', hip: '', bfManual: '' }; const r = estimateBF(e); e.bf = r.bf ? +r.bf.toFixed(1) : null; e.method = r.method; S.body.push(e); }
    S.onboarded = true; save(); closeSheet(() => render());
  };
}

/* =========================================================
   Ações (delegação de eventos)
   ========================================================= */
const A = {
  go: el => go(el.dataset.to),
  back: () => { if (history.length > 1) history.back(); else go('home'); },
  closeSheet: () => closeSheet(),
  start: el => startWorkout(el.dataset.id),
  startFree: () => startWorkout(null),
  exInfo: el => exInfoSheet(el.dataset.id),
  exReport: el => closeSheet(() => { RF.ex = el.dataset.id; RF.period = 'all'; RF.routine = 'all'; go('reports'); }),
  routineMenu: el => {
    const r = S.routines.find(x => x.id === el.dataset.id);
    openSheet(`<h3>${esc(r.name)}</h3><div class="sp"></div><div class="stack"><button class="btn" id="rm-dup">${ic('copy', 'sm')} Duplicar treino</button><button class="btn danger" id="rm-del">${ic('trash', 'sm')} Excluir treino</button></div>`);
    $('#rm-dup').onclick = () => { const c = JSON.parse(JSON.stringify(r)); c.id = uid(); c.name += ' (cópia)'; c.items.forEach(i => i.uid = uid()); S.routines.push(c); save(); closeSheet(() => go('routine/' + c.id)); };
    $('#rm-del').onclick = () => closeSheet(async () => { if (await confirmSheet({ title: `Excluir “${r.name}”?`, text: 'O histórico de treinos realizados é mantido.', ok: 'Excluir', danger: true })) { S.routines = S.routines.filter(x => x.id !== r.id); save(); go('routines'); } });
  },
  // editor
  cancelEdit: () => { const id = draft && draft._for; draft = null; if (id && id !== 'new') go('routine/' + id); else go('routines'); },
  saveEdit: () => {
    const d = draft; d.name = ($('#ed-name').value || '').trim();
    if (!d.name) { toast('Dê um nome ao treino'); $('#ed-name').focus(); return; }
    if (d.items.length) d.items[d.items.length - 1].ss = false;
    const clean = JSON.parse(JSON.stringify(d)); delete clean._for;
    const i = S.routines.findIndex(r => r.id === d.id); if (i >= 0) S.routines[i] = clean; else S.routines.push(clean);
    draft = null; save(); toast('Treino salvo'); go('routine/' + clean.id);
  },
  draftColor: el => { draft.color = el.dataset.c; draft.name = $('#ed-name').value; render(true); },
  edStep: el => { const it = draft.items.find(i => i.uid === el.dataset.u); const k = el.dataset.k; const st = k === 'rest' ? 15 : 1; it[k] = clamp((+it[k] || 0) + st * +el.dataset.d, k === 'rest' ? 0 : 1, k === 'rest' ? 600 : 100); draft.name = $('#ed-name').value; render(true); },
  edMove: el => { const a = draft.items, i = a.findIndex(x => x.uid === el.dataset.u), j = i + +el.dataset.d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; draft.name = $('#ed-name').value; render(true); },
  edSS: el => { const it = draft.items.find(i => i.uid === el.dataset.u); it.ss = !it.ss; draft.name = $('#ed-name').value; render(true); },
  edDel: el => { draft.items = draft.items.filter(i => i.uid !== el.dataset.u); draft.name = $('#ed-name').value; render(true); },
  edAdd: () => { draft.name = $('#ed-name').value; openPicker(ids => { ids.forEach(id => draft.items.push({ uid: uid(), exId: id, sets: 3, reps: 10, rest: S.settings.rest, ss: false })); render(true); }); },
  // picker
  pkG: el => { PK.g = el.dataset.k; PK.limit = 60; pkChips(); pkRender(); $('#pk-list').scrollTop = 0; },
  pkE: el => { PK.e = el.dataset.k; PK.limit = 60; pkChips(); pkRender(); $('#pk-list').scrollTop = 0; },
  pkMore: () => { PK.limit += 80; pkRender(); },
  pkTog: (el, ev) => { if (ev.target.closest('[data-a="exInfoPk"]')) return; const id = el.dataset.id; const i = PK.sel.indexOf(id); if (i >= 0) PK.sel.splice(i, 1); else PK.sel.push(id); const item = el.closest('.pk-item'); item.classList.toggle('on', i < 0); $('.r-main', item).setAttribute('aria-pressed', i < 0); const b = $('#pk-go'); b.disabled = !PK.sel.length; b.textContent = PK.sel.length ? `Adicionar (${PK.sel.length})` : 'Adicionar'; },
  pkDone: () => { const ids = [...PK.sel], cb = PK.cb; closeSheet(() => cb && cb(ids)); },
  exInfoPk: el => exInfoSheet(el.dataset.id, true),
  pkBack: () => PK._restore && PK._restore(),
  pkPickFromInfo: el => { if (!PK.sel.includes(el.dataset.id)) PK.sel.push(el.dataset.id); PK._restore(); },
  pkCustom: () => { const cb = PK.cb, sel = [...PK.sel], q = PK.q; closeSheet(() => setTimeout(() => customExerciseSheet(q, id => cb && cb([...sel, id])), 50)); },
  // treino
  wkOpen: (el, ev) => { if (ev.target.closest('.chk')) return; openU = openU === el.dataset.u ? '' : el.dataset.u; render(true); },
  wkDone: el => {
    const it = findItem(el.dataset.u); if (!it) return;
    if (it.done) { it.done = false; it.doneAt = null; openU = it.uid; }
    else { it.sets.forEach(s => { if (num(s.r) > 0) s.done = true; }); markItemDone(it); if (navigator.vibrate) navigator.vibrate(30); if (!it.ss) startRest(it.rest); }
    save(); render(true);
  },
  wkSet: el => {
    const it = findItem(el.dataset.u); const s = it.sets[+el.dataset.i]; s.done = !s.done;
    if (s.done) { if (!num(s.r)) s.r = it.sets.find(x => num(x.r)) ? it.sets.find(x => num(x.r)).r : '10'; if (navigator.vibrate) navigator.vibrate(20);
      if (it.sets.every(x => x.done)) { markItemDone(it); if (!it.ss) startRest(it.rest); }
      else if (!it.ss) startRest(it.rest);
      else { const nx = S.active.items[S.active.items.indexOf(it) + 1]; if (nx) openU = nx.uid; } }
    else if (it.done) { it.done = false; it.doneAt = null; }
    save(); render(true);
  },
  wkAddSet: el => { const it = findItem(el.dataset.u); const l = it.sets[it.sets.length - 1] || { w: '', r: '10' }; it.sets.push({ w: l.w, r: l.r, done: false }); it.done = false; save(); render(true); },
  wkRmSet: el => { const it = findItem(el.dataset.u); if (it.sets.length > 1) it.sets.pop(); save(); render(true); },
  wkRmItem: async el => {
    const it = findItem(el.dataset.u); if (!it) return;
    // Só pede confirmação se houver séries já feitas: é o caso em que um toque acidental custa caro.
    if (it.sets.some(s => s.done) && !await confirmSheet({ title: `Remover ${getEx(it.exId).n}?`, text: 'As séries já registradas deste exercício serão descartadas.', ok: 'Remover', danger: true })) return;
    S.active.items = S.active.items.filter(i => i.uid !== it.uid); save(); render(true);
  },
  wkAdd: () => openPicker(ids => { ids.forEach(id => S.active.items.push(newActiveItem(id, 3, 10, S.settings.rest, false))); if (ids.length) openU = S.active.items[S.active.items.length - ids.length].uid; save(); render(true); }),
  wkCancel: async () => { if (await confirmSheet({ title: 'Descartar treino?', text: 'Nada deste treino será salvo.', ok: 'Descartar', danger: true })) discardWorkout(); },
  finish: () => finishWorkout(),
  restAdd: el => { const a = S.active; a.restEnd += +el.dataset.d * 1000; a.restTotal = Math.max(a.restTotal, (a.restEnd - Date.now()) / 1000); if (a.restEnd <= Date.now()) a.restEnd = 0; save(); renderRest(); tick(); },
  restSkip: () => { S.active.restEnd = 0; save(); renderRest(); },
  delSession: async el => { if (await confirmSheet({ title: 'Excluir este treino do histórico?', ok: 'Excluir', danger: true })) { S.sessions = S.sessions.filter(s => s.id !== el.dataset.id); save(); justFinished = null; go('routines/hist'); } },
  // corpo
  bodyAdd: () => bodySheet(null),
  bodyEdit: el => bodySheet(S.body.find(b => b.id === el.dataset.id)),
  bodyTab: el => { bodyTab = el.dataset.k; render(true); },
  // relatórios
  rfPeriod: el => { RF.period = el.dataset.k; render(true); },
  rfSetEx: el => { RF.ex = el.dataset.id; render(false); },
  // ajustes
  setSex: el => { S.profile.sex = el.dataset.k; save(); render(true); },
  setStep: el => { const k = el.dataset.k, d = +el.dataset.d; S.settings[k] = k === 'rest' ? clamp(S.settings[k] + d * 15, 0, 600) : clamp(S.settings[k] + d, 1, 14); save(); render(true); },
  setToggle: el => { const k = el.dataset.k; S.settings[k] = !S.settings[k]; save(); render(true); },
  exportData: () => {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `jhonfit-backup-${dayKey(Date.now())}.json`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Backup exportado');
  },
  // conta
  syncNow: async () => { if (!navigator.onLine) { toast('Sem conexão com a internet'); return; } const ok = await Cloud.syncNow(); toast(ok ? 'Tudo sincronizado' : 'Não foi possível sincronizar agora'); },
  signOut: async () => {
    const pend = Cloud.pending;
    if (!await confirmSheet({ title: 'Sair da conta?', text: pend ? 'Há alterações que ainda não foram enviadas para a nuvem. Conecte-se à internet e toque em Sincronizar antes de sair.' : 'Seus treinos continuam salvos na sua conta. Para voltar, é só entrar com e-mail e senha.', ok: pend ? 'Sair mesmo assim' : 'Sair', danger: pend })) return;
    await Cloud.signOut(); leaveApp();
  },
  changePass: () => passSheet(false),
  authMode: el => { const email = $('#au-email') ? $('#au-email').value.trim() : (GATE && GATE.email) || ''; GATE = { mode: el.dataset.m, email }; render(); },
  pwEye: el => {
    const inp = $('input', el.closest('.pw')), show = inp.type === 'password';
    inp.type = show ? 'text' : 'password'; el.innerHTML = ic(show ? 'eyeOff' : 'eye');
    el.setAttribute('aria-pressed', show); el.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha'); inp.focus();
  },
  restoreSeed: () => { S.routines.push(...seedRoutines()); save(); toast('Treinos de exemplo adicionados'); go('routines'); },
  wipe: async () => { if (await confirmSheet({ title: 'Apagar todos os dados?', text: Cloud.enabled && Cloud.user ? 'Treinos, histórico, peso e medidas serão apagados da sua conta, em todos os aparelhos. Exporte um backup antes.' : 'Treinos, histórico, peso e medidas serão apagados deste aparelho. Exporte um backup antes.', ok: 'Apagar tudo', danger: true })) { localStorage.removeItem(KEY); S = defaults(); S.onboarded = true; save(); go('home'); render(); } },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  if (el.hasAttribute('disabled')) return;
  const f = A[el.dataset.a]; if (!f) return;
  e.preventDefault(); e.stopPropagation(); f(el, e);
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.f && S.active) { const it = findItem(t.dataset.u); if (it) { it.sets[+t.dataset.i][t.dataset.f] = t.value; save(false); } }
});
document.addEventListener('change', async e => {
  const t = e.target, c = t.dataset.c; if (!c) return;
  if (c === 'prof') { S.profile[t.dataset.k] = t.dataset.k === 'height' ? num(t.value) || '' : t.value; save(); }
  else if (c === 'draftName') draft.name = t.value;
  else if (c === 'rfRoutine') { RF.routine = t.value; render(true); }
  else if (c === 'rfEx') { RF.ex = t.value; render(false); }
  else if (c === 'importData') {
    const f = t.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d || !Array.isArray(d.routines) || !Array.isArray(d.sessions)) throw new Error('formato');
      if (await confirmSheet({ title: 'Restaurar backup?', text: `${d.sessions.length} treinos, ${d.routines.length} rotinas e ${(d.body || []).length} registros corporais vão substituir os dados atuais.`, ok: 'Restaurar' })) {
        S = normalize(d); S.active = null; S.onboarded = true; (S.custom || []).forEach(x => EX.set(x.i, x)); save(); toast('Backup restaurado'); go('home'); render();
      }
    } catch (err) { toast('Arquivo inválido'); }
    t.value = '';
  }
});
// Enter no campo de peso pula para reps
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.dataset || !e.target.dataset.f) return;
  const ins = $$('.sets input'); const i = ins.indexOf(e.target); if (ins[i + 1]) { e.preventDefault(); ins[i + 1].focus(); ins[i + 1].select(); } else e.target.blur();
});
document.addEventListener('focusin', e => { if (e.target.dataset && e.target.dataset.f) setTimeout(() => e.target.select(), 0); });

/* =========================================================
   Dados de demonstração (apenas via #/seed-demo, para testes)
   ========================================================= */
function seedDemo() {
  const now = Date.now(); S.sessions = []; S.body = [];
  let k = 0;
  for (let d = 84; d >= 1; d--) {
    const dt = new Date(now - d * DAY); const wd = (dt.getDay() + 6) % 7; if (![0, 1, 3, 4].includes(wd) || Math.random() < .12) continue;
    const r = S.routines[k++ % S.routines.length]; const st = startOfDay(dt.getTime()) + (18 + Math.random()) * 36e5; let t = st;
    const prog = (84 - d) / 84;
    const items = r.items.map(it => { const base = { Barra: 30, Halter: 12, Cabo: 25, Aparelho: 40, Smith: 40, 'Peso corporal': 0 }[getEx(it.exId).e] ?? 20; const w = Math.round((base * (1 + prog * .25)) / 2.5) * 2.5; const dur = (3 + Math.random() * 4) * 6e4; t += dur;
      return { exId: it.exId, ss: it.ss, time: dur, sets: Array.from({ length: it.sets }, (_, i) => ({ w, r: Math.max(5, it.reps - (i > 1 ? 1 : 0)) })) }; });
    S.sessions.push({ id: uid(), routineId: r.id, name: r.name, start: st, end: t + 5 * 6e4, planned: r.items.length, items, prs: [] });
  }
  Object.assign(S.profile, { name: 'Demo', sex: 'M', birth: '1990-01-01', height: 178 });
  for (let d = 84; d >= 0; d -= 7) { const w = 86 - (84 - d) / 84 * 3.4 + Math.random() * .6; const e = { id: uid(), date: dayKey(now - d * DAY), weight: +w.toFixed(1), waist: +(92 - (84 - d) / 84 * 3).toFixed(1), neck: 39, hip: 101, armR: +(36 + (84 - d) / 84 * .8).toFixed(1), armF: +(38.5 + (84 - d) / 84 * 1).toFixed(1), thigh: 58, calf: 38, wrist: 17.5, bfManual: '' }; const r = estimateBF(e); e.bf = +r.bf.toFixed(1); e.method = r.method; S.body.push(e); }
  S.onboarded = true; save();
}

/* =========================================================
   Acessibilidade: teclado, papéis ARIA e imagens
   ========================================================= */
/* Vários elementos clicáveis são <div data-a="...">. Aqui eles ganham papel de botão e entram na ordem do Tab. */
function a11y() {
  $$('[data-a]').forEach(el => {
    if (el.hasAttribute('role') || el.matches('button,a,input,select,textarea,label,summary,.ov')) return;
    el.setAttribute('role', 'button'); el.tabIndex = 0;
  });
  $$('.seg button,.chip,.meas').forEach(b => { const v = String(b.classList.contains('on')); if (b.getAttribute('aria-pressed') !== v) b.setAttribute('aria-pressed', v); });
}
let a11yT = 0;
new MutationObserver(() => { if (!a11yT) a11yT = requestAnimationFrame(() => { a11yT = 0; a11y(); }); })
  .observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && sheetOpen) { e.preventDefault(); closeSheet(); return; }
  const t = e.target;
  if ((e.key === 'Enter' || e.key === ' ') && t.matches && t.matches('[role="button"],[role="switch"]')) { e.preventDefault(); t.click(); return; }
  if (e.key === 'Tab' && sheetOpen) {   // mantém o foco dentro do diálogo aberto
    const f = $$('#sheet-root button:not([disabled]),#sheet-root input:not([hidden]),#sheet-root select,#sheet-root textarea,#sheet-root summary,#sheet-root [tabindex="0"]').filter(x => x.offsetParent !== null);
    if (!f.length) { e.preventDefault(); return; }
    const first = f[0], last = f[f.length - 1], inside = $('#sheet-root').contains(document.activeElement) && document.activeElement !== $('.sheet');
    if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
  }
});
/* Imagem que falhou ao carregar (offline, por exemplo): mostra as iniciais no lugar. O evento "error" não borbulha, por isso capture=true. */
document.addEventListener('error', e => {
  const t = e.target; if (!t || t.tagName !== 'IMG') return;
  if (t.hasAttribute('data-rm-on-error')) t.remove();
  else if (t.parentNode && t.parentNode.classList.contains('thumb')) t.parentNode.classList.add('noimg');
}, true);

/* =========================================================
   Conta: sincronização, login e senha
   ========================================================= */
const SYNC_TXT = { synced: 'Sincronizado', syncing: 'Sincronizando…', idle: 'Alterações aguardando envio', offline: 'Sem conexão · salvo neste aparelho', error: 'Não foi possível sincronizar', local: 'Somente neste aparelho' };
function syncLabel() { return SYNC_TXT[Cloud.status] || ''; }
function paintSync() {
  $$('[data-sync]').forEach(el => { el.className = 'sync ' + Cloud.status; el.lastElementChild.textContent = syncLabel(); });
  const dot = Cloud.status === 'error' ? 'error' : (Cloud.status === 'offline' && Cloud.pending ? 'offline' : '');
  $$('[data-syncdot]').forEach(el => { el.className = 'sync-dot ' + dot; });
}
/* O que vai para a nuvem: tudo, menos o treino em andamento (ele é do aparelho que está na academia). */
const cloudData = () => Object.assign({}, S, { active: null });
/* Dois aparelhos editaram ao mesmo tempo: une históricos pelo id (nenhum treino se perde); no resto, vale o que está neste aparelho. */
function mergeData(local, remote) {
  const union = (a, b, key) => { const m = new Map(); [...(b || []), ...(a || [])].forEach(x => m.set(x[key], x)); return [...m.values()]; };
  const out = Object.assign({}, remote, local);
  out.sessions = union(local.sessions, remote.sessions, 'id').sort((x, y) => x.start - y.start);
  out.body = union(local.body, remote.body, 'id');
  out.routines = union(local.routines, remote.routines, 'id');
  out.custom = union(local.custom, remote.custom, 'i');
  return out;
}
function applyRemote(data) {
  const active = S.active;
  S = normalize(data); S.active = active; S.custom.forEach(c => EX.set(c.i, c));
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* armazenamento cheio */ }
  const typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if (!GATE && !sheetOpen && !typing && route().name !== 'edit') render(true);
}

let curUid = null, pendingRecovery = false;
async function enterApp(u) {
  if (curUid === u.id) return;
  curUid = u.id; KEY = KEY0 + '.' + u.id;
  const fresh = localStorage.getItem(KEY) == null;   // primeira vez desta conta neste aparelho
  loadState();
  Cloud.attach({ getData: cloudData, merge: mergeData, applyRemote, onStatus: paintSync });
  if (fresh) {   // espera a nuvem responder antes de mostrar o app, para não exibir dados vazios por engano
    GATE = { mode: 'boot' }; render();
    await Promise.race([Cloud.syncNow(), new Promise(r => setTimeout(r, 8000))]);
    if (curUid !== u.id) return;
  } else Cloud.syncNow();
  if (!S.profile.name && u.name) S.profile.name = u.name;
  GATE = null; save();
  if (S.active) wake();
  render();
  if (pendingRecovery) { pendingRecovery = false; setTimeout(() => passSheet(true), 400); }
  else if (!S.onboarded) setTimeout(onboarding, 400);
}
function leaveApp(gate) {
  curUid = null; KEY = KEY0;
  if (wl) { wl.release().catch(() => { }); wl = null; }
  S = defaults(); draft = null; justFinished = null;
  if (sheetOpen) hideSheet();
  GATE = gate || { mode: 'signin' }; render();
}

function renderGate() {
  const view = $('#view'), g = GATE, m = g.mode;
  view.className = 'app gate'; $('#nav').style.display = 'none'; $('#live').innerHTML = ''; $('#rest').innerHTML = '';
  if (m === 'boot') { document.title = 'Jhon Fit'; view.innerHTML = `<div class="boot"><div class="spin" role="status" aria-label="Carregando"></div></div>`; return; }
  const brand = `<div class="auth-brand"><img src="icons/icon-192.png" alt="" width="76" height="76"><h1>Jhon Fit</h1><p>Seu treino, seu corpo, seus números.</p></div>`;
  const tabs = `<div class="seg" role="group" aria-label="Entrar ou criar conta"><button type="button" class="${m === 'signin' ? 'on' : ''}" data-a="authMode" data-m="signin">Entrar</button><button type="button" class="${m === 'signup' ? 'on' : ''}" data-a="authMode" data-m="signup">Criar conta</button></div>`;
  const emailF = `<label class="field"><span>E-mail</span><input class="input" id="au-email" type="email" inputmode="email" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" value="${esc(g.email || '')}" placeholder="voce@email.com" required></label>`;
  const passF = (ac, hint) => `<div class="field"><span><label for="au-pass">Senha</label></span><div class="pw"><input class="input" id="au-pass" type="password" autocomplete="${ac}" ${hint ? 'aria-describedby="au-hint" minlength="8"' : ''} required>
    <button type="button" class="pw-eye" data-a="pwEye" aria-label="Mostrar senha" aria-pressed="false">${ic('eye')}</button></div>${hint ? `<p class="hint" id="au-hint">${hint}</p>` : ''}</div>`;
  const err = `<p class="form-err ${g.ok ? 'form-ok' : ''}" id="au-err" role="alert"${g.error || g.ok ? '' : ' hidden'}>${esc(g.error || g.ok || '')}</p>`;
  let body;
  if (m === 'signup') body = `${tabs}<form data-form="auth" novalidate>
      <label class="field"><span>Nome</span><input class="input" id="au-name" autocomplete="given-name" placeholder="Como quer ser chamado(a)?" required></label>
      ${emailF}${passF('new-password', 'Pelo menos 8 caracteres.')}${err}
      <button class="btn primary" type="submit" id="au-go">Criar conta</button></form>
      <p class="auth-foot">Cada pessoa tem a própria conta: treinos, histórico e medidas ficam separados e protegidos por senha.</p>`;
  else if (m === 'forgot') body = `<h2>Recuperar senha</h2><p class="lead">Informe o e-mail da sua conta. Vamos enviar um link para você criar uma nova senha.</p>
      <form data-form="auth" novalidate>${emailF}${err}<button class="btn primary" type="submit" id="au-go">Enviar link</button>
      <button type="button" class="link-btn" data-a="authMode" data-m="signin">Voltar para o login</button></form>`;
  else if (m === 'sent') body = `<div class="empty" style="padding:0"><div class="ill">${ic('mail', 'lg')}</div></div><h2 style="text-align:center">Confira seu e-mail</h2>
      <p class="lead" style="text-align:center">${g.kind === 'reset' ? 'Se existir uma conta com' : 'Enviamos um link de confirmação para'} <b>${esc(g.email)}</b>${g.kind === 'reset' ? ', você receberá um link para criar uma nova senha.' : '. Toque nele para ativar a conta e depois volte aqui para entrar.'} Não chegou? Veja a caixa de spam.</p>
      <button class="btn" data-a="authMode" data-m="signin">Voltar para o login</button>`;
  else body = `${tabs}<form data-form="auth" novalidate>${emailF}${passF('current-password')}${err}
      <button class="btn primary" type="submit" id="au-go">Entrar</button>
      <button type="button" class="link-btn" data-a="authMode" data-m="forgot">Esqueci minha senha</button></form>
      <p class="auth-foot">Seus treinos ficam salvos na sua conta e o app funciona mesmo sem internet.</p>`;
  document.title = ({ signup: 'Criar conta', forgot: 'Recuperar senha', sent: 'Confira seu e-mail' }[m] || 'Entrar') + ' · Jhon Fit';
  view.innerHTML = `<div class="auth">${brand}${body}</div>`;
  window.scrollTo(0, 0);
}
function formError(id, msg, field) {
  const el = $('#' + id); if (!el) { toast(msg); return; }
  el.classList.remove('form-ok'); el.textContent = msg; el.hidden = !msg;
  $$('[aria-invalid]').forEach(x => x.removeAttribute('aria-invalid'));
  if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
}
function setBusy(btn, busy, label) {
  if (!btn) return;
  if (busy) { btn.dataset.label = btn.textContent; btn.classList.add('busy'); btn.setAttribute('aria-busy', 'true'); btn.innerHTML = `<span class="spin"></span> ${esc(label)}`; }
  else { btn.classList.remove('busy'); btn.removeAttribute('aria-busy'); btn.textContent = btn.dataset.label || btn.textContent; }
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
document.addEventListener('submit', async e => {
  const form = e.target, kind = form.dataset.form; if (!kind) return;
  e.preventDefault();
  const btn = $('button[type="submit"]', form); if (btn.classList.contains('busy')) return;
  if (kind === 'pass') {
    const inp = $('#np-pass'), pw = inp.value;
    if (pw.length < 8) { formError('np-err', 'A senha precisa ter pelo menos 8 caracteres.', inp); return; }
    setBusy(btn, true, 'Salvando…');
    try { await Cloud.updatePassword(pw); closeSheet(() => toast('Senha alterada')); }
    catch (err) { setBusy(btn, false); formError('np-err', err.message, inp); }
    return;
  }
  const m = GATE.mode, emailEl = $('#au-email'), passEl = $('#au-pass'), nameEl = $('#au-name');
  const email = emailEl.value.trim().toLowerCase(), pw = passEl ? passEl.value : '', name = nameEl ? nameEl.value.trim() : '';
  if (m === 'signup' && !name) { formError('au-err', 'Informe seu nome.', nameEl); return; }
  if (!EMAIL_RE.test(email)) { formError('au-err', 'Informe um e-mail válido.', emailEl); return; }
  if (m !== 'forgot' && !pw) { formError('au-err', 'Informe sua senha.', passEl); return; }
  if (m === 'signup' && pw.length < 8) { formError('au-err', 'A senha precisa ter pelo menos 8 caracteres.', passEl); return; }
  formError('au-err', ''); GATE.email = email;
  setBusy(btn, true, m === 'signup' ? 'Criando conta…' : m === 'forgot' ? 'Enviando…' : 'Entrando…');
  try {
    if (m === 'forgot') { await Cloud.resetPassword(email); GATE = { mode: 'sent', kind: 'reset', email }; render(); }
    else if (m === 'signup') {
      const r = await Cloud.signUp(email, pw, name);
      if (r.needsConfirm) { GATE = { mode: 'sent', kind: 'confirm', email }; render(); } else await enterApp(r.user);
    } else await enterApp(await Cloud.signIn(email, pw));
  } catch (err) { setBusy(btn, false); formError('au-err', err.message || 'Algo deu errado. Tente de novo.', m === 'forgot' ? emailEl : passEl); }
});
function passSheet(recovery) {
  openSheet(`<h3>${recovery ? 'Crie uma nova senha' : 'Alterar senha'}</h3><p class="sub">${recovery ? 'Você entrou pelo link de recuperação. Escolha a nova senha da sua conta.' : 'A nova senha vale para todos os seus aparelhos.'}</p><div class="sp"></div>
    <form class="stack" data-form="pass" novalidate><div class="field"><span><label for="np-pass">Nova senha</label></span><div class="pw"><input class="input" id="np-pass" type="password" autocomplete="new-password" minlength="8" aria-describedby="np-hint" required>
      <button type="button" class="pw-eye" data-a="pwEye" aria-label="Mostrar senha" aria-pressed="false">${ic('eye')}</button></div><p class="hint" id="np-hint">Pelo menos 8 caracteres.</p></div>
    <p class="form-err" id="np-err" role="alert" hidden></p><button class="btn primary" type="submit">Salvar senha</button></form>`);
}
if (Cloud.enabled) Cloud.onAuth((ev, u) => {
  if (ev === 'PASSWORD_RECOVERY') { if (curUid && !GATE) passSheet(true); else pendingRecovery = true; }
  else if (ev === 'SIGNED_IN' && u && GATE && GATE.mode !== 'boot') enterApp(u);       // ex.: voltou pelo link de confirmação do e-mail
  else if (ev === 'SIGNED_OUT' && curUid) leaveApp({ mode: 'signin', error: 'Sua sessão terminou. Entre de novo para continuar.' });
});

/* =========================================================
   Boot
   ========================================================= */
async function boot() {
  if (!Cloud.enabled) {   // modo local: sem backend configurado (config.js vazio), tudo fica só no aparelho
    if (location.hash === '#/seed-demo') { seedDemo(); history.replaceState(null, '', '#/home'); }
    if (S.active) wake();
    render();
    if (!S.onboarded && route().name === 'home') setTimeout(onboarding, 400);
    return;
  }
  // Links de e-mail vencidos voltam com o erro na URL
  const linkErr = /error_code=|error_description=/.test(location.hash + location.search);
  GATE = { mode: 'boot' }; render();
  let u = null;
  try { u = await Cloud.init(); } catch (e) { console.error(e); }
  if (linkErr) history.replaceState(null, '', location.pathname + '#/home');
  if (u) enterApp(u);
  else { GATE = { mode: 'signin', error: linkErr ? 'Este link expirou ou já foi usado. Peça um novo.' : '' }; render(); }
}
boot();
})();
