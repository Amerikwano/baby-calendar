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
