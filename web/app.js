'use strict';
/* Trazo — planificación de proyectos (PWA). Usa merge.js (globales: mergeState, sanitizeState, emptyState, firstEmoji, isEmoji, COLORS). */
(() => {
const VERSION = '1.0.0';
const CFG = window.TRAZO_CONFIG || {};
const KEY = 'trazo.v1', LKEY = 'trazo.local';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const now = () => Date.now();
let seq = 0;
const uid = () => Math.random().toString(36).slice(2, 8) + now().toString(36);
const stamp = () => now() + (++seq % 1000) / 1000;

/* ---------- Fechas: 'AAAA-MM-DD' y número de día (sin husos horarios) ---------- */
const DAY = 86400000;
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const dn = s => { const [y, m, d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / DAY); };
const fromDn = n => { const d = new Date(n * DAY); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const addD = (s, n) => fromDn(dn(s) + n);
const ymOf = s => s.slice(0, 7);
const addM = (ym, n) => { const [y, m] = ym.split('-').map(Number); const t = y * 12 + (m - 1) + n; return `${Math.floor(t / 12)}-${pad(t % 12 + 1)}`; };
const daysIn = ym => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
const wday = n => (n + 4) % 7;     // 0 = domingo
const MON = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DOW1 = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const dm = s => { const [y, m, d] = s.split('-').map(Number); return `${d} ${MON[m - 1].slice(0, 3)}${String(y) !== today().slice(0, 4) ? ' ' + String(y).slice(2) : ''}`; };
const ymLabel = ym => { const [y, m] = ym.split('-').map(Number); return `${MON[m - 1].slice(0, 3)} ${y}`; };
const mondayOf = s => addD(s, -((wday(dn(s)) + 6) % 7));

/* ---------- Estado ---------- */
let S = { email: '', token: '', server: '', data: emptyState(), dirty: false };
try {
  const r = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (r && typeof r === 'object') { S.email = String(r.email || ''); S.token = String(r.token || ''); S.server = String(r.server || ''); S.dirty = !!r.dirty; S.data = sanitizeState(r.data); }
} catch (_) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} };
/* Preferencias de este dispositivo (no se sincronizan) */
let L = { onb: 0, theme: 'auto', tab: {}, sort: {}, flt: {}, lastTeam: {} };
try { const r = JSON.parse(localStorage.getItem(LKEY) || 'null'); if (r && typeof r === 'object') L = { ...L, ...r }; } catch (_) {}
for (const k of ['tab', 'sort', 'flt', 'lastTeam']) if (!L[k] || typeof L[k] !== 'object') L[k] = {};
const saveL = () => { try { localStorage.setItem(LKEY, JSON.stringify(L)); } catch (_) {} };
const THEMES = ['auto', 'light', 'dark'];
function applyTheme() {
  const t = THEMES.includes(L.theme) ? L.theme : 'auto';
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  for (const m of $$('meta[name=theme-color]')) m.remove();
  const mt = document.createElement('meta'); mt.name = 'theme-color'; mt.content = dark ? '#111614' : '#F5F6F4';
  document.head.append(mt);
}
applyTheme();
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if ((L.theme || 'auto') === 'auto') applyTheme(); }); } catch (_) {}

let full = false;               // roadmap en pantalla completa
let view = 'auth', sheet = null, busy = false, st = 'ok', rev = 0, curP = '', onb = -1, dragging = false, installEvt = null;
let authMode = 'login', authErr = '', authEmail = S.email, authPass = '', authName = '';
const D = () => S.data;

/* ---------- Consultas ---------- */
const live = o => Object.values(o).filter(x => !x.del);
const ordK = e => e.o || e.c;
const byOrd = (a, b) => ordK(a) - ordK(b);
const projects = () => live(D().projects).sort(byOrd);
const proj = id => { const p = D().projects[id]; return p && !p.del ? p : null; };
const P = () => proj(curP);
const statesOf = pr => live(D().states).filter(x => x.pr === pr).sort(byOrd);
const teamsOf = pr => live(D().teams).filter(x => x.pr === pr).sort(byOrd);
const initsOf = pr => live(D().inits).filter(x => x.pr === pr);
const blocksOf = pr => live(D().blocks).filter(b => b.pr === pr && D().inits[b.in] && !D().inits[b.in].del);
const stateOf = id => { const s = D().states[id]; return s && !s.del ? s : null; };
const teamOf = id => { const t = D().teams[id]; return t && !t.del ? t : null; };
const isDone = i => !!stateOf(i.st)?.dn;
const PRIO = { urg: { n: 'Urgente', c: 'red', r: 0 }, high: { n: 'Alta', c: 'orange', r: 1 }, mid: { n: 'Media', c: 'yellow', r: 2 }, low: { n: 'Baja', c: 'gray', r: 3 }, '': { n: 'Sin prioridad', c: 'none', r: 4 } };
const PRIO_KEYS = ['urg', 'high', 'mid', 'low', ''];
const SORTS = { manual: 'Orden manual', prio: 'Prioridad', dl: 'Deadline', st: 'Estado' };
function sortedInits(p) {
  const k = L.sort[p.id] || 'manual', so = Object.fromEntries(statesOf(p.id).map((s, i) => [s.id, i]));
  const by = {
    manual: byOrd,
    prio: (a, b) => PRIO[a.p].r - PRIO[b.p].r || (a.dl || '9').localeCompare(b.dl || '9') || byOrd(a, b),
    dl: (a, b) => (a.dl || '9').localeCompare(b.dl || '9') || PRIO[a.p].r - PRIO[b.p].r || byOrd(a, b),
    st: (a, b) => (so[a.st] ?? 99) - (so[b.st] ?? 99) || PRIO[a.p].r - PRIO[b.p].r || byOrd(a, b)
  };
  return initsOf(p.id).sort(by[k] || byOrd);
}
const nm = o => `${o.e ? `<span class="em" aria-hidden="true">${esc(o.e)}</span>` : ''}${esc(o.n)}`;

/* ---------- Servidor ---------- */
class ApiErr extends Error { constructor(m, status, net) { super(m); this.status = status; this.net = !!net; } }
const apiBase = () => String(CFG.API_URL || S.server || '').trim().replace(/\/+$/, '');
async function api(path, opts = {}) {
  const base = apiBase();
  if (!base) throw new ApiErr('Falta la URL del servidor', 0);
  const h = { 'Content-Type': 'application/json' };
  if (S.token) h.Authorization = 'Bearer ' + S.token;
  let r;
  try { r = await fetch(base + path, { ...opts, headers: h }); } catch (_) { throw new ApiErr('Sin conexión con el servidor', 0, true); }
  let b = null; try { b = await r.json(); } catch (_) {}
  if (!r.ok) throw new ApiErr((b && b.error) || 'Error del servidor', r.status);
  return b;
}

/* ---------- Sincronización ---------- */
let syncing = false, again = false, syncT = null;
function setSt(v) { st = v; paintSync(); }
function queueSync(ms = 900) { if (!S.token) return; setSt('pend'); clearTimeout(syncT); syncT = setTimeout(() => sync(), ms); }
async function sync() {
  if (!S.token || !apiBase()) return false;
  if (syncing) { again = true; return false; }
  syncing = true;
  const r0 = rev, wasDirty = S.dirty;
  try {
    const res = wasDirty ? await api('/data', { method: 'PUT', body: JSON.stringify({ data: S.data }) }) : await api('/data');
    S.data = mergeState(S.data, res.data);
    if (rev === r0) S.dirty = false; else again = true;
    save(); setSt(S.dirty ? 'pend' : 'ok'); afterRemote();
    return true;
  } catch (e) {
    if (e.status === 401) { expireSession(); return false; }
    setSt(e.net ? 'off' : 'err'); return false;
  } finally { syncing = false; if (again) { again = false; queueSync(300); } }
}
function expireSession() { S.token = ''; save(); authErr = 'Tu sesión venció. Ingresá de nuevo.'; authEmail = S.email; authPass = ''; go('auth'); }
let remoteSig = '';
function afterRemote() {
  const sig = JSON.stringify(S.data);
  if (sig === remoteSig) return;
  remoteSig = sig;
  if (view === 'auth' || sheet || dragging || document.activeElement?.matches('input,select,textarea')) { paintHeader(); return; }
  if (view === 'project' && !P()) { go('projects'); return; }
  render();
}
function touch() { S.dirty = true; rev++; remoteSig = JSON.stringify(S.data); save(); queueSync(); }

/* ---------- Mutaciones ---------- */
function put(kind, o) { const id = o.id || uid(), e = { c: stamp(), u: now(), del: false, o: 0, ...o, id }; D()[kind][id] = e; return e; }
function upd(kind, id, patch) { const e = D()[kind][id]; if (!e) return null; Object.assign(e, patch, { u: now() }); return e; }
const DEF_STATES = [['Por hacer', 'gray'], ['En curso', 'navy'], ['Finalizado', 'forest', true], ['Bloqueado', 'red']];
function newProject(n, e) {
  const p = put('projects', { n: n.trim().slice(0, 80) || 'Proyecto', e: firstEmoji(e), g: 'w', vs: ymOf(today()), vn: 4, gb: 'i' });
  DEF_STATES.forEach(([sn, col, done], i) => put('states', { pr: p.id, n: sn, col, dn: !!done, o: i + 1 }));
  return p;
}
const nextCol = (kind, pr) => { const used = new Set(live(D()[kind]).filter(x => x.pr === pr).map(x => x.col)); return COLORS.find(c => !used.has(c) && c !== 'gray') || COLORS[(live(D()[kind]).length) % COLORS.length]; };
function addTag(kind, pr, n) {
  n = String(n || '').trim().slice(0, 40); if (!n) return null;
  const list = kind === 'states' ? statesOf(pr) : teamsOf(pr);
  const dup = list.find(x => x.n.toLowerCase() === n.toLowerCase()); if (dup) return dup;
  const o = list.length ? Math.max(...list.map(ordK)) + 1 : 1;
  return put(kind, { pr, n, col: nextCol(kind, pr), o: Math.min(o, 1e7) });
}
function newInit(pr, o) {
  const st = o.st || statesOf(pr)[0]?.id || '';
  return put('inits', { pr, n: '', dl: '', p: '', ln: '', no: '', ...o, st });
}
function delInit(id) {
  const ids = [id, ...live(D().blocks).filter(b => b.in === id).map(b => b.id)];
  const u = now();
  D().inits[id].del = true; D().inits[id].u = u;
  ids.slice(1).forEach(b => { D().blocks[b].del = true; D().blocks[b].u = u; });
  touch();
  return () => { const u2 = now(); D().inits[id].del = false; D().inits[id].u = u2; ids.slice(1).forEach(b => { D().blocks[b].del = false; D().blocks[b].u = u2; }); touch(); render(); };
}
/* Reordena una lista guardando o = 1, 2, 3… */
function moveTag(kind, id, dir) {
  const e = D()[kind][id]; if (!e) return;
  const list = kind === 'states' ? statesOf(e.pr) : teamsOf(e.pr), i = list.findIndex(x => x.id === id), j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  const u = now(); list.forEach((x, k) => { if (x.o !== k + 1) { x.o = k + 1; x.u = u; } });
  touch();
}

/* Proyecto de ejemplo para explorar la herramienta */
function sampleProject() {
  const p = newProject('Roadmap trimestral (ejemplo)', '🧭');
  const mon = mondayOf(today());
  p.vs = ymOf(addD(mon, -14)); p.vn = 4; p.g = 'w';
  const sts = Object.fromEntries(statesOf(p.id).map(s => [s.n, s.id]));
  const ref = addTag('states', p.id, 'En refinamiento'); ref.col = 'orange'; sts['En refinamiento'] = ref.id;
  ['Por hacer', 'En refinamiento', 'En curso', 'Finalizado', 'Bloqueado'].forEach((n, i) => { D().states[sts[n]].o = i + 1; });
  const tm = {};
  [['CUX / Data', 'purple'], ['Desarrollo', 'blue'], ['Implementación', 'yellow'], ['QA', 'green']].forEach(([n, col], i) => { tm[n] = put('teams', { pr: p.id, n, col, o: i + 1 }).id; });
  const I = [
    ['Rediseño del flujo de agenda', 18, 'En curso', 'urg', [['CUX / Data', -14, 14], ['Desarrollo', 0, 10], ['QA', 10, 7]]],
    ['Campaña post-instalación', 25, 'En curso', 'high', [['CUX / Data', -7, 10], ['Implementación', 4, 10], ['QA', 14, 6]]],
    ['QR y derivación a autogestión', 32, 'En refinamiento', 'high', [['CUX / Data', 7, 12], ['Desarrollo', 19, 10]]],
    ['Comunicación preventiva de servicio', 4, 'Bloqueado', 'mid', [['Implementación', -5, 9, 'Esperando aprobación']]],
    ['Automatización de órdenes de trabajo', 0, 'Finalizado', 'mid', [['Desarrollo', -14, 10], ['QA', -4, 4]]],
    ['Onboarding de autoinstalación', 0, 'Por hacer', 'low', [['CUX / Data', 28, 14]]]
  ];
  I.forEach(([n, dl, s, pr, bl], k) => {
    const i = newInit(p.id, { n, dl: dl ? addD(mon, dl) : '', st: sts[s], p: pr, o: k + 1 });
    bl.forEach(([t, a, len, lb]) => put('blocks', { pr: p.id, in: i.id, tm: tm[t], s: addD(mon, a), e: addD(mon, a + len - 1), lb: lb || '' }));
  });
  touch();
  return p;
}

/* ---------- Íconos y piezas ---------- */
const SYL = { ok: 'Sincronizado', pend: 'Guardando…', off: 'Sin conexión', err: 'Error al sincronizar' };
const syncBadge = () => `<span class="sy ${st}" role="status">${SYL[st]}</span>`;
function paintSync() { $$('.sy').forEach(e => { e.className = 'sy ' + st; e.textContent = SYL[st]; }); }
const LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M4 7h9M8 12h12M6 17h7"/></svg>';
const I_GEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>';
const I_DOTS = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
const I_LINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>';
const I_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/></svg>';
const I_EXPAND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const I_SHRINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
const grip = (i) => `<button type="button" class="grip" data-g="${esc(i.id)}" aria-label="Mover «${esc(i.n)}». Arrastrá, o usá las flechas arriba y abajo" title="Arrastrá para ordenar"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></button>`;
const I_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
const EMOS = ['🧭', '🚀', '📦', '🛠️', '📣', '💡', '📊', '🎯', '🧩', '🗂️', '🏗️', '📱', '💬', '🔧', '🌱', '⭐'];
const COLN = { gray: 'Gris', orange: 'Naranja', teal: 'Turquesa', purple: 'Violeta', pink: 'Rosa', blue: 'Celeste', yellow: 'Amarillo', green: 'Verde', red: 'Rojo', forest: 'Verde oscuro', navy: 'Azul', brown: 'Marrón' };
const chip = (n, col, cls = '') => `<span class="tg c-${col} ${cls}">${esc(n)}</span>`;
const stateOpts = (pr, sel, edit) => statesOf(pr).map(s => `<option value="${esc(s.id)}"${s.id === sel ? ' selected' : ''}>${esc(s.n)}</option>`).join('') + (edit ? '<option value="__edit">✎ Editar estados…</option>' : '');
const prioOpts = sel => PRIO_KEYS.map(k => `<option value="${k}"${k === sel ? ' selected' : ''}>${PRIO[k].n}</option>`).join('');

/* ---------- Encabezado ---------- */
function paintHeader() {
  const h = $('#hd'); if (!h) return;
  if (view === 'auth') { h.hidden = true; return; }
  h.hidden = false;
  const p = P();
  h.innerHTML = `<div class="hd-in"><button class="brand" data-a="go" data-v="projects" aria-label="Ir a mis proyectos"><span class="logo sm">${LOGO}</span><b>Trazo</b></button>
${view === 'project' && p ? `<span class="crumb" aria-hidden="true">/</span><button class="psw" data-a="pswitch" aria-label="Cambiar de proyecto"><span class="pn">${nm(p)}</span>${I_DOWN}</button>` : ''}
<span class="grow"></span>${syncBadge()}<button class="icon" data-a="go" data-v="set" aria-label="Ajustes"${view === 'set' ? ' aria-current="page"' : ''}>${I_GEAR}</button></div>`;
}

/* ---------- Ingreso ---------- */
function vAuth() {
  const login = authMode === 'login';
  return `<div class="auth"><div class="ahero"><div class="logo">${LOGO}</div><h1>Trazo</h1>
<p class="mut">Planificá tus proyectos: iniciativas con estado, prioridad y deadline, y un roadmap por equipo que armás arrastrando.</p>
<div class="amock" aria-hidden="true"><i class="c-purple" style="left:4%;width:34%"></i><i class="c-blue" style="left:30%;width:28%;top:34px"></i><i class="c-green" style="left:56%;width:22%;top:68px"></i><i class="c-yellow" style="left:70%;width:26%"></i></div></div>
<div class="acard"><div class="seg" role="group" aria-label="Modo"><button type="button" data-a="am" data-m="login" aria-pressed="${login}">Ingresar</button><button type="button" data-a="am" data-m="signup" aria-pressed="${!login}">Crear cuenta</button></div>
<form id="af" novalidate>
${login ? '' : `<label class="f">¿Cómo te gustaría que te llamen?<input type="text" data-au="name" value="${esc(authName)}" maxlength="30" placeholder="Tu nombre o apodo" autocomplete="given-name" autocapitalize="words"></label>`}
<label class="f">Email<input type="email" data-au="email" value="${esc(authEmail)}" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false"></label>
<label class="f">Contraseña<input type="password" data-au="pass" value="${esc(authPass)}" autocomplete="${login ? 'current-password' : 'new-password'}" ${login ? '' : 'placeholder="Mínimo 8 caracteres"'}></label>
${CFG.API_URL ? '' : `<label class="f">URL del servidor<input type="url" data-au="server" value="${esc(S.server)}" placeholder="https://trazo-server.tu-usuario.workers.dev" autocapitalize="none" spellcheck="false"></label>`}
<p class="err" role="alert">${esc(authErr)}</p>
<button class="btn" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Un momento…' : login ? 'Ingresar' : 'Crear cuenta'}</button>
</form></div></div>`;
}

/* ---------- Proyectos ---------- */
function vProjects() {
  const ps = projects(), name = D().name;
  if (!ps.length) return `<div class="page"><div class="empty first"><div class="big" aria-hidden="true">🧭</div><h1>${name ? `Hola ${esc(name)}, ` : ''}empecemos por un proyecto</h1>
<p class="mut">Un proyecto agrupa iniciativas, estados y equipos. Después lo planificás en el roadmap.</p>
<div class="erow2"><button class="btn" data-a="newproj">+ Crear mi primer proyecto</button><button class="btn ghost" data-a="sample">Ver un proyecto de ejemplo</button></div></div></div>`;
  return `<div class="page"><div class="ph"><div><h1>${name ? `Hola ${esc(name)} 👋` : 'Tus proyectos'}</h1><p class="mut">Elegí un proyecto o creá uno nuevo.</p></div><button class="btn auto" data-a="newproj">+ Nuevo proyecto</button></div>
<div class="pgrid">${ps.map(projCard).join('')}</div></div>`;
}
function projCard(p) {
  const is = initsOf(p.id), ts = teamsOf(p.id), sts = statesOf(p.id), tot = is.length || 1;
  const done = is.filter(isDone).length;
  const next = is.filter(i => i.dl && i.dl >= today() && !isDone(i)).sort((a, b) => a.dl.localeCompare(b.dl))[0];
  const bars = sts.map(s => { const n = is.filter(i => i.st === s.id).length; return n ? `<i class="c-${s.col}" style="width:${n / tot * 100}%" title="${esc(s.n)}: ${n}"></i>` : ''; }).join('');
  return `<div class="pcw"><button class="pcard" data-a="openp" data-id="${esc(p.id)}"><span class="pe" aria-hidden="true">${esc(p.e || '📁')}</span><b>${esc(p.n)}</b>
<small>${is.length} ${is.length === 1 ? 'iniciativa' : 'iniciativas'} · ${ts.length} ${ts.length === 1 ? 'equipo' : 'equipos'}${is.length ? ` · ${done} ${done === 1 ? 'terminada' : 'terminadas'}` : ''}</small>
<span class="sbar" aria-hidden="true">${bars}</span>
<small class="nx">${next ? `Próximo deadline: <b>${esc(dm(next.dl))}</b> · ${esc(next.n)}` : 'Sin deadlines próximos'}</small></button><button class="icon pcm" data-a="pcmenu" data-id="${esc(p.id)}" aria-label="Opciones de ${esc(p.n)}">${I_DOTS}</button></div>`;
}

/* ---------- Proyecto ---------- */
const TABS = [['inits', 'Iniciativas'], ['plan', 'Roadmap'], ['teams', 'Equipos'], ['dash', 'Tablero']];
const tabOf = p => L.tab[p.id] || 'inits';
function vProject() {
  const p = P(); if (!p) return '';
  const t = tabOf(p), cnt = { inits: initsOf(p.id).length, teams: teamsOf(p.id).length };
  return `<div class="page ${t === 'plan' ? 'wide' : ''}"><div class="ph pj"><h1 class="vh">${esc(p.n)}</h1>
<div class="tabs" role="tablist" aria-label="Secciones del proyecto">${TABS.map(([k, n]) => `<button role="tab" data-a="ptab" data-t="${k}" aria-selected="${t === k}">${n}${cnt[k] !== undefined ? ` <span class="cn">${cnt[k]}</span>` : ''}</button>`).join('')}</div></div>
${t === 'inits' ? shellInits(p) : t === 'plan' ? shellPlan(p) : ''}<div id="body"></div></div>`;
}

/* --- Iniciativas --- */
function shellInits(p) {
  const sts = statesOf(p.id), all = initsOf(p.id), f = L.flt[p.id] || '';
  return `<form id="addi" class="addi" autocomplete="off"><input id="ain" class="in" type="text" maxlength="160" placeholder="Nueva iniciativa…" aria-label="Nombre de la nueva iniciativa" enterkeyhint="done">
<label class="fl"><span>Deadline</span><input id="adl" class="in" type="date" aria-label="Deadline"></label>
<label class="fl"><span>Estado</span><select id="ast" class="in" aria-label="Estado">${stateOpts(p.id, sts[0]?.id)}</select></label>
<label class="fl"><span>Prioridad</span><select id="apr" class="in" aria-label="Prioridad">${prioOpts('')}</select></label>
<button class="btn" type="submit">Agregar</button></form>
<div class="tbar"><div class="chips" role="group" aria-label="Filtrar por estado"><button class="chip" data-a="flt" data-v="" aria-pressed="${!f}">Todas <span class="cn">${all.length}</span></button>${sts.map(s => { const n = all.filter(i => i.st === s.id).length; return `<button class="chip" data-a="flt" data-v="${esc(s.id)}" aria-pressed="${f === s.id}"><i class="dot c-${s.col}"></i>${esc(s.n)} <span class="cn">${n}</span></button>`; }).join('')}</div>
<span class="grow"></span><label class="sel">Ordenar por <select data-ch="sort" aria-label="Ordenar por">${Object.entries(SORTS).map(([k, n]) => `<option value="${k}"${(L.sort[p.id] || 'manual') === k ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
<button class="mini" data-a="states">Editar estados</button></div>`;
}
function bodyInits(p) {
  const f = L.flt[p.id] || '', rows = sortedInits(p).filter(i => !f || i.st === f);
  if (!initsOf(p.id).length) return `<div class="empty"><div class="big" aria-hidden="true">📝</div><p><b>Todavía no hay iniciativas.</b></p><p class="mut">Escribí la primera arriba: nombre, deadline, estado y prioridad.</p></div>`;
  if (!rows.length) return `<div class="empty"><p class="mut">No hay iniciativas con ese estado.</p></div>`;
  const bl = blocksOf(p.id), t = today();
  return `<div class="itbl" role="table" aria-label="Iniciativas"><div class="ith" role="row"><span role="columnheader">Iniciativa</span><span role="columnheader">Deadline</span><span role="columnheader">Estado</span><span role="columnheader">Prioridad</span><span role="columnheader">Equipos</span><span></span></div>
${rows.map(i => {
    const s = stateOf(i.st), late = i.dl && i.dl < t && !isDone(i), soon = i.dl && !late && dn(i.dl) - dn(t) <= 7 && !isDone(i);
    const tms = [...new Set(bl.filter(b => b.in === i.id).map(b => b.tm))].map(teamOf).filter(Boolean);
    return `<div class="itr${isDone(i) ? ' done' : ''}" role="row" data-rid="${esc(i.id)}"><div class="itc" role="cell">${grip(i)}<button class="itn" data-a="iopen" data-id="${esc(i.id)}"><span>${esc(i.n)}</span>${i.ln ? `<i class="lk" title="Tiene enlace">${I_LINK}</i>` : ''}${i.no ? '<i class="nt" title="Tiene notas">¶</i>' : ''}</button></div>
<span role="cell" class="cdl"><input class="in sm dl${late ? ' late' : soon ? ' soon' : ''}" type="date" value="${esc(i.dl)}" data-ch="dl" data-id="${esc(i.id)}" aria-label="Deadline de ${esc(i.n)}"></span>
<span role="cell"><select class="tgs c-${s ? s.col : 'gray'}" data-ch="st" data-id="${esc(i.id)}" aria-label="Estado de ${esc(i.n)}">${s ? '' : '<option value="" selected>Sin estado</option>'}${stateOpts(p.id, i.st, true)}</select></span>
<span role="cell"><select class="tgs p c-${PRIO[i.p].c}" data-ch="p" data-id="${esc(i.id)}" aria-label="Prioridad de ${esc(i.n)}">${prioOpts(i.p)}</select></span>
<span role="cell" class="tms">${tms.length ? tms.map(x => `<i class="dot c-${x.col}" title="${esc(x.n)}"></i>`).join('') + `<small>${tms.length === 1 ? esc(tms[0].n) : tms.length + ' equipos'}</small>` : `<button class="lnk" data-a="iplan" data-id="${esc(i.id)}">Planificar</button>`}</span>
<span role="cell" class="ce"><button class="icon sm" data-a="iopen" data-id="${esc(i.id)}" aria-label="Editar ${esc(i.n)}">${I_DOTS}</button></span></div>`;
  }).join('')}</div>`;
}

/* --- Roadmap --- */
const GN = { m: 'Mes', q: 'Quincena', w: 'Semana', d: 'Día' };
const DW = { m: 5, q: 9, w: 20, d: 34 };
const LH = 34, RP = 7;
function tl(p) {
  const vs = p.vs || ymOf(today()), vn = p.vn || 4, endM = addM(vs, vn - 1);
  const d0 = dn(vs + '-01'), n = dn(`${endM}-${pad(daysIn(endM))}`) - d0 + 1;
  return { vs, vn, d0, n, dw: DW[p.g] || 20, g: p.g, endM };
}
function segsOf(T) {
  const months = [], segs = [];
  for (let i = 0; i < T.vn; i++) {
    const ym = addM(T.vs, i), nd = daysIn(ym), st = dn(ym + '-01') - T.d0;
    months.push({ ym, st, len: nd });
    const cuts = T.g === 'm' ? [[1, nd]] : T.g === 'q' ? [[1, 15], [16, nd]] : T.g === 'w' ? [[1, 7], [8, 14], [15, 21], [22, nd]] : Array.from({ length: nd }, (_, k) => [k + 1, k + 1]);
    cuts.forEach(([a, b], k) => segs.push({ st: st + a - 1, len: b - a + 1, k, first: k === 0, a }));
  }
  return { months, segs };
}
function shellPlan(p) {
  const T = tl(p), ts = teamsOf(p.id);
  return `<div class="rtb"><div class="segs" role="group" aria-label="Granularidad">${Object.entries(GN).map(([k, n]) => `<button data-a="gran" data-v="${k}" aria-pressed="${p.g === k}">${n}</button>`).join('')}</div>
<div class="navm"><button class="icon sm" data-a="rmnav" data-v="-1" aria-label="Mes anterior">‹</button><button class="mini" data-a="rmtoday">Hoy</button><button class="icon sm" data-a="rmnav" data-v="1" aria-label="Mes siguiente">›</button><b>${cap(ymLabel(T.vs))} – ${ymLabel(T.endM)}</b></div>
<label class="sel">Ver <select data-ch="vn" aria-label="Meses visibles">${[1, 2, 3, 4, 6, 9, 12].map(n => `<option value="${n}"${n === T.vn ? ' selected' : ''}>${n} ${n === 1 ? 'mes' : 'meses'}</option>`).join('')}</select></label>
<span class="grow"></span>
<button class="mini full" data-a="full" aria-pressed="${full}">${full ? I_SHRINK + ' Salir de pantalla completa' : I_EXPAND + ' Pantalla completa'}</button>
<div class="segs" role="group" aria-label="Agrupar por"><button data-a="gb" data-v="i" aria-pressed="${p.gb !== 't'}">Por iniciativa</button><button data-a="gb" data-v="t" aria-pressed="${p.gb === 't'}">Por equipo</button></div></div>
<div class="legend">${ts.length ? ts.map(t => chip(t.n, t.col)).join('') : '<span class="mut small">Todavía no hay equipos.</span>'}<button class="lnk" data-a="ptab" data-t="teams">${ts.length ? 'Gestionar equipos' : '+ Agregar equipos o personas'}</button>
<span class="grow"></span><span class="hint">Arrastrá sobre una fila para crear un plazo · arrastrá un plazo para moverlo · tirá de sus bordes para cambiar la duración</span></div>`;
}
function rowsOf(p) {
  const bl = blocksOf(p.id);
  if (p.gb === 't') {
    const rs = teamsOf(p.id).map(t => ({ key: t.id, kind: 't', t, blocks: bl.filter(b => b.tm === t.id) }));
    const none = bl.filter(b => !teamOf(b.tm));
    if (none.length) rs.push({ key: '', kind: 't', t: null, blocks: none });
    return rs;
  }
  return sortedInits(p).map(i => ({ key: i.id, kind: 'i', i, blocks: bl.filter(b => b.in === i.id) }));
}
function lanes(blocks) {
  const s = [...blocks].sort((a, b) => a.s.localeCompare(b.s) || a.e.localeCompare(b.e) || a.c - b.c), ends = [], at = {};
  for (const b of s) { let k = ends.findIndex(e => e < b.s); if (k < 0) { k = ends.length; ends.push(b.e); } else ends[k] = b.e; at[b.id] = k; }
  return { at, n: Math.max(1, ends.length) };
}
function blockHtml(b, T, lane, p) {
  const s = dn(b.s) - T.d0, e = dn(b.e) - T.d0;
  if (e < 0 || s > T.n - 1) return '';
  const l = Math.max(0, s), r = Math.min(T.n - 1, e), tm = teamOf(b.tm), it = D().inits[b.in];
  const txt = p.gb === 't' ? it.n : (tm ? tm.n : 'Sin equipo'), days = e - s + 1;
  const desc = `${p.gb === 't' ? (tm ? tm.n : 'Sin equipo') : it.n}${b.lb ? ' · ' + b.lb : ''}: ${dm(b.s)} → ${dm(b.e)} (${days} ${days === 1 ? 'día' : 'días'})`;
  return `<button class="blk c-${tm ? tm.col : 'gray'}${s < 0 ? ' cl' : ''}${e > T.n - 1 ? ' cr' : ''}" data-b="${esc(b.id)}" style="left:${l * T.dw}px;width:${(r - l + 1) * T.dw}px;top:${RP + lane * LH}px" title="${esc(txt + ' — ' + desc)}" aria-label="${esc((p.gb === 't' ? it.n + ' · ' : '') + desc)}. Flechas para mover, Mayús + flechas para cambiar la duración."><i class="hl" aria-hidden="true"></i><span>${esc(txt)}${b.lb ? ` <em>${esc(b.lb)}</em>` : ''}</span><i class="hr" aria-hidden="true"></i></button>`;
}
function bodyPlan(p) {
  const T = tl(p), { months, segs } = segsOf(T), W = T.n * T.dw, rs = rowsOf(p), td = dn(today()) - T.d0;
  if (p.gb === 't' && !teamsOf(p.id).length) return `<div class="empty"><div class="big" aria-hidden="true">👥</div><p><b>Agregá equipos o personas</b> para ver la carga de cada uno.</p><button class="btn auto" data-a="ptab" data-t="teams">Ir a Equipos</button></div>`;
  if (p.gb !== 't' && !rs.length) return `<div class="empty"><div class="big" aria-hidden="true">🗓️</div><p><b>Primero cargá iniciativas.</b> Después las planificás acá, por equipo.</p><button class="btn auto" data-a="ptab" data-t="inits">Ir a Iniciativas</button></div>`;
  const head = `<div class="rh"><div class="rl rlh">${p.gb === 't' ? 'Equipo / persona' : 'Iniciativa'}</div><div class="rt rth" style="width:${W}px">
<div class="mrow">${months.map(m => `<div class="mc" style="left:${m.st * T.dw}px;width:${m.len * T.dw}px"><span>${cap(MON[+m.ym.slice(5) - 1])} ${m.ym.slice(0, 4)}</span></div>`).join('')}</div>
${T.g === 'm' ? '' : `<div class="srow">${segs.map(s => { const lab = T.g === 'q' ? (s.k ? '2ª quincena' : '1ª quincena') : T.g === 'w' ? 'S' + (s.k + 1) : `${DOW1[wday(T.d0 + s.st)]}<b>${s.a}</b>`; const we = T.g === 'd' && [0, 6].includes(wday(T.d0 + s.st)); const isT = td >= s.st && td < s.st + s.len; return `<div class="sc${we ? ' we' : ''}${isT ? ' now' : ''}" style="left:${s.st * T.dw}px;width:${s.len * T.dw}px">${lab}</div>`; }).join('')}</div>`}
${td >= 0 && td < T.n ? `<i class="tdh" style="left:${td * T.dw + T.dw / 2}px">Hoy</i>` : ''}</div></div>`;
  let lines = segs.map(s => `<i class="gl${s.first ? ' gm' : ''}" style="left:${s.st * T.dw}px"></i>`).join('');
  if (T.g === 'd') lines += segs.filter(s => [0, 6].includes(wday(T.d0 + s.st))).map(s => `<i class="gwe" style="left:${s.st * T.dw}px;width:${T.dw}px"></i>`).join('');
  if (td >= 0 && td < T.n) lines += `<i class="tdy" style="left:${td * T.dw + T.dw / 2}px"></i>`;
  const body = rs.map(r => {
    const { at, n } = lanes(r.blocks), h = n * LH + RP + 1;
    let lab;
    if (r.kind === 'i') {
      const i = r.i, s = stateOf(i.st), late = i.dl && i.dl < today() && !isDone(i);
      lab = `<button class="rlb" data-a="iopen" data-id="${esc(i.id)}"><span class="rn">${esc(i.n)}</span><small>${s ? `<i class="dot c-${s.col}"></i>${esc(s.n)}` : ''}${i.p ? ` · <span class="pt-${i.p}">${PRIO[i.p].n}</span>` : ''}${i.dl ? ` · <span class="${late ? 'late' : ''}">${esc(dm(i.dl))}</span>` : ''}</small></button>`;
    } else {
      const days = r.blocks.reduce((a, b) => a + dn(b.e) - dn(b.s) + 1, 0);
      lab = `<div class="rlb tm"><span class="rn"><i class="dot c-${r.t ? r.t.col : 'gray'}"></i>${esc(r.t ? r.t.n : 'Sin equipo')}</span><small>${r.blocks.length} ${r.blocks.length === 1 ? 'plazo' : 'plazos'}${days ? ` · ${days} días` : ''}</small></div>`;
    }
    const dl = r.kind === 'i' && r.i.dl ? dn(r.i.dl) - T.d0 : -1;
    const dlm = dl >= 0 && dl < T.n ? `<i class="dlm${isDone(r.i) ? ' ok' : ''}" style="left:${dl * T.dw + T.dw / 2}px" title="Deadline: ${esc(dm(r.i.dl))}"></i>` : '';
    return `<div class="rr" data-row="${esc(r.key)}" data-k="${r.kind}"${r.kind === 'i' ? ` data-rid="${esc(r.key)}"` : ''}><div class="rl">${r.kind === 'i' ? grip(r.i) : ''}${lab}</div><div class="rt" style="width:${W}px;min-height:${h}px">${dlm}${r.blocks.map(b => blockHtml(b, T, at[b.id], p)).join('')}</div></div>`;
  }).join('');
  return `<div id="rm" class="rm g-${T.g}" style="--dw:${T.dw}px"><div class="rmi" style="width:calc(var(--lw) + ${W}px)">${head}<div class="rb"><div class="rgl" style="width:${W}px">${lines}</div>${body}</div></div></div>`;
}

/* --- Equipos --- */
function tagEditor(kind, pr) {
  const items = kind === 'states' ? statesOf(pr) : teamsOf(pr);
  const used = id => kind === 'states' ? initsOf(pr).filter(i => i.st === id).length : blocksOf(pr).filter(b => b.tm === id).length;
  const unit = kind === 'states' ? ['iniciativa', 'iniciativas'] : ['plazo', 'plazos'];
  return `<div class="tge">${items.map((x, k) => { const u = used(x.id); return `<div class="tgr"><button class="sw c-${x.col}" data-a="pickcol" data-k="${kind}" data-id="${esc(x.id)}" aria-label="Color de ${esc(x.n)}: ${COLN[x.col]}"></button>
<input class="in sm tgn" type="text" maxlength="40" value="${esc(x.n)}" data-ch="tgn" data-k="${kind}" data-id="${esc(x.id)}" aria-label="Nombre">
${kind === 'states' ? `<label class="dnc" title="Las iniciativas en este estado cuentan como terminadas"><input type="checkbox" data-ch="tgdn" data-id="${esc(x.id)}"${x.dn ? ' checked' : ''}> Terminado</label>` : ''}
${kind === 'teams' ? `<label class="capc" title="Cuántas iniciativas puede llevar en paralelo por semana">Capacidad<input class="in sm" type="number" min="1" max="99" inputmode="numeric" value="${capOf(x)}" data-ch="tgcap" data-id="${esc(x.id)}" aria-label="Capacidad de ${esc(x.n)}: iniciativas en paralelo"></label>` : ''}
<small class="mut us">${u} ${u === 1 ? unit[0] : unit[1]}</small>
<span class="ord"><button class="icon xs" data-a="tgmv" data-k="${kind}" data-id="${esc(x.id)}" data-v="-1" aria-label="Subir"${k ? '' : ' disabled'}>↑</button><button class="icon xs" data-a="tgmv" data-k="${kind}" data-id="${esc(x.id)}" data-v="1" aria-label="Bajar"${k < items.length - 1 ? '' : ' disabled'}>↓</button></span>
<button class="icon xs dng" data-a="tgdel" data-k="${kind}" data-id="${esc(x.id)}" aria-label="Eliminar ${esc(x.n)}">${I_TRASH}</button></div>`; }).join('') || `<p class="mut small">${kind === 'states' ? 'No hay estados.' : 'Todavía no hay equipos ni personas.'}</p>`}</div>
<form class="tga" data-k="${kind}" autocomplete="off"><input class="in" type="text" maxlength="40" placeholder="${kind === 'states' ? 'Nuevo estado (ej. En refinamiento)' : 'Nuevo equipo o persona (ej. QA, Ana)'}" aria-label="${kind === 'states' ? 'Nuevo estado' : 'Nuevo equipo o persona'}"><button class="btn auto" type="submit">Agregar</button></form>`;
}
/* --- Tablero --- */
const capOf = t => t.cap || 2;
const WEEKS = [4, 8, 12];
/* Iniciativas distintas que un equipo tiene en una semana (lunes a domingo) */
function weekLoad(bl, tm, ws) { const we = addD(ws, 6), set = new Set(); for (const b of bl) if (b.tm === tm && b.s <= we && b.e >= ws) set.add(b.in); return set; }
const ICO_WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/></svg>';
const ICO_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
const ICO_CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
function bodyDash(p) {
  const is = initsOf(p.id), t = today(), bl = blocksOf(p.id), ts = teamsOf(p.id);
  if (!is.length) return `<div class="empty"><div class="big" aria-hidden="true">📊</div><p><b>El tablero se arma con tus iniciativas.</b></p><p class="mut">Cargá iniciativas y planificalas por equipo para ver avance, atrasos y capacidad.</p><button class="btn auto" data-a="ptab" data-t="inits">Ir a Iniciativas</button></div>`;
  const done = is.filter(isDone), open = is.filter(i => !isDone(i));
  const byDl = (a, b) => a.dl.localeCompare(b.dl);
  const late = open.filter(i => i.dl && i.dl < t).sort(byDl);
  const soon = open.filter(i => i.dl && i.dl >= t && dn(i.dl) - dn(t) <= 14).sort(byDl);
  const endOf = i => bl.filter(b => b.in === i.id).reduce((m, b) => b.e > m ? b.e : m, '');
  const risk = open.filter(i => i.dl && i.dl >= t && endOf(i) > i.dl).sort(byDl);
  const unpl = open.filter(i => !bl.some(b => b.in === i.id)).sort((a, b) => PRIO[a.p].r - PRIO[b.p].r);
  const pct = Math.round(done.length / is.length * 100);
  const tile = (n, lab, sub, cls = '', ico = '') => `<div class="kpi ${cls}"><span class="kl">${ico}${lab}</span><b>${n}</b><small>${sub}</small></div>`;
  const tiles = `<div class="kpis">
${tile(is.length, 'Iniciativas', `${open.length} abiertas · ${done.length} terminadas`)}
${tile(pct + '%', 'Avance', `<span class="pbar" aria-hidden="true"><i style="width:${pct}%"></i></span>${done.length} de ${is.length} finalizadas`, 'ok', ICO_OK)}
${tile(late.length, 'Atrasadas', late.length ? 'Deadline vencido sin terminar' : 'Nada vencido', late.length ? 'bad' : '', ICO_WARN)}
${tile(soon.length, 'Vencen en 14 días', soon.length ? `Próxima: ${esc(dm(soon[0].dl))}` : 'Sin deadlines cerca', soon.length ? 'warn' : '', ICO_CLOCK)}
${tile(risk.length, 'En riesgo', 'Planificadas para terminar después del deadline', risk.length ? 'warn' : '', ICO_WARN)}
${tile(unpl.length, 'Sin planificar', 'Abiertas sin plazos en el roadmap')}</div>`;
  /* Iniciativas por estado */
  const sts = statesOf(p.id).map(s => ({ s, n: is.filter(i => i.st === s.id).length }));
  const mx = Math.max(1, ...sts.map(x => x.n));
  const stChart = `<section class="card"><h2>Iniciativas por estado</h2><div class="hb" role="table" aria-label="Iniciativas por estado">${sts.map(({ s, n }) => `<div class="hbr" role="row" title="${esc(s.n)}: ${n} ${n === 1 ? 'iniciativa' : 'iniciativas'} (${Math.round(n / is.length * 100)}%)"><span role="rowheader"><i class="dot c-${s.col}"></i>${esc(s.n)}</span><span class="hbt" role="cell"><i class="c-${s.col}" style="width:${n / mx * 100}%"></i></span><b role="cell">${n}</b></div>`).join('')}</div></section>`;
  /* Abiertas por prioridad, con cuántas están atrasadas */
  const prs = PRIO_KEYS.map(k => ({ k, n: open.filter(i => i.p === k).length, l: late.filter(i => i.p === k).length })).filter(x => x.n);
  const mp = Math.max(1, ...prs.map(x => x.n));
  const prChart = `<section class="card"><h2>Abiertas por prioridad</h2>${prs.length ? `<div class="hb" role="table" aria-label="Iniciativas abiertas por prioridad">${prs.map(x => `<div class="hbr" role="row" title="${PRIO[x.k].n}: ${x.n} abiertas, ${x.l} atrasadas"><span role="rowheader">${PRIO[x.k].n}</span><span class="hbt" role="cell"><i class="pl" style="width:${(x.n - x.l) / mp * 100}%"></i>${x.l ? `<i class="lt" style="width:${x.l / mp * 100}%"></i>` : ''}</span><b role="cell">${x.n}${x.l ? ` <small class="late">· ${x.l} atras.</small>` : ''}</b></div>`).join('')}</div>
<div class="lg"><span><i class="pl"></i>En término</span><span><i class="lt"></i>Atrasadas</span></div>` : '<p class="mut small">No hay iniciativas abiertas.</p>'}</section>`;
  /* Capacidad por equipo y semana */
  const nW = WEEKS.includes(L.dw?.[p.id]) ? L.dw[p.id] : 8, off = (L.do && L.do[p.id]) || 0;
  const w0 = addD(mondayOf(t), off * 7), weeks = Array.from({ length: nW }, (_, k) => addD(w0, k * 7));
  const lvl = (n, c) => !n ? 0 : n > c ? 4 : n === c ? 3 : n / c > .5 ? 2 : 1;
  const LV = ['Libre', 'Con lugar', 'Con lugar', 'Al límite', 'Sobrecargado'];
  const cap = ts.length ? `<div class="hmw"><table class="hm"><thead><tr><th scope="col">Equipo <small>(capacidad)</small></th>${weeks.map(w => `<th scope="col"${w === mondayOf(t) ? ' class="now"' : ''}><small>Semana</small>${esc(dm(w))}</th>`).join('')}<th scope="col">Sobrecarga</th></tr></thead><tbody>
${ts.map(x => { let over = 0; const c = capOf(x); const cells = weeks.map(w => { const set = weekLoad(bl, x.id, w), n = set.size, l = lvl(n, c); if (l === 4) over++; const names = [...set].map(id => D().inits[id]?.n).filter(Boolean).join(', '); return `<td class="lv${l}" title="${esc(x.n)} · semana del ${esc(dm(w))}: ${n} de ${c} — ${LV[l]}${names ? '\n' + esc(names) : ''}">${l === 4 ? ICO_WARN : ''}${n ? `${n}<small>/${c}</small>` : '<small>—</small>'}</td>`; }).join(''); return `<tr><th scope="row"><i class="dot c-${x.col}"></i>${esc(x.n)} <small>(${c})</small></th>${cells}<td class="ovr${over ? ' bad' : ''}">${over ? `${over} ${over === 1 ? 'semana' : 'semanas'}` : '—'}</td></tr>`; }).join('')}</tbody></table></div>
<div class="lg"><span><i class="lv1"></i>Con lugar</span><span><i class="lv3"></i>Al límite</span><span><i class="lv4"></i>Sobrecargado</span><span class="mut">Número = iniciativas en paralelo / capacidad</span></div>`
    : `<p class="mut small">Agregá equipos o personas para ver su carga por semana.</p>`;
  const capCard = `<section class="card"><div class="ch"><div><h2>Capacidad por equipo y semana</h2><p class="mut small">Cuántas iniciativas tiene cada equipo en paralelo cada semana, contra su capacidad.</p></div>
<div class="chc"><div class="navm"><button class="icon sm" data-a="dwnav" data-v="-1" aria-label="Semanas anteriores">‹</button><button class="mini" data-a="dwnav" data-v="0">Esta semana</button><button class="icon sm" data-a="dwnav" data-v="1" aria-label="Semanas siguientes">›</button></div>
<div class="segs" role="group" aria-label="Semanas visibles">${WEEKS.map(n => `<button data-a="dwn" data-v="${n}" aria-pressed="${n === nW}">${n} sem.</button>`).join('')}</div><button class="lnk" data-a="ptab" data-t="teams">Editar capacidad</button></div></div>${cap}</section>`;
  /* Listas */
  const days = (a, b) => { const d = dn(b) - dn(a); return `${d} ${d === 1 ? 'día' : 'días'}`; };
  const row = (i, right) => { const s = stateOf(i.st); return `<button class="dli" data-a="iopen" data-id="${esc(i.id)}"><span class="dn">${esc(i.n)}</span><span class="dm">${s ? chip(s.n, s.col) : ''}${i.p ? `<span class="pt-${i.p}">${PRIO[i.p].n}</span>` : ''}</span><span class="dr">${right}</span></button>`; };
  const list = (title, items, fn, empty, cls = '') => `<section class="card ${cls}"><h2>${title} <span class="cn">${items.length}</span></h2>${items.length ? `<div class="dlst">${items.slice(0, 8).map(fn).join('')}</div>${items.length > 8 ? `<p class="mut small">y ${items.length - 8} más</p>` : ''}` : `<p class="mut small">${empty}</p>`}</section>`;
  const lists = `<div class="dgrid2">
${list('Atrasadas', late, i => row(i, `<b class="late">${days(i.dl, t)} tarde</b><small>${esc(dm(i.dl))}</small>`), 'No hay iniciativas atrasadas 🎉')}
${list('En riesgo', risk, i => row(i, `<b class="warnt">termina ${days(i.dl, endOf(i))} después</b><small>deadline ${esc(dm(i.dl))}</small>`), 'Todo lo planificado termina antes de su deadline.')}
${list('Próximos deadlines', soon, i => row(i, `<b>${i.dl === t ? 'hoy' : 'en ' + days(t, i.dl)}</b><small>${esc(dm(i.dl))}</small>`), 'Nada vence en las próximas dos semanas.')}
${list('Sin planificar', unpl, i => row(i, `<span class="lnk" data-a="iplan" data-id="${esc(i.id)}">Planificar</span>`), 'Todas las iniciativas abiertas tienen plazos.')}</div>`;
  return `<div class="dash">${tiles}<div class="dgrid2">${stChart}${prChart}</div>${capCard}${lists}</div>`;
}
function bodyTeams(p) {
  const ts = teamsOf(p.id), bl = blocksOf(p.id), t = today();
  const load = ts.map(x => {
    const mine = bl.filter(b => b.tm === x.id), cur = mine.filter(b => b.s <= t && b.e >= t), nxt = mine.filter(b => b.s > t).sort((a, b) => a.s.localeCompare(b.s))[0];
    return `<div class="ld"><b><i class="dot c-${x.col}"></i>${esc(x.n)}</b><small>${cur.length ? `Ahora: ${cur.map(b => esc(D().inits[b.in].n)).join(', ')}` : 'Sin plazos en curso'}</small><small>${nxt ? `Próximo: ${esc(D().inits[nxt.in].n)} · ${esc(dm(nxt.s))}` : ''}</small></div>`;
  }).join('');
  return `<div class="twocol"><section class="card"><h2>Equipos y personas</h2><p class="mut small">Cada plazo del roadmap se asigna a un equipo o persona. El color es el de sus barras.</p>${tagEditor('teams', p.id)}</section>
<section class="card"><h2>Carga de hoy</h2>${ts.length ? `<div class="lds">${load}</div><button class="btn ghost" data-a="gbteam">Ver el roadmap por equipo</button>` : '<p class="mut small">Cuando agregues equipos vas a ver qué tiene cada uno en curso y qué sigue.</p>'}</section></div>`;
}

/* ---------- Ajustes ---------- */
function vSet() {
  return `<div class="page narrow"><div class="ph"><h1>Ajustes</h1></div>
<section class="card"><h2>Cuenta</h2>
<div class="set-row"><span class="mut">Sesión</span><span>${esc(S.email)}</span></div>
<div class="set-row"><span class="mut">Cómo te llamamos</span><span>${esc(D().name || '—')}</span></div>
<button class="sb" data-a="editname">Cambiar mi nombre</button><button class="sb" data-a="syncnow">Sincronizar ahora</button></section>
<section class="card"><h2>Apariencia</h2><div class="themesel" role="group" aria-label="Apariencia">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([k, n]) => `<button type="button" data-a="theme" data-v="${k}" aria-pressed="${(L.theme || 'auto') === k}">${n}</button>`).join('')}</div></section>
<section class="card"><h2>App</h2>${installEvt ? '<button class="sb" data-a="install">Instalar la app</button>' : ''}
<button class="sb" data-a="onbshow">Ver la introducción de Trazo</button><button class="sb" data-a="export">Exportar todo (JSON)</button></section>
<section class="card"><h2>Sesión</h2><button class="sb" data-a="logout">Cerrar sesión</button><button class="sb dng" data-a="delacc">Eliminar mi cuenta y mis datos</button></section>
<p class="mut small">Trazo ${VERSION}. Tus datos se guardan en este dispositivo y en la nube; funciona sin conexión y se sincroniza cuando vuelve.</p></div>`;
}

/* ---------- Navegación y dibujo ---------- */
function bodyHtml() {
  const p = P(); if (view !== 'project' || !p) return '';
  const t = tabOf(p);
  return t === 'inits' ? bodyInits(p) : t === 'plan' ? bodyPlan(p) : t === 'dash' ? bodyDash(p) : bodyTeams(p);
}
let scrollKeep = null;
function paint() {
  const b = $('#body'); if (!b) return;
  const rm = $('#rm'); if (rm) scrollKeep = { l: rm.scrollLeft, t: rm.scrollTop, p: curP, vs: P()?.vs, g: P()?.g };
  b.innerHTML = bodyHtml();
  const nr = $('#rm');
  if (nr) {
    const p = P();
    if (scrollKeep && scrollKeep.p === curP && scrollKeep.vs === p.vs && scrollKeep.g === p.g) { nr.scrollLeft = scrollKeep.l; nr.scrollTop = scrollKeep.t; }
    else { const T = tl(p), td = dn(today()) - T.d0; if (td > 0 && td < T.n) nr.scrollLeft = Math.max(0, td * T.dw - 80); }
  }
}
function render() {
  const V = { auth: vAuth, projects: vProjects, project: vProject, set: vSet };
  $('#v').innerHTML = (V[view] || vProjects)();
  if (full && !(view === 'project' && P() && tabOf(P()) === 'plan')) setFull(false, true);
  document.body.classList.toggle('rmfull', full);
  $('#v').className = 'v-' + view;
  paintHeader(); paint(); renderSheet();
  if (view !== 'auth' && !L.onb && onb < 0) onb = 0;
  paintOnb();
}
function setFull(on, quiet) {
  full = !!on;
  document.body.classList.toggle('rmfull', full);
  try {
    if (full && !document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    if (!full && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  } catch (_) {}
  if (!quiet) { scrollKeep = null; render(); }
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && full) setFull(false); });
function go(v) { view = v; sheet = null; render(); window.scrollTo(0, 0); }
function openProject(id) {
  if (!proj(id)) return;
  curP = id; D().last = id; D().lastU = now(); touch(); go('project');
}

/* ---------- Pantalla de carga e introducción ---------- */
const splashT0 = performance.now();
function hideSplash() {
  const sp = $('#sp'); if (!sp) return;
  setTimeout(() => { sp.classList.add('out'); setTimeout(() => sp.remove(), 450); }, Math.max(0, 800 - (performance.now() - splashT0)));
}
const ONB = [
  { t: 'Todo empieza en un proyecto', d: 'Creá un proyecto por roadmap, producto o equipo. Cada uno tiene sus propias iniciativas, estados y equipos.',
    art: '<div class="oa"><div class="om"><span class="oi">🧭</span><b>Roadmap Q4</b><small>12 iniciativas · 4 equipos</small><span class="sbar"><i class="c-forest" style="width:30%"></i><i class="c-navy" style="width:40%"></i><i class="c-gray" style="width:30%"></i></span></div><div class="om dim"><span class="oi">📱</span><b>App de autogestión</b><small>5 iniciativas · 2 equipos</small></div></div>' },
  { t: 'Cargá tus iniciativas', d: 'Cada iniciativa tiene deadline, estado y prioridad. Los estados vienen de base (Por hacer, En curso, Finalizado, Bloqueado) y los podés editar o sumar.',
    art: '<div class="oa"><div class="om row"><b>Rediseño del flujo de agenda</b><span class="tg c-navy">En curso</span><span class="tg c-red">Urgente</span><small>4 nov</small></div><div class="om row"><b>Campaña post-instalación</b><span class="tg c-orange">En refinamiento</span><span class="tg c-yellow">Media</span><small>29 oct</small></div><div class="om row"><b>QR y derivación</b><span class="tg c-red">Bloqueado</span><span class="tg c-orange">Alta</span><small>11 nov</small></div></div>' },
  { t: 'Planificá por equipo, arrastrando', d: 'En el Roadmap arrastrá sobre una fila para crear un plazo y asignale un equipo o persona. Movelo o estiralo desde los bordes.',
    art: '<div class="oa"><div class="ogantt"><div><b>Rediseño de agenda</b><span><i class="c-purple" style="left:0;width:40%">CUX / Data</i><i class="c-blue" style="left:40%;width:30%">Desarrollo</i><i class="c-green" style="left:70%;width:22%">QA</i></span></div><div><b>Campaña post-instalación</b><span><i class="c-purple" style="left:15%;width:30%">CUX / Data</i><i class="c-yellow" style="left:45%;width:35%">Implementación</i></span></div></div></div>' },
  { t: 'Elegí el nivel de detalle', d: 'El roadmap se divide por mes, y cada mes lo podés ver por quincena, por semana o por día. También podés agruparlo por equipo para ver la carga de cada uno.',
    art: '<div class="oa"><div class="segs demo"><button aria-pressed="false">Mes</button><button aria-pressed="false">Quincena</button><button aria-pressed="true">Semana</button><button aria-pressed="false">Día</button></div><div class="ocols"><b>Octubre</b><b>Noviembre</b><span>S1</span><span>S2</span><span>S3</span><span>S4</span><span>S1</span><span>S2</span><span>S3</span><span>S4</span></div></div>' }
];
let obKey = '';
function paintOnb() {
  const root = $('#ob-root'); if (!root) return;
  if (onb < 0 || view === 'auth') { if (obKey) { root.innerHTML = ''; obKey = ''; document.body.classList.remove('inonb'); } return; }
  const k = String(onb) + projects().length; if (k === obKey) return;
  obKey = k; document.body.classList.add('inonb');
  const s = ONB[onb], last = onb === ONB.length - 1, none = !projects().length;
  root.innerHTML = `<div class="onb" role="dialog" aria-modal="true" aria-labelledby="obh"><div class="onbc">
<div class="obt">${onb ? '<button class="icon" data-a="oback" aria-label="Paso anterior">‹</button>' : '<span></span>'}<span class="mut small">Paso ${onb + 1} de ${ONB.length}</span>${last ? '<span></span>' : '<button class="mini" data-a="oskip">Saltar</button>'}</div>
<div class="obm"><div class="obart">${s.art}</div><h2 id="obh">${s.t}</h2><p>${s.d}</p></div>
<div class="obb"><div class="dots" aria-hidden="true">${ONB.map((_, i) => `<i${i === onb ? ' class="on"' : ''}></i>`).join('')}</div>
${last && none ? '<button class="btn" data-a="ofirst">Crear mi primer proyecto</button><button class="btn ghost" data-a="osample">Explorar un proyecto de ejemplo</button>' : `<button class="btn" data-a="onext">${last ? 'Empezar' : 'Siguiente'}</button>`}</div></div></div>`;
  root.querySelector('.btn')?.focus({ preventScroll: true });
}
function closeOnb() { onb = -1; L.onb = 1; saveL(); paintOnb(); }

/* ---------- Ventanas flotantes ---------- */
function projForm(title, n, e, btn) {
  return `<form id="sf" novalidate class="sh" data-f="proj" role="dialog" aria-modal="true" aria-label="${title}"><h2>${title}</h2>
<div class="erow"><input id="se" class="in emo" type="text" value="${esc(e)}" placeholder="🙂" maxlength="16" autocomplete="off" aria-label="Emoji"><input id="sn" class="in" type="text" maxlength="80" value="${esc(n)}" placeholder="Nombre del proyecto" autocomplete="off" aria-label="Nombre"></div>
<div class="egrid" role="group" aria-label="Emojis sugeridos">${EMOS.map(x => `<button type="button" data-a="pe" data-e="${x}" aria-label="Emoji ${x}" aria-pressed="${x === e}">${x}</button>`).join('')}<button type="button" class="noemo" data-a="pe" data-e="" aria-label="Sin emoji">✕</button></div>
${sheet.t === 'newproj' ? '<p class="mut small">Se crea con los estados Por hacer, En curso, Finalizado y Bloqueado. Los podés cambiar cuando quieras.</p>' : ''}
<button class="btn" type="submit">${btn}</button><button class="btn ghost" type="button" data-a="close">Cancelar</button></form>`;
}
function initSheet() {
  const x = sheet.draft, p = P(), isNew = !x.id;
  const bl = isNew ? [] : blocksOf(p.id).filter(b => b.in === x.id).sort((a, b) => a.s.localeCompare(b.s));
  return `<form id="sf" novalidate class="sh wide" data-f="init" role="dialog" aria-modal="true" aria-label="${isNew ? 'Nueva iniciativa' : 'Iniciativa'}"><h2>${isNew ? 'Nueva iniciativa' : 'Iniciativa'}</h2>
<label class="f">Nombre<input id="in" type="text" maxlength="160" value="${esc(x.n)}" autocomplete="off"></label>
<div class="three"><label class="f">Deadline<input id="idl" type="date" value="${esc(x.dl)}"></label>
<label class="f">Estado<select id="ist">${stateOpts(p.id, x.st)}</select></label>
<label class="f">Prioridad<select id="ipr">${prioOpts(x.p)}</select></label></div>
<label class="f">Enlace <span class="mut small">(Jira, Confluence, Figma…)</span><input id="iln" type="url" maxlength="500" value="${esc(x.ln)}" placeholder="https://" autocapitalize="none" spellcheck="false"></label>
${x.ln && /^https?:\/\//i.test(x.ln) ? `<a class="lnk ext" href="${esc(x.ln)}" target="_blank" rel="noopener noreferrer">${I_LINK} Abrir enlace</a>` : ''}
<label class="f">Notas<textarea id="ino" maxlength="2000" rows="3" placeholder="Contexto, alcance, dependencias…">${esc(x.no)}</textarea></label>
${isNew ? '' : `<div class="lab">Plazos por equipo</div><div class="bls">${bl.map(b => { const t = teamOf(b.tm); return `<button type="button" class="blr" data-a="bopen" data-id="${esc(b.id)}">${chip(t ? t.n : 'Sin equipo', t ? t.col : 'gray')}${b.lb ? `<em>${esc(b.lb)}</em>` : ''}<span class="mut">${esc(dm(b.s))} → ${esc(dm(b.e))}</span></button>`; }).join('') || '<p class="mut small">Todavía no tiene plazos.</p>'}<button type="button" class="lnk" data-a="badd">+ Agregar plazo</button></div>`}
<p class="err" role="alert">${esc(sheet.err || '')}</p>
<button class="btn" type="submit">${isNew ? 'Crear iniciativa' : 'Guardar'}</button>
${isNew ? '' : '<button class="btn danger" type="button" data-a="idel">Eliminar iniciativa</button>'}<button class="btn ghost" type="button" data-a="close">Cancelar</button></form>`;
}
function blockSheet() {
  const x = sheet.draft, p = P(), isNew = !x.id, ts = teamsOf(p.id), is = sortedInits(p);
  const it = D().inits[x.in];
  return `<form id="sf" novalidate class="sh" data-f="block" role="dialog" aria-modal="true" aria-label="${isNew ? 'Nuevo plazo' : 'Plazo'}"><h2>${isNew ? 'Nuevo plazo' : 'Plazo'}</h2>
${sheet.fixIn && it ? `<p class="mut">${esc(it.n)}</p>` : `<label class="f">Iniciativa<select id="bin">${x.in ? '' : '<option value="" selected>Elegí una iniciativa…</option>'}${is.map(i => `<option value="${esc(i.id)}"${i.id === x.in ? ' selected' : ''}>${esc(i.n)}</option>`).join('')}</select></label>`}
<div class="lab">Equipo o persona</div><div class="chips wrapc" role="group" aria-label="Equipo o persona">${ts.map(t => `<button type="button" class="chip tc c-${t.col}" data-a="bteam" data-id="${esc(t.id)}" aria-pressed="${x.tm === t.id}">${esc(t.n)}</button>`).join('')}
${sheet.newTeam ? `<span class="ntm"><input id="bnt" class="in sm" type="text" maxlength="40" placeholder="Nombre del equipo o persona" aria-label="Nuevo equipo o persona"><button type="button" class="mini" data-a="bteamadd">Agregar</button></span>` : `<button type="button" class="chip add" data-a="bteamnew">+ ${ts.length ? 'Otro' : 'Nuevo equipo o persona'}</button>`}</div>
<label class="f">Etiqueta <span class="mut small">(opcional: Refinamiento, Desarrollo, QA…)</span><input id="blb" type="text" maxlength="30" value="${esc(x.lb)}" autocomplete="off"></label>
<div class="two"><label class="f">Desde<input id="bs" type="date" value="${esc(x.s)}" required></label><label class="f">Hasta<input id="be" type="date" value="${esc(x.e)}" required></label></div>
<p class="mut small">${x.s && x.e && x.e >= x.s ? `${dn(x.e) - dn(x.s) + 1} días` : ''}</p>
<p class="err" role="alert">${esc(sheet.err || '')}</p>
<button class="btn" type="submit">${isNew ? 'Crear plazo' : 'Guardar'}</button>
${isNew ? '' : '<button class="btn danger" type="button" data-a="bdel">Eliminar plazo</button>'}<button class="btn ghost" type="button" data-a="close">Cancelar</button></form>`;
}
function sheetHtml() {
  const s = sheet, p = P(); if (!s) return '';
  switch (s.t) {
    case 'ask': return `<div class="sh" role="dialog" aria-modal="true" aria-label="${esc(s.msg)}"><h2>${esc(s.msg)}</h2>${s.sub ? `<p class="mut">${esc(s.sub)}</p>` : ''}<button class="btn dangerf" data-a="yes">${esc(s.yes || 'Sí, eliminar')}</button><button class="btn ghost" data-a="close">Cancelar</button></div>`;
    case 'newproj': return projForm('Nuevo proyecto', '', '🧭', 'Crear proyecto');
    case 'editproj': return projForm('Editar proyecto', p?.n || '', p?.e || '', 'Guardar');
    case 'pswitch': return `<div class="sh" role="dialog" aria-modal="true" aria-label="Cambiar de proyecto"><h2>Proyectos</h2>${projects().map(x => `<button class="rowb" data-a="openp" data-id="${esc(x.id)}"><span>${nm(x)}</span>${x.id === curP ? '<span class="ck">✓</span>' : ''}</button>`).join('')}<button class="rowb acc" data-a="newproj">+ Nuevo proyecto</button><button class="rowb" data-a="go" data-v="projects">Ver todos los proyectos</button><button class="rowb" data-a="pmenu">Opciones de este proyecto…</button></div>`;
    case 'pmenu': return `<div class="sh" role="dialog" aria-modal="true" aria-label="Opciones del proyecto"><h2>${p ? nm(p) : 'Proyecto'}</h2><button class="rowb" data-a="pedit">Editar nombre y emoji</button><button class="rowb" data-a="states">Editar estados</button><button class="rowb" data-a="csv">Exportar iniciativas (Excel / CSV)</button><button class="rowb dng" data-a="pdel">Eliminar proyecto</button></div>`;
    case 'init': return initSheet();
    case 'block': return blockSheet();
    case 'states': return `<div class="sh wide" role="dialog" aria-modal="true" aria-label="Estados"><h2>Estados del proyecto</h2><p class="mut small">Ordená, renombrá, cambiá colores o sumá estados. Marcá «Terminado» en los que cierran una iniciativa.</p>${tagEditor('states', curP)}<button class="btn" data-a="close" style="margin-top:16px">Listo</button></div>`;
    case 'color': { const e = D()[s.k][s.id]; if (!e) return '';
      return `<div class="sh" role="dialog" aria-modal="true" aria-label="Color"><h2>Color de «${esc(e.n)}»</h2><div class="cgrid">${COLORS.map(c => `<button class="cs c-${c}" data-a="setcol" data-c="${c}" aria-pressed="${e.col === c}"><span>${esc(e.n)}</span><small>${COLN[c]}</small></button>`).join('')}</div><button class="btn ghost" data-a="close">Cancelar</button></div>`; }
    case 'name': return `<form id="sf" novalidate class="sh" data-f="name" role="dialog" aria-modal="true" aria-label="Tu nombre"><h2>¿Cómo te llamamos?</h2><input id="sn" class="in" type="text" maxlength="30" value="${esc(D().name || '')}" placeholder="Tu nombre o apodo" autocomplete="off" autocapitalize="words" aria-label="Tu nombre"><button class="btn" type="submit" style="margin-top:14px">Guardar</button><button class="btn ghost" type="button" data-a="close">Cancelar</button></form>`;
  }
  return '';
}
function renderSheet() {
  const root = $('#ov-root'), keep = root.querySelector('.sh')?.scrollTop || 0;
  root.innerHTML = '';
  if (!sheet) return;
  const o = document.createElement('div');
  o.className = 'ov'; o.innerHTML = sheetHtml();
  const d = o.firstElementChild;
  if (!d) { sheet = null; return; }
  const t0 = now();     // en pantallas táctiles, el mismo toque que abrió la ventana no la cierra
  o.addEventListener('mousedown', e => { if (e.target === o && now() - t0 > 450) closeSheet(); });
  root.append(o);
  d.scrollTop = keep;
  const f = sheet.focus && d.querySelector(sheet.focus);
  sheet.focus = '';
  if (f) f.focus();
  else if (['newproj', 'name'].includes(sheet.t)) d.querySelector('#sn')?.focus();
  else { d.tabIndex = -1; d.focus({ preventScroll: true }); }
}
function openSheet(s) { sheet = s; renderSheet(); }
/* Cerrar vuelve a la ventana anterior si la hay (por ejemplo, de un plazo a su iniciativa). */
function closeSheet() { sheet = sheet && sheet.back ? sheet.back : null; renderSheet(); if (!sheet) { if (view === 'projects') render(); else paint(); } }
function markEmo() { const v = ($('#se') || {}).value || ''; $$('.egrid button[data-e]').forEach(b => { if (b.dataset.e) b.setAttribute('aria-pressed', String(b.dataset.e === v)); }); }
function toast(msg, label, fn) {
  const root = $('#t-root'); root.innerHTML = '';
  const d = document.createElement('div'); d.id = 't'; d.setAttribute('role', 'status'); d.append(document.createTextNode(msg));
  if (label && fn) { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { root.innerHTML = ''; fn(); }; d.append(b); }
  root.append(d);
  clearTimeout(toast.t); toast.t = setTimeout(() => { root.innerHTML = ''; }, label ? 6000 : 3200);
}
function ask(msg, sub, yes, fn) { sheet = { t: 'ask', msg, sub, yes, fn, back: sheet }; renderSheet(); }

/* Borradores: se leen del formulario antes de volver a dibujar la ventana */
function readInit() { const x = sheet.draft; const v = id => ($('#' + id) || {}).value; if ($('#in')) Object.assign(x, { n: v('in'), dl: v('idl') || '', st: v('ist') || '', p: v('ipr') || '', ln: v('iln') || '', no: v('ino') || '' }); }
function readBlock() { const x = sheet.draft; const v = id => ($('#' + id) || {}).value; if ($('#bs')) Object.assign(x, { in: v('bin') ?? x.in, lb: v('blb') || '', s: v('bs') || '', e: v('be') || '' }); }
function openInit(id) {
  const i = D().inits[id]; if (!i || i.del) return;
  openSheet({ t: 'init', draft: { id: i.id, n: i.n, dl: i.dl, st: i.st, p: i.p, ln: i.ln, no: i.no } });
}
const DEF_LEN = { d: 5, w: 7, q: 14, m: 30 };
function openNewBlock(o, back) {
  const p = P(); if (!p) return;
  const lt = teamOf(L.lastTeam[p.id]) ? L.lastTeam[p.id] : (teamsOf(p.id)[0]?.id || '');
  const s = o.s || today(), e = o.e || addD(s, (DEF_LEN[p.g] || 7) - 1);
  openSheet({ t: 'block', fixIn: !!o.fixIn, back, draft: { id: '', in: o.in || '', tm: o.tm !== undefined ? o.tm : lt, lb: '', s, e } });
}
function openBlock(id, back) {
  const b = D().blocks[id]; if (!b || b.del) return;
  openSheet({ t: 'block', back, draft: { id: b.id, in: b.in, tm: b.tm, lb: b.lb, s: b.s, e: b.e } });
}

/* ---------- Envíos de formularios ---------- */
function submitSheet() {
  const s = sheet; if (!s) return;
  const f = $('#sf')?.dataset.f;
  if (f === 'proj') {
    const n = $('#sn').value.trim(), e = $('#se').value;
    if (!n) { $('#sn').focus(); return; }
    if (s.t === 'newproj') { const p = newProject(n, e); touch(); sheet = null; openProject(p.id); toast('Proyecto creado. Empezá cargando iniciativas ✍️'); return; }
    const p = P(); if (p) { upd('projects', p.id, { n: n.slice(0, 80), e: firstEmoji(e) }); touch(); }
    sheet = null; render(); return;
  }
  if (f === 'name') { const n = $('#sn').value.trim().slice(0, 30); D().name = n; D().nameU = now(); touch(); sheet = null; render(); return; }
  if (f === 'init') {
    readInit(); const x = s.draft;
    x.n = x.n.trim();
    if (!x.n) { s.err = 'Escribí un nombre'; s.focus = '#in'; renderSheet(); return; }
    if (x.ln && !/^https?:\/\/\S+$/i.test(x.ln.trim())) { s.err = 'El enlace tiene que empezar con https://'; s.focus = '#iln'; renderSheet(); return; }
    if (x.id) upd('inits', x.id, { n: x.n, dl: x.dl, st: x.st, p: x.p, ln: x.ln.trim(), no: x.no });
    else newInit(curP, { n: x.n, dl: x.dl, st: x.st, p: x.p, ln: x.ln.trim(), no: x.no });
    touch(); sheet = null; render(); return;
  }
  if (f === 'block') {
    readBlock(); const x = s.draft;
    if (s.newTeam && $('#bnt')?.value.trim()) addTeamFromSheet();
    if (!x.in || !D().inits[x.in]) { s.err = 'Elegí una iniciativa'; renderSheet(); return; }
    if (!x.s || !x.e) { s.err = 'Completá las dos fechas'; renderSheet(); return; }
    if (x.e < x.s) [x.s, x.e] = [x.e, x.s];
    if (x.id) upd('blocks', x.id, { in: x.in, tm: x.tm, lb: x.lb.trim(), s: x.s, e: x.e });
    else put('blocks', { pr: curP, in: x.in, tm: x.tm, lb: x.lb.trim(), s: x.s, e: x.e });
    if (x.tm) { L.lastTeam[curP] = x.tm; saveL(); }
    touch();
    if (s.back && s.back.t === 'init') { sheet = s.back; renderSheet(); paint(); return; }
    sheet = null; render(); return;
  }
}
function addTeamFromSheet() {
  const inp = $('#bnt'); const n = inp ? inp.value.trim() : '';
  if (!n) { inp?.focus(); return; }
  readBlock();
  const t = addTag('teams', curP, n); touch();
  sheet.draft.tm = t.id; sheet.newTeam = false; renderSheet();
}

/* ---------- Roadmap: arrastrar ---------- */
let drag = null;
const tip = $('#tip');
function showTip(e, txt) { tip.hidden = false; tip.textContent = txt; tip.style.left = Math.min(innerWidth - 220, e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 18) + 'px'; }
function hideTip() { tip.hidden = true; }
const dayAt = (rt, x, T) => Math.floor((x - rt.getBoundingClientRect().left) / T.dw);
const rangeTxt = (a, b) => `${dm(a)} → ${dm(b)} · ${dn(b) - dn(a) + 1} ${dn(b) - dn(a) ? 'días' : 'día'}`;
function autoScroll(e) {
  const rm = $('#rm'); if (!rm) return;
  const r = rm.getBoundingClientRect(), lw = parseFloat(getComputedStyle(rm).getPropertyValue('--lw')) || 0;
  if (e.clientX > r.right - 40) rm.scrollLeft += 14;
  else if (e.clientX < r.left + lw + 30) rm.scrollLeft -= 14;
}
document.addEventListener('pointerdown', e => {
  const rt = e.target.closest('#rm .rb .rt'); if (!rt) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const p = P(), T = tl(p), row = rt.parentElement, blk = e.target.closest('.blk');
  if (blk) {
    const b = D().blocks[blk.dataset.b]; if (!b) return;
    const mode = e.target.classList.contains('hl') ? 'l' : e.target.classList.contains('hr') ? 'r' : 'm';
    drag = { kind: 'blk', mode, b, el: blk, rt, T, x0: e.clientX, day0: dayAt(rt, e.clientX, T), s0: b.s, e0: b.e, ns: b.s, ne: b.e, moved: false };
    blk.setPointerCapture(e.pointerId); e.preventDefault();
    return;
  }
  const day = dayAt(rt, e.clientX, T);
  if (e.pointerType !== 'mouse') { drag = { kind: 'tap', row: row.dataset.row, rk: row.dataset.k, day, x0: e.clientX, y0: e.clientY, T }; return; }
  const g = document.createElement('i'); g.className = 'dghost';
  drag = { kind: 'new', row: row.dataset.row, rk: row.dataset.k, a: day, b: day, rt, T, x0: e.clientX, g, moved: false };
  rt.setPointerCapture(e.pointerId); e.preventDefault();
});
document.addEventListener('pointermove', e => {
  const d = drag; if (!d) return;
  if (d.kind === 'tap') { if (Math.abs(e.clientX - d.x0) + Math.abs(e.clientY - d.y0) > 10) drag = null; return; }
  if (!d.moved && Math.abs(e.clientX - d.x0) < 4) return;
  if (!d.moved) { d.moved = true; dragging = true; document.body.classList.add('dragging'); if (d.kind === 'new') d.rt.append(d.g); else d.el.classList.add('on'); }
  autoScroll(e);
  const T = d.T, day = dayAt(d.rt, e.clientX, T);
  if (d.kind === 'blk') {
    const dd = day - d.day0; let s = dn(d.s0), en = dn(d.e0);
    if (d.mode === 'm') { s += dd; en += dd; } else if (d.mode === 'l') s = Math.min(s + dd, en); else en = Math.max(en + dd, s);
    d.ns = fromDn(s); d.ne = fromDn(en);
    d.el.style.left = (s - T.d0) * T.dw + 'px'; d.el.style.width = (en - s + 1) * T.dw + 'px';
    showTip(e, rangeTxt(d.ns, d.ne));
  } else {
    d.b = Math.max(0, Math.min(T.n - 1, day));
    const a = Math.min(d.a, d.b), b = Math.max(d.a, d.b);
    d.g.style.left = a * T.dw + 'px'; d.g.style.width = (b - a + 1) * T.dw + 'px';
    showTip(e, rangeTxt(fromDn(T.d0 + a), fromDn(T.d0 + b)));
  }
});
function endDrag(e, cancel) {
  const d = drag; drag = null; hideTip(); document.body.classList.remove('dragging');
  setTimeout(() => { dragging = false; }, 0);
  if (!d || cancel) { if (d && d.g) d.g.remove(); if (d && d.kind === 'blk') paint(); return; }
  const T = d.T, p = P();
  const preset = d.rk === 'i' ? { in: d.row, fixIn: true } : { tm: d.row };
  if (d.kind === 'tap') { openNewBlock({ ...preset, s: fromDn(T.d0 + d.day) }); return; }
  if (d.kind === 'blk') {
    if (!d.moved) { openBlock(d.b.id); return; }
    if (d.ns !== d.s0 || d.ne !== d.e0) { upd('blocks', d.b.id, { s: d.ns, e: d.ne }); touch(); }
    paint(); return;
  }
  d.g.remove();
  if (!d.moved) { openNewBlock({ ...preset, s: fromDn(T.d0 + d.a) }); return; }
  const a = Math.min(d.a, d.b), b = Math.max(d.a, d.b);
  /* En la vista por equipo, si hay una sola iniciativa no hace falta preguntar */
  if (d.rk === 't' && p && initsOf(p.id).length === 1) preset.in = initsOf(p.id)[0].id;
  openNewBlock({ ...preset, s: fromDn(T.d0 + a), e: fromDn(T.d0 + b) });
}
document.addEventListener('pointerup', e => endDrag(e));
document.addEventListener('pointercancel', e => endDrag(e, true));
/* Teclado: flechas mueven el plazo un día; Mayús + flechas cambian el final */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (rdrag) { endSort(true); return; } if (drag) { endDrag(e, true); return; } if (sheet) { closeSheet(); return; } if (onb >= 0) { closeOnb(); return; } if (full) { setFull(false); return; } }
  const blk = e.target.closest?.('.blk'); if (!blk || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  e.preventDefault();
  const b = D().blocks[blk.dataset.b]; if (!b) return;
  const k = e.key === 'ArrowLeft' ? -1 : 1;
  if (e.shiftKey) { const ne = addD(b.e, k); if (ne >= b.s) upd('blocks', b.id, { e: ne }); }
  else upd('blocks', b.id, { s: addD(b.s, k), e: addD(b.e, k) });
  touch(); paint();
  $(`.blk[data-b="${CSS.escape(b.id)}"]`)?.focus();
});

/* ---------- Cuenta ---------- */
function wipeLocal(keepEmail) { S = { email: keepEmail ? S.email : '', token: '', server: S.server, data: emptyState(), dirty: false }; curP = ''; save(); }
async function doAuth() {
  if (busy) return;
  const em = authEmail.trim().toLowerCase(), pw = authPass;
  if (!CFG.API_URL) {
    const sv = $('[data-au=server]'), url = sv ? sv.value.trim() : S.server;
    if (!/^https?:\/\/\S+$/i.test(url)) { authErr = 'Pegá la URL del servidor (empieza con https://)'; render(); return; }
    S.server = url; save();
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { authErr = 'Ingresá un email válido'; render(); return; }
  if (authMode === 'signup' && pw.length < 8) { authErr = 'La contraseña debe tener al menos 8 caracteres'; render(); return; }
  if (!pw) { authErr = 'Ingresá tu contraseña'; render(); return; }
  busy = true; authErr = ''; render();
  try {
    const r = await api('/' + authMode, { method: 'POST', body: JSON.stringify({ email: em, password: pw }) });
    if (S.email && S.email !== em) { S.data = emptyState(); S.dirty = false; }
    S.email = em; S.token = r.token; authPass = ''; save();
    if (authMode === 'signup') { S.dirty = true; const n = authName.trim().slice(0, 30); if (n) { D().name = n; D().nameU = now(); } save(); L.onb = 0; onb = -1; saveL(); }
    await sync(); busy = false; startView(); return;
  } catch (e) { authErr = e.message; }
  busy = false; render();
}
function startView() {
  const last = D().last;
  if (last && proj(last)) { curP = last; go('project'); } else go('projects');
}
async function logout() {
  if (S.dirty) { toast('Sincronizando antes de salir…'); await sync(); }
  if (S.dirty) { sheet = null; renderSheet(); toast('Hay cambios sin subir. Conectate e intentá de nuevo.'); return; }
  wipeLocal(true); authEmail = S.email; authPass = ''; authName = ''; authErr = ''; authMode = 'login'; go('auth');
}
async function deleteAccount() {
  try { await api('/account', { method: 'DELETE' }); } catch (e) { sheet = null; renderSheet(); toast(e.net ? 'Sin conexión: no se pudo eliminar la cuenta' : e.message); return; }
  wipeLocal(false); authEmail = ''; authPass = ''; authErr = ''; authMode = 'signup'; go('auth'); toast('Cuenta eliminada');
}
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function exportData() {
  const out = { exportado: new Date().toISOString(), proyectos: projects().map(p => ({
    nombre: p.n, emoji: p.e, estados: statesOf(p.id).map(s => ({ nombre: s.n, color: s.col, terminado: s.dn })), equipos: teamsOf(p.id).map(t => ({ nombre: t.n, color: t.col })),
    iniciativas: sortedInits(p).map(i => ({ nombre: i.n, deadline: i.dl, estado: stateOf(i.st)?.n || '', prioridad: PRIO[i.p].n, enlace: i.ln, notas: i.no,
      plazos: blocksOf(p.id).filter(b => b.in === i.id).map(b => ({ equipo: teamOf(b.tm)?.n || '', etiqueta: b.lb, desde: b.s, hasta: b.e })) }))
  })) };
  download(`trazo-${today()}.json`, JSON.stringify(out, null, 2), 'application/json');
}
function exportCsv() {
  const p = P(); if (!p) return;
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Iniciativa', 'Deadline', 'Estado', 'Prioridad', 'Enlace', 'Notas', 'Plazos por equipo']];
  sortedInits(p).forEach(i => rows.push([i.n, i.dl, stateOf(i.st)?.n || '', i.p ? PRIO[i.p].n : '', i.ln, i.no,
    blocksOf(p.id).filter(b => b.in === i.id).sort((a, b) => a.s.localeCompare(b.s)).map(b => `${teamOf(b.tm)?.n || 'Sin equipo'}${b.lb ? ' (' + b.lb + ')' : ''}: ${b.s} a ${b.e}`).join(' | ')]));
  download(`${p.n.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'proyecto'}-${today()}.csv`, '﻿' + rows.map(r => r.map(q).join(';')).join('\r\n'), 'text/csv');
}

/* ---------- Acciones (clics) ---------- */
const A = {
  am(b) { authMode = b.dataset.m; authErr = ''; render(); },
  go(b) { go(b.dataset.v); },
  newproj() { openSheet({ t: 'newproj' }); },
  sample() { const p = sampleProject(); L.tab[p.id] = 'plan'; saveL(); openProject(p.id); toast('Proyecto de ejemplo creado. Probá arrastrar los plazos.'); },
  openp(b) { sheet = null; openProject(b.dataset.id); },
  pswitch() { openSheet({ t: 'pswitch' }); },
  pmenu() { openSheet({ t: 'pmenu' }); },
  pcmenu(b) { if (!proj(b.dataset.id)) return; curP = b.dataset.id; openSheet({ t: 'pmenu' }); },
  full() { setFull(!full); },
  pedit() { openSheet({ t: 'editproj' }); },
  pdel() {
    const p = P(); if (!p) return;
    ask(`¿Eliminar «${p.n}»?`, 'Se borran sus iniciativas, equipos, estados y plazos.', 'Sí, eliminar proyecto', () => {
      const u = now();
      for (const k of ['states', 'teams', 'inits', 'blocks']) live(D()[k]).filter(x => x.pr === p.id).forEach(x => { x.del = true; x.u = u; });
      p.del = true; p.u = u; touch(); curP = ''; go('projects'); toast('Proyecto eliminado');
    });
  },
  csv() { sheet = null; renderSheet(); exportCsv(); },
  pe(b) { $('#se').value = b.dataset.e; markEmo(); },
  ptab(b) { const p = P(); if (!p) return; L.tab[p.id] = b.dataset.t; saveL(); sheet = null; render(); },
  dwn(b) { L.dw = L.dw || {}; L.dw[curP] = +b.dataset.v; saveL(); paint(); },
  dwnav(b) { L.do = L.do || {}; const v = +b.dataset.v; L.do[curP] = v ? (L.do[curP] || 0) + v * (L.dw?.[curP] || 8) : 0; saveL(); paint(); },
  flt(b) { L.flt[curP] = b.dataset.v; saveL(); render(); },
  states() { openSheet({ t: 'states' }); },
  iopen(b) { if (dragging) return; openInit(b.dataset.id); },
  iplan(b) { const p = P(); L.tab[p.id] = 'plan'; if (p.gb === 't') { p.gb = 'i'; p.u = now(); touch(); } saveL(); render(); openNewBlock({ in: b.dataset.id, fixIn: true }); },
  idel() {
    const id = sheet.draft.id, n = D().inits[id]?.n || '';
    ask(`¿Eliminar «${n}»?`, 'También se eliminan sus plazos del roadmap.', 'Sí, eliminar', () => { const undo = delInit(id); sheet = null; render(); toast('Iniciativa eliminada', 'Deshacer', undo); });
  },
  badd() { readInit(); const back = sheet; openNewBlock({ in: back.draft.id, fixIn: true }, back); },
  bopen(b) { readInit(); openBlock(b.dataset.id, sheet); },
  bteam(b) { readBlock(); sheet.draft.tm = sheet.draft.tm === b.dataset.id ? '' : b.dataset.id; renderSheet(); },
  bteamnew() { readBlock(); sheet.newTeam = true; sheet.focus = '#bnt'; renderSheet(); },
  bteamadd() { addTeamFromSheet(); },
  bdel() {
    const id = sheet.draft.id, back = sheet.back;
    const b = D().blocks[id]; if (!b) return;
    b.del = true; b.u = now(); touch();
    sheet = back && back.t === 'init' ? back : null; renderSheet(); if (sheet) paint(); else render();
    toast('Plazo eliminado', 'Deshacer', () => { b.del = false; b.u = now(); touch(); render(); });
  },
  gran(b) { const p = P(); upd('projects', p.id, { g: b.dataset.v }); touch(); render(); },
  gb(b) { const p = P(); upd('projects', p.id, { gb: b.dataset.v }); touch(); render(); },
  gbteam() { const p = P(); upd('projects', p.id, { gb: 't' }); L.tab[p.id] = 'plan'; saveL(); touch(); render(); },
  rmnav(b) { const p = P(); upd('projects', p.id, { vs: addM(tl(p).vs, +b.dataset.v) }); touch(); render(); },
  rmtoday() { const p = P(); upd('projects', p.id, { vs: ymOf(today()) }); touch(); scrollKeep = null; render(); },
  pickcol(b) { openSheet({ t: 'color', k: b.dataset.k, id: b.dataset.id, back: sheet }); },
  setcol(b) { const s = sheet; upd(s.k, s.id, { col: b.dataset.c }); touch(); sheet = s.back; renderSheet(); render(); },
  tgmv(b) { moveTag(b.dataset.k, b.dataset.id, +b.dataset.v); refreshTags(); },
  tgdel(b) {
    const k = b.dataset.k, e = D()[k][b.dataset.id]; if (!e) return;
    if (k === 'states') {
      const others = statesOf(e.pr).filter(x => x.id !== e.id);
      if (!others.length) { toast('Tiene que quedar al menos un estado'); return; }
      const n = initsOf(e.pr).filter(i => i.st === e.id).length;
      ask(`¿Eliminar el estado «${e.n}»?`, n ? `${n} ${n === 1 ? 'iniciativa pasa' : 'iniciativas pasan'} a «${others[0].n}».` : '', 'Sí, eliminar', () => {
        const u = now(); initsOf(e.pr).filter(i => i.st === e.id).forEach(i => { i.st = others[0].id; i.u = u; });
        if (L.flt[e.pr] === e.id) { L.flt[e.pr] = ''; saveL(); }
        e.del = true; e.u = u; touch(); sheet = sheet.back; renderSheet(); render();
      });
    } else {
      const n = blocksOf(e.pr).filter(x => x.tm === e.id).length;
      ask(`¿Eliminar «${e.n}»?`, n ? `Sus ${n} ${n === 1 ? 'plazo queda' : 'plazos quedan'} como «Sin equipo».` : '', 'Sí, eliminar', () => {
        const u = now(); blocksOf(e.pr).filter(x => x.tm === e.id).forEach(x => { x.tm = ''; x.u = u; });
        e.del = true; e.u = u; touch(); sheet = sheet.back; renderSheet(); render();
      });
    }
  },
  editname() { openSheet({ t: 'name' }); },
  syncnow() { if (!S.dirty) S.dirty = true; sync().then(ok => toast(ok ? 'Sincronizado ✓' : 'No se pudo sincronizar')); },
  theme(b) { L.theme = b.dataset.v; saveL(); applyTheme(); render(); },
  install() { if (installEvt) { installEvt.prompt(); installEvt = null; render(); } },
  onbshow() { onb = 0; obKey = ''; paintOnb(); },
  export() { exportData(); },
  logout() { logout(); },
  delacc() { ask('¿Eliminar tu cuenta?', 'Se borran tu cuenta y todos tus proyectos, en todos tus dispositivos. No se puede deshacer.', 'Sí, eliminar todo', deleteAccount); },
  yes() { const f = sheet.fn; f(); },
  close() { closeSheet(); },
  onext() { if (onb < ONB.length - 1) { onb++; paintOnb(); } else closeOnb(); },
  oback() { if (onb > 0) { onb--; paintOnb(); } },
  oskip() { closeOnb(); },
  ofirst() { closeOnb(); openSheet({ t: 'newproj' }); },
  osample() { closeOnb(); A.sample(); }
};
/* ---------- Ordenar iniciativas (arrastrar el agarre ⋮⋮, o flechas arriba/abajo) ---------- */
/* `vis` es el orden visible después del cambio; se integra al orden completo (respeta filtros) y pasa a "Orden manual". */
function applyOrder(id, vis) {
  const p = P(); if (!p) return;
  const full = sortedInits(p).map(i => i.id).filter(x => x !== id), k = vis.indexOf(id);
  const next = vis[k + 1], prev = vis[k - 1];
  let at = next ? full.indexOf(next) : prev ? full.indexOf(prev) + 1 : 0;
  if (at < 0) at = full.length;
  full.splice(at, 0, id);
  const u = now();
  full.forEach((x, n) => { const i = D().inits[x]; if (i.o !== n + 1) { i.o = n + 1; i.u = u; } });
  if ((L.sort[p.id] || 'manual') !== 'manual') { L.sort[p.id] = 'manual'; saveL(); toast('Orden cambiado a «Orden manual»'); }
  touch(); render();
}
let rdrag = null;
document.addEventListener('pointerdown', e => {
  const g = e.target.closest('.grip'); if (!g) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const row = g.closest('[data-rid]'), box = row.parentElement;
  const rows = [...box.children].filter(x => x.dataset.rid);
  const b0 = box.getBoundingClientRect().top;
  const rects = rows.map(r => { const b = r.getBoundingClientRect(); return { top: b.top - b0, h: b.height }; });
  const idx = rows.indexOf(row);
  rdrag = { row, rows, rects, box, idx, to: idx, y0: e.clientY - b0, moved: false, g };
  g.setPointerCapture(e.pointerId); e.preventDefault();
});
document.addEventListener('pointermove', e => {
  const d = rdrag; if (!d) return;
  const rel = e.clientY - d.box.getBoundingClientRect().top, dy = rel - d.y0;
  if (!d.moved && Math.abs(dy) < 4) return;
  if (!d.moved) { d.moved = true; dragging = true; document.body.classList.add('sorting'); d.row.classList.add('lift'); }
  const me = d.rects[d.idx], c = me.top + me.h / 2 + dy;
  let to = d.idx;
  for (let i = d.idx + 1; i < d.rows.length; i++) if (c > d.rects[i].top + d.rects[i].h / 2) to = i;
  for (let i = d.idx - 1; i >= 0; i--) if (c < d.rects[i].top + d.rects[i].h / 2) to = i;
  d.to = to;
  d.rows.forEach((r, i) => { if (r === d.row) return; r.style.transform = d.idx < i && i <= to ? `translateY(${-me.h}px)` : to <= i && i < d.idx ? `translateY(${me.h}px)` : ''; });
  d.row.style.transform = `translateY(${dy}px)`;
  /* desplazar la pantalla (o el roadmap) cerca de los bordes */
  const sc = d.box.closest('#rm');
  if (sc) { const r = sc.getBoundingClientRect(); if (e.clientY > r.bottom - 40) sc.scrollTop += 12; else if (e.clientY < r.top + 70) sc.scrollTop -= 12; }
  else if (e.clientY > innerHeight - 60) scrollBy(0, 14); else if (e.clientY < 90) scrollBy(0, -14);
});
function endSort(cancel) {
  const d = rdrag; rdrag = null; if (!d) return;
  document.body.classList.remove('sorting');
  setTimeout(() => { dragging = false; }, 0);
  d.rows.forEach(r => { r.style.transform = ''; r.classList.remove('lift'); });
  if (cancel || !d.moved || d.to === d.idx) return;
  const vis = d.rows.map(r => r.dataset.rid), [m] = vis.splice(d.idx, 1);
  vis.splice(d.to, 0, m);
  applyOrder(m, vis);
}
document.addEventListener('pointerup', () => endSort());
document.addEventListener('pointercancel', () => endSort(true));
document.addEventListener('keydown', e => {
  const g = e.target.closest?.('.grip'); if (!g || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
  e.preventDefault();
  const row = g.closest('[data-rid]'), vis = [...row.parentElement.children].filter(x => x.dataset.rid).map(x => x.dataset.rid);
  const i = vis.indexOf(g.dataset.g), j = i + (e.key === 'ArrowUp' ? -1 : 1);
  if (j < 0 || j >= vis.length) return;
  [vis[i], vis[j]] = [vis[j], vis[i]];
  applyOrder(g.dataset.g, vis);
  $(`.grip[data-g="${CSS.escape(g.dataset.g)}"]`)?.focus();
});
function refreshTags() { if (sheet && sheet.t === 'states') renderSheet(); else render(); }
document.addEventListener('click', e => {
  const blk = e.target.closest('.blk');
  if (blk && e.detail === 0) { openBlock(blk.dataset.b); return; }     // Enter o espacio sobre un plazo
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
  const f = A[b.dataset.a]; if (f) { e.preventDefault(); f(b); }
});
document.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  if (f.id === 'af') { doAuth(); return; }
  if (f.id === 'sf') { submitSheet(); return; }
  if (f.id === 'addi') {
    const n = $('#ain').value.trim(); if (!n) { $('#ain').focus(); return; }
    const p = P();
    const i = newInit(p.id, { n: n.slice(0, 160), dl: $('#adl').value || '', st: $('#ast').value, p: $('#apr').value || '' });
    touch();
    if (L.flt[p.id] && L.flt[p.id] !== i.st) { L.flt[p.id] = ''; saveL(); }
    const keep = { st: $('#ast').value, p: $('#apr').value };
    render();
    $('#ast').value = keep.st; $('#apr').value = keep.p; $('#ain').focus();
    toast(`«${n}» agregada`);
    return;
  }
  if (f.classList.contains('tga')) {
    const inp = f.querySelector('input'), k = f.dataset.k, n = inp.value.trim();
    if (!n) { inp.focus(); return; }
    addTag(k, curP, n); touch();
    if (sheet && sheet.t === 'states') { sheet.focus = '.tga input'; renderSheet(); } else { render(); $('.tga input')?.focus(); }
  }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.au) { if (t.dataset.au === 'email') authEmail = t.value; else if (t.dataset.au === 'pass') authPass = t.value; else if (t.dataset.au === 'name') authName = t.value; }
  if (t.id === 'se') markEmo();
});
document.addEventListener('change', e => {
  const t = e.target, ch = t.dataset.ch; if (!ch) return;
  const p = P(); if (!p) return;
  const id = t.dataset.id;
  if (ch === 'sort') { L.sort[p.id] = t.value; saveL(); render(); return; }
  if (ch === 'vn') { upd('projects', p.id, { vn: +t.value }); touch(); render(); return; }
  if (ch === 'dl') { upd('inits', id, { dl: t.value || '' }); touch(); paint(); return; }
  if (ch === 'p') { upd('inits', id, { p: t.value }); touch(); paint(); return; }
  if (ch === 'st') {
    if (t.value === '__edit') { t.value = D().inits[id]?.st || ''; openSheet({ t: 'states' }); return; }
    upd('inits', id, { st: t.value }); touch(); render(); return;
  }
  if (ch === 'tgn') { const v = t.value.trim().slice(0, 40); if (!v) { t.value = D()[t.dataset.k][id]?.n || ''; return; } upd(t.dataset.k, id, { n: v }); touch(); if (!sheet) render(); return; }
  if (ch === 'tgcap') { const v = Math.min(99, Math.max(1, Math.round(+t.value) || 2)); t.value = v; upd('teams', id, { cap: v }); touch(); if (!sheet) render(); return; }
  if (ch === 'tgdn') { upd('states', id, { dn: t.checked }); touch(); return; }
});
/* Las fechas del plazo actualizan el contador de días sin perder lo escrito */
document.addEventListener('input', e => { if (sheet && sheet.t === 'block' && ['bs', 'be'].includes(e.target.id)) { readBlock(); const x = sheet.draft, el = $('#sf .two + .mut'); if (el) el.textContent = x.s && x.e && x.e >= x.s ? `${dn(x.e) - dn(x.s) + 1} días` : ''; } });

/* ---------- Ciclo de vida ---------- */
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.token) sync(); });
window.addEventListener('online', () => { if (S.token) sync(); });
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (view === 'set') render(); });
setInterval(() => { if (document.visibilityState === 'visible' && S.token && !sheet && !dragging) sync(); }, 45000);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });

remoteSig = JSON.stringify(S.data);
if (S.token) {
  if (!navigator.onLine) st = 'off';
  startView();
  sync();
} else render();
hideSplash();
})();
