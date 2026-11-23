/* 웹 주소용 AI 서버(Cloudflare Workers).
   접근 코드가 맞는 요청만 받고, 하루·한 달 실행 횟수를 제한하고, 결과를 저장해 다시 쓴다. */
import { DurableObject } from 'cloudflare:workers';
import kinds from './kinds.js';
const { Anthropic, KINDS, explain, seoulToday } = kinds;

const cors = env => ({ 'access-control-allow-origin': env.ALLOWED_ORIGIN, 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-max-age': '86400', vary: 'Origin' });
const json = (env, status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors(env) } });
const sha = async s => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

async function allowed(req, env) {
  let code = '';
  try { code = decodeURIComponent((req.headers.get('authorization') || '').replace(/^Bearer /, '')); } catch { return false; }
  const a = await sha(code), b = await sha(env.ACCESS_CODE);
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export default {
  async fetch(req, env) {
    if (req.headers.get('origin') !== env.ALLOWED_ORIGIN) return json(env, 403, { error: '허용되지 않은 요청이에요.' });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) });
    if (!env.ACCESS_CODE || env.ACCESS_CODE.length < 12 || !env.ANTHROPIC_API_KEY) return json(env, 503, { error: 'AI 서버 설정이 끝나지 않았어요. API 키와 12자 이상의 접근 코드를 넣어 주세요.' });
    if (!await allowed(req, env)) return json(env, 401, { error: '접근 코드가 맞지 않아요.' });
    const url = new URL(req.url).pathname;
    if (req.method === 'GET' && url === '/api/status') return json(env, 200, { ai: true });
    const kind = req.method === 'POST' && Object.hasOwn(KINDS, url) && KINDS[url];
    if (!kind) return json(env, 404, { error: '없는 주소예요.' });
    const raw = await req.text();
    let body; try { body = raw.length <= 5000 && JSON.parse(raw); } catch { body = null; }
    const q = body && kind.validate(body);
    if (!q) return json(env, 400, { error: '입력한 내용을 확인해 주세요.' });
    const res = await env.AI.get(env.AI.idFromName('main')).fetch('https://do/', { method: 'POST', body: JSON.stringify({ url, q, refresh: body.refresh === true }) });
    return new Response(res.body, { status: 200, headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', ...cors(env) } });
  },
};

export class BabyAI extends DurableObject {
  running = new Map();

  // 실행 전에 먼저 센다. 실패해도 비용이 들 수 있어 되돌리지 않는다.
  async take() {
    const day = 'n:' + seoulToday(), mon = day.slice(0, 9);
    const c = await this.ctx.storage.get([day, mon]);
    const d = c.get(day) || 0, m = c.get(mon) || 0;
    if (d >= Number(this.env.DAILY_LIMIT)) return '오늘 쓸 수 있는 AI 횟수를 다 썼어요. 내일 다시 시도해 주세요.';
    if (m >= Number(this.env.MONTHLY_LIMIT)) return '이번 달 AI 횟수를 다 썼어요.';
    await this.ctx.storage.put({ [day]: d + 1, [mon]: m + 1 });
    return null;
  }

  async work({ url, q, refresh }) {
    const kind = KINDS[url], key = 'r:' + kind.key(q);
    if (this.running.has(key)) return this.running.get(key); // 같은 요청은 하나로 합친다
    const job = (async () => {
      const old = await this.ctx.storage.get(key);
      if (old && !refresh) return { status: 200, body: old };
      const full = await this.take();
      if (full) return { status: 429, body: { error: full } };
      try {
        const client = new Anthropic({ apiKey: this.env.ANTHROPIC_API_KEY, baseURL: this.env.ANTHROPIC_BASE_URL || undefined, maxRetries: 1 });
        const out = await kind.run(client, { today: seoulToday(), ...q });
        const entry = { checkedAt: new Date().toISOString(), ...kind.entry(out, old) };
        await this.ctx.storage.put(key, entry);
        return { status: 200, body: entry };
      } catch (e) {
        console.error('[ai]', e.name, e.status || '', e.message);
        const [status, error] = explain(e);
        return { status, body: { error } };
      }
    })().finally(() => this.running.delete(key));
    this.running.set(key, job);
    return job;
  }

  // 검색이 1~3분 걸리므로, 휴대폰 연결이 끊기지 않게 빈 줄을 보내다가 마지막 줄에 결과를 보낸다.
  async fetch(req) {
    const job = this.work(await req.json());
    const { readable, writable } = new TransformStream();
    const w = writable.getWriter(), enc = new TextEncoder();
    const beat = setInterval(() => w.write(enc.encode('\n')).catch(() => {}), 10000);
    w.write(enc.encode('\n')).catch(() => {});
    this.ctx.waitUntil(job.then(r => w.write(enc.encode(JSON.stringify(r) + '\n'))).catch(() => {}).finally(() => { clearInterval(beat); return w.close().catch(() => {}); }));
    return new Response(readable);
  }
}
