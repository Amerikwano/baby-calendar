const test = require('node:test');
const assert = require('node:assert');
const { zip, unzip } = require('./local.js');
test('백업 zip: 만들고 되돌리기, 손상 감지', async () => {
  const files = [{ name: 'state.json', data: new TextEncoder().encode('{"v":1}') }, { name: 'photos/2026-12-03_한글.jpg', data: new Uint8Array(5000).map((_, i) => i) }];
  const b = zip(files), r = await unzip(b);
  assert.deepEqual(r.map(x => x.name), files.map(x => x.name));
  assert.deepEqual([...r[1].data], [...files[1].data]);
  const bad = new Uint8Array(await b.arrayBuffer()); bad[200] ^= 1;
  await assert.rejects(unzip(new Blob([bad])), /손상/);
  await assert.rejects(unzip(new Blob(['아무 파일이나 넣은 경우입니다 정말로'])), /백업 파일이 아니/);
  require('node:fs').writeFileSync(require('node:path').join(require('node:os').tmpdir(), 'baby-zip-test.zip'), Buffer.from(await b.arrayBuffer()));
});
