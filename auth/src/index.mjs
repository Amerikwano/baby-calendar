/* 카카오·네이버 로그인 서버(Cloudflare Workers). 비밀 값으로 로그인을 확인하고 이름만 앱에 돌려준다.
   다른 창에서 로그인이 끝나도 앱이 이어받도록 결과를 10분까지만 맡아 두고, 앱이 가져가면 바로 지운다(desk.mjs). */
const PROVIDERS = {
  kakao: {
    authorize: (e, cb, s) => 'https://kauth.kakao.com/oauth/authorize?' + new URLSearchParams({ response_type: 'code', client_id: e.KAKAO_ID, redirect_uri: cb, state: s }),
    token: (e, cb, code) => ['https://kauth.kakao.com/oauth/token', { grant_type: 'authorization_code', client_id: e.KAKAO_ID, client_secret: e.KAKAO_SECRET, redirect_uri: cb, code }],
    me: 'https://kapi.kakao.com/v2/user/me', ready: e => e.KAKAO_ID && e.KAKAO_SECRET,
    user: j => ({ id: j.id, name: ((j.kakao_account || {}).profile || j.properties || {}).nickname }),
  },
  naver: {
    authorize: (e, cb, s) => 'https://nid.naver.com/oauth2.0/authorize?' + new URLSearchParams({ response_type: 'code', client_id: e.NAVER_ID, redirect_uri: cb, state: s }),
    token: (e, cb, code, s) => ['https://nid.naver.com/oauth2.0/token', { grant_type: 'authorization_code', client_id: e.NAVER_ID, client_secret: e.NAVER_SECRET, code, state: s }],
    me: 'https://openapi.naver.com/v1/nid/me', ready: e => e.NAVER_ID && e.NAVER_SECRET,
    user: j => ({ id: (j.response || {}).id, name: (j.response || {}).nickname || (j.response || {}).name }),
  },
};
const STATE = /^[0-9a-f]{32}$/;
const go = url => new Response(null, { status: 302, headers: { location: url, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
// 결과는 항상 정해진 앱 주소로만 돌려준다.
const back = (env, p, state, o) => go(env.APP_URL + '#' + new URLSearchParams(Object.assign({ social: p, state }, o)));

const V = /^[0-9a-f]{64}$/;
const hex = async s => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))), b => b.toString(16).padStart(2, '0')).join('');
// desk: 결과를 잠시 맡아 두는 곳. 시작한 앱만 아는 값(v)이 있어야 가져갈 수 있다.
// 맡아 두는 곳이 잠깐 안 되더라도 로그인 자체는 이어진다.
const safe = b => ({ peek: p => b.peek(p).catch(() => null), finish: (p, r) => b.finish(p, r).catch(() => { }), start: (p, c) => b.start(p, c).catch(e => console.error('desk', e.message)) });
const deskOf = env => state => env.DESK.get(env.DESK.idFromName(state));
async function handle(req, env, get = fetch, desk = env.DESK ? deskOf(env) : null) {
  const url = new URL(req.url);
  // 어느 로그인이 준비됐는지만 알려 준다(값은 알려 주지 않는다).
  if (req.method === 'GET' && url.pathname === '/ready') return new Response(JSON.stringify(Object.fromEntries(Object.entries(PROVIDERS).map(([n, p]) => [n, Boolean(p.ready(env))]))), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': new URL(env.APP_URL).origin, 'cache-control': 'no-store' } });
  if (url.pathname === '/result') {
    const head = { 'access-control-allow-origin': new URL(env.APP_URL).origin, 'access-control-allow-headers': 'content-type', 'cache-control': 'no-store', 'content-type': 'application/json' };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: head });
    if (req.method !== 'POST' || !desk) return new Response('{}', { status: 404, headers: head });
    let b = {}; try { b = JSON.parse((await req.text()).slice(0, 500)); } catch { }
    if (!b || !STATE.test(b.state) || !V.test(b.v)) return new Response('{}', { status: 400, headers: head });
    return new Response(JSON.stringify(await desk(b.state).take(await hex(b.v)).catch(() => ({ stage: 'wait' }))), { headers: head });
  }
  const m = url.pathname.match(/^\/(login|callback)\/(kakao|naver)$/);
  if (req.method !== 'GET' || !m) return new Response('없는 주소예요.', { status: 404 });
  const p = m[2], P = PROVIDERS[p], cb = `${url.origin}/callback/${p}`, state = url.searchParams.get('state') || '';
  if (!STATE.test(state)) return new Response('잘못된 요청이에요.', { status: 400 });
  if (!P.ready(env)) return back(env, p, state, { error: 'off' });
  if (m[1] === 'login') {
    const c = url.searchParams.get('c') || '';
    if (desk && V.test(c)) await safe(desk(state)).start(p, c);
    return go(P.authorize(env, cb, state));
  }
  const box = desk ? safe(desk(state)) : null;
  // 같은 결과 주소가 두 번 열려도 처음 확인한 결과를 돌려준다.
  const had = box ? await box.peek(p) : null; if (had) return back(env, p, state, had);
  const code = url.searchParams.get('code');
  if (!code) { const error = url.searchParams.get('error') === 'access_denied' ? 'cancel' : 'fail'; if (box) await box.finish(p, { error }); return back(env, p, state, { error }); }
  try {
    const [u, body] = P.token(env, cb, code, state);
    const t = await (await get(u, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' }, body: new URLSearchParams(body) })).json();
    if (!t.access_token) throw new Error('token ' + String(t.error_code || t.error || '').slice(0, 40)); // 값 없이 오류 종류만 남긴다
    const r = await get(P.me, { headers: { authorization: 'Bearer ' + t.access_token } }); if (!r.ok) throw new Error('me');
    const who = P.user(await r.json()); if (!who.id) throw new Error('id');
    // 원래 회원번호 대신 이 앱에서만 쓰는 값으로 바꿔 돌려준다.
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${p}:${who.id}:${env[p.toUpperCase() + '_SECRET']}`));
    const ok = { id: Array.from(new Uint8Array(h).slice(0, 16), b => b.toString(16).padStart(2, '0')).join(''), name: String(who.name || '').slice(0, 40) };
    if (box) await box.finish(p, ok);
    return back(env, p, state, ok);
  } catch (e) {
    console.error(p, e.message);
    if (box) { for (let i = 0; i < 4; i++) { const r = await box.peek(p); if (r) return back(env, p, state, r); await new Promise(x => setTimeout(x, 400)); } await box.finish(p, { error: 'fail' }); }
    return back(env, p, state, { error: 'fail' });
  }
}
export { handle };
