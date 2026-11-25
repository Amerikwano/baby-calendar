/* 카카오·네이버 로그인 서버(Cloudflare Workers). 비밀 값으로 로그인을 확인하고 이름만 앱에 돌려준다. 아무것도 저장하지 않는다. */
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

async function handle(req, env, get = fetch) {
  const url = new URL(req.url), m = url.pathname.match(/^\/(login|callback)\/(kakao|naver)$/);
  if (req.method !== 'GET' || !m) return new Response('없는 주소예요.', { status: 404 });
  const p = m[2], P = PROVIDERS[p], cb = `${url.origin}/callback/${p}`, state = url.searchParams.get('state') || '';
  if (!STATE.test(state)) return new Response('잘못된 요청이에요.', { status: 400 });
  if (!P.ready(env)) return back(env, p, state, { error: 'off' });
  if (m[1] === 'login') return go(P.authorize(env, cb, state));
  const code = url.searchParams.get('code');
  if (!code) return back(env, p, state, { error: url.searchParams.get('error') === 'access_denied' ? 'cancel' : 'fail' });
  try {
    const [u, body] = P.token(env, cb, code, state);
    const t = await (await get(u, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' }, body: new URLSearchParams(body) })).json();
    if (!t.access_token) throw new Error('token');
    const r = await get(P.me, { headers: { authorization: 'Bearer ' + t.access_token } }); if (!r.ok) throw new Error('me');
    const who = P.user(await r.json()); if (!who.id) throw new Error('id');
    // 원래 회원번호 대신 이 앱에서만 쓰는 값으로 바꿔 돌려준다.
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${p}:${who.id}:${env[p.toUpperCase() + '_SECRET']}`));
    return back(env, p, state, { id: Array.from(new Uint8Array(h).slice(0, 16), b => b.toString(16).padStart(2, '0')).join(''), name: String(who.name || '').slice(0, 40) });
  } catch (e) { console.error(p, e.message); return back(env, p, state, { error: 'fail' }); }
}
export { handle };
export default { fetch: (req, env) => handle(req, env) };
