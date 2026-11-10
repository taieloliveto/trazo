// Servidor de Trazo (Cloudflare Worker): cuentas, sesión y sincronización. Mismo esquema que Foco y Compras.
import { mergeState, sanitizeState, shOk, emailOk } from './merge.js';

/* ---------- Compartir ---------- */
const SCOPED = ['states', 'teams', 'inits', 'blocks', 'sprints', 'dailies', 'alerts'];
/* Clave del link de visualización de un proyecto (los datos nuevos viven en `shares`; los viejos en el proyecto) */
const viewTok = (d, p) => d.shares[p.id] ? d.shares[p.id].sh : p.sh;
/* Datos de un solo proyecto. Con tumbas (para quien edita) o sin ellas (para quien mira). */
function scoped(d, p, withDel) {
  const pick = k => Object.fromEntries(Object.entries(d[k]).filter(([, x]) => x.pr === p.id && (withDel || !x.del)));
  const out = { projects: { [p.id]: p } };
  for (const k of SCOPED) out[k] = pick(k);
  return out;
}
async function ownerData(env, e) {
  const key = 'user:' + e, raw = await env.KV.get(key);
  if (!raw) return null;
  const u = JSON.parse(raw);
  return { key, u, d: sanitizeState(u.data) };
}
/* Acceso de edición: link de editor (cualquiera) o invitación a un email (hay que entrar con esa cuenta). */
async function editCtx(env, tok, email) {
  if (!shOk(tok)) return { err: 404 };
  const raw = await env.KV.get('edit:' + tok);
  if (!raw) return { err: 404 };
  const { e, who } = JSON.parse(raw);
  if (who && who !== email) return { err: email ? 403 : 401, who };
  const o = await ownerData(env, e);
  if (!o) return { err: 404 };
  const p = Object.values(o.d.projects).find(x => {
    if (x.del) return false;
    const sh = o.d.shares[x.id];
    return sh && (who ? sh.eds.some(y => y.k === tok && y.m === who) : sh.se === tok);
  });
  if (!p) return { err: 404 };
  return { ...o, p, who, owner: e };
}
async function invList(env, m) { try { return JSON.parse((await env.KV.get('inv:' + m)) || '[]'); } catch (_) { return []; } }

const TOKEN_TTL = 60 * 86400;        // las sesiones duran 60 días
const MAX_BODY = 1500000;            // bytes por sincronización

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64u(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64uToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
function safeEq(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function hashPass(pw, saltB64) {
  const salt = saltB64 ? Uint8Array.from(atob(saltB64), c => c.charCodeAt(0)) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  return { salt: btoa(String.fromCharCode(...salt)), hash: btoa(String.fromCharCode(...new Uint8Array(bits))) };
}

async function hmac(msg, secret) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
async function makeToken(email, env) {
  const p = b64u(enc.encode(JSON.stringify({ e: email, x: Math.floor(Date.now() / 1000) + TOKEN_TTL })));
  return p + '.' + await hmac(p, env.SERVER_SECRET);
}
async function verifyToken(token, env) {
  if (!token) return null;
  const [p, sig] = token.split('.');
  if (!p || !sig) return null;
  if (!safeEq(await hmac(p, env.SERVER_SECRET), sig)) return null;
  try {
    const o = JSON.parse(dec.decode(b64uToBytes(p)));
    return o.x > Date.now() / 1000 && typeof o.e === 'string' ? o.e : null;
  } catch (_) { return null; }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const h = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'no-store',
      Vary: 'Origin'
    };
    const j = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...h, 'Content-Type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (!env.SERVER_SECRET) return j({ error: 'Falta configurar SERVER_SECRET en el servidor' }, 500);

    try {
      if (url.pathname === '/health') return j({ ok: true });

      if (url.pathname === '/signup' && req.method === 'POST') {
        const { email, password } = await req.json();
        const em = String(email || '').trim().toLowerCase();
        if (!EMAIL_RE.test(em) || em.length > 254) return j({ error: 'Ingresá un email válido' }, 400);
        if (typeof password !== 'string' || password.length < 8 || password.length > 200) return j({ error: 'La contraseña debe tener entre 8 y 200 caracteres' }, 400);
        if (await env.KV.get('user:' + em)) return j({ error: 'Ya existe una cuenta con ese email' }, 409);
        const { salt, hash } = await hashPass(password);
        await env.KV.put('user:' + em, JSON.stringify({ salt, hash, data: sanitizeState(null), createdAt: Date.now() }));
        return j({ token: await makeToken(em, env) });
      }

      if (url.pathname === '/login' && req.method === 'POST') {
        const { email, password } = await req.json();
        const em = String(email || '').trim().toLowerCase();
        const bad = () => j({ error: 'Email o contraseña incorrectos' }, 401);
        if (typeof password !== 'string' || password.length > 200) return bad();
        const raw = await env.KV.get('user:' + em);
        if (!raw) return bad();
        const u = JSON.parse(raw);
        const { hash } = await hashPass(password, u.salt);
        if (!safeEq(hash, u.hash)) return bad();
        return j({ token: await makeToken(em, env) });
      }

      /* Link público de solo lectura: devuelve únicamente ese proyecto, si sigue compartido. */
      if (url.pathname.startsWith('/public/') && req.method === 'GET') {
        const tok = url.pathname.slice(8);
        const gone = () => j({ error: 'Este link ya no está disponible' }, 404);
        if (!shOk(tok)) return gone();
        const sh = await env.KV.get('share:' + tok);
        if (!sh) return gone();
        const { e } = JSON.parse(sh);
        const raw = await env.KV.get('user:' + e);
        if (!raw) return gone();
        const d = sanitizeState(JSON.parse(raw).data);
        const p = Object.values(d.projects).find(x => !x.del && viewTok(d, x) === tok);
        if (!p) return gone();
        return j({ pr: p.id, at: Date.now(), data: scoped(d, p, false) });
      }

      /* Quien mira por link solo puede crear y escribir dailies de ese proyecto (no puede borrarlas ni tocar nada más). */
      if (/^\/public\/[A-Za-z0-9]+\/daily$/.test(url.pathname) && req.method === 'PUT') {
        const tok = url.pathname.split('/')[2];
        const gone = () => j({ error: 'Este link ya no está disponible' }, 404);
        if (!shOk(tok)) return gone();
        const body = await req.text();
        if (body.length > 300000) return j({ error: 'Demasiados datos' }, 413);
        const sh = await env.KV.get('share:' + tok);
        if (!sh) return gone();
        const key = 'user:' + JSON.parse(sh).e, raw = await env.KV.get(key);
        if (!raw) return gone();
        const u = JSON.parse(raw), d = sanitizeState(u.data);
        const p = Object.values(d.projects).find(x => !x.del && viewTok(d, x) === tok);
        if (!p) return gone();
        const inc = sanitizeState({ dailies: JSON.parse(body).dailies }).dailies, ok = {};
        for (const x of Object.values(inc)) {
          if (x.pr !== p.id) continue;
          const cur = d.dailies[x.id];
          if (cur && (cur.del || cur.pr !== p.id)) continue;
          ok[x.id] = { ...x, del: false };
        }
        const merged = mergeState(d, { dailies: ok });
        if (JSON.stringify(merged.dailies) !== JSON.stringify(d.dailies)) { u.data = merged; await env.KV.put(key, JSON.stringify(u)); }
        return j({ dailies: Object.fromEntries(Object.entries(merged.dailies).filter(([, x]) => x.pr === p.id && !x.del)) });
      }

      /* Pedido de permiso de edición desde el link de visualización */
      if (/^\/public\/[A-Za-z0-9]+\/request$/.test(url.pathname) && req.method === 'POST') {
        const tok = url.pathname.split('/')[2];
        const gone = () => j({ error: 'Este link ya no está disponible' }, 404);
        if (!shOk(tok)) return gone();
        const { m, n } = await req.json();
        const em = String(m || '').trim().toLowerCase();
        if (!emailOk(em)) return j({ error: 'Ingresá un email válido' }, 400);
        const sh = await env.KV.get('share:' + tok); if (!sh) return gone();
        const o = await ownerData(env, JSON.parse(sh).e); if (!o) return gone();
        const p = Object.values(o.d.projects).find(x => !x.del && viewTok(o.d, x) === tok); if (!p) return gone();
        const now = Date.now(), cur = o.d.shares[p.id] || { id: p.id, pr: p.id, sh: p.sh, se: '', eds: [], eU: now, rq: [], rqU: 0, c: now, u: now };
        if (cur.eds.some(x => x.m === em)) return j({ ok: true, already: true });
        const rq = [{ m: em, n: String(n || '').slice(0, 60), t: now }, ...cur.rq.filter(x => x.m !== em)].slice(0, 30);
        o.u.data = mergeState(o.d, { shares: { [p.id]: { ...cur, rq, rqU: now } } });
        await env.KV.put(o.key, JSON.stringify(o.u));
        return j({ ok: true });
      }

      const email = await verifyToken((req.headers.get('Authorization') || '').replace(/^Bearer /, ''), env);

      if (url.pathname === '/data' && req.method === 'GET') {
        if (!email) return j({ error: 'No autenticado' }, 401);
        const raw = await env.KV.get('user:' + email);
        if (!raw) return j({ error: 'No autenticado' }, 401);
        return j({ data: sanitizeState(JSON.parse(raw).data) });
      }

      if (url.pathname === '/data' && req.method === 'PUT') {
        if (!email) return j({ error: 'No autenticado' }, 401);
        const body = await req.text();
        if (body.length > MAX_BODY) return j({ error: 'Demasiados datos' }, 413);
        const incoming = JSON.parse(body).data;
        const raw = await env.KV.get('user:' + email);
        if (!raw) return j({ error: 'No autenticado' }, 401);
        const u = JSON.parse(raw);
        const before = JSON.stringify(sanitizeState(u.data));
        const merged = mergeState(u.data, incoming);
        // KV gratis permite pocas escrituras por día: solo se escribe si algo cambió.
        if (JSON.stringify(merged) !== before) {
          u.data = merged;
          await env.KV.put('user:' + email, JSON.stringify(u));
        }
        return j({ data: merged });
      }

      /* Edición de un proyecto ajeno (link de editor o invitación) */
      if (url.pathname.startsWith('/edit/') && (req.method === 'GET' || req.method === 'PUT')) {
        const c = await editCtx(env, url.pathname.slice(6), email);
        if (c.err === 404) return j({ error: 'Este link de edición ya no está disponible' }, 404);
        if (c.err) return j({ error: 'Este acceso es para ' + c.who, who: c.who }, c.err);
        if (req.method === 'GET') return j({ pr: c.p.id, at: Date.now(), who: c.who || '', data: scoped(c.d, c.p, true) });
        const body = await req.text();
        if (body.length > MAX_BODY) return j({ error: 'Demasiados datos' }, 413);
        const inc = sanitizeState(JSON.parse(body).data), ok = { projects: {} };
        const ip = inc.projects[c.p.id];
        if (ip) ok.projects[c.p.id] = { ...ip, sh: c.p.sh };          // nunca toca cómo se comparte
        for (const k of SCOPED) ok[k] = Object.fromEntries(Object.entries(inc[k]).filter(([, x]) => x.pr === c.p.id && (!c.d[k][x.id] || c.d[k][x.id].pr === c.p.id)));
        const merged = mergeState(c.d, ok);
        if (JSON.stringify(merged) !== JSON.stringify(c.d)) { c.u.data = merged; await env.KV.put(c.key, JSON.stringify(c.u)); }
        const mp = merged.projects[c.p.id];
        return j({ pr: c.p.id, at: Date.now(), data: mp && !mp.del ? scoped(merged, mp, true) : {} });
      }

      /* Proyectos que otras personas me compartieron para editar */
      if (url.pathname === '/invites' && req.method === 'GET') {
        if (!email) return j({ error: 'No autenticado' }, 401);
        const list = await invList(env, email), out = [];
        for (const x of list.slice(0, 50)) {
          const c = await editCtx(env, x.k, email);
          if (!c.err) out.push({ k: x.k, n: c.p.n, e: c.p.e, owner: c.d.name || c.owner.split('@')[0] });
        }
        return j({ invites: out });
      }

      if (url.pathname === '/share' && req.method === 'POST') {
        if (!email) return j({ error: 'No autenticado' }, 401);
        const { token, kind, who } = await req.json();
        if (!shOk(token)) return j({ error: 'Link inválido' }, 400);
        const ed = kind === 'edit', key = (ed ? 'edit:' : 'share:') + token;
        const w = ed && who ? String(who).trim().toLowerCase() : '';
        if (w && !emailOk(w)) return j({ error: 'Ingresá un email válido' }, 400);
        const prev = await env.KV.get(key);
        if (prev && JSON.parse(prev).e !== email) return j({ error: 'Link inválido' }, 409);
        if (!prev) await env.KV.put(key, JSON.stringify(ed ? { e: email, who: w } : { e: email }));
        if (w) { const l = await invList(env, w); if (!l.some(x => x.k === token)) { l.unshift({ k: token, e: email }); await env.KV.put('inv:' + w, JSON.stringify(l.slice(0, 50))); } }
        return j({ ok: true });
      }
      if (url.pathname.startsWith('/share/') && req.method === 'DELETE') {
        if (!email) return j({ error: 'No autenticado' }, 401);
        const tok = url.pathname.slice(7);
        if (!shOk(tok)) return j({ ok: true });
        const v = await env.KV.get('share:' + tok);
        if (v && JSON.parse(v).e === email) await env.KV.delete('share:' + tok);
        const ed = await env.KV.get('edit:' + tok);
        if (ed) { const x = JSON.parse(ed); if (x.e === email) { await env.KV.delete('edit:' + tok); if (x.who) { const l = (await invList(env, x.who)).filter(y => y.k !== tok); if (l.length) await env.KV.put('inv:' + x.who, JSON.stringify(l)); else await env.KV.delete('inv:' + x.who); } } }
        return j({ ok: true });
      }

      if (url.pathname === '/account' && req.method === 'DELETE') {
        if (!email) return j({ error: 'No autenticado' }, 401);
        const raw = await env.KV.get('user:' + email);
        if (raw) {
          const d = sanitizeState(JSON.parse(raw).data);
          for (const p of Object.values(d.projects)) if (p.sh) await env.KV.delete('share:' + p.sh);
          for (const x of Object.values(d.shares)) {
            if (x.sh) await env.KV.delete('share:' + x.sh);
            if (x.se) await env.KV.delete('edit:' + x.se);
            for (const y of x.eds) await env.KV.delete('edit:' + y.k);
          }
        }
        await env.KV.delete('inv:' + email);
        await env.KV.delete('user:' + email);
        return j({ ok: true });
      }

      return j({ error: 'No encontrado' }, 404);
    } catch (err) {
      return j({ error: 'Error del servidor' }, 500);
    }
  }
};
