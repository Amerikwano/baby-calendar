/* 가족 수첩 서버(Cloudflare Workers + Durable Object). 집(수첩) 하나가 Durable Object 하나다. */
import { HomeCore, rand } from './core.mjs';

// 앱 주소에서 온 요청만 받는다.
export async function handle(req, env, homeOf) {
  const origin = req.headers.get('origin'), head = { 'access-control-allow-origin': env.APP_ORIGIN, 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS', 'access-control-allow-headers': 'content-type, authorization', 'access-control-max-age': '600', vary: 'origin', 'cache-control': 'no-store' };
  const out = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...head, 'content-type': 'application/json' } });
  if (origin !== env.APP_ORIGIN) return out({ error: 'origin' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: head });
  const url = new URL(req.url), p = url.pathname.split('/').filter(Boolean);
  let path = url.pathname;
  if (p[0] === 'new' && req.method === 'POST') { const id = rand(12); path = `/h/${id}/new`; p.splice(0, p.length, 'h', id, 'new'); }
  if (p[0] !== 'h' || !/^[0-9a-f]{24}$/.test(p[1] || '')) return out({ error: 'path' }, 404);
  const [status, body] = await homeOf(p[1]).run(req, path);
  if (body && body.bytes) return new Response(body.bytes, { status, headers: { ...head, 'content-type': body.type, 'cache-control': 'private, max-age=31536000, immutable' } });
  return out(p[2] === 'new' && status === 200 ? Object.assign({ home: p[1] }, body) : body, status);
}
export { HomeCore };
