// Revisión del desplazamiento del roadmap: la marca «Hoy» no tapa la columna de nombres y la barra de desplazamiento queda a la vista.
// Uso: node scripts/roadmap-scroll.mjs
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
process.env.TZ = 'America/Buenos_Aires';
import worker from '../server/src/index.js';
const here = dirname(fileURLToPath(import.meta.url)), WEB = join(here, '..', 'web'), SHOTS = join(here, '..', '.shots');
mkdirSync(SHOTS, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [here, '/opt/npm-tools/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules'] }));
const store = new Map();
const env = { SERVER_SECRET: 'r-secret-largo', KV: { get: async k => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); }, delete: async k => { store.delete(k); } } };
const api = http.createServer(async (req, res) => { const c = []; for await (const x of req) c.push(x); const r = await worker.fetch(new Request('http://a' + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(c) }), env); res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
let API = '';
const web = http.createServer((req, res) => { let p = new URL(req.url, 'http://x').pathname; if (p === '/') p = '/index.html'; const f = join(WEB, p); if (!f.startsWith(WEB) || !existsSync(f)) { res.writeHead(404); return res.end(); } if (p === '/config.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(`window.TRAZO_CONFIG={API_URL:${JSON.stringify(API)}};`); } res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f)); });
const listen = s => new Promise(r => s.listen(0, '127.0.0.1', () => r(s.address().port)));
const [ap, wp] = [await listen(api), await listen(web)]; API = `http://127.0.0.1:${ap}`; const APP = `http://127.0.0.1:${wp}/`;
const browser = await chromium.launch();
const fails = [];
for (const [w, h, name] of [[1440, 900, 'escritorio'], [1280, 720, 'notebook'], [390, 844, 'celular']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'es-AR', timezoneId: 'America/Buenos_Aires', ...(w < 500 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const page = await ctx.newPage();
  await page.goto(APP); await page.waitForSelector('#af');
  await page.click('[data-m=signup]'); await page.fill('[data-au=email]', `${name}@t.com`); await page.fill('[data-au=pass]', 'clave-segura-1');
  await page.click('#af button[type=submit]'); await page.waitForSelector('.onb');
  for (let i = 0; i < 3; i++) await page.click('[data-a=onext]');
  await page.click('[data-a=osample]'); await page.waitForSelector('.blk');
  // muchas iniciativas, para que el roadmap tenga desplazamiento vertical
  await page.evaluate(() => document.querySelector('.swel')?.remove());
  await page.click('.tabs [data-t=inits]');
  for (let i = 1; i <= 14; i++) { await page.fill('#ain', 'Iniciativa extra ' + i); await page.click('#addi button[type=submit]'); }
  await page.click('.tabs [data-t=plan]'); await page.waitForSelector('#rm');
  for (const g of ['w', 'm']) {
    await page.click(`[data-a=gran][data-v=${g}]`); await page.waitForSelector(`#rm.g-${g}`);
    await page.evaluate(() => window.scrollTo(0, 0));
    const r = await page.evaluate(() => { const rm = document.querySelector('#rm').getBoundingClientRect(); return { bottom: rm.bottom, vh: innerHeight, hasX: document.querySelector('#rm').scrollWidth > document.querySelector('#rm').clientWidth }; });
    if (r.bottom > r.vh + 1) fails.push(`${name}/${g}: el roadmap termina abajo de la pantalla (${Math.round(r.bottom)} > ${r.vh}), la barra horizontal no se ve`);
    // desplazar a la derecha: hoy queda detrás de la columna de nombres
    await page.evaluate(() => { const rm = document.querySelector('#rm'); rm.scrollLeft = rm.scrollWidth; rm.dispatchEvent(new Event('scroll')); });
    await page.waitForTimeout(150);
    const o = await page.evaluate(() => {
      const t = document.querySelector('.tdh'); if (!t) return null;
      const b = t.getBoundingClientRect(), lw = document.querySelector('.rl').getBoundingClientRect();
      const x = b.left + b.width / 2, y = b.top + b.height / 2;
      const top = document.elementFromPoint(x, y);
      return { visibleOverLabel: x < lw.right && top === t, below: b.bottom > document.querySelector('.rh').getBoundingClientRect().bottom + 1 };
    });
    if (o && o.visibleOverLabel) fails.push(`${name}/${g}: la marca «Hoy» se ve encima de la columna de nombres al desplazar`);
    if (o && o.below) fails.push(`${name}/${g}: la marca «Hoy» se sale del encabezado y tapa la primera fila`);
    await page.screenshot({ path: join(SHOTS, `r-${name}-${g}.png`) });
  }
  await ctx.close();
}
console.log(fails.length ? 'PROBLEMAS:\n  ' + fails.join('\n  ') : 'Sin problemas de desplazamiento');
await browser.close(); api.close(); web.close();
