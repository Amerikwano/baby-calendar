const test = require('node:test'), assert = require('node:assert');
const C = require('./care.js'), A = require('./album.js'), L = require('./login.js'), I = require('./icons.js'), F = require('./family.js');
const log = o => Object.assign({ type: 'diaper', date: '2027-02-01', time: '10:00', sub: '', amount: '', end: '', done: true }, o);
test('기록 상태: 예정, 미완료, 완료', () => {
  const now = '2027-02-01T12:00';
  assert.deepEqual([log({}), log({ done: false, time: '13:00' }), log({ done: false, time: '11:00' })].map(l => C.state(l, now)), ['done', 'plan', 'miss']);
});
test('하루 요약: 완료한 것만, 자정을 넘긴 잠도 센다', () => {
  const r = C.report([log({ sub: '소변' }), log({ sub: '둘 다' }), log({ sub: '대변' }), log({ type: 'bottle', amount: '80' }), log({ type: 'bottle', amount: '100', done: false }), log({ type: 'breast' }), log({ type: 'sleep', time: '21:00', end: '05:30' }), log({ type: 'food', sub: '물' }), log({ type: 'food', sub: '이유식' }), log({ type: 'temp', amount: '37.2' })]);
  assert.deepEqual([r.feeds, r.ml, r.pee, r.poo, r.diaper, r.sleep, r.food, r.temp], [2, 80, 2, 2, 3, 510, 1, 37.2]);
  assert.deepEqual([C.hm(510), C.hm(45), C.clock('00:05'), C.clock('13:30'), C.report([]).total], ['8시간 30분', '45분', '오전 12:05', '오후 1:30', 0]);
});
test('기록은 최근 순서로, 모든 종류에 그림이 있다', () => {
  assert.deepEqual(C.byDay([log({ time: '09:00' }), log({ time: '11:00' })])['2027-02-01'].map(l => l.time), ['11:00', '09:00']);
  C.BORN.concat(C.WAIT).forEach(t => assert.ok(C.TYPES[t] && I.names.includes(t), t));
});
test('앨범: 연도·월·대표 사진·예전 오늘', () => {
  const p = (date, fav) => ({ id: date, date, fav }), l = A.sort([p('2025-11-24'), p('2027-11-25'), p('2027-10-01', true), p('2024-11-25'), p('2026-01-01')]);
  assert.deepEqual(A.years(l), ['2027', '2026', '2025', '2024']); assert.deepEqual(A.months(l, '2027'), ['2027-11', '2027-10']);
  assert.equal(A.cover(l).date, '2027-10-01');
  assert.deepEqual([A.onThisDay(l, '2027-11-25').ago, A.onThisDay(l, '2027-11-25').gap], [3, 0]); assert.equal(A.onThisDay(l, '2027-06-01'), null);
  assert.equal(A.onThisDay([p('2026-11-25')], '2026-11-25'), null);
});
test('아이를 빼면 그 아이의 육아 기록만 지운다', () => {
  const d = F.migrate({ v: 1, name: 'a', birth: '2027-01-01', born: true, photos: [], diary: [], events: [] }); d.kids.push(F.newKid('k2', { birth: '2027-01-01' })); d.logs = [{ id: 1, kid: 'k1' }, { id: 2, kid: 'k2' }];
  F.removeKid(d, 'k2'); assert.deepEqual(d.logs.map(l => l.id), [1]); assert.equal(d.kids[0].photo, '');
});
const S32 = 'a'.repeat(32);
test('소셜 로그인 결과: 내가 시작한 것만 받는다', () => {
  const s = { p: 'kakao', state: S32, t: 1000 }, ok = `#social=kakao&state=${S32}&id=abc123&name=%EC%BD%A9`;
  assert.equal(L.readReturn('#x', s, 2000), null); assert.deepEqual(L.readReturn(ok, s, 2000).acct, { provider: 'kakao', id: 'abc123', name: '콩' });
  for (const bad of [L.readReturn(ok, null, 2000), L.readReturn(ok, Object.assign({}, s, { state: 'b' }), 2000), L.readReturn(ok, Object.assign({}, s, { p: 'naver' }), 2000), L.readReturn(ok, s, 1e7), L.readReturn(ok.replace('abc123', '<x>'), s, 2000)]) assert.ok(bad.error);
  assert.match(L.readReturn(`#social=kakao&state=${S32}&error=cancel`, s, 2000).error, /취소/);
});
test('로그인 서버: 시작, 확인, 거절', async () => {
  const { handle } = await import('./auth/src/index.mjs'), env = { APP_URL: 'https://app/x/', KAKAO_ID: 'kid', KAKAO_SECRET: 'ks', NAVER_ID: 'nid', NAVER_SECRET: 'ns' };
  const req = (u, m) => new Request('https://auth.test' + u, { method: m || 'GET' }), loc = r => r.headers.get('location');
  assert.equal((await handle(req('/nope'), env)).status, 404); assert.equal((await handle(req('/login/kakao?state=zz'), env)).status, 400); assert.equal((await handle(req('/login/kakao?state=' + S32, 'POST'), env)).status, 404);
  const a = new URL(loc(await handle(req('/login/kakao?state=' + S32), env))); assert.deepEqual([a.host, a.searchParams.get('redirect_uri'), a.searchParams.get('state')], ['kauth.kakao.com', 'https://auth.test/callback/kakao', S32]);
  const calls = [], get = async (u, o) => { calls.push([u, String(o.body || ''), o.headers.authorization || '']); return new Response(JSON.stringify(/token/.test(u) ? { access_token: 'T' } : /kakao/.test(u) ? { id: 7, kakao_account: { profile: { nickname: '콩이네' } } } : { response: { id: 'n7', nickname: '네이버' } })); };
  for (const p of ['kakao', 'naver']) {
    const l = loc(await handle(req(`/callback/${p}?code=C&state=${S32}`), env, get)), q = new URLSearchParams(l.split('#')[1]);
    assert.ok(l.startsWith('https://app/x/#')); assert.match(q.get('id'), /^[0-9a-f]{32}$/); assert.ok(q.get('name')); assert.ok(!/ks|ns|=T(&|$)/.test(l.split('#')[1].replace(/id=[^&]*/, '').replace(/social=[^&]*/, '')));
  }
  assert.match(calls[0][1], /client_secret=ks/); assert.equal(calls[1][2], 'Bearer T');
  assert.match(loc(await handle(req(`/callback/kakao?error=access_denied&state=${S32}`), env, get)), /error=cancel/);
  assert.match(loc(await handle(req(`/callback/kakao?code=C&state=${S32}`), env, async () => new Response('{}'))), /error=fail/);
  assert.match(loc(await handle(req('/login/naver?state=' + S32), Object.assign({}, env, { NAVER_SECRET: '' }))), /error=off/);
});
test('성별: 태어난 아이는 남자·여자만, 예정이면 모름도 된다', () => {
  assert.equal(F.sexProblem('boy', true), ''); assert.equal(F.sexProblem('girl', true), ''); assert.ok(F.sexProblem('', true)); assert.equal(F.sexProblem('', false), '');
  assert.equal(F.migrate({ v: 1, kids: [{ id: 'k1', name: 'a', birth: '2027-01-01' }], photos: [], diary: [], events: [] }).kids[0].sex, '');
});
test('카카오톡 공유 글에는 사진과 생일이 들어가지 않는다', () => {
  const H = require('./share.js'), k = { name: '콩이', born: true, birth: '2027-01-01', photo: 'x' };
  assert.deepEqual([H.text(k, 100).title, H.text(k, 100).description], ['콩이 태어난 지 100일', '오늘은 백일이에요']);
  assert.deepEqual([8, 0, -2].map(n => H.text({ name: '콩이', born: false }, n).title), ['콩이 만나기까지 D-8', '콩이 만나는 날이에요', '콩이 예정일 D+2']); assert.equal(H.text(null).title, '우리 아기 수첩');
  const m = JSON.stringify(H.message(H.text(k, 5))); assert.ok(!/2027-01-01|photos/.test(m)); assert.ok(m.includes('https://amerikwano.github.io/baby-calendar/'));
});
test('로그인 서버는 준비 여부만 알려 준다', async () => {
  const { handle } = await import('./auth/src/index.mjs'), r = await handle(new Request('https://a.test/ready'), { APP_URL: 'https://app.test/x/', KAKAO_ID: 'a', KAKAO_SECRET: 'b' });
  assert.deepEqual(await r.json(), { kakao: true, naver: false }); assert.equal(r.headers.get('access-control-allow-origin'), 'https://app.test');
});
