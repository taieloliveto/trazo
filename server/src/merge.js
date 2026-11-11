/* Lógica de datos compartida entre la app y el servidor.
   FUENTE ÚNICA: shared/merge.js. Después de editarla corré `npm run sync-shared`
   (copia a web/merge.js y a server/src/merge.js). No edites esas copias a mano.

   Forma de los datos (todo se identifica por id y se combina entidad por entidad; gana el cambio más reciente `u`):
   {
     name, nameU,                                   cómo te llamamos
     projects: { id: { id, n, e, g, vs, vn, gb, sh, o, c, u, del } }
                  n nombre · e emoji · g granularidad (m mes | q quincena | w semana | d día)
                  vs primer mes visible 'AAAA-MM' · vn cantidad de meses visibles · gb agrupar por (i iniciativa | t equipo)
                  sh clave del link público de solo lectura ('' = no compartido)
                  cols columnas visibles del listado de iniciativas, en orden ([] = las de siempre)
     states:   { id: { id, pr, n, col, dn, o, c, u, del } } estados de un proyecto (editables) · dn cuenta como terminado
     teams:    { id: { id, pr, n, col, cap, o, c, u, del } } equipos o personas de un proyecto · cap iniciativas en paralelo (0 = 2 por defecto)
     inits:    { id: { id, pr, n, dl, st, p, ln, no, o, c, u, del } }
                  iniciativa · dl deadline 'AAAA-MM-DD' · st estado · p prioridad (urg|high|mid|low|'') · ln enlace · no notas
     blocks:   { id: { id, pr, in, tm, tms, s, e, lb, c, u, del } }
                  plazo en la planificación: iniciativa `in`, equipos/personas `tms` (el primero también en `tm`),
                  del día `s` al día `e` (inclusive), etiqueta `lb`
     sprints:  { id: { id, pr, n, s, e, off, goal, ins, dn, cl, c, u, del } }
                  sprint: del día `s` al día `e` · off días no disponibles (feriados) · goal objetivo
                  ins iniciativas incluidas · cl cerrado · dn iniciativas terminadas al cerrarlo
     shares:   { idProyecto: { id, pr, sh, se, eds: [{ m, k }], eU, rq: [{ m, n, t }], rqU, c, u, del } }
                  cómo se comparte un proyecto, aparte del proyecto para que ningún cambio lo pise:
                  sh link de visualización · se link de edición · eds personas (email) con permiso de edición y su clave
                  rq pedidos de permiso de edición (lo escribe el servidor) · eU y rqU marcan qué parte cambió
     alerts:   { id: { id, pr, s, e, t, lv, c, u, del } }
                  aviso "a tener en cuenta" del roadmap (vacaciones, feriados, congelamientos)
                  t texto · lv nivel (red | yellow | gray)
     dailies:  { id: { id, pr, d, notes, nU, items: { idIniciativa: { c, st, u } }, c, u, del } }
                  daily del día `d` · notes avisos generales · items comentario y estado de cada iniciativa
                  (se combina por partes: avisos e iniciativas por separado, así varias personas pueden escribir a la vez)
     last, lastU                                    último proyecto abierto
     tabs, tabsU                                    orden de las pestañas del proyecto
     season, seasonU                                ambientación elegida ('' = la del mes, 'off' = ninguna, o una temporada)
   } */

const DAY = 86400000, TOMB_TTL = 30 * DAY;
const LIM = { projects: 200, states: 2000, teams: 2000, inits: 5000, blocks: 12000, sprints: 3000, dailies: 5000, alerts: 3000, shares: 200 };
const idOk = s => typeof s === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(s);
const str = (s, n) => typeof s === 'string' ? s.slice(0, n) : '';
const num = x => Number.isFinite(+x) ? +x : 0;
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const ymdOk = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const ordN = x => Math.min(1e7, Math.max(0, Math.round(num(x))));
const COLORS = ['gray', 'orange', 'teal', 'purple', 'pink', 'blue', 'yellow', 'green', 'red', 'forest', 'navy', 'brown'];
const PRIOS = ['urg', 'high', 'mid', 'low', ''];
const GRANS = ['m', 'q', 'w', 'd'];
const shOk = s => typeof s === 'string' && /^[A-Za-z0-9]{20,40}$/.test(s);
const COLKEYS = ['dl', 'st', 'p', 'tm', 'sp', 'plan', 'ln', 'no'];
const SEASONS = ['verano', 'sanvalentin', 'otono', 'pascuas', 'patrio', 'pride', 'invierno', 'vacaciones', 'infancias', 'primavera', 'halloween', 'tradicion', 'navidad'];
const TABKEYS = ['inits', 'plan', 'sprints', 'cur', 'daily', 'teams', 'dash'];
const ymOk = s => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const linkOk = s => typeof s === 'string' && /^https?:\/\/\S+$/i.test(s.trim()) ? s.trim().slice(0, 500) : '';

/* Emoji de un proyecto: un solo carácter emoji o vacío. */
const EMO = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[#*0-9]️?⃣/u;
const isEmoji = g => typeof g === 'string' && g.length > 0 && g.length <= 16 && EMO.test(g);
function firstEmoji(s) {
  s = typeof s === 'string' ? s.trim() : '';
  if (!s) return '';
  let g;
  try { const it = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)[Symbol.iterator]().next(); g = it.done ? '' : it.value.segment; }
  catch (_) { g = Array.from(s)[0] || ''; }
  return isEmoji(g) ? g : '';
}

function emptyState() { return { name: '', nameU: 0, projects: {}, states: {}, teams: {}, inits: {}, blocks: {}, sprints: {}, dailies: {}, alerts: {}, shares: {}, last: '', lastU: 0, tabs: [], tabsU: 0, season: '', seasonU: 0 }; }

const isObj = x => x && typeof x === 'object';
const col = c => COLORS.includes(c) ? c : 'gray';
function fixProject(r, id) {
  if (!isObj(r)) return null;
  return { id, n: str(r.n, 80).trim() || 'Proyecto', e: firstEmoji(r.e), g: GRANS.includes(r.g) ? r.g : 'w',
    vs: ymOk(r.vs) ? r.vs : '', vn: Math.min(24, Math.max(1, Math.round(num(r.vn)) || 6)), gb: r.gb === 't' ? 't' : 'i', sh: shOk(r.sh) ? r.sh : '', cols: Array.isArray(r.cols) ? [...new Set(r.cols.filter(k => COLKEYS.includes(k)))] : [], o: ordN(r.o), c: num(r.c), u: num(r.u), del: !!r.del };
}
function fixTag(r, id) {        // estados y equipos tienen la misma forma
  if (!isObj(r) || !idOk(r.pr)) return null;
  const del = !!r.del, n = str(r.n, 40).trim();
  if (!n && !del) return null;
  return { id, pr: r.pr, n, col: col(r.col), dn: !!r.dn, cap: Math.min(99, Math.max(0, Math.round(num(r.cap)))), o: ordN(r.o), c: num(r.c), u: num(r.u), del };
}
function fixInit(r, id) {
  if (!isObj(r) || !idOk(r.pr)) return null;
  const del = !!r.del, n = str(r.n, 160).trim();
  if (!n && !del) return null;
  return {
    id, pr: r.pr, n, dl: ymdOk(r.dl) ? r.dl : '', st: idOk(r.st) ? r.st : '', p: PRIOS.includes(r.p) ? r.p : '',
    ln: del ? '' : linkOk(r.ln), no: del ? '' : str(r.no, 2000), o: ordN(r.o), c: num(r.c), u: num(r.u), del
  };
}
function fixBlock(r, id) {
  if (!isObj(r) || !idOk(r.pr) || !idOk(r.in)) return null;
  const del = !!r.del;
  let s = ymdOk(r.s) ? r.s : '', e = ymdOk(r.e) ? r.e : '';
  if (!s || !e) { if (!del) return null; s = s || '2000-01-01'; e = e || s; }
  if (e < s) [s, e] = [e, s];
  let tms = Array.isArray(r.tms) ? [...new Set(r.tms.filter(idOk))].slice(0, 20) : [];
  if (!tms.length && idOk(r.tm)) tms = [r.tm];
  return { id, pr: r.pr, in: r.in, tm: tms[0] || '', tms, s, e, lb: str(r.lb, 30).trim(), c: num(r.c), u: num(r.u), del };
}

const idList = (a, max) => Array.isArray(a) ? [...new Set(a.filter(idOk))].slice(0, max) : [];
function fixSprint(r, id) {
  if (!isObj(r) || !idOk(r.pr)) return null;
  const del = !!r.del;
  let s = ymdOk(r.s) ? r.s : '', e = ymdOk(r.e) ? r.e : '';
  if (!s || !e) { if (!del) return null; s = s || '2000-01-01'; e = e || s; }
  if (e < s) [s, e] = [e, s];
  return { id, pr: r.pr, n: str(r.n, 60).trim() || 'Sprint', s, e, off: Math.min(60, Math.max(0, Math.round(num(r.off)))),
    goal: del ? '' : str(r.goal, 1000), ins: del ? [] : idList(r.ins, 300), dn: del ? [] : idList(r.dn, 300), cl: !!r.cl, c: num(r.c), u: num(r.u), del };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailOk = m => typeof m === 'string' && m.length <= 254 && EMAIL.test(m);
function fixShare(r, id) {
  if (!isObj(r) || !idOk(r.pr)) return null;
  const eds = [], seen = new Set();
  for (const x of Array.isArray(r.eds) ? r.eds.slice(0, 50) : []) {
    if (!isObj(x)) continue; const m = String(x.m || '').trim().toLowerCase();
    if (!emailOk(m) || !shOk(x.k) || seen.has(m)) continue; seen.add(m); eds.push({ m, k: x.k });
  }
  const rq = [], rs = new Set();
  for (const x of Array.isArray(r.rq) ? r.rq.slice(0, 30) : []) {
    if (!isObj(x)) continue; const m = String(x.m || '').trim().toLowerCase();
    if (!emailOk(m) || rs.has(m)) continue; rs.add(m); rq.push({ m, n: str(x.n, 60).trim(), t: num(x.t) });
  }
  return { id, pr: r.pr, sh: shOk(r.sh) ? r.sh : '', se: shOk(r.se) ? r.se : '', eds, eU: num(r.eU), rq, rqU: num(r.rqU), c: num(r.c), u: num(r.u), del: !!r.del };
}
function mergeShare(x, y) {
  if (!x) return y; if (!y) return x;
  const out = { ...(x.u >= y.u ? x : y) }, e = x.eU >= y.eU ? x : y, q = x.rqU >= y.rqU ? x : y;
  Object.assign(out, { sh: e.sh, se: e.se, eds: e.eds, eU: e.eU, rq: q.rq, rqU: q.rqU });
  return out;
}
function fixAlert(r, id) {
  if (!isObj(r) || !idOk(r.pr)) return null;
  const del = !!r.del;
  let s = ymdOk(r.s) ? r.s : '', e = ymdOk(r.e) ? r.e : '';
  if (!s || !e) { if (!del) return null; s = s || '2000-01-01'; e = e || s; }
  if (e < s) [s, e] = [e, s];
  const t = str(r.t, 120).trim();
  if (!t && !del) return null;
  return { id, pr: r.pr, s, e, t, lv: ['red', 'yellow', 'gray'].includes(r.lv) ? r.lv : 'gray', c: num(r.c), u: num(r.u), del };
}
function fixDaily(r, id) {
  if (!isObj(r) || !idOk(r.pr)) return null;
  const del = !!r.del, d = ymdOk(r.d) ? r.d : (del ? '2000-01-01' : '');
  if (!d) return null;
  const items = {};
  if (!del && isObj(r.items)) for (const k of Object.keys(r.items).slice(0, 300)) {
    const x = r.items[k]; if (!idOk(k) || !isObj(x)) continue;
    items[k] = { c: str(x.c, 1000), st: idOk(x.st) ? x.st : '', u: num(x.u) };
  }
  return { id, pr: r.pr, d, notes: del ? '' : str(r.notes, 4000), nU: num(r.nU), items, c: num(r.c), u: num(r.u), del };
}
/* Dos versiones de la misma daily: avisos y cada iniciativa se combinan por separado */
function mergeDaily(x, y) {
  if (!x) return y; if (!y) return x;
  const out = { ...(x.u >= y.u ? x : y) }, nb = x.nU >= y.nU ? x : y;
  out.notes = nb.notes; out.nU = nb.nU; out.items = {};
  if (!out.del) for (const k of new Set([...Object.keys(x.items), ...Object.keys(y.items)])) {
    const a = x.items[k], b = y.items[k];
    out.items[k] = !a ? b : !b ? a : (a.u >= b.u ? a : b);
  }
  return out;
}

/* Aplica `fix` a cada entrada, descarta tumbas viejas y acota la cantidad (se queda con lo más reciente). */
function pruneMap(src, max, now, fix) {
  const out = {};
  if (!isObj(src)) return out;
  let arr = [];
  for (const id of Object.keys(src).slice(0, max * 2)) {
    if (!idOk(id)) continue;
    const e = fix(src[id], id);
    if (!e) continue;
    if (e.del && e.u < now - TOMB_TTL) continue;
    arr.push(e);
  }
  if (arr.length > max) { arr.sort((a, b) => (a.del - b.del) || b.u - a.u); arr = arr.slice(0, max); }
  for (const e of arr) out[e.id] = e;
  return out;
}

/* Limpia y acota cualquier dato que venga de afuera (disco, red, otro dispositivo). */
function sanitizeState(d, now) {
  now = now || Date.now();
  const out = emptyState();
  if (!isObj(d)) return out;
  out.name = str(typeof d.name === 'string' ? d.name.trim() : '', 30);
  out.nameU = num(d.nameU);
  out.projects = pruneMap(d.projects, LIM.projects, now, fixProject);
  out.states = pruneMap(d.states, LIM.states, now, fixTag);
  out.teams = pruneMap(d.teams, LIM.teams, now, fixTag);
  out.inits = pruneMap(d.inits, LIM.inits, now, fixInit);
  out.blocks = pruneMap(d.blocks, LIM.blocks, now, fixBlock);
  out.sprints = pruneMap(d.sprints, LIM.sprints, now, fixSprint);
  out.dailies = pruneMap(d.dailies, LIM.dailies, now, fixDaily);
  out.alerts = pruneMap(d.alerts, LIM.alerts, now, fixAlert);
  out.shares = pruneMap(d.shares, LIM.shares, now, fixShare);
  out.last = idOk(d.last) ? d.last : '';
  out.lastU = num(d.lastU);
  out.tabs = Array.isArray(d.tabs) ? [...new Set(d.tabs.filter(k => TABKEYS.includes(k)))] : [];
  out.tabsU = num(d.tabsU);
  out.season = d.season === 'off' || SEASONS.includes(d.season) ? d.season : '';
  out.seasonU = num(d.seasonU);
  return out;
}

/* ---- Combinación de dos estados: gana el cambio más reciente por entidad ---- */
function mergeMap(a, b, fn) {
  const out = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[id], y = b[id];
    out[id] = !x ? y : !y ? x : fn ? fn(x, y) : (x.u >= y.u ? x : y);
  }
  return out;
}
function mergeState(a, b, now) {
  a = sanitizeState(a, now);
  b = sanitizeState(b, now);
  const out = emptyState();
  for (const k of ['projects', 'states', 'teams', 'inits', 'blocks', 'sprints', 'alerts']) out[k] = mergeMap(a[k], b[k]);
  out.dailies = mergeMap(a.dailies, b.dailies, mergeDaily);
  out.shares = mergeMap(a.shares, b.shares, mergeShare);
  const wl = a.lastU >= b.lastU ? a : b;
  out.last = wl.last; out.lastU = wl.lastU;
  const ws = a.seasonU >= b.seasonU ? a : b;
  out.season = ws.season; out.seasonU = ws.seasonU;
  const wt = a.tabsU >= b.tabsU ? a : b;
  out.tabs = wt.tabs; out.tabsU = wt.tabsU;
  const wn = a.nameU >= b.nameU ? a : b;
  out.name = wn.name; out.nameU = wn.nameU;
  return sanitizeState(out, now);
}

export { mergeState, sanitizeState, emptyState, norm, firstEmoji, isEmoji, COLORS, PRIOS, GRANS, shOk, emailOk };
