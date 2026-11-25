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
test('로그인 결과 이어받기: 시작한 앱만, 한 번만, 실패가 성공을 덮지 않는다', async () => {
  const { handle } = await import('./auth/src/index.mjs'), { Box } = await import('./auth/src/box.mjs'), crypto2 = require('node:crypto');
  const boxes = new Map(), mk = () => { const m = new Map(); return new Box({ get: async k => m.get(k), put: async (k, v) => { m.set(k, v); }, deleteAll: async () => m.clear(), setAlarm: async () => { } }); };
  const desk = s => boxes.get(s) || boxes.set(s, mk()).get(s), env = { APP_URL: 'https://app.test/x/', NAVER_ID: 'n', NAVER_SECRET: 's' }, v = 'c'.repeat(64), c = crypto2.createHash('sha256').update(v).digest('hex');
  let uses = 0; const get = async u => /token/.test(u) ? new Response(JSON.stringify(uses++ ? { error: 'invalid_request' } : { access_token: 'T' })) : new Response(JSON.stringify({ response: { id: 'n7', nickname: '콩' } }));
  const g = u => handle(new Request('https://a.test' + u), env, get, desk), ask = async (st, vv) => (await handle(new Request('https://a.test/result', { method: 'POST', body: JSON.stringify({ state: st, v: vv }) }), env, get, desk)).json();
  assert.equal((await g(`/login/naver?state=${S32}&c=${c}`)).status, 302); assert.equal((await ask(S32, v)).stage, 'wait'); assert.equal((await ask(S32, 'd'.repeat(64))).stage, 'none');
  const one = (await g(`/callback/naver?code=C&state=${S32}`)).headers.get('location'), two = (await g(`/callback/naver?code=C&state=${S32}`)).headers.get('location'); assert.match(one, /id=/); assert.equal(two, one);
  const j = await ask(S32, v); assert.deepEqual([j.stage, j.provider, j.name], ['done', 'naver', '콩']); assert.equal((await ask(S32, v)).stage, 'none');
  assert.deepEqual(L.readResult(j, { p: 'naver' }).acct.name, '콩'); assert.equal(L.readResult(j, { p: 'kakao' }), null); assert.ok(L.readResult({ stage: 'fail' }, { p: 'kakao' }).error); assert.equal(L.readResult({ stage: 'wait' }, { p: 'kakao' }), null);
  const S2 = 'e'.repeat(32); await g(`/login/naver?state=${S2}&c=${c}`); await g(`/callback/naver?error=access_denied&state=${S2}`); assert.deepEqual(await ask(S2, v), { stage: 'fail', error: 'cancel' });
  const S3 = 'f'.repeat(32); await g(`/login/naver?state=${S3}`); uses = 0; await g(`/callback/naver?code=C&state=${S3}`); assert.equal((await ask(S3, v)).stage, 'none');
});
test('맡아 두는 곳이 고장 나도 로그인은 된다', async () => {
  const { handle } = await import('./auth/src/index.mjs'), bad = () => new Proxy({}, { get: () => async () => { throw new Error('x'); } }), env = { APP_URL: 'https://app.test/x/', KAKAO_ID: 'n', KAKAO_SECRET: 's' };
  const get = async u => new Response(JSON.stringify(/token/.test(u) ? { access_token: 'T' } : { id: 7 }));
  assert.equal((await handle(new Request(`https://a.test/login/kakao?state=${S32}&c=${'a'.repeat(64)}`), env, get, bad)).status, 302);
  assert.match((await handle(new Request(`https://a.test/callback/kakao?code=C&state=${S32}`), env, get, bad)).headers.get('location'), /id=[0-9a-f]{32}/);
});
test('동영상: 형식, 길이, 찍은 시각', async () => {
  const M = require('./media.js');
  assert.deepEqual([M.isVideo({ type: 'video/quicktime' }), M.isVideo({ type: '', name: 'a.MOV' }), M.isVideo({ type: 'image/jpeg' }), M.ext('video/quicktime'), M.ext('video/webm;codecs=vp9'), M.clock(75.4)], [true, true, false, 'mov', 'webm', '1:15']);
  const box = (n, ...p) => { const b = Buffer.concat(p), h = Buffer.alloc(8); h.writeUInt32BE(b.length + 8); h.write(n, 4); return Buffer.concat([h, b]); }, hd = Buffer.alloc(20); hd.writeUInt32BE(Date.UTC(2026, 10, 3, 1) / 1000 + 2082844800, 4);
  const f = new Blob([box('ftyp', Buffer.alloc(8)), box('mdat', Buffer.alloc(5000)), box('moov', box('free', Buffer.alloc(4)), box('mvhd', hd))]);
  assert.equal((await M.madeAt(f)).toISOString(), '2026-11-03T01:00:00.000Z'); assert.equal(await M.madeAt(new Blob(['x'])), null);
});
test('백업 zip에 동영상이 그대로 들어가고 손상을 찾는다', async () => {
  const { zip, unzip, blobCrc } = require('./local.js'), data = new Uint8Array(300000).map((_, i) => i * 7), blob = new Blob([data]);
  const z = zip([{ name: 'state.json', data: new TextEncoder().encode('{}') }, { name: 'photos/2026-11-03_' + 'a'.repeat(24) + '.mov', blob, crc: await blobCrc(blob) }]), r = await unzip(z);
  assert.ok(r[1].blob); assert.deepEqual(new Uint8Array(await r[1].blob.arrayBuffer()), data);
  const bad = new Uint8Array(await z.arrayBuffer()); bad[90000] ^= 1; await assert.rejects(unzip(new Blob([bad])), /손상/);
});
test('드라이브: 큰 파일은 이어 올리기로 보낸다', async () => {
  const D = require('./drive.js'), old = { f: globalThis.fetch, s: globalThis.sessionStorage }, calls = [];
  globalThis.sessionStorage = { getItem: () => JSON.stringify({ token: 'T', until: Date.now() + 1e6 }), setItem() { }, removeItem() { } };
  globalThis.fetch = async (u, o = {}) => { calls.push([o.method || 'GET', String(u).slice(0, 90)]); if (String(u).includes('uploadType=resumable')) return new Response('', { headers: { location: 'https://www.googleapis.com/upload/x' } }); return new Response(JSON.stringify({ files: [{ id: 'F' }], id: 'I' })); };
  try { assert.equal((await D.upload(new Blob([new Uint8Array(6 * 1048576)], { type: 'video/mp4' }), 'a.mp4', { pid: '1' })).id, 'I'); assert.deepEqual(calls.slice(-2).map(c => c[0]), ['POST', 'PUT']); calls.length = 0; await D.upload(new Blob(['x']), 'b.jpg', {}); assert.ok(calls.at(-1)[1].includes('multipart')); } finally { globalThis.fetch = old.f; globalThis.sessionStorage = old.s; }
});
test('밀어서 탭 옮기기: 순서와 판정', () => {
  const W = require('./swipe.js');
  assert.deepEqual(['home', 'cal', 'diary', 'album', 'grow', 'more'].map(t => W.next(t, 1)), ['cal', 'diary', 'album', 'grow', 'more', '']);
  assert.deepEqual(['home', 'cal', 'more', 'tips', 'vax'].map(t => W.next(t, -1)), ['', 'home', 'grow', 'more', 'more']); assert.equal(W.next('tips', 1), '');
  assert.deepEqual([W.judge(-120, 10, 200), W.judge(120, 10, 200), W.judge(-40, 0, 100), W.judge(-100, 80, 200), W.judge(-200, 5, 1500)], [1, -1, 0, 0, 0]);
});
