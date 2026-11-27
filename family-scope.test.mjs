import test from 'node:test';
import assert from 'node:assert';
import { scope, unscope, catOf } from './family/src/core.mjs';
const data = { kids: [{ id: 'a' }, { id: 'p', kind: 'dog' }], diary: [{ id: 1, kid: 'a' }, { id: 2, kid: 'p' }, { id: 3, kid: '' }], photos: [], faces: [], logs: [], events: [], sido: 'x' };
test('수첩 종류별로 보여 주고, 저장하면 그 종류만 바꾼다', () => {
  assert.equal(catOf({ kind: 'cat' }), 'pet');
  const p = scope(data, ['pet']);
  assert.deepEqual(p.kids.map(k => k.id), ['p']); assert.deepEqual(p.diary.map(x => x.id), [2]);
  const mine = Object.assign({}, p, { diary: [{ id: 2, kid: 'p', body: 'x' }, { id: 4, kid: '' }], kids: p.kids.concat({ id: 'z' }) });
  const out = unscope(data, mine, ['pet']);
  assert.deepEqual(out.kids.map(k => k.id), ['a', 'p']);
  assert.deepEqual(out.diary.map(x => x.id).sort(), [1, 2, 3, 4]);
  assert.equal(out.diary.find(x => x.id === 4).kid, 'p');
  assert.equal(scope(data, null), data);
});
