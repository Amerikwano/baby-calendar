const test = require('node:test');
const assert = require('node:assert');
const Pet = require('./pet.js');

test('강아지: 기초 접종 6번, 동물등록, 해마다 추가접종', () => {
  const its = Pet.build('dog', '2026-09-01', {}, { today: '2026-11-27' });
  assert.equal(its.filter(i => /^pv\d$/.test(i.id)).length, 6);
  assert.equal(its.find(i => i.id === 'pv1').start, '2026-10-13');
  assert.equal(its.find(i => i.id === 'preg').start, '2026-11-01');
  assert.equal(its.find(i => i.id === 'pbo1').start, '2027-09-01');
  assert.ok(its.some(i => /^phw/.test(i.id)));
});
test('고양이: 기초 접종 3번과 광견병(선택), 등록은 선택', () => {
  const its = Pet.build('cat', '2026-09-01', {}, {});
  assert.equal(its.filter(i => /^pv\d$/.test(i.id)).length, 4);
  assert.match(its.find(i => i.id === 'preg').title, /선택/);
  assert.ok(!its.some(i => /^phw/.test(i.id)));
});
test('다 큰 아이를 데려오면 지난 일정은 빼고, 7살부터 반년 검진', () => {
  const its = Pet.build('dog', '2018-03-10', {}, { since: '2026-11-27', today: '2026-11-27' });
  assert.ok(!its.some(i => i.id === 'pv1'));
  assert.ok(its.some(i => i.id === 'pck9'));
  assert.ok(its.some(i => i.id === 'pch9'));
  const done = Pet.build('dog', '2018-03-10', { pv1: { done: '2018-04-30' } }, { since: '2026-11-27' });
  assert.ok(done.some(i => i.id === 'pv1'));
});
test('예방약은 지난달부터 다음 달까지만', () => {
  const hw = Pet.build('cat', '2020-01-15', {}, { today: '2026-11-27' }).filter(i => /^phw/.test(i.id));
  assert.ok(hw.length >= 2 && hw.length <= 3);
  assert.ok(hw.every(i => i.start >= '2026-10-27' && i.start <= '2027-01-06'));
});
test('나이에 맞는 팁', () => {
  assert.ok(Pet.tips('dog', 2).some(t => t.topic === '사회화'));
  assert.ok(Pet.tips('cat', 100).some(t => t.topic === '노령' || t.topic === '물'));
  assert.ok(Pet.tips('cat', 3).every(t => t.kinds.includes('c')));
  assert.equal(Pet.isPet({ kind: 'dog' }), true);
  assert.equal(Pet.isPet({}), false);
});
