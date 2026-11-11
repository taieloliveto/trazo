// Revisión en celular: recorre todas las pantallas a 390 px, saca capturas y avisa si algo se sale del ancho.
// Uso: node scripts/mobile.mjs   (capturas en .shots/m-*.png)
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
process.env.TZ = 'America/Buenos_Aires';
import worker from '../server/src/index.js';

const here = dirname(fileURLToPath(import.meta.url)), WEB = join(here, '..', 'web'), SHOTS = join(here, '..', '.shots');
mkdirSync(SHOTS, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [here, '/opt/npm-tools/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules'] }));
const store = new Map();
const env = { SERVER_SECRET: 'mobile-secret-largo', KV: { get: async k => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); }, delete: async k => { store.delete(k); } } };
const api = http.createServer(async (req, res) => { const c = []; for await (const x of req) c.push(x); const r = await worker.fetch(new Request('http://a' + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(c) }), env); res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
let API = '';
const web = http.createServer((req, res) => { let p = new URL(req.url, 'http://x').pathname; if (p === '/') p = '/index.html'; const f = join(WEB, p); if (!f.startsWith(WEB) || !existsSync(f)) { res.writeHead(404); return res.end(); } if (p === '/config.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(`window.TRAZO_CONFIG={API_URL:${JSON.stringify(API)}};`); } res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f)); });
const listen = s => new Promise(r => s.listen(0, '127.0.0.1', () => r(s.address().port)));
const [ap, wp] = [await listen(api), await listen(web)]; API = `http://127.0.0.1:${ap}`; const APP = `http://127.0.0.1:${wp}/`;
const browser = await chromium.launch();
const W = +(process.env.MW || 390);
const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-AR', timezoneId: 'America/Buenos_Aires' });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push(String(e)));
const problems = [];
async function check(name, full = true) {
  await page.waitForTimeout(350);
  const o = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth, out = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('#rm, .hmw, .tabs, .chips, .rtb, .legend, .spchk, .itbl, .ov .sh, #sp')) continue;
      const r = el.getBoundingClientRect(); if (!r.width || getComputedStyle(el).visibility === 'hidden') continue;
      if (r.right > vw + 1 || r.left < -1) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').join('.')} (${Math.round(r.left)}–${Math.round(r.right)})`);
    }
    return { sw: document.documentElement.scrollWidth, vw, out: out.slice(0, 6) };
  });
  if (o.sw > o.vw + 1 || o.out.length) problems.push(`${name}: ancho ${o.sw}/${o.vw} ${o.out.join(' | ')}`);
  await page.screenshot({ path: join(SHOTS, `m-${name}.png`), fullPage: full });
}
await page.goto(APP); await page.waitForSelector('#af'); await page.waitForTimeout(900); await check('01-ingreso');
await page.click('[data-m=signup]'); await page.fill('[data-au=name]', 'Taiel'); await page.fill('[data-au=email]', 'm@test.com'); await page.fill('[data-au=pass]', 'clave-segura-1');
await page.click('#af button[type=submit]'); await page.waitForSelector('.onb'); await check('02-intro', false);
for (let i = 0; i < 3; i++) await page.click('[data-a=onext]');
await check('03-intro-final', false);
await page.click('[data-a=osample]'); await page.waitForSelector('.blk');
await check('04-roadmap', false);
for (const t of ['inits', 'sprints', 'cur', 'daily', 'teams', 'dash']) { await page.click(`.tabs [data-t=${t}]`); await check('05-' + t); }
await page.click('.tabs [data-t=daily]'); await page.click('[data-a=dnew]'); await check('06-daily-abierta');
await page.click('[data-a=dsave]');
await page.click('.tabs [data-t=inits]'); await page.click('[data-a=cols]'); await check('07-columnas', false); await page.click('.sh [data-a=close]');
await page.click('.itn >> nth=0'); await check('08-ficha', false); await page.click('.sh [data-a=close]');
await page.click('.tabs [data-t=plan]'); await page.click('.blk:not(.alr) >> nth=0'); await check('09-plazo', false); await page.click('.sh [data-a=close]');
await page.click('[data-a=share]'); await check('10-compartir', false); await page.click('.sh [data-a=close]');
await page.click('[data-a=full]'); await check('11-pantalla-completa', false); await page.click('[data-a=full]');
await page.click('[data-a=go][data-v=set]'); await check('12-ajustes');
await page.click('.back'); await page.click('.brand'); await check('13-proyectos');
await page.click('[data-a=newproj]'); await check('14-nuevo-proyecto', false);
console.log(problems.length ? 'PROBLEMAS:\n  ' + problems.join('\n  ') : 'Sin desbordes horizontales');
if (errors.length) console.log('ERRORES:', errors);
await browser.close(); api.close(); web.close();
