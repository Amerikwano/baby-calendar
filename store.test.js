const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
process.env.BABY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'baby-'));
const test = require('node:test');
const assert = require('node:assert');
const { server } = require('./server.js');
const store = require('./store.js');
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40)]);

test('저장·사진 API', async t => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const u = 'http://127.0.0.1:' + server.address().port;
  const put = (rev, data) => fetch(u + '/api/state', { method: 'PUT', body: JSON.stringify({ rev, data }) });
  try {
    await t.test('일기 저장과 동시 저장 충돌', async () => {
      assert.deepEqual(await (await fetch(u + '/api/state')).json(), { rev: 0, data: null });
      assert.equal((await put(0, { a: 1 })).status, 200);
      assert.equal((await put(0, { a: 2 })).status, 409);
      assert.equal((await (await fetch(u + '/api/state')).json()).data.a, 1);
      assert.equal((await put(1, { a: 3 })).status, 200);
      assert.equal(fs.readdirSync(path.join(store.DIR, 'backup')).length, 1);
    });
    await t.test('사진 올리기, 보기, 지우면 휴지통으로', async () => {
      const r = await (await fetch(u + '/api/photos', { method: 'POST', body: JPG })).json();
      assert.equal(r.ext, 'jpg');
      const g = await fetch(`${u}/photos/${r.id}`);
      assert.equal(g.headers.get('content-type'), 'image/jpeg');
      assert.ok(Buffer.from(await g.arrayBuffer()).equals(JPG));
      assert.equal((await fetch(`${u}/photos/${r.id}/thumb`, { method: 'PUT', body: JPG })).status, 200);
      assert.equal((await fetch(`${u}/api/photos/${r.id}`, { method: 'DELETE' })).status, 200);
      assert.equal((await fetch(`${u}/photos/${r.id}`)).status, 404);
      assert.deepEqual(fs.readdirSync(path.join(store.DIR, 'trash')), [r.id + '.jpg']);
    });
    await t.test('사진이 아닌 파일, 경로 조작, 다른 사이트 거절', async () => {
      assert.equal((await fetch(u + '/api/photos', { method: 'POST', body: '<script>alert(1)</script>' })).status, 415);
      assert.equal((await fetch(u + '/photos/..%2f..%2fstate.json')).status, 404);
      assert.equal((await fetch(u + '/api/state', { method: 'PUT', headers: { origin: 'https://evil.example' }, body: '{}' })).status, 403);
    });
    await t.test('저장 파일이 망가지면 덮어쓰지 않는다', async () => {
      fs.writeFileSync(path.join(store.DIR, 'state.json'), '{broken');
      assert.equal((await put(2, { a: 9 })).status, 500);
      assert.equal(fs.readFileSync(path.join(store.DIR, 'state.json'), 'utf8'), '{broken');
    });
  } finally { server.close(); server.closeAllConnections(); fs.rmSync(store.DIR, { recursive: true, force: true }); }
});
