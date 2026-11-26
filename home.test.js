const test = require('node:test'), assert = require('node:assert/strict');
// Durable Object 저장소 흉내
function store() {
  const m = new Map(), clone = v => v instanceof Uint8Array ? v.slice() : structuredClone(v);
  return {
    m, async get(k) { if (Array.isArray(k)) return new Map(k.filter(x => m.has(x)).map(x => [x, clone(m.get(x))])); return m.has(k) ? clone(m.get(k)) : undefined; },
    async put(k, v) { if (typeof k === 'object') Object.entries(k).forEach(([a, b]) => m.set(a, clone(b))); else m.set(k, clone(v)); },
    async delete(k) { (Array.isArray(k) ? k : [k]).forEach(x => m.delete(x)); },
    async list({ prefix }) { return new Map([...m].filter(([k]) => k.startsWith(prefix)).sort(([a], [b]) => a < b ? -1 : 1).map(([k, v]) => [k, clone(v)])); },
  };
}
const ORIGIN = 'https://app.test';
async function server() {
  const { handle, HomeCore, PersonCore } = await import('./family/src/index.mjs'), homes = new Map(); let now = 1e12;
  const st = id => { if (!homes.has(id)) homes.set(id, store()); return homes.get(id); };
  const homeOf = id => ({ run: (req, path) => new HomeCore(st(id), now, KEY).route(req, path), plist: () => new PersonCore(st(id)).list(), padd: (...a) => new PersonCore(st(id)).add(...a), pdel: h => new PersonCore(st(id)).del(h) });
  const call = async (path, { method = 'GET', body, token, raw, type } = {}) => {
    const h = { origin: ORIGIN }; if (token) h.authorization = 'Bearer ' + token; if (body) h['content-type'] = 'application/json'; if (type) h['content-type'] = type;
    const r = await handle(new Request('https://f.test' + path, { method, headers: h, body: raw || (body ? JSON.stringify(body) : undefined) }), { APP_ORIGIN: ORIGIN, FAMILY_KEY: KEY }, homeOf, now);
    const ct = r.headers.get('content-type') || ''; return { status: r.status, body: ct.includes('json') ? await r.json() : new Uint8Array(await r.arrayBuffer()), type: ct };
  };
  const { signWho } = await import('./family/src/core.mjs');
  // 로그인 서버가 주는 확인표 흉내
  const who = (id, n, key = KEY) => signWho(key, { p: 'kakao', id, n, i: 'https://k.test/' + id + '.jpg', e: now + 7 * 86400000 });
  // 초대 링크로 들어와서 승인받기
  const enter = async (H, c, nick, tok, approver) => {
    const j = await call(H + '/join', { method: 'POST', body: { c, nick, tok } }); assert.equal(j.status, 202, JSON.stringify(j.body));
    assert.ok((await call(H + '/talk', { token: approver })).body.pending.some(p => p.nick === nick)); // 함께 쓰는 가족은 알림용으로 승인 요청을 본다
    assert.equal((await call(H + '/wait', { method: 'POST', body: { ticket: j.body.ticket } })).body.stage, 'wait');
    const p = (await call(H + '/state', { token: approver })).body.pending; const rid = p.find(x => x.nick === nick).rid;
    await call(H + '/approve', { method: 'POST', token: approver, body: { rid, ok: true } });
    const w = (await call(H + '/wait', { method: 'POST', body: { ticket: j.body.ticket } })).body; assert.equal(w.stage, 'ok');
    // 응답이 끊겨 다시 물어도 같은 사람으로 다시 들어온다
    const w2 = (await call(H + '/wait', { method: 'POST', body: { ticket: j.body.ticket } })).body; assert.equal(w2.stage, 'ok'); assert.equal(w2.id, w.id);
    assert.equal((await call(H + '/state', { token: w2.token })).status, 200); return w;
  };
  return { call, homes, who, enter, tick: ms => { now += ms; } };
}
const KEY = 'test-key';
const DATA = { v: 1, kids: [{ id: 'k1', name: '콩이', birth: '2026-06-01', born: true, photo: 'a'.repeat(24), options: {} }], events: [{ id: 'e1' }], diary: [{ id: 'd1', body: '첫날' }], photos: [], faces: [], logs: [{ id: 1 }], sido: '서울' };

test('가족 수첩 서버', async () => {
  const { call, tick, who, enter, homes } = await server();
  const made = (await call('/new', { method: 'POST', body: { nick: '엄마', data: DATA, tok: await who('mom', '김엄마') } })).body;
  assert.equal(made.role, 'owner'); assert.equal(made.name, '콩이네'); assert.match(made.home, /^[0-9a-f]{24}$/);
  const H = `/h/${made.home}`, own = made.token;
  assert.equal((await call(H + '/state')).status, 401);
  assert.equal((await call(H + '/state', { token: 'x'.repeat(64) })).status, 401);
  // 함께 쓰기 초대
  const inv = (await call(H + '/invite', { method: 'POST', token: own, body: { role: 'editor' } })).body.code;
  assert.deepEqual((await call(H + '/peek?c=' + inv)).body, { name: '콩이네', role: 'editor', by: '엄마', used: false });
  // 로그인 없이, 또는 가짜 확인표로는 들어올 수 없다
  assert.equal((await call(H + '/join', { method: 'POST', body: { c: inv, nick: '아빠' } })).status, 401);
  assert.equal((await call(H + '/join', { method: 'POST', body: { c: inv, nick: '아빠', tok: await who('dad', '박아빠', 'other-key') } })).status, 401);
  const dad = await enter(H, inv, '아빠', await who('dad', '박아빠'), own);
  assert.equal(dad.role, 'editor');
  // 한 번 쓴 링크는 다른 사람이 못 쓴다
  assert.equal((await call(H + '/join', { method: 'POST', body: { c: inv, nick: '아빠', tok: await who('stranger', '모르는사람') } })).status, 410);
  assert.equal((await call(H + '/peek?c=' + inv)).body.used, true);
  const s1 = (await call(H + '/state', { token: dad.token })).body; assert.equal(s1.rev, 1); assert.deepEqual(s1.data, DATA); assert.deepEqual(s1.members.map(m => m.nick).sort(), ['아빠', '엄마']);
  assert.equal((await call(H + '/state?have=1', { token: dad.token })).body.same, true);
  // 고치기: 같은 rev면 받고, 늦으면 409와 최신 기록
  assert.equal((await call(H + '/state', { method: 'PUT', token: dad.token, body: { rev: 1, data: Object.assign({}, DATA, { sido: '부산' }) } })).body.rev, 2);
  const late = await call(H + '/state', { method: 'PUT', token: own, body: { rev: 1, data: DATA } }); assert.equal(late.status, 409); assert.equal(late.body.data.sido, '부산'); assert.equal(late.body.rev, 2);
  // 열람 초대
  const vinv = (await call(H + '/invite', { method: 'POST', token: dad.token, body: { role: 'viewer' } })).body.code;
  // 보기만 초대받은 사람은 엄마·아빠(영어 포함)로 들어올 수 없다
  for (const bad of ['엄마', '콩이 아빠', '엄 마', '아　빠', 'M o m', 'd a d', '엄\u200b마', 'daddy']) assert.equal((await call(H + '/join', { method: 'POST', body: { c: vinv, nick: bad, tok: await who('gma', '김순자') } })).body.error, 'parent');
  const F = require('./home.js'); assert.equal(F.parentNick('할머니'), false); assert.equal(F.parentNick('grandmom'), false); assert.equal(F.parentNick('외삼촌'), false); assert.equal(F.parentNick('큰엄마'), false); assert.equal(F.parentNick('작은아빠'), false); assert.equal(F.parentNick('오빠'), false);
  const gma = await enter(H, vinv, '할머니', await who('gma', '김순자'), dad.token); assert.equal(gma.role, 'viewer');
  assert.equal((await call(H + '/me', { method: 'POST', token: gma.token, body: { nick: '아빠' } })).body.error, 'parent');
  // 함께 쓰는 가족에게만 카카오 이름이 보인다
  assert.equal((await call(H + '/state', { token: own })).body.members.find(m => m.nick === '할머니').kname, '김순자');
  assert.equal((await call(H + '/state', { token: gma.token })).body.members.find(m => m.nick === '할머니').kname, undefined);
  assert.equal((await call(H + '/state', { token: gma.token })).body.pending, undefined);
  const vs = (await call(H + '/state', { token: gma.token })).body.data;
  assert.deepEqual(Object.keys(vs).sort(), ['diary', 'faces', 'kids', 'photos', 'v']); assert.deepEqual(Object.keys(vs.kids[0]).sort(), ['birth', 'born', 'id', 'name', 'photo']);
  assert.equal((await call(H + '/state', { method: 'PUT', token: gma.token, body: { rev: 2, data: DATA } })).status, 403);
  assert.equal((await call(H + '/invite', { method: 'POST', token: gma.token, body: { role: 'viewer' } })).status, 403);
  assert.equal((await call(H + '/photo/' + 'a'.repeat(24), { method: 'PUT', token: gma.token, raw: new Uint8Array(10), type: 'image/jpeg' })).status, 403);
  // 사진: 여러 조각으로 저장하고 그대로 돌려준다
  const big = new Uint8Array(300000).map((_, i) => i % 251);
  assert.equal((await call(H + '/photo/' + 'a'.repeat(24), { method: 'PUT', token: own, raw: big, type: 'image/jpeg' })).status, 200);
  const got = await call(H + '/photo/' + 'a'.repeat(24), { token: gma.token }); assert.equal(got.type, 'image/jpeg'); assert.deepEqual(got.body, big);
  assert.equal((await call(H + '/photo/' + 'a'.repeat(24) + '?t=1', { token: gma.token })).status, 404);
  // 휴대폰 알림 주소: 브라우저 회사 주소만 받는다. 좋아요·댓글이 달리면 다른 가족에게 알릴 목록에 넣는다(하트는 함께 쓰는 가족만).
  assert.equal((await call(H + '/push', { method: 'POST', token: own, body: { endpoint: 'https://evil.test/x' } })).status, 400);
  await call(H + '/push', { method: 'POST', token: own, body: { endpoint: 'https://fcm.googleapis.com/fcm/send/mom' } });
  await call(H + '/push', { method: 'POST', token: gma.token, body: { endpoint: 'https://web.push.apple.com/gma' } });
  const pq = () => homes.get(made.home).m.get('pingq') || [];
  // 좋아요, 댓글, 대댓글
  let t = (await call(H + '/like', { method: 'POST', token: gma.token, body: { target: 'd:d1', on: true } })).body; assert.equal(t.likes['d:d1'].length, 1);
  assert.deepEqual(pq(), ['https://fcm.googleapis.com/fcm/send/mom']); homes.get(made.home).m.delete('pingq');
  t = (await call(H + '/note', { method: 'POST', token: gma.token, body: { target: 'd:d1', text: '예쁘다' } })).body; const c1 = t.notes[0];
  assert.deepEqual(pq(), ['https://fcm.googleapis.com/fcm/send/mom']); assert.equal(t.nicks[c1.who], '할머니');
  await call(H + '/like', { method: 'POST', token: own, body: { target: 'd:d1', on: true } }); assert.equal(pq().length, 1); // 할머니(보기만)에게는 하트 알림을 보내지 않는다
  await call(H + '/like', { method: 'POST', token: own, body: { target: 'd:d1', on: false } });
  assert.equal(c1.nick, '할머니');
  await call(H + '/me', { method: 'POST', token: gma.token, body: { nick: '외할머니' } });
  const tk = (await call(H + '/talk', { token: own })).body; assert.equal(tk.nicks[tk.notes[0].who], '외할머니'); // 댓글 이름은 그 집 명단의 지금 별명으로 보여 준다
  await call(H + '/me', { method: 'POST', token: gma.token, body: { nick: '할머니' } });
  tick(1000); t = (await call(H + '/note', { method: 'POST', token: own, body: { target: 'd:d1', parent: c1.id, text: '고마워요' } })).body; const r1 = t.notes[1]; assert.equal(r1.parent, c1.id);
  tick(1000); t = (await call(H + '/note', { method: 'POST', token: dad.token, body: { target: 'd:d1', parent: r1.id, text: '저도요' } })).body; assert.equal(t.notes[2].parent, c1.id);
  assert.equal((await call(H + '/note', { method: 'POST', token: dad.token, body: { target: 'p:zz', parent: c1.id, text: 'x' } })).status, 400);
  assert.equal((await call(H + '/unnote', { method: 'POST', token: dad.token, body: { id: c1.id } })).status, 403);
  t = (await call(H + '/unnote', { method: 'POST', token: gma.token, body: { id: c1.id } })).body; assert.equal(t.notes.length, 0); // 댓글을 지우면 달린 대댓글도
  t = (await call(H + '/like', { method: 'POST', token: gma.token, body: { target: 'd:d1', on: false } })).body; assert.equal(t.likes['d:d1'], undefined);
  // 거절하면 기다리던 사람은 못 들어오고 그 링크도 끝난다
  const inv3 = (await call(H + '/invite', { method: 'POST', token: own, body: { role: 'viewer' } })).body.code;
  assert.equal((await call(H + '/state', { token: own })).body.invites.length, 1);
  const j3 = (await call(H + '/join', { method: 'POST', body: { c: inv3, nick: '할머니', tok: await who('fake', '가짜') } })).body;
  assert.equal((await call(H + '/state', { token: own })).body.invites.length, 0);
  const rid = (await call(H + '/state', { token: own })).body.pending[0].rid;
  assert.equal((await call(H + '/approve', { method: 'POST', token: gma.token, body: { rid, ok: false } })).status, 403);
  await call(H + '/approve', { method: 'POST', token: own, body: { rid, ok: false } });
  assert.equal((await call(H + '/wait', { method: 'POST', body: { ticket: j3.ticket } })).body.stage, 'no');
  assert.equal((await call(H + '/join', { method: 'POST', body: { c: inv3, nick: '할머니', tok: await who('fake', '가짜') } })).status, 404);
  // 안 쓴 초대는 취소할 수 있다
  const inv4 = (await call(H + '/invite', { method: 'POST', token: own, body: { role: 'editor' } })).body.code;
  const iid = (await call(H + '/state', { token: own })).body.invites[0].id;
  assert.equal((await call(H + '/uninvite', { method: 'POST', token: own, body: { id: iid } })).body.invites.length, 0);
  assert.equal((await call(H + '/peek?c=' + inv4)).status, 404);
  // 새 기기: 같은 카카오로 로그인하면 링크 없이 다시 들어온다. 내 집 목록도 서버가 안다.
  const mr = await call('/mine', { method: 'POST', body: { tok: await who('gma', '김순자') } }); const mine = mr.body.homes;
  assert.deepEqual(mine, [{ home: made.home, role: 'viewer', name: '콩이네' }]);
  assert.deepEqual((await call('/mine', { method: 'POST', body: { tok: await who('mom', '김엄마') } })).body.homes.map(x => x.role), ['owner']);
  const again = (await call(H + '/back', { method: 'POST', body: { tok: await who('gma', '김순자') } })).body; assert.equal(again.role, 'viewer'); assert.equal(again.nick, '할머니');
  assert.equal((await call(H + '/state', { token: again.token })).status, 200);
  assert.equal((await call(H + '/back', { method: 'POST', body: { tok: await who('stranger', '모르는사람') } })).status, 404);
  // 이미 들어온 사람이 옛 링크를 다시 열어도 그냥 들어온다
  assert.equal((await call(H + '/join', { method: 'POST', body: { c: vinv, nick: '할머니', tok: await who('gma', '김순자') } })).body.role, 'viewer');
  // 초대 번호는 3일 뒤 끝나고, 확인표도 7일 뒤 끝난다
  const inv5 = (await call(H + '/invite', { method: 'POST', token: own, body: { role: 'viewer' } })).body.code, late5 = await who('uncle', '삼촌');
  tick(4 * 86400000); assert.equal((await call(H + '/join', { method: 'POST', body: { c: inv5, nick: '삼촌', tok: await who('uncle', '삼촌') } })).status, 404);
  tick(4 * 86400000); assert.equal((await call(H + '/back', { method: 'POST', body: { tok: late5 } })).status, 401);
  assert.equal((await call(H + '/leave', { method: 'POST', token: own })).status, 400);
  assert.equal((await call(H + '/leave', { method: 'POST', token: gma.token })).status, 200); assert.equal((await call(H + '/state', { token: gma.token })).status, 401);
  assert.equal((await call(H + '/state', { token: again.token })).status, 401); // 다른 기기 열쇠도 함께 끝난다
  assert.deepEqual((await call('/mine', { method: 'POST', body: { tok: await who('gma', '김순자') } })).body.homes, []);
});
test('가족 수첩 서버: 다른 주소에서 온 요청은 거절', async () => {
  const { handle, HomeCore } = await import('./family/src/index.mjs');
  const r = await handle(new Request('https://f.test/new', { method: 'POST', headers: { origin: 'https://evil.test' }, body: '{}' }), { APP_ORIGIN: ORIGIN }, () => { throw new Error('no'); });
  assert.equal(r.status, 403);
});
test('가족 수첩 합치기: 각자 고친 것을 모두 남긴다', () => {
  const F = require('./home.js');
  const base = { sido: '서울', kids: [{ id: 'k1', name: '콩이' }], diary: [{ id: 'd1', body: 'a' }, { id: 'd2', body: 'b' }], logs: [{ id: 1 }], events: [], photos: [], faces: [] };
  const mine = Object.assign({}, base, { diary: [{ id: 'd1', body: 'a 고침' }, { id: 'd2', body: 'b' }, { id: 'd3', body: '엄마' }], logs: [] });
  const theirs = Object.assign({}, base, { sido: '부산', diary: [{ id: 'd1', body: 'a' }, { id: 'd4', body: '아빠' }], logs: [{ id: 1 }, { id: 2 }] });
  const m = F.merge(base, mine, theirs);
  assert.equal(m.sido, '부산'); assert.deepEqual(m.diary.map(x => x.id + x.body), ['d1a 고침', 'd4아빠', 'd3엄마']); assert.deepEqual(m.logs, [{ id: 2 }]);
  assert.deepEqual(F.shared({ cur: 'k1', leads: [7], hour: 9, exports: 1, kids: [] }), { kids: [] });
  assert.deepEqual(F.parseJoin('a'.repeat(24) + '.' + 'b'.repeat(24)), { home: 'a'.repeat(24), code: 'b'.repeat(24) }); assert.equal(F.parseJoin('x.y'), null);
  const th = F.thread([{ id: 'a', target: 'd:1', parent: '' }, { id: 'b', target: 'd:1', parent: 'a' }, { id: 'c', target: 'd:2', parent: '' }], 'd:1'); assert.equal(th.length, 1); assert.equal(th[0].replies.length, 1);
});
