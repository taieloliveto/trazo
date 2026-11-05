// Prueba de punta a punta con un navegador real (Playwright): app + servidor con KV simulado.
// Uso: node scripts/e2e.mjs   (E2E_CSP=1 aplica los encabezados de seguridad de web/vercel.json)
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
process.env.TZ = 'America/Buenos_Aires';
import worker from '../server/src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const WEB = join(here, '..', 'web');
const SHOTS = process.env.SHOTS_DIR || join(here, '..', '.shots');
mkdirSync(SHOTS, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [here, '/opt/npm-tools/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules'] }));

const store = new Map();
const env = { SERVER_SECRET: 'e2e-secret-largo-largo', KV: { get: async k => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); }, delete: async k => { store.delete(k); } } };
const api = http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const r = await worker.fetch(new Request('http://api.local' + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
});
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
let API = '';
const web = http.createServer((req, res) => {
  let p = new URL(req.url, 'http://x').pathname; if (p === '/') p = '/index.html';
  const f = join(WEB, p);
  if (!f.startsWith(WEB) || !existsSync(f)) { res.writeHead(404); return res.end(); }
  const headers = { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' };
  if (process.env.E2E_CSP) {
    const rule = JSON.parse(readFileSync(join(WEB, 'vercel.json'), 'utf8')).headers.find(h => h.source === '/(.*)');
    for (const { key, value } of rule.headers) headers[key] = value.replace('http://localhost:*', 'http://127.0.0.1:*');
  }
  if (p === '/config.js') { res.writeHead(200, headers); return res.end(`window.TRAZO_CONFIG={API_URL:${JSON.stringify(API)}};`); }
  res.writeHead(200, headers); res.end(readFileSync(f));
});
const listen = s => new Promise(r => s.listen(0, '127.0.0.1', () => r(s.address().port)));
const [apiPort, webPort] = [await listen(api), await listen(web)];
const APP = `http://127.0.0.1:${webPort}/`;
API = `http://127.0.0.1:${apiPort}`;

const browser = await chromium.launch();
const errors = [];
let n = 0;
const step = async (name, fn) => { try { await fn(); n++; console.log('  ✓', name); } catch (e) { console.log('  ✗', name); await page.screenshot({ path: join(SHOTS, 'FAIL.png') }).catch(() => {}); throw e; } };
const watch = page => { page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); };
const shot = (page, name) => page.screenshot({ path: join(SHOTS, name + '.png') });
const data = page => page.evaluate(() => JSON.parse(localStorage.getItem('trazo.v1')).data);
const live = o => Object.values(o).filter(x => !x.del);

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'es-AR', timezoneId: 'America/Buenos_Aires' });
const page = await ctx.newPage(); watch(page);

await step('pantalla de ingreso', async () => {
  await page.goto(APP);
  await page.waitForSelector('#af');
  await page.waitForTimeout(900);
  await shot(page, '01-ingreso');
});
await step('crear cuenta con nombre', async () => {
  await page.click('[data-m=signup]');
  await page.fill('[data-au=name]', 'Taiel');
  await page.fill('[data-au=email]', 'taiel@test.com');
  await page.fill('[data-au=pass]', 'clave-segura-1');
  await page.click('#af button[type=submit]');
  await page.waitForSelector('.onb');
  assert.ok(store.has('user:taiel@test.com'));
});
await step('introducción de 4 pasos', async () => {
  await shot(page, '02-intro-1');
  for (let i = 0; i < 2; i++) await page.click('[data-a=onext]');
  await shot(page, '03-intro-3');
  await page.click('[data-a=onext]');
  await page.waitForSelector('[data-a=ofirst]');
  await shot(page, '04-intro-4');
});
await step('crear el primer proyecto desde la introducción', async () => {
  await page.click('[data-a=ofirst]');
  await page.fill('#sn', 'Roadmap Q4');
  await page.click('.egrid button[data-e="🚀"]');
  await page.click('#sf button[type=submit]');
  await page.waitForSelector('#addi');
  const d = await data(page);
  const p = live(d.projects)[0];
  assert.equal(p.n, 'Roadmap Q4'); assert.equal(p.e, '🚀');
  assert.deepEqual(live(d.states).sort((a, b) => a.o - b.o).map(s => s.n), ['Por hacer', 'En curso', 'Finalizado', 'Bloqueado']);
  assert.equal(await page.textContent('.psw .pn'), '🚀Roadmap Q4');
  assert.equal(await page.locator('.pj h1.vh').count(), 1, 'el título grande ya no se ve');
});
const add = async (name, dl, st, pr) => {
  await page.fill('#ain', name);
  if (dl) await page.fill('#adl', dl);
  await page.selectOption('#ast', { label: st });
  await page.selectOption('#apr', { label: pr });
  await page.click('#addi button[type=submit]');
  await page.waitForFunction(n => [...document.querySelectorAll('.itn span')].some(s => s.textContent === n), name);
};
await step('cargar iniciativas con deadline, estado y prioridad', async () => {
  await add('Rediseño estructural GDA', '2026-11-04', 'En curso', 'Urgente');
  await add('Campaña post-mudanza', '2026-11-20', 'Por hacer', 'Alta');
  await add('QR y derivación autoinstalable', '2026-10-30', 'Bloqueado', 'Media');
  await add('Comunicación preventiva', '', 'Finalizado', 'Baja');
  const d = await data(page);
  const g = live(d.inits).find(i => i.n === 'Rediseño estructural GDA');
  assert.equal(g.dl, '2026-11-04'); assert.equal(g.p, 'urg');
  assert.equal(d.states[g.st].n, 'En curso');
  assert.equal(await page.locator('.itr').count(), 4);
  assert.ok(await page.locator('.dl.late').count() >= 1, 'deadline vencido resaltado');
});
await step('cambiar estado y prioridad desde la tabla', async () => {
  const row = page.locator('.itr', { hasText: 'Campaña post-mudanza' });
  await row.locator('select[data-ch=st]').selectOption({ label: 'En curso' });
  await page.locator('.itr', { hasText: 'Campaña post-mudanza' }).locator('select[data-ch=p]').selectOption('urg');
  const d = await data(page), i = live(d.inits).find(x => x.n === 'Campaña post-mudanza');
  assert.equal(d.states[i.st].n, 'En curso'); assert.equal(i.p, 'urg');
});
await step('editar estados: agregar, renombrar y recolorear', async () => {
  await page.click('.tbar [data-a=states]');
  await page.fill('.sh .tga input', 'En refinamiento');
  await page.press('.sh .tga input', 'Enter');
  await page.waitForFunction(() => [...document.querySelectorAll('.sh .tgn')].some(i => i.value === 'En refinamiento'));
  const ref = page.locator('.sh .tgr').filter({ has: page.locator('input[value="En refinamiento"]') });
  await ref.locator('[data-a=pickcol]').click();
  await page.click('.cs.c-orange');
  for (let k = 0; k < 3; k++) await page.locator('.sh .tgr').filter({ has: page.locator('input[value="En refinamiento"]') }).locator('[data-v="-1"]').click();
  await page.waitForTimeout(100);
  await shot(page, '06-estados');
  await page.click('.sh [data-a=close]');
  const d = await data(page);
  const sts = live(d.states).sort((a, b) => a.o - b.o);
  assert.equal(sts[1].n, 'En refinamiento'); assert.equal(sts[1].col, 'orange');
  assert.ok(await page.locator('#ast option', { hasText: 'En refinamiento' }).count());
});
await step('filtrar y ordenar', async () => {
  await page.selectOption('select[data-ch=sort]', 'prio');
  const first = await page.locator('.itn span').first().textContent();
  assert.ok(['Rediseño estructural GDA', 'Campaña post-mudanza'].includes(first));
  await page.click('.chip:has-text("Bloqueado")');
  assert.equal(await page.locator('.itr').count(), 1);
  await page.click('.chip[data-v=""]');
  await shot(page, '05-iniciativas');
});
await step('ordenar iniciativas arrastrando (listado)', async () => {
  await page.selectOption('select[data-ch=sort]', 'manual');
  const names = async () => page.locator('.itn span').allTextContents();
  const before = await names();
  const src = page.locator('.itr').nth(3).locator('.grip'), dst = page.locator('.itr').nth(0);
  const a = await src.boundingBox(), b = await dst.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y - 20, { steps: 4 });
  await page.mouse.move(a.x + a.width / 2, b.y + 4, { steps: 8 });
  await page.mouse.up();
  const after = await names();
  assert.equal(after[0], before[3]); assert.equal(after.length, 4);
  // con flechas del teclado
  await page.locator('.itr').nth(0).locator('.grip').focus();
  await page.keyboard.press('ArrowDown');
  assert.equal((await names())[1], before[3]);
  // ordenar por prioridad y después arrastrar vuelve a "Orden manual"
  await page.selectOption('select[data-ch=sort]', 'prio');
  await page.locator('.itr').nth(0).locator('.grip').focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.inputValue('select[data-ch=sort]'), 'manual');
});
await step('editar una iniciativa con enlace y notas', async () => {
  await page.click('.itn:has-text("QR y derivación autoinstalable")');
  await page.fill('#iln', 'no-es-url');
  await page.click('#sf button[type=submit]');
  await page.waitForSelector('.sh .err:has-text("https://")');
  await page.fill('#iln', 'https://jira.example.com/QR-12');
  await page.fill('#ino', 'Depende de Isla.');
  await page.click('#sf button[type=submit]');
  await page.waitForSelector('.ov', { state: 'detached' });
  const i = live((await data(page)).inits).find(x => x.n.startsWith('QR'));
  assert.equal(i.ln, 'https://jira.example.com/QR-12'); assert.equal(i.no, 'Depende de Isla.');
});
await step('equipos: agregar y ver en la pestaña', async () => {
  await page.click('[data-a=ptab][data-t=teams]');
  for (const t of ['CUX / Data', 'Desarrollo', 'QA']) { await page.fill('.tga input', t); await page.press('.tga input', 'Enter'); await page.waitForFunction(t => [...document.querySelectorAll('.tgn')].some(i => i.value === t), t); }
  assert.equal(live((await data(page)).teams).length, 3);
  await shot(page, '07-equipos');
});
const rowBox = async name => (await page.locator('.rr', { has: page.locator(`.rn:text-is("${name}")`) }).locator('.rt').boundingBox());
await step('roadmap: arrastrar sobre una fila crea un plazo por equipo', async () => {
  await page.click('[data-a=ptab][data-t=plan]');
  await page.waitForSelector('#rm');
  await page.click('[data-a=gran][data-v=w]');
  const b = await rowBox('Rediseño estructural GDA');
  const dw = 20, y = b.y + b.height / 2;
  const x0 = b.x + 40 * dw + 5;     // día 40 desde el inicio visible
  await page.mouse.move(x0, y); await page.mouse.down();
  await page.mouse.move(x0 + 60, y, { steps: 4 }); await page.mouse.move(x0 + 9 * dw, y, { steps: 4 });
  await page.waitForSelector('.dghost');
  await page.mouse.up();
  await page.waitForSelector('.sh[data-f=block]');
  await page.click('.sh .chip.tc:has-text("Desarrollo")');
  await page.fill('#blb', 'IMPLE');
  await page.click('#sf button[type=submit]');
  await page.waitForSelector('.blk');
  const d = await data(page), bl = live(d.blocks);
  assert.equal(bl.length, 1);
  const p = live(d.projects)[0], start = new Date(Date.UTC(+p.vs.slice(0, 4), +p.vs.slice(5) - 1, 1 + 40)).toISOString().slice(0, 10);
  assert.equal(bl[0].s, start); assert.equal((Date.parse(bl[0].e) - Date.parse(bl[0].s)) / 86400000, 9);
  assert.equal(d.teams[bl[0].tm].n, 'Desarrollo'); assert.equal(bl[0].lb, 'IMPLE');
});
await step('roadmap: mover y estirar un plazo', async () => {
  const before = live((await data(page)).blocks)[0];
  let bb = await page.locator('.blk').boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down();
  await page.mouse.move(bb.x + bb.width / 2 + 30, bb.y + bb.height / 2, { steps: 3 });
  await page.mouse.move(bb.x + bb.width / 2 + 7 * 20, bb.y + bb.height / 2, { steps: 3 });
  await page.mouse.up();
  let a = live((await data(page)).blocks)[0];
  assert.equal((Date.parse(a.s) - Date.parse(before.s)) / 86400000, 7);
  assert.equal((Date.parse(a.e) - Date.parse(a.s)) / 86400000, 9);
  await page.evaluate(() => { const rm = document.querySelector('#rm'); rm.scrollLeft += 300; });
  bb = await page.locator('.blk').boundingBox();
  await page.mouse.move(bb.x + bb.width - 3, bb.y + bb.height / 2); await page.mouse.down();
  await page.mouse.move(bb.x + bb.width + 20, bb.y + bb.height / 2, { steps: 3 });
  await page.mouse.move(bb.x + bb.width - 3 + 4 * 20, bb.y + bb.height / 2, { steps: 3 });
  await page.mouse.up();
  a = live((await data(page)).blocks)[0];
  assert.equal((Date.parse(a.e) - Date.parse(a.s)) / 86400000, 13);
});
await step('roadmap: teclado mueve el plazo', async () => {
  const s0 = live((await data(page)).blocks)[0].s;
  await page.focus('.blk'); await page.keyboard.press('ArrowRight');
  assert.equal((Date.parse(live((await data(page)).blocks)[0].s) - Date.parse(s0)) / 86400000, 1);
});
await step('roadmap: más plazos desde la ficha de la iniciativa', async () => {
  await page.click('.rlb:has-text("Rediseño estructural GDA")');
  await page.click('[data-a=badd]');
  await page.click('.sh .chip.tc:has-text("QA")');
  const s = live((await data(page)).blocks)[0].e;
  await page.fill('#bs', s); await page.fill('#be', new Date(Date.parse(s) + 5 * 86400000).toISOString().slice(0, 10));
  await page.click('#sf button[type=submit]');
  await page.waitForSelector('.sh[data-f=init] .blr >> nth=1');
  await page.click('.sh [data-a=close]');
  assert.equal(await page.locator('.blk').count(), 2);
  /* dos plazos que se superponen van en carriles distintos */
  const tops = await page.locator('.blk').evaluateAll(els => els.map(e => e.style.top));
  assert.notEqual(tops[0], tops[1]);
  // otro plazo en otra iniciativa, creado por clic (sin arrastrar)
  const b = await rowBox('Campaña post-mudanza');
  await page.mouse.click(b.x + 20 * 20 + 3, b.y + b.height / 2);
  await page.waitForSelector('.sh[data-f=block]');
  await page.click('.sh .chip.tc:has-text("CUX / Data")');
  await page.click('#sf button[type=submit]');
  await page.waitForFunction(() => document.querySelectorAll('.blk').length === 3);
  await page.waitForTimeout(150);
  await shot(page, '08-roadmap-semana');
});
await step('ordenar iniciativas arrastrando (roadmap) y se refleja en el listado', async () => {
  const names = async () => page.locator('.rr .rn').allTextContents();
  const before = await names();
  const src = page.locator('.rr').nth(0).locator('.grip'), last = page.locator('.rr').nth(3);
  const a = await src.boundingBox(), b = await last.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y + 30, { steps: 4 });
  await page.mouse.move(a.x + a.width / 2, b.y + b.height - 4, { steps: 10 });
  await page.mouse.up();
  const after = await names();
  assert.equal(after[3], before[0]);
  await page.click('[data-a=ptab][data-t=inits]');
  assert.deepEqual(await page.locator('.itn span').allTextContents(), after);
  await page.click('[data-a=ptab][data-t=plan]');
  await shot(page, '08b-roadmap-orden');
});
await step('granularidad: día, quincena y mes', async () => {
  for (const [g, name] of [['d', '09-roadmap-dia'], ['q', '10-roadmap-quincena'], ['m', '11-roadmap-mes']]) {
    await page.click(`[data-a=gran][data-v=${g}]`);
    await page.waitForSelector(`#rm.g-${g}`);
    await shot(page, name);
  }
  assert.equal(await page.locator('.srow').count(), 0, 'por mes no hay subdivisión');
  await page.click('[data-a=gran][data-v=d]');
  const p = live((await data(page)).projects)[0];
  assert.equal(await page.locator('.srow .sc').count(), [0, 1, 2, 3].reduce((a, k) => { const [y, m] = p.vs.split('-').map(Number); return a + new Date(Date.UTC(y, m - 1 + k + 1, 0)).getUTCDate(); }, 0));
  await page.click('[data-a=gran][data-v=w]');
  assert.equal(await page.locator('.srow .sc').count(), 16);
});
await step('navegar meses y cantidad visible', async () => {
  const vs = live((await data(page)).projects)[0].vs;
  await page.click('[data-a=rmnav][data-v="1"]');
  assert.notEqual(live((await data(page)).projects)[0].vs, vs);
  await page.click('[data-a=rmtoday]');
  await page.selectOption('select[data-ch=vn]', '6');
  assert.equal(live((await data(page)).projects)[0].vn, 6);
  assert.equal(await page.locator('.mc').count(), 6);
});
await step('agrupar por equipo', async () => {
  await page.click('[data-a=gb][data-v=t]');
  await page.waitForSelector('.rlb.tm');
  assert.equal(await page.locator('.rr').count(), 3);
  assert.ok(await page.locator('.blk:has-text("Rediseño estructural GDA")').count() >= 1);
  await shot(page, '12-roadmap-por-equipo');
  await page.click('[data-a=gb][data-v=i]');
});
await step('tablero: indicadores, gráficos, capacidad y listas', async () => {
  await page.click('[data-a=ptab][data-t=teams]');
  const capIn = page.locator('.tgr').filter({ has: page.locator('input[value="Desarrollo"]') }).locator('input[data-ch=tgcap]');
  await capIn.fill('1'); await capIn.press('Tab');
  assert.equal(live((await data(page)).teams).find(x => x.n === 'Desarrollo').cap, 1);
  await page.click('[data-a=ptab][data-t=dash]');
  await page.waitForSelector('.kpis');
  assert.equal(await page.locator('.kpi').count(), 6);
  const dd = await data(page), td = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  const lateN = live(dd.inits).filter(i => i.dl && i.dl < td && !dd.states[i.st]?.dn).length;
  assert.equal((await page.locator('.kpi.bad b').textContent()).trim(), String(lateN), 'atrasadas');
  assert.equal(await page.locator('.hm tbody tr').count(), 3);
  assert.equal(await page.locator('.hm thead th').count(), 8 + 2);
  await page.click('[data-a=dwn][data-v="12"]');
  assert.equal(await page.locator('.hm thead th').count(), 12 + 2);
  await page.click('[data-a=dwnav][data-v="1"]'); await page.click('[data-a=dwnav][data-v="0"]');
  await page.click('[data-a=dwn][data-v="8"]');
  await shot(page, '12d-tablero');
  await page.screenshot({ path: join(SHOTS, '12e-tablero-completo.png'), fullPage: true });
  await page.click('[data-a=ptab][data-t=plan]');
});
await step('sprints: crear con fechas, días disponibles, objetivo e iniciativas', async () => {
  await page.click('[data-a=ptab][data-t=sprints]');
  await page.click('[data-a=spnew]');
  const mon = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); });
  const fri2 = new Date(Date.parse(mon) + 11 * 86400000).toISOString().slice(0, 10);
  await page.fill('#spn', 'SP 16');
  await page.fill('#sps', mon); await page.fill('#spe', fri2);
  await page.fill('#spo', '1');
  await page.waitForFunction(() => document.querySelector('#spdays').textContent.startsWith('9 días disponibles'));
  assert.ok((await page.textContent('#spdays')).includes('10 hábiles'));
  await page.fill('#spg', 'Rediseño GDA listo para QA');
  await page.check('.ck:has-text("Rediseño estructural GDA") input');
  await page.check('.ck:has-text("Campaña post-mudanza") input');
  await page.check('.ck:has-text("Comunicación preventiva") input');
  assert.equal(await page.textContent('#spcnt'), '3');
  await page.click('#sf button[type=submit]');
  await page.waitForSelector('.spc.st-cur');
  // el siguiente se propone solo: SP 17, a continuación
  await page.click('[data-a=spnew]');
  assert.equal(await page.inputValue('#spn'), 'SP 17');
  assert.ok((await page.inputValue('#sps')) > fri2);
  await page.check('.ck:has-text("QR y derivación") input');
  await page.click('#sf button[type=submit]');
  await page.waitForSelector('.spc.st-fut');
  const sp = live((await data(page)).sprints);
  assert.equal(sp.length, 2); assert.equal(sp.find(x => x.n === 'SP 16').off, 1); assert.equal(sp.find(x => x.n === 'SP 16').ins.length, 3);
  await shot(page, '12f-sprints');
});
await step('sprint actual: reporte y cambiar estado desde ahí', async () => {
  await page.click('[data-a=ptab][data-t=cur]');
  await page.waitForSelector('.rep');
  assert.ok((await page.textContent('.goalc')).includes('Rediseño GDA listo para QA'));
  assert.equal(await page.locator('.rep .kpi').count(), 5);
  assert.equal(await page.locator('.rtr').count(), 3);
  await page.locator('.rtr', { hasText: 'Campaña post-mudanza' }).locator('select[data-ch=st]').selectOption({ label: 'Finalizado' });
  await page.waitForFunction(() => document.querySelectorAll('.rtr.done').length === 2);
  await page.screenshot({ path: join(SHOTS, '12g-sprint-actual.png'), fullPage: true });
});
await step('sprints en el roadmap', async () => {
  await page.click('[data-a=ptab][data-t=plan]');
  await page.waitForSelector('#rm.hs .spb');
  assert.ok(await page.locator('.spb:has-text("SP 16")').count());
  assert.ok(await page.locator('.spband').count());
  assert.ok(await page.locator('.rlb .sptag').count() >= 3);
  await shot(page, '12h-roadmap-sprints');
});
await step('cerrar sprint y pasar lo pendiente al próximo', async () => {
  await page.click('[data-a=ptab][data-t=sprints]');
  await page.click('.spc.st-cur [data-a=spclose]');
  assert.ok(await page.isChecked('#spmv'));
  await page.click('[data-a=spcloseok]');
  await page.waitForSelector('.spc .tg:has-text("Finalizado")');
  const sp = live((await data(page)).sprints), a = sp.find(x => x.n === 'SP 16'), b = sp.find(x => x.n === 'SP 17');
  assert.equal(a.cl, true); assert.equal(a.dn.length, 2);
  assert.equal(b.ins.length, 2, 'la que no terminó pasó a SP 17');
  await page.click('.spc [data-a=spreopen]');
  assert.equal(live((await data(page)).sprints).find(x => x.n === 'SP 16').cl, false);
  await page.click('[data-a=ptab][data-t=plan]');
});
await step('reordenar las pestañas arrastrando', async () => {
  const keys = async () => page.locator('.tabs [role=tab]').evaluateAll(t => t.map(x => x.dataset.t));
  const before = await keys();
  const src = await page.locator('.tabs [data-t=dash]').boundingBox(), dst = await page.locator('.tabs [role=tab]').first().boundingBox();
  await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2); await page.mouse.down();
  await page.mouse.move(src.x + src.width / 2 - 20, src.y + src.height / 2, { steps: 3 });
  await page.mouse.move(dst.x + 5, dst.y + dst.height / 2, { steps: 12 });
  await page.mouse.up();
  const after = await keys();
  assert.equal(after[0], 'dash'); assert.equal(after.length, before.length);
  assert.equal(await page.locator('.tabs [aria-selected=true]').getAttribute('data-t'), 'plan', 'arrastrar no cambia de pestaña');
  assert.deepEqual((await data(page)).tabs, after);
  await page.locator('.tabs [data-t=dash]').focus();
  await page.keyboard.press('Alt+ArrowRight');
  assert.equal((await keys())[1], 'dash');
});
await step('daily: crear, comentar, cambiar estado, avisos y filtros', async () => {
  await page.click('.tabs [data-t=daily]');
  await page.click('[data-a=dnew]');
  await page.waitForSelector('.dye');
  assert.equal(await page.locator('.dyr').count(), 3, 'las iniciativas del sprint en curso');
  const row = page.locator('.dyr', { hasText: 'Rediseño estructural GDA' });
  await row.locator('textarea').fill('Dev terminó el back, falta front');
  await row.locator('select').selectOption({ label: 'Bloqueado' });
  await page.fill('[data-dy=notes]', 'Jueves feriado. Ana de vacaciones.');
  await page.waitForTimeout(200);
  let d = await data(page); let x = live(d.dailies)[0];
  const gda = live(d.inits).find(i => i.n === 'Rediseño estructural GDA');
  assert.equal(x.items[gda.id].c, 'Dev terminó el back, falta front');
  assert.equal(d.states[gda.st].n, 'Bloqueado', 'el dueño cambia también la iniciativa');
  assert.equal(x.notes, 'Jueves feriado. Ana de vacaciones.');
  // otra daily en otra fecha y filtros
  const dprev = new Date(Date.now() - 86400000 * 35).toISOString().slice(0, 10);
  await page.click('[data-a=dnew]');                       // ya hay una de hoy: la abre
  assert.equal(live((await data(page)).dailies).length, 1);
  await page.locator('[data-dy=d]').fill(dprev);           // la de hoy pasa a otra fecha…
  await page.locator('[data-dy=d]').dispatchEvent('change');
  await page.click('[data-a=dnew]');                       // …y se crea la de hoy
  assert.equal(await page.locator('.dyli').count(), 2);
  assert.ok(await page.locator('.prev').count() >= 1, 'muestra el comentario de la daily anterior');
  await page.selectOption('[data-dy=fm]', dprev.slice(0, 7));
  assert.equal(await page.locator('.dyli').count(), 1);
  const wk = await page.locator('[data-dy=fw] option').nth(1).getAttribute('value');
  await page.selectOption('[data-dy=fw]', wk);
  assert.equal(await page.locator('.dyli').count(), 1);
  await page.selectOption('[data-dy=fm]', '');
  assert.equal(await page.locator('.dyli').count(), 2);
  await page.click('.dyli >> nth=0');
  await shot(page, '12i-daily');
  await page.locator('.dyr', { hasText: 'Rediseño estructural GDA' }).locator('select').selectOption({ label: 'En curso' });
});
await step('compartir: link de solo lectura que se actualiza', async () => {
  await page.click('[data-a=share]');
  await page.click('[data-a=shon]');
  await page.waitForSelector('#shl');
  const link = (await page.inputValue('#shl')).replace(/^https?:\/\/[^/]+\//, APP);
  assert.match(link, /\?ver=[A-Za-z0-9]{24}$/);
  await page.click('.sh [data-a=close]');
  await page.waitForFunction(() => document.querySelector('.sy')?.classList.contains('ok'), null, { timeout: 8000 });
  const cv = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-AR', timezoneId: 'America/Buenos_Aires' });
  const v = await cv.newPage();
  v.on('pageerror', e => errors.push(String(e))); v.on('console', m => { if (m.type() === 'error' && !/status of 404/.test(m.text())) errors.push(m.text()); });   // el 404 del link revocado es esperado
  await v.goto(link);
  await v.waitForSelector('.rob');
  assert.equal(await v.locator('#af').count(), 0, 'no pide cuenta');
  assert.equal(await v.locator('.onb').count(), 0, 'sin introducción');
  await v.click('.tabs [data-t=inits]');
  await v.waitForSelector('.itr');
  assert.equal(await v.locator('.itr').count(), 4);
  assert.ok(!(await v.isVisible('#addi')) && !(await v.isVisible('.grip')));
  assert.ok(await v.locator('select[data-ch=st]').first().isDisabled());
  await v.click('.itn >> nth=0');
  await v.waitForSelector('.sh');
  assert.ok(await v.locator('#in').isDisabled()); assert.equal(await v.locator('.sh button[type=submit]:visible').count(), 0);
  await v.click('.sh [data-a=close]');
  await v.click('.tabs [data-t=plan]');
  await v.waitForSelector('.blk');
  const before = JSON.stringify(live((await data(page)).blocks).map(b => [b.s, b.e]));
  const bb = await v.locator('.blk').first().boundingBox();
  await v.mouse.move(bb.x + 20, bb.y + 10); await v.mouse.down(); await v.mouse.move(bb.x + 140, bb.y + 10, { steps: 5 }); await v.mouse.up();
  await v.waitForTimeout(300);
  assert.equal(await v.locator('.sh[data-f=block] button[type=submit]:visible').count(), 0, 'no se puede editar el plazo');
  await v.keyboard.press('Escape');
  await v.click('[data-a=gran][data-v=d]');      // cambiar la vista sí se puede (solo para quien mira)
  await v.waitForSelector('#rm.g-d');
  await v.click('.tabs [data-t=cur]'); await v.waitForSelector('.rep');
  // la daily sí se puede completar desde el link
  await v.click('.tabs [data-t=daily]');
  await v.waitForSelector('.dye');
  const vr = v.locator('.dyr', { hasText: 'Campaña post-mudanza' });
  await vr.locator('textarea').fill('Escrito por alguien del equipo');
  await vr.locator('select').selectOption({ label: 'Bloqueado' });
  await v.waitForFunction(() => document.querySelector('.sy')?.textContent.startsWith('Actualizado'), null, { timeout: 8000 });
  const ownerD = JSON.parse(store.get('user:taiel@test.com')).data;
  const cpm = Object.values(ownerD.inits).find(i => i.n === 'Campaña post-mudanza');
  const today0 = Object.values(ownerD.dailies).sort((a, b) => b.d.localeCompare(a.d))[0];
  assert.equal(today0.items[cpm.id].c, 'Escrito por alguien del equipo');
  assert.notEqual(ownerD.states[cpm.st].n, 'Bloqueado', 'desde el link no cambia la iniciativa');
  assert.ok(await v.locator('[data-a=ddel]').count() === 0, 'desde el link no se puede borrar');
  await v.screenshot({ path: join(SHOTS, '22b-compartido-daily.png'), fullPage: true });
  // el dueño ve lo que escribió el equipo
  await page.click('.tabs [data-t=daily]');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(() => [...document.querySelectorAll('.dyc')].some(t => t.value === 'Escrito por alguien del equipo'), null, { timeout: 8000 });
  await page.click('.tabs [data-t=plan]');
  await v.screenshot({ path: join(SHOTS, '22-compartido-sprint.png'), fullPage: true });
  // el dueño agrega una iniciativa y el link se actualiza
  await page.click('.tabs [data-t=inits]');
  await page.fill('#ain', 'Nueva desde el dueño'); await page.click('#addi button[type=submit]');
  await page.waitForFunction(() => document.querySelector('.sy')?.classList.contains('ok'), null, { timeout: 8000 });
  await v.click('.tabs [data-t=inits]');
  await v.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await v.waitForSelector('.itn:has-text("Nueva desde el dueño")');
  await v.screenshot({ path: join(SHOTS, '23-compartido-iniciativas.png') });
  // dejar de compartir
  await page.click('[data-a=share]');
  await page.click('[data-a=shoff]'); await page.click('[data-a=yes]');
  await page.waitForSelector('[data-a=shon]');
  await page.click('.sh [data-a=close]');
  await page.waitForFunction(() => document.querySelector('.sy')?.classList.contains('ok'), null, { timeout: 8000 });
  await v.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await v.waitForSelector('.v-gone');
  await v.screenshot({ path: join(SHOTS, '24-compartido-cerrado.png') });
  await cv.close();
  assert.equal(JSON.stringify(live((await data(page)).blocks).map(b => [b.s, b.e])), before);
  // la iniciativa de prueba se borra para no alterar los pasos siguientes
  await page.click('.itn:has-text("Nueva desde el dueño")'); await page.click('[data-a=idel]'); await page.click('[data-a=yes]');
  await page.click('.tabs [data-t=plan]');
});
await step('roadmap en pantalla completa', async () => {
  await page.click('[data-a=full]');
  await page.waitForSelector('body.rmfull');
  assert.ok(!(await page.isVisible('#hd')) && !(await page.isVisible('.tabs')));
  const h = (await page.locator('#rm').boundingBox()).height;
  assert.ok(h > 700, 'el roadmap ocupa la pantalla: ' + h);
  await shot(page, '12b-pantalla-completa');
  await page.keyboard.press('Escape');
  await page.waitForSelector('body:not(.rmfull)');
  assert.ok(await page.isVisible('#hd'));
});
await step('editar el proyecto desde la vista de proyectos', async () => {
  await page.click('.brand');
  await page.click('.pcw [data-a=pcmenu]');
  await page.click('[data-a=pedit]');
  await page.fill('#sn', 'Célula Fulfillment');
  await page.click('#sf button[type=submit]');
  await page.waitForSelector('.pcard:has-text("Célula Fulfillment")');
  await page.click('.pcw [data-a=pcmenu]');
  await page.click('.sh [data-a=states]');
  await page.waitForSelector('.sh .tge');
  await page.click('.sh [data-a=close]');
  await page.waitForSelector('.ov', { state: 'detached' });
  await shot(page, '12c-proyectos-menu');
  assert.equal(live((await data(page)).projects)[0].n, 'Célula Fulfillment');
  await page.click('.pcard');
  await page.click('[data-a=ptab][data-t=plan]');
});
await step('se guarda en el servidor y aparece en otro dispositivo', async () => {
  await page.waitForFunction(() => document.querySelector('.sy')?.classList.contains('ok'), null, { timeout: 8000 });
  const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-AR', timezoneId: 'America/Buenos_Aires' });
  const m = await c2.newPage(); watch(m);
  await m.goto(APP);
  await m.fill('[data-au=email]', 'taiel@test.com'); await m.fill('[data-au=pass]', 'clave-segura-1');
  await m.click('#af button[type=submit]');
  await m.waitForSelector('.onb');
  await m.click('[data-a=oskip]');
  await m.waitForSelector('#addi');    // abre el último proyecto usado; la pestaña se recuerda por dispositivo
  await m.click('[data-a=ptab][data-t=plan]');
  await m.waitForSelector('#rm');
  await m.waitForTimeout(300);
  assert.equal(await m.locator('.blk').count(), 3);
  await m.screenshot({ path: join(SHOTS, '13-movil-roadmap.png') });
  // tocar una fila vacía abre un plazo nuevo
  const b = await m.locator('.rr').nth(1).locator('.rt').boundingBox();
  await m.touchscreen.tap(b.x + 100, b.y + b.height / 2);
  await m.waitForSelector('.sh[data-f=block]');
  await m.waitForTimeout(500);
  assert.equal(await m.locator('.sh[data-f=block]').count(), 1, 'la ventana sigue abierta');
  await m.screenshot({ path: join(SHOTS, '14-movil-plazo.png') });
  await m.click('.sh [data-a=close]');
  await m.click('[data-a=ptab][data-t=inits]');
  await m.waitForSelector('.itr');
  await m.screenshot({ path: join(SHOTS, '15-movil-iniciativas.png'), fullPage: true });
  await m.click('.brand');
  await m.waitForSelector('.pcard');
  await m.screenshot({ path: join(SHOTS, '16-movil-proyectos.png') });
  await c2.close();
});
await step('proyecto de ejemplo y pantalla de proyectos', async () => {
  await page.click('.brand');
  await page.click('[data-a=newproj]');
  await page.click('.sh [data-a=close]');
  await page.evaluate(() => document.querySelector('[data-a=sample]'));
  // el botón de ejemplo está en la intro y en la pantalla vacía; acá se usa la intro
  await page.click('[data-a=go][data-v=set]');
  await page.click('[data-a=onbshow]');
  for (let i = 0; i < 3; i++) await page.click('[data-a=onext]');
  await page.click('[data-a=onext]');     // con proyectos ya creados, el último paso dice "Empezar"
  await page.waitForSelector('.onb', { state: 'detached' });
  await page.evaluate(() => { localStorage.setItem('trazo.local', JSON.stringify({ ...JSON.parse(localStorage.getItem('trazo.local')), onb: 1 })); });
  await page.click('.brand');
  await shot(page, '17-proyectos');
  assert.equal(await page.locator('.pcard').count(), 1);
});
await step('pantalla vacía ofrece el ejemplo', async () => {
  const c3 = await browser.newContext({ viewport: { width: 1280, height: 820 }, locale: 'es-AR', timezoneId: 'America/Buenos_Aires' });
  const q = await c3.newPage(); watch(q);
  await q.goto(APP);
  await q.click('[data-m=signup]');
  await q.fill('[data-au=email]', 'otra@test.com'); await q.fill('[data-au=pass]', 'clave-segura-2');
  await q.click('#af button[type=submit]');
  await q.waitForSelector('.onb');
  for (let i = 0; i < 3; i++) await q.click('[data-a=onext]');
  await q.click('[data-a=osample]');
  await q.waitForSelector('.blk');
  await q.waitForTimeout(200);
  await q.screenshot({ path: join(SHOTS, '18-ejemplo-roadmap.png') });
  assert.ok(await q.locator('.blk').count() >= 10);
  assert.ok(await q.locator('.dlm').count() >= 3, 'marcas de deadline');
  await q.click('[data-a=ptab][data-t=inits]');
  await q.screenshot({ path: join(SHOTS, '19-ejemplo-iniciativas.png') });
  await q.click('[data-a=ptab][data-t=cur]');
  await q.waitForSelector('.rep');
  await q.screenshot({ path: join(SHOTS, '19c-ejemplo-sprint-actual.png'), fullPage: true });
  await q.click('[data-a=ptab][data-t=sprints]');
  assert.equal(await q.locator('.spc').count(), 3);
  await q.screenshot({ path: join(SHOTS, '19d-ejemplo-sprints.png'), fullPage: true });
  await q.click('[data-a=ptab][data-t=dash]');
  await q.waitForSelector('.hm');
  assert.ok(await q.locator('.hm td.lv4, .hm td.lv3, .hm td.lv2, .hm td.lv1').count() > 0);
  await q.screenshot({ path: join(SHOTS, '19b-ejemplo-tablero.png'), fullPage: true });
  await q.click('[data-a=ptab][data-t=teams]');
  await q.screenshot({ path: join(SHOTS, '20-ejemplo-equipos.png') });
  await q.evaluate(() => { localStorage.setItem('trazo.local', JSON.stringify({ ...JSON.parse(localStorage.getItem('trazo.local')), theme: 'dark' })); });
  await q.reload();
  await q.click('[data-a=ptab][data-t=plan]');
  await q.waitForSelector('.blk');
  await q.waitForTimeout(900);
  await q.screenshot({ path: join(SHOTS, '21-oscuro-roadmap.png') });
  await c3.close();
});
await step('eliminar iniciativa con deshacer, y exportar', async () => {
  await page.click('.pcard');
  await page.click('[data-a=ptab][data-t=inits]');
  await page.click('.itn:has-text("Comunicación preventiva")');
  await page.click('[data-a=idel]');
  await page.click('[data-a=yes]');
  assert.equal(await page.locator('.itr').count(), 3);
  await page.click('#t button');
  assert.equal(await page.locator('.itr').count(), 4);
  await page.click('.brand');
  await page.click('.pcw [data-a=pcmenu]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-a=csv]')]);
  const csv = readFileSync(await dl.path(), 'utf8');
  assert.ok(csv.includes('Rediseño estructural GDA') && csv.includes('Desarrollo (IMPLE)'));
});
await step('cerrar sesión y volver a entrar', async () => {
  await page.click('[data-a=go][data-v=set]');
  await page.click('[data-a=logout]');
  await page.waitForSelector('#af');
  await page.fill('[data-au=pass]', 'clave-segura-1');
  await page.click('#af button[type=submit]');
  await page.waitForSelector('.v-project');
  assert.equal(live((await data(page)).inits).length, 4);
});
await step('sin errores en la consola', async () => { assert.deepEqual(errors, []); });

await browser.close(); api.close(); web.close();
console.log(`\n${n} pasos OK`);
