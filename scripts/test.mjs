// Pruebas de la lógica de datos y del servidor (con KV simulado). Uso: node scripts/test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeState, sanitizeState } from '../server/src/merge.js';
import worker from '../server/src/index.js';

let n = 0;
const ok = (name, fn) => Promise.resolve().then(fn).then(() => { n++; console.log('  ✓', name); }, e => { console.log('  ✗', name); throw e; });
const T = Date.now();

console.log('datos');
await ok('las copias de merge.js están sincronizadas', () => {
  const shared = readFileSync(new URL('../shared/merge.js', import.meta.url), 'utf8');
  assert.equal(readFileSync(new URL('../web/merge.js', import.meta.url), 'utf8'), shared);
  assert.ok(readFileSync(new URL('../server/src/merge.js', import.meta.url), 'utf8').startsWith(shared));
});
await ok('une proyectos, iniciativas y plazos de dos dispositivos', () => {
  const a = { projects: { p1: { n: 'Q4', u: T } }, inits: { i1: { pr: 'p1', n: 'A', u: T } }, blocks: { b1: { pr: 'p1', in: 'i1', s: '2026-11-02', e: '2026-11-06', u: T } } };
  const b = { projects: { p1: { n: 'Q4', u: T } }, inits: { i2: { pr: 'p1', n: 'B', u: T } }, teams: { t1: { pr: 'p1', n: 'QA', col: 'green', u: T } } };
  const m = mergeState(a, b);
  assert.deepEqual(Object.keys(m.inits).sort(), ['i1', 'i2']);
  assert.equal(m.teams.t1.n, 'QA'); assert.equal(m.blocks.b1.e, '2026-11-06');
});
await ok('gana el cambio más reciente y la tumba más nueva borra', () => {
  const a = { inits: { i1: { pr: 'p1', n: 'Vieja', p: 'low', u: T - 5000 } } };
  const b = { inits: { i1: { pr: 'p1', n: 'Nueva', p: 'urg', u: T } } };
  assert.equal(mergeState(a, b).inits.i1.n, 'Nueva'); assert.equal(mergeState(b, a).inits.i1.p, 'urg');
  const c = { inits: { i1: { pr: 'p1', n: '', u: T + 1, del: true } } };
  assert.equal(mergeState(b, c).inits.i1.del, true);
});
await ok('es conmutativo e idempotente', () => {
  const a = { name: 'Taiel', nameU: 2, projects: { p1: { n: 'A', g: 'q', u: T } }, last: 'p1', lastU: 5 };
  const b = { name: 'Tai', nameU: 3, projects: { p1: { n: 'A2', g: 'd', u: T + 1 } }, last: 'p2', lastU: 4 };
  assert.deepEqual(mergeState(a, b, T), mergeState(b, a, T));
  const m = mergeState(a, b, T);
  assert.deepEqual(mergeState(m, m, T), m);
  assert.equal(m.name, 'Tai'); assert.equal(m.last, 'p1'); assert.equal(m.projects.p1.g, 'd');
});
await ok('limpia datos malos', () => {
  const s = sanitizeState({
    projects: { 'x y': { n: 'mal id' }, p1: { n: '', e: 'hola', g: 'zz', vs: '2026-13', vn: 99, gb: 'x' } },
    states: { s1: { pr: 'p1', n: 'Ok', col: 'fucsia', dn: 1 }, s2: { pr: '../', n: 'X' }, s3: { pr: 'p1', n: '' } },
    inits: { i1: { pr: 'p1', n: 'x'.repeat(500), dl: '2026-02-31x', p: 'mucha', ln: 'javascript:alert(1)' } },
    blocks: { b1: { pr: 'p1', in: 'i1', s: '2026-11-10', e: '2026-11-02' }, b2: { pr: 'p1', in: 'i1', s: 'mañana', e: '2026-11-02' } },
    last: '../x'
  });
  assert.deepEqual(Object.keys(s.projects), ['p1']);
  const p = s.projects.p1;
  assert.equal(p.n, 'Proyecto'); assert.equal(p.e, ''); assert.equal(p.g, 'w'); assert.equal(p.vs, ''); assert.equal(p.vn, 24); assert.equal(p.gb, 'i');
  assert.deepEqual(Object.keys(s.states), ['s1']); assert.equal(s.states.s1.col, 'gray'); assert.equal(s.states.s1.dn, true);
  const i = s.inits.i1; assert.equal(i.n.length, 160); assert.equal(i.dl, ''); assert.equal(i.p, ''); assert.equal(i.ln, '');
  assert.deepEqual(Object.keys(s.blocks), ['b1']); assert.equal(s.blocks.b1.s, '2026-11-02'); assert.equal(s.blocks.b1.e, '2026-11-10');
  assert.equal(s.last, '');
});
await ok('sprints: limpia fechas, ids repetidos y combina', () => {
  const s = sanitizeState({ sprints: { a: { pr: 'p', n: '', s: '2026-11-13', e: '2026-11-02', ins: ['x', 'x', 'no válido', 5], off: 99 }, b: { pr: 'p', n: 'Sin fechas' } } });
  assert.deepEqual(Object.keys(s.sprints), ['a']);
  const a = s.sprints.a; assert.equal(a.n, 'Sprint'); assert.equal(a.s, '2026-11-02'); assert.equal(a.e, '2026-11-13'); assert.deepEqual(a.ins, ['x']); assert.equal(a.off, 60);
  const m = mergeState({ sprints: { a: { pr: 'p', n: 'SP 1', s: '2026-11-02', e: '2026-11-13', u: T } } }, { sprints: { a: { pr: 'p', n: 'SP 1', s: '2026-11-02', e: '2026-11-13', cl: true, dn: ['x'], u: T + 1 } } });
  assert.equal(m.sprints.a.cl, true); assert.deepEqual(m.sprints.a.dn, ['x']);
});
await ok('daily: avisos y comentarios de cada iniciativa se combinan por separado', () => {
  const base = { pr: 'p', d: '2026-11-05', c: 1, u: T };
  const a = { dailies: { d1: { ...base, notes: 'A', nU: T + 1, items: { i1: { c: 'uno', st: 's1', u: T + 3 }, i2: { c: 'viejo', u: T } } } } };
  const b = { dailies: { d1: { ...base, notes: 'B', nU: T + 2, items: { i2: { c: 'nuevo', u: T + 4 }, i3: { c: 'tres', u: T } } } } };
  const m = mergeState(a, b), x = m.dailies.d1;
  assert.equal(x.notes, 'B'); assert.equal(x.items.i1.c, 'uno'); assert.equal(x.items.i2.c, 'nuevo'); assert.equal(x.items.i3.c, 'tres');
  assert.deepEqual(mergeState(b, a), m);
});
await ok('tumbas viejas se descartan y se acota la cantidad', () => {
  const s = sanitizeState({ inits: { old: { pr: 'p', n: '', del: true, u: T - 40 * 86400000 }, nw: { pr: 'p', n: '', del: true, u: T } } }, T);
  assert.deepEqual(Object.keys(s.inits), ['nw']);
  const many = {}; for (let i = 0; i < 2100; i++) many['t' + i] = { pr: 'p', n: 'x' + i, u: i + 1 };
  assert.equal(Object.keys(sanitizeState({ teams: many }).teams).length, 2000);
});

console.log('servidor');
const store = new Map();
const env = { SERVER_SECRET: 'prueba-secreta-larga', KV: { get: async k => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); }, delete: async k => { store.delete(k); } } };
const call = async (path, method = 'GET', body, token) => {
  const r = await worker.fetch(new Request('http://x' + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }), env);
  return { status: r.status, body: await r.json().catch(() => null) };
};
let tok = '';
await ok('health', async () => assert.equal((await call('/health')).body.ok, true));
await ok('crear cuenta valida datos y no repite emails', async () => {
  assert.equal((await call('/signup', 'POST', { email: 'mal', password: '12345678' })).status, 400);
  assert.equal((await call('/signup', 'POST', { email: 'a@b.co', password: 'corta' })).status, 400);
  const r = await call('/signup', 'POST', { email: 'A@B.co', password: 'contraseña1' });
  assert.equal(r.status, 200); tok = r.body.token;
  assert.equal((await call('/signup', 'POST', { email: 'a@b.co', password: 'otra12345' })).status, 409);
});
await ok('ingresar con contraseña correcta e incorrecta', async () => {
  assert.equal((await call('/login', 'POST', { email: 'a@b.co', password: 'nop12345' })).status, 401);
  assert.ok((await call('/login', 'POST', { email: 'a@b.co', password: 'contraseña1' })).body.token);
});
await ok('sincroniza y combina sin perder cambios', async () => {
  assert.equal((await call('/data')).status, 401);
  assert.equal((await call('/data', 'GET', null, 'x.y')).status, 401);
  await call('/data', 'PUT', { data: { projects: { p1: { n: 'Q4', u: T } }, inits: { i1: { pr: 'p1', n: 'A', u: T } } } }, tok);
  const r = await call('/data', 'PUT', { data: { inits: { i2: { pr: 'p1', n: 'B', u: T } } } }, tok);
  assert.deepEqual(Object.keys(r.body.data.inits).sort(), ['i1', 'i2']);
  assert.equal((await call('/data', 'GET', null, tok)).body.data.projects.p1.n, 'Q4');
});
await ok('link público: solo el proyecto compartido, sin cuenta, y se puede revocar', async () => {
  const tk = 'Abc123Abc123Abc123Abc123';
  assert.equal((await call('/share', 'POST', { token: tk })).status, 401);
  assert.equal((await call('/share', 'POST', { token: 'corto' }, tok)).status, 400);
  assert.equal((await call('/share', 'POST', { token: tk }, tok)).status, 200);
  assert.equal((await call('/public/' + tk)).status, 404, 'el proyecto todavía no tiene la clave');
  await call('/data', 'PUT', { data: { projects: { p1: { n: 'Q4', sh: tk, u: T + 5 }, p2: { n: 'Privado', u: T } }, inits: { i3: { pr: 'p2', n: 'Secreto', u: T } } } }, tok);
  const r = await call('/public/' + tk);
  assert.equal(r.status, 200); assert.equal(r.body.pr, 'p1');
  assert.deepEqual(Object.keys(r.body.data.projects), ['p1']);
  assert.deepEqual(Object.keys(r.body.data.inits).sort(), ['i1', 'i2']);
  // otra cuenta no puede apropiarse de la clave
  const o = await call('/signup', 'POST', { email: 'otro@b.co', password: 'contraseña2' });
  assert.equal((await call('/share', 'POST', { token: tk }, o.body.token)).status, 409);
  await call('/data', 'PUT', { data: { projects: { p1: { n: 'Q4', sh: '', u: T + 9 } } } }, tok);
  assert.equal((await call('/public/' + tk)).status, 404);
  await call('/data', 'PUT', { data: { projects: { p1: { n: 'Q4', sh: tk, u: T + 10 } } } }, tok);
  assert.equal((await call('/public/' + tk)).status, 200);
  // quien mira por link puede escribir dailies de ese proyecto, y nada más
  const dy = { d9: { pr: 'p1', d: '2026-11-05', notes: 'aviso', nU: T, items: { i1: { c: 'ok', u: T } }, u: T } };
  const w = await call('/public/' + tk + '/daily', 'PUT', { dailies: { ...dy, d8: { pr: 'p2', d: '2026-11-05', u: T } } });
  assert.equal(w.status, 200); assert.deepEqual(Object.keys(w.body.dailies), ['d9']);
  assert.equal((await call('/public/' + tk)).body.data.dailies.d9.items.i1.c, 'ok');
  await call('/data', 'PUT', { data: { dailies: { d9: { pr: 'p1', d: '2026-11-05', u: T + 50, del: true } } } }, tok);
  await call('/public/' + tk + '/daily', 'PUT', { dailies: { d9: { ...dy.d9, u: T + 99 } } });
  assert.equal((await call('/data', 'GET', null, tok)).body.data.dailies.d9.del, true, 'no puede revivir una daily borrada');
  await call('/share/' + tk, 'DELETE', null, tok);
  assert.equal((await call('/public/' + tk + '/daily', 'PUT', { dailies: dy })).status, 404);
  assert.equal((await call('/public/' + tk)).status, 404);
  await call('/account', 'DELETE', null, o.body.token);
});
await ok('eliminar la cuenta borra todo', async () => {
  assert.equal((await call('/account', 'DELETE', null, tok)).status, 200);
  assert.equal((await call('/data', 'GET', null, tok)).status, 401);
  assert.equal(store.size, 0);
});
console.log(`\n${n} pruebas OK`);
