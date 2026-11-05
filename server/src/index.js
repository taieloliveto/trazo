// Servidor de Trazo (Cloudflare Worker): cuentas, sesión y sincronización. Mismo esquema que Foco y Compras.
import { mergeState, sanitizeState, shOk } from './merge.js';

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
        const p = Object.values(d.projects).find(x => x.sh === tok && !x.del);
        if (!p) return gone();
        const pick = k => Object.fromEntries(Object.entries(d[k]).filter(([, x]) => x.pr === p.id && !x.del));
        return j({ pr: p.id, at: Date.now(), data: { projects: { [p.id]: p }, states: pick('states'), teams: pick('teams'), inits: pick('inits'), blocks: pick('blocks'), sprints: pick('sprints'), dailies: pick('dailies') } });
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
        const p = Object.values(d.projects).find(x => x.sh === tok && !x.del);
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

      if (url.pathname === '/share' && req.method === 'POST') {
        if (!email) return j({ error: 'No autenticado' }, 401);
        const { token } = await req.json();
        if (!shOk(token)) return j({ error: 'Link inválido' }, 400);
        const prev = await env.KV.get('share:' + token);
        if (prev && JSON.parse(prev).e !== email) return j({ error: 'Link inválido' }, 409);
        if (!prev) await env.KV.put('share:' + token, JSON.stringify({ e: email }));
        return j({ ok: true });
      }
      if (url.pathname.startsWith('/share/') && req.method === 'DELETE') {
        if (!email) return j({ error: 'No autenticado' }, 401);
        const tok = url.pathname.slice(7), prev = shOk(tok) && await env.KV.get('share:' + tok);
        if (prev && JSON.parse(prev).e === email) await env.KV.delete('share:' + tok);
        return j({ ok: true });
      }

      if (url.pathname === '/account' && req.method === 'DELETE') {
        if (!email) return j({ error: 'No autenticado' }, 401);
        const raw = await env.KV.get('user:' + email);
        if (raw) for (const p of Object.values(sanitizeState(JSON.parse(raw).data).projects)) if (p.sh) await env.KV.delete('share:' + p.sh);
        await env.KV.delete('user:' + email);
        return j({ ok: true });
      }

      return j({ error: 'No encontrado' }, 404);
    } catch (err) {
      return j({ error: 'Error del servidor' }, 500);
    }
  }
};
