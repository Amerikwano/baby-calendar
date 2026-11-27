const test = require('node:test');
const assert = require('node:assert');
const Me = require('./me.js');
test('국가검진: 출생연도 짝수·홀수와 같은 해, 나이·성별 맞춤', () => {
  const its = Me.build('1990-05-01', 'girl', {}, { today: '2026-11-27' });
  assert.ok(its.some(i => i.id === 'mgen2026') && its.some(i => i.id === 'mcer2026'));
  assert.ok(!its.some(i => i.id === 'mgen2027'));
  assert.ok(!its.some(i => /^mstm/.test(i.id)));
  const m = Me.build('1975-03-01', 'boy', {}, { today: '2026-11-27' });
  assert.ok(m.some(i => i.id === 'mstm2027') && m.some(i => i.id === 'mcol2026') && !m.some(i => /^mcer|^mbre/.test(i.id)));
});
test('나이와 성별에 맞는 팁, 솔로', () => {
  assert.equal(Me.age('1990-12-01', '2026-11-27'), 35);
  const t = Me.tips({ birth: '2000-01-01', sex: 'boy' }, '2026-11-27');
  assert.ok(t.money.some(x => x.title.includes('청약')) && !t.health.some(x => x.title.includes('자궁')));
  assert.equal(Me.isSolo({ kind: 'me', solo: true }), true);
});
