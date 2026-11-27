const test = require('node:test');
const assert = require('node:assert');
const C = require('./couple.js');
let seed = 1; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
test('랜덤 코스: 시간대 안에서 점심·저녁을 넣고, 비 오면 실내만', () => {
  const sp = C.SPOTS.filter(x => x.sido === '서울특별시');
  for (let i = 0; i < 30; i++) {
    const c = C.randomCourse({ from: '11:00', to: '21:00', spots: sp }, rnd);
    assert.ok(c.every(([t]) => C.mins(t) >= 660 && C.mins(t) < 1260));
    assert.ok(c.some(s => s[1].includes('점심')) && c.some(s => s[1].includes('저녁')));
  }
  const outdoor = ['공원 산책', '자전거 타기', '강변·호숫가 피크닉', '근교 드라이브', '야경 보러 가기'];
  for (let i = 0; i < 30; i++) { const c = C.randomCourse({ from: '10:00', to: '22:00', rain: true, spots: sp }, rnd); assert.ok(!c.some(s => outdoor.includes(s[1]) || s[2])); }
});
test('테마 코스: 실내 테마는 실내만, 야경 테마는 야경 명소', () => {
  const sp = C.SPOTS.filter(x => x.sido === '서울특별시');
  for (let i = 0; i < 20; i++) {
    const c = C.randomCourse({ from: '12:00', to: '22:00', theme: 'indoor', spots: sp }, rnd);
    assert.ok(!c.some(s => s[2]) && !c.some(s => ['공원 산책', '자전거 타기', '근교 드라이브'].includes(s[1])));
    const n = C.randomCourse({ from: '12:00', to: '22:00', theme: 'night', spots: sp }, rnd);
    assert.ok(n.some(s => s[1].includes('야경')));
  }
});
test('코스 순서가 말이 되게: 집 데이트는 요리가 배달 뒤에 따로 안 나오고, 장보기는 저녁 전, 즉흥 여행은 역에서 내리기부터', () => {
  for (let i = 0; i < 40; i++) {
    const h = C.randomCourse({ from: '10:00', to: '22:00', theme: 'home' }, rnd), dn = h.findIndex(s => s[1].includes('요리해서 저녁')), sh = h.findIndex(s => s[1].includes('장 보기'));
    assert.ok(!h.some(s => s[1] === '함께 요리하기'));
    if (sh >= 0 && dn >= 0) assert.ok(sh < dn);
    assert.ok(h.filter(s => /배달/.test(s[1])).length <= 1);
    const t = C.randomCourse({ from: '11:00', to: '20:00', theme: 'trip' }, rnd);
    assert.ok(t[0][1].includes('랜덤 역'));
    const m = C.randomCourse({ from: '11:00', to: '20:00', theme: 'memory' }, rnd);
    assert.ok(m.filter(s => /분식/.test(s[1])).length <= 1);
  }
});
test('명소 목록에 빈 칸이 없다', () => { assert.ok(C.SPOTS.every(x => x && x.name && x.sido)); });

test('키워드로 테마 고르기', () => {
  const C = require('./couple.js');
  assert.equal(C.themeFor('온천'), 'spa');
  assert.equal(C.themeFor('맛집'), 'food');
  assert.equal(C.themeFor('집에서 쉬기'), 'home');
  assert.equal(C.themeFor('생일'), 'bday');
  assert.equal(C.themeFor('아무 말'), 'trip');
  assert.equal(C.themeFor(''), null);
});
