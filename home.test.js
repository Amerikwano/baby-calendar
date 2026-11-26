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
  const { handle, HomeCore } = await import('./family/src/index.mjs'), homes = new Map(); let now = 1e12;
  const homeOf = id => ({ run: (req, path) => { if (!homes.has(id)) homes.set(id, store()); return new HomeCore(homes.get(id), now).route(req, path); } });
  const call = async (path, { method = 'GET', body, token, raw, type } = {}) => {
    const h = { origin: ORIGIN }; if (token) h.authorization = 'Bearer ' + token; if (body) h['content-type'] = 'application/json'; if (type) h['content-type'] = type;
    const r = await handle(new Request('https://f.test' + path, { method, headers: h, body: raw || (body ? JSON.stringify(body) : undefined) }), { APP_ORIGIN: ORIGIN }, homeOf);
    const ct = r.headers.get('content-type') || ''; return { status: r.status, body: ct.includes('json') ? await r.json() : new Uint8Array(await r.arrayBuffer()), type: ct };
  };
  return { call, homes, tick: ms => { now += ms; } };
}
const DATA = { v: 1, kids: [{ id: 'k1', name: '콩이', birth: '2026-06-01', born: true, photo: 'a'.repeat(24), options: {} }], events: [{ id: 'e1' }], diary: [{ id: 'd1', body: '첫날' }], photos: [], faces: [], logs: [{ id: 1 }], sido: '서울' };

test('가족 수첩 서버', async () => {
  const { call, tick } = await server();
  const made = (await call('/new', { method: 'POST', body: { nick: '엄마', data: DATA } })).body;
  assert.equal(made.role, 'owner'); assert.equal(made.name, '콩이네'); assert.match(made.home, /^[0-9a-f]{24}$/);
  const H = `/h/${made.home}`, own = made.token;
  assert.equal((await call(H + '/state')).status, 401);
  assert.equal((await call(H + '/state', { token: 'x'.repeat(64) })).status, 401);
  // 함께 쓰기 초대
  const inv = (await call(H + '/invite', { method: 'POST', token: own, body: { role: 'editor' } })).body.code;
  assert.deepEqual((await call(H + '/peek?c=' + inv)).body, { name: '콩이네', role: 'editor', by: '엄마' });
  const dad = (await call(H + '/join', { method: 'POST', body: { c: inv, nick: '아빠' } })).body;
  assert.equal(dad.role, 'editor');
  const s1 = (await call(H + '/state', { token: dad.token })).body; assert.equal(s1.rev, 1); assert.deepEqual(s1.data, DATA); assert.deepEqual(s1.members.map(m => m.nick).sort(), ['아빠', '엄마']);
  assert.equal((await call(H + '/state?have=1', { token: dad.token })).body.same, true);
  // 고치기: 같은 rev면 받고, 늦으면 409와 최신 기록
  assert.equal((await call(H + '/state', { method: 'PUT', token: dad.token, body: { rev: 1, data: Object.assign({}, DATA, { sido: '부산' }) } })).body.rev, 2);
  const late = await call(H + '/state', { method: 'PUT', token: own, body: { rev: 1, data: DATA } }); assert.equal(late.status, 409); assert.equal(late.body.data.sido, '부산'); assert.equal(late.body.rev, 2);
  // 열람 초대
  const vinv = (await call(H + '/invite', { method: 'POST', token: dad.token, body: { role: 'viewer' } })).body.code;
  const gma = (await call(H + '/join', { method: 'POST', body: { c: vinv, nick: '할머니' } })).body; assert.equal(gma.role, 'viewer');
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
  // 좋아요, 댓글, 대댓글
  let t = (await call(H + '/like', { method: 'POST', token: gma.token, body: { target: 'd:d1', on: true } })).body; assert.equal(t.likes['d:d1'].length, 1);
  t = (await call(H + '/note', { method: 'POST', token: gma.token, body: { target: 'd:d1', text: '예쁘다' } })).body; const c1 = t.notes[0];
  assert.equal(c1.nick, '할머니');
  tick(1000); t = (await call(H + '/note', { method: 'POST', token: own, body: { target: 'd:d1', parent: c1.id, text: '고마워요' } })).body; const r1 = t.notes[1]; assert.equal(r1.parent, c1.id);
  tick(1000); t = (await call(H + '/note', { method: 'POST', token: dad.token, body: { target: 'd:d1', parent: r1.id, text: '저도요' } })).body; assert.equal(t.notes[2].parent, c1.id);
  assert.equal((await call(H + '/note', { method: 'POST', token: dad.token, body: { target: 'p:zz', parent: c1.id, text: 'x' } })).status, 400);
  assert.equal((await call(H + '/unnote', { method: 'POST', token: dad.token, body: { id: c1.id } })).status, 403);
  t = (await call(H + '/unnote', { method: 'POST', token: gma.token, body: { id: c1.id } })).body; assert.equal(t.notes.length, 0); // 댓글을 지우면 달린 대댓글도
  t = (await call(H + '/like', { method: 'POST', token: gma.token, body: { target: 'd:d1', on: false } })).body; assert.equal(t.likes['d:d1'], undefined);
  // 초대 번호는 7일 뒤 끝난다
  tick(8 * 86400000); assert.equal((await call(H + '/join', { method: 'POST', body: { c: inv, nick: '삼촌' } })).status, 404);
  assert.equal((await call(H + '/leave', { method: 'POST', token: own })).status, 400);
  assert.equal((await call(H + '/leave', { method: 'POST', token: gma.token })).status, 200); assert.equal((await call(H + '/state', { token: gma.token })).status, 401);
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
