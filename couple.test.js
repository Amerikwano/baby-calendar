const test = require('node:test');
const assert = require('node:assert');
const C = require('./couple.js');
test('기념일: 사귄 날이 1일, 100일 단위와 주년', () => {
  const its = C.build('2026-01-01', {}, {});
  assert.equal(its.find(i => i.id === 'cpd100').end, '2026-04-10');
  assert.equal(its.find(i => i.id === 'cpy1').end, '2027-01-01');
  assert.equal(its.find(i => i.id === 'cpd100').start, '2026-03-27');
});
test('수첩을 만들기 전에 지난 기념일은 뺀다', () => {
  const its = C.build('2020-01-01', {}, { since: '2026-11-27' });
  assert.ok(its.every(i => i.end >= '2026-11-27'));
});
test('계절별 데이트 코스와 지역 명소', () => {
  assert.equal(C.season('2026-11-27'), 2);
  assert.ok(C.courses('2026-12-24').some(x => x.title.includes('빛축제')));
  assert.ok(C.SPOTS.some(x => x.sido === '제주특별자치도'));
});
