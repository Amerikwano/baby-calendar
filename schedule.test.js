const test = require('node:test');
const assert = require('node:assert');
const S = require('./schedule.js');
const B = '2026-12-03';
const get = (items, id) => items.find(i => i.id === id);

test('월 계산: 말일 보정, 연도 넘김, 윤년', () => {
  assert.equal(S.addMonths('2026-12-31', 2), '2027-02-28');
  assert.equal(S.addMonths('2027-08-31', 6), '2028-02-29');
  assert.equal(S.addMonths('2026-12-03', 1), '2027-01-03');
  assert.equal(S.addMonths('2026-12-03', 12), '2027-12-03');
});

test('12월 3일생 주요 일정', () => {
  const it = S.build(B);
  const want = {
    hepb1: ['2026-12-03', '2026-12-03'], bcg: ['2026-12-03', '2026-12-31'], ck1: ['2026-12-17', '2027-01-07'],
    hepb2: ['2027-01-03', '2027-02-02'], combo1: ['2027-02-03', '2027-03-02'], pcv3: ['2027-06-03', '2027-07-02'],
    ck2: ['2027-04-03', '2027-07-02'], mmr1: ['2027-12-03', '2028-04-02'], dtap4: ['2028-03-03', '2028-07-02'],
    or1: ['2028-06-03', '2029-06-02'], dtap5: ['2030-12-03', '2033-12-02'], flu1: ['2027-09-20', '2028-04-30'], flu2: ['2027-10-18', '2028-04-30'],
  };
  for (const [id, [s, e]] of Object.entries(want)) assert.deepEqual([get(it, id).start, get(it, id).end], [s, e], id);
  assert.equal(get(it, 'rota1').hard, '2027-03-17'); // 14주 6일 = 104일
  assert.equal(get(it, 'rota3').hard, '2027-08-03');
});

test('백신 선택과 id 중복', () => {
  for (const combo of ['5', '6']) for (const rota of ['RV1', 'RV5']) for (const je of ['dead', 'live']) {
    const it = S.build(B, { combo, rota, je });
    assert.equal(new Set(it.map(i => i.id)).size, it.length);
    assert.equal(!!get(it, 'hepb2'), combo === '5');
    assert.equal(!!get(it, 'hepb3'), combo === '5');
    assert.equal(!!get(it, 'rota3'), rota === 'RV5');
    assert.equal(!!get(it, 'je5'), je === 'dead');
  }
});

test('어느 날 태어나도 시작일이 마감일을 넘지 않는다', () => {
  for (let d = 0; d < 800; d++) {
    const b = S.addDays('2026-01-01', d);
    for (const i of S.build(b)) assert.ok(i.start <= i.end, b + ' ' + i.id);
    assert.ok(get(S.build(b), 'flu1').start >= S.addMonths(b, 6));
  }
});

test('1차 완료일에 맞춰 2차를 다시 계산', () => {
  const it = S.build(B, {}, { hepa1: { done: '2028-02-10' }, flu1: { done: '2027-10-05' } });
  assert.equal(get(it, 'hepa2').start, '2028-08-10');
  assert.equal(get(it, 'flu2').start, '2027-11-02');
});

test('상태와 알림일', () => {
  const it = S.build(B);
  assert.equal(S.status(get(it, 'bcg'), '2026-12-02'), 'next');
  assert.equal(S.status(get(it, 'bcg'), '2026-12-31'), 'open');
  assert.equal(S.status(get(it, 'bcg'), '2027-01-01'), 'late');
  assert.equal(S.status(get(it, 'rota1'), '2027-03-10'), 'open'); // 권장월은 지났지만 지원 기한 전
  assert.equal(S.alertDate(get(it, 'bcg'), '2026-11-23'), '2026-12-17');
  assert.equal(S.alertDate(get(it, 'metab'), '2026-12-05'), '2026-12-06'); // 지난 날짜면 내일
  assert.equal(S.lastChance(get(it, 'ck1')), '2026-12-31');
});

test('ics: 알림 시각, 줄 길이, 짝, 완료 제외', () => {
  assert.equal(S.trigger(0, 9), 'PT9H');
  assert.equal(S.trigger(1, 9), '-PT15H');
  assert.equal(S.trigger(7, 9), '-PT159H');
  const items = S.build(B, {}, { hepb1: { done: B } });
  const { text, count } = S.toICS(items, { name: '아기, 테스트', today: '2026-11-23', leads: [7, 1], hour: 9, stamp: '20261123T000000Z' });
  const n = re => (text.match(re) || []).length;
  assert.equal(n(/BEGIN:VEVENT/g), count);
  assert.equal(n(/BEGIN:VEVENT/g), n(/END:VEVENT/g));
  assert.equal(n(/BEGIN:VALARM/g), n(/END:VALARM/g));
  for (const l of text.split('\r\n')) assert.ok(Buffer.byteLength(l) <= 75, l);
  assert.ok(!text.includes('UID:hepb1@'));
  assert.ok(text.replace(/\r\n /g, '').includes('아기\\, 테스트'));
  const uids = text.match(/UID:.*/g); assert.equal(new Set(uids).size, uids.length);
});

test('개월 수', () => {
  assert.equal(S.ageMonths(B, '2026-12-02'), -1);
  assert.equal(S.ageMonths(B, '2026-12-03'), 0);
  assert.equal(S.ageMonths(B, '2027-06-02'), 5);
  assert.equal(S.ageMonths(B, '2027-06-03'), 6);
  assert.equal(S.ageMonths('2027-01-31', '2027-02-28'), 1);
});
test('직접 넣은 일정도 ics에 들어간다', () => {
  const r = S.toICS([], { name: 'a', today: '2026-11-23', leads: [1], hour: 9, stamp: '20261123T000000Z', events: [{ id: '1', date: '2027-01-05', time: '14:30', title: '백일 사진; 예약' }, { id: '2', date: '2027-03-12', title: '백일' }] });
  assert.equal(r.count, 2);
  assert.ok(r.text.includes('DTSTART:20270105T143000')); assert.ok(r.text.includes('DTSTART;VALUE=DATE:20270312')); assert.ok(r.text.includes('사진\\; 예약'));
});
test('기본 팁: 모든 개월에 있고, 안전 기준을 지킨다', () => {
  const T = require('./base-tips.js');
  for (let m = 0; m < 24; m++) assert.ok(T.forMonth(m).length >= 3, 'm' + m);
  assert.equal(new Set(T.list.map(x => x.id)).size, T.list.length);
  assert.ok(T.list.every(x => /^https:/.test(x.url)));
  assert.ok(!T.forMonth(5).some(x => x.id === 'milk12')); assert.ok(T.forMonth(11).some(x => x.id === 'honey'));
});
