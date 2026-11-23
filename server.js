/* 앱 화면을 띄우고 AI 기능을 대신 호출하는 작은 로컬 서버. 실행: npm start */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const sdk = require('@anthropic-ai/sdk');
const Anthropic = sdk.default || sdk.Anthropic || sdk;
const { findBenefits } = require('./benefits.js');
const { findTips } = require('./tips.js');
const store = require('./store.js');

const PORT = Number(process.env.PORT) || 4173;
const CACHE = path.join(store.DIR, 'ai-cache.json');
const FILES = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/schedule.js': ['schedule.js', 'text/javascript'], '/local.js': ['local.js', 'text/javascript'], '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json'], '/icon-192.png': ['icon-192.png', 'image/png'], '/apple-touch-icon.png': ['apple-touch-icon.png', 'image/png'], '/base-tips.js': ['base-tips.js', 'text/javascript'], '/base-benefits.js': ['base-benefits.js', 'text/javascript'] };
const SIDO = ['서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도'];
const HAS_KEY = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const running = new Map();

const send = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
const readCache = () => { try { return JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { return {}; } };
function writeCache(c) { fs.mkdirSync(path.dirname(CACHE), { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(c, null, 1)); }

function validate(b) {
  if (!b || !SIDO.includes(b.sido)) return null;
  const sigungu = String(b.sigungu || '').trim();
  if (!/^[가-힣0-9 ]{0,20}$/.test(sigungu)) return null;
  if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(b.birthMonth || '')) return null;
  const order = [1, 2, 3].includes(b.order) ? b.order : 1;
  return { sido: b.sido, sigungu, birthMonth: b.birthMonth, order };
}
function explain(e) {
  if (e instanceof Anthropic.AuthenticationError) return [401, 'API 키가 올바르지 않아요. 키를 다시 확인해 주세요.'];
  if (e instanceof Anthropic.RateLimitError) return [429, '요청이 많아 잠시 막혔어요. 조금 뒤 다시 시도해 주세요.'];
  if (e instanceof Anthropic.APIConnectionError) return [503, '인터넷 연결을 확인해 주세요.'];
  if (e instanceof Anthropic.APIError) return [502, `AI 서비스에서 오류가 났어요 (${e.status || '알 수 없음'}).`];
  if (e.message === 'NO_RESULT' || e.message === 'TOO_LONG') return [502, '이번에는 결과를 정리하지 못했어요. 다시 시도해 주세요.'];
  if (e.message === 'REFUSED') return [502, 'AI가 이 요청을 처리하지 못했어요.'];
  return [500, '알 수 없는 오류가 났어요.'];
}

// 두 AI 기능의 설정: 입력 확인, 저장 이름, 실행, 결과 모양
const KINDS = {
  '/api/benefits': {
    validate,
    key: q => ['benefit', q.sido, q.sigungu, q.birthMonth, q.order].join('|'),
    run: findBenefits,
    entry: (list, old) => { const before = new Set(old ? old.items.map(i => i.title) : []); return { items: list.map(i => Object.assign({}, i, { isNew: Boolean(old) && !before.has(i.title) })) }; },
  },
  '/api/tips': {
    validate: b => (b && Number.isInteger(b.ageMonths) && b.ageMonths >= -1 && b.ageMonths <= 71 ? { ageMonths: b.ageMonths } : null),
    key: q => 'tips|' + q.ageMonths,
    run: findTips,
    entry: r => r,
  },
};

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
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
      running.set(key, kind.run(new Anthropic(), Object.assign({ today }, q)).finally(() => running.delete(key)));
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
  const f = req.method === 'GET' && FILES[url];
  if (!f) return send(res, 404, { error: '없는 주소예요.' });
  res.writeHead(200, { 'content-type': f[1] + '; charset=utf-8', 'cache-control': 'no-store' });
  fs.createReadStream(path.join(__dirname, f[0])).pipe(res);
});
if (require.main === module) server.listen(PORT, '127.0.0.1', () => console.log(`http://localhost:${PORT}`));
module.exports = { server, validate };
