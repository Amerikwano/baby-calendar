/* 앱 화면을 띄우고 AI 기능을 대신 호출하는 작은 로컬 서버. 실행: npm start */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Anthropic, KINDS, validate, explain, seoulToday } = require('./worker/src/kinds.js');
const store = require('./store.js');

const PORT = Number(process.env.PORT) || 4173;
const CACHE = path.join(store.DIR, 'ai-cache.json');
const FILES = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/schedule.js': ['schedule.js', 'text/javascript'], '/regions.js': ['regions.js', 'text/javascript'], '/local.js': ['local.js', 'text/javascript'], '/family.js': ['family.js', 'text/javascript'], '/hospitals.js': ['hospitals.js', 'text/javascript'], '/drive.js': ['drive.js', 'text/javascript'], '/hospitals.json': ['hospitals.json', 'application/json'], '/login.js': ['login.js', 'text/javascript'], '/icons.js': ['icons.js', 'text/javascript'], '/care.js': ['care.js', 'text/javascript'], '/album.js': ['album.js', 'text/javascript'], '/onboard.js': ['onboard.js', 'text/javascript'], '/app.js': ['app.js', 'text/javascript'], '/notice.js': ['notice.js', 'text/javascript'], '/bell.js': ['bell.js', 'text/javascript'], '/share.js': ['share.js', 'text/javascript'], '/swipe.js': ['swipe.js', 'text/javascript'], '/media.js': ['media.js', 'text/javascript'], '/viewer.js': ['viewer.js', 'text/javascript'], '/sync.js': ['sync.js', 'text/javascript'], '/home.js': ['home.js', 'text/javascript'], '/app.css': ['app.css', 'text/css'], '/privacy.html': ['privacy.html', 'text/html'], '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json'], '/icon-192.png': ['icon-192.png', 'image/png'], '/apple-touch-icon.png': ['apple-touch-icon.png', 'image/png'], '/base-tips.js': ['base-tips.js', 'text/javascript'], '/base-benefits.js': ['base-benefits.js', 'text/javascript'] };
const HAS_KEY = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const running = new Map();

const send = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
const readCache = () => { try { return JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { return {}; } };
function writeCache(c) { fs.mkdirSync(path.dirname(CACHE), { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(c, null, 1)); }

async function handleAI(kind, req, res) {
  let raw = '';
  for await (const c of req) { raw += c; if (raw.length > 5000) return send(res, 413, { error: '요청이 너무 커요.' }); }
  let body; try { body = JSON.parse(raw); } catch { return send(res, 400, { error: '요청 형식이 잘못됐어요.' }); }
  const q = kind.validate(body);
  if (!q) return send(res, 400, { error: '입력한 내용을 확인해 주세요.' });
  const key = kind.key(q);
  const old = readCache()[key];
  if (old && !body.refresh) return send(res, 200, old);
  if (!HAS_KEY()) return send(res, 503, { error: 'AI를 쓰려면 API 키가 필요해요.', needKey: true });
  try {
    if (!running.has(key)) {
      running.set(key, kind.run(new Anthropic(), Object.assign({ today: seoulToday() }, q)).finally(() => running.delete(key)));
    }
    const entry = Object.assign({ checkedAt: new Date().toISOString() }, kind.entry(await running.get(key), old));
    const latest = readCache(); latest[key] = entry; writeCache(latest);
    send(res, 200, entry);
  } catch (e) {
    console.error('[ai]', e.name, e.status || '', e.message);
    const [code, msg] = explain(e);
    send(res, code, { error: msg });
  }
}

async function readBody(req, limit) {
  const parts = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > limit) return null; parts.push(c); }
  return Buffer.concat(parts);
}
async function handleStore(req, res, url) {
  if (url === '/api/state' && req.method === 'GET') return send(res, 200, store.read());
  if (url === '/api/state' && req.method === 'PUT') {
    const raw = await readBody(req, 10e6);
    let b; try { b = JSON.parse(raw); } catch { return send(res, 400, { error: '저장할 내용을 읽지 못했어요.' }); }
    if (!Number.isInteger(b.rev) || !b.data || typeof b.data !== 'object') return send(res, 400, { error: '저장할 내용을 읽지 못했어요.' });
    const rev = store.write(b.rev, b.data);
    return rev === null ? send(res, 409, { error: '다른 창에서 먼저 저장했어요.' }) : send(res, 200, { rev });
  }
  if (url === '/api/photos' && req.method === 'POST') {
    const buf = await readBody(req, 40e6);
    if (!buf) return send(res, 413, { error: '사진이 너무 커요 (40MB까지).' });
    const r = store.savePhoto(buf);
    return r ? send(res, 200, r) : send(res, 415, { error: 'JPG, PNG, WebP, GIF 사진만 넣을 수 있어요.' });
  }
  const m = url.match(/^\/(?:api\/)?photos\/([0-9a-f]{24})(\/thumb)?$/);
  if (m && req.method === 'GET') {
    const f = store.photoFile(m[1], Boolean(m[2]));
    if (!f) return send(res, 404, { error: '사진이 없어요.' });
    res.writeHead(200, { 'content-type': f.type, 'x-content-type-options': 'nosniff', 'cache-control': 'private, max-age=86400' });
    return fs.createReadStream(f.file).pipe(res);
  }
  if (m && m[2] && req.method === 'PUT') {
    const buf = await readBody(req, 2e6);
    return buf && store.saveThumb(m[1], buf) ? send(res, 200, {}) : send(res, 400, { error: '작은 사진을 만들지 못했어요.' });
  }
  if (m && !m[2] && req.method === 'DELETE') return send(res, store.trashPhoto(m[1]) ? 200 : 404, {});
  return send(res, 404, { error: '없는 주소예요.' });
}

const server = http.createServer((req, res) => {
  // 이 컴퓨터의 화면에서 온 요청만 받는다(다른 사이트가 내 API 키로 호출하는 것을 막음).
  const host = (req.headers.host || '').replace(/:\d+$/, '');
  if (!['localhost', '127.0.0.1'].includes(host)) return send(res, 403, { error: '허용되지 않은 주소예요.' });
  const origin = req.headers.origin;
  if (origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return send(res, 403, { error: '허용되지 않은 요청이에요.' });
  const url = new URL(req.url, 'http://localhost').pathname;
  if (req.method === 'POST' && KINDS[url]) return handleAI(KINDS[url], req, res);
  if (url === '/api/state' || url.startsWith('/api/photos') || url.startsWith('/photos/')) {
    return handleStore(req, res, url).catch(e => { console.error('[store]', e.message); if (!res.headersSent) send(res, 500, { error: '저장 폴더를 읽거나 쓰지 못했어요.' }); });
  }
  if (req.method === 'GET' && url === '/api/status') return send(res, 200, { ai: HAS_KEY() });
  const reg = url.match(/^\/regions\/([a-z-]+)\.json$/);
  const f = req.method === 'GET' && (FILES[url] || (reg && fs.existsSync(path.join(__dirname, 'regions', reg[1] + '.json')) && ['regions/' + reg[1] + '.json', 'application/json']));
  if (!f) return send(res, 404, { error: '없는 주소예요.' });
  res.writeHead(200, { 'content-type': f[1] + '; charset=utf-8', 'cache-control': 'no-store' });
  fs.createReadStream(path.join(__dirname, f[0])).pipe(res);
});
if (require.main === module) server.listen(PORT, '127.0.0.1', () => console.log(`http://localhost:${PORT}`));
module.exports = { server, validate };
