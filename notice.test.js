const test = require('node:test'), assert = require('node:assert');
const N = require('./notice.js'), S = require('./schedule.js'), F = require('./family.js'), C = require('./care.js');
const mk = (kid, o) => Object.assign({ kids: [F.newKid('k1', Object.assign({ name: '콩이', birth: '2027-01-01', born: true, since: '2027-01-01', options: {} }, kid))], leads: [7, 1], hour: 9, events: [], logs: [] }, o);
const subs = (l, now) => N.active(l, now).map(n => n.subject);
test('시기가 지난 것은 알리지 않고, 등록한 날부터만 알린다', () => {
  const db = mk({ birth: '2026-06-16', since: '2026-11-25' }), l = N.build(db, S, '2026-11-25');
  assert.ok(l.length && l.every(n => n.date >= '2026-11-25' && n.limit >= '2026-11-25'));
  assert.ok(!l.some(n => /k1:(bcg|hepb1|combo1|pcv1|metab):/.test(n.id)));
  const a = N.active(l, '2026-11-25T20:00'), late = S.build('2026-06-16', {}, {}).filter(i => S.status(i, '2026-11-25') === 'late').map(i => 'k1:' + i.id);
  assert.ok(!a.some(n => late.includes(n.subject)));
  const open = S.build('2026-06-16', {}, {}).filter(i => S.status(i, '2026-11-25') === 'open').map(i => 'k1:' + i.id).sort();
  assert.deepEqual(a.filter(n => / 받을 시기/.test(n.title)).map(n => n.subject).sort(), open);
});
test('미리, 당일, 마감 알림과 완료·예약', () => {
  const d = l => l.filter(n => n.subject === 'k1:pcv1').map(n => n.date + ' ' + n.id.split(':')[2]);
  assert.deepEqual(d(N.build(mk(), S, '2027-01-01')), ['2027-02-22 lead7', '2027-02-28 lead1', '2027-03-01 start', '2027-03-24 last7', '2027-03-30 last1']);
  assert.deepEqual(d(N.build(mk({ records: { pcv1: { done: '2027-03-02' } } }), S, '2027-03-05')), []);
  assert.deepEqual(d(N.build(mk({ records: { pcv1: { appt: '2027-03-10' } } }), S, '2027-01-01')), ['2027-03-03 appt7', '2027-03-09 appt1', '2027-03-10 appt0']);
  assert.deepEqual(d(N.build(mk(), S, '2027-04-01')), []);
});
test('지금 보여 줄 것: 울린 것만, 같은 일은 하나, 최근 것부터', () => {
  const l = N.build(mk(), S, '2027-03-01');
  assert.ok(!subs(l, '2027-02-22T08:59').includes('k1:pcv1')); assert.ok(subs(l, '2027-02-22T09:00').includes('k1:pcv1'));
  const a = N.active(l, '2027-03-01T10:00'); assert.equal(a.filter(n => n.subject === 'k1:pcv1').length, 1); assert.match(a.find(n => n.subject === 'k1:pcv1').id, /start/);
  assert.ok(!subs(N.build(mk(), S, '2027-03-30'), '2027-04-01T10:00').includes('k1:pcv1'));
});
test('출산 예정, 일정, 예정 기록', () => {
  const w = N.build(mk({ born: false, birth: '2027-02-10', since: '2027-01-20' }), S, '2027-01-20'); assert.deepEqual(w.map(n => n.date), ['2027-02-03', '2027-02-09', '2027-02-10']);
  const l = N.build(mk({}, { events: [{ id: 'a', title: '백일 사진', date: '2027-01-05', time: '14:00', kid: '' }, { id: 'b', title: '지난', date: '2027-01-01', kid: '' }, { id: 'c', title: '끝', date: '2027-01-05', kid: '', done: true }], logs: [{ id: 'l', kid: 'k1', type: 'bottle', date: '2027-01-03', time: '13:30', done: false }, { id: 'm', kid: 'k1', type: 'bottle', date: '2027-01-03', time: '13:30', done: true }] }), S, '2027-01-03');
  assert.deepEqual(l.filter(n => /^(e|l):/.test(n.subject)).map(N.at), ['2027-01-03T13:30', '2027-01-04T09:00', '2027-01-05T09:00', '2027-01-05T13:00']);
  const at = t => N.active(l, t).some(n => n.subject === 'l:l'); assert.deepEqual([at('2027-01-03T13:29'), at('2027-01-03T13:30'), at('2027-01-03T14:31')], [false, true, false]);
  C.BORN.concat(C.WAIT).forEach(t => assert.notEqual(N.logName(t), '기록', t));
});
test('서버에 맡기는 것은 시각뿐, 휴대폰 글은 하나로 묶고 다시 띄우지 않는다', () => {
  const l = N.build(mk(), S, '2027-01-01'), ms = s => Date.parse(s + ':00Z'), now = ms('2027-01-01T08:00'), w = N.wakes(l, now, ms);
  assert.ok(w.length <= 300 && w.every(t => Number.isInteger(t) && t > now) && new Set(w).size === w.length);
  const m = N.message(l, '2027-01-01T09:00', [], N.logName); assert.match(m.title, /알림 \d+개/); assert.ok(m.body.includes('B형간염'));
  assert.equal(N.message(l, '2027-01-01T09:01', m.ids, N.logName), null); assert.equal(N.message(l, '2027-01-01T18:00', [], N.logName), null);
});
test('알림 서버: 주소·시각 검사와 서명', async () => {
  const P = await import('./push/src/core.mjs'), now = Date.parse('2027-01-01T00:00Z');
  for (const ok of ['https://fcm.googleapis.com/fcm/send/abc', 'https://web.push.apple.com/Qx', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://wns2-sg2p.notify.windows.com/w/?token=x']) assert.ok(P.endpointOk(ok), ok);
  for (const bad of ['http://fcm.googleapis.com/x', 'https://evil.com/', 'https://fcm.googleapis.com.evil.com/', 'https://push.apple.com.evil/x', 'https://127.0.0.1/', 'https://fcm.googleapis.com:8443/x', 'https://u@fcm.googleapis.com/x', 5, '']) assert.ok(!P.endpointOk(bad), String(bad));
  assert.deepEqual(P.timesOk([now + 5, now + 5, now - 10], now), [now + 5]); assert.equal(P.timesOk([1.5], now), null); assert.equal(P.timesOk('x', now), null); assert.equal(P.timesOk([now + 500 * 864e5], now), null);
  const k = await P.newKeys(); assert.equal(Buffer.from(k.pub, 'base64url').length, 65);
  let seen; const s = await P.send(k, 'https://web.push.apple.com/Qx', 'https://a/', now, async (u, o) => { seen = [u, o]; return { status: 201 }; }); assert.equal(s, 201); assert.equal(seen[1].body, undefined);
  const [, t, pub] = seen[1].headers.authorization.match(/^vapid t=([^,]+), k=(.+)$/), [h, b, sig] = t.split('.'); assert.equal(pub, k.pub); assert.deepEqual(JSON.parse(Buffer.from(b, 'base64url')), { aud: 'https://web.push.apple.com', exp: now / 1000 + 43200, sub: 'https://a/' });
  const key = await crypto.subtle.importKey('raw', Buffer.from(pub, 'base64url'), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']); assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(sig, 'base64url'), new TextEncoder().encode(`${h}.${b}`)));
});
test('내 일정은 고른 때마다 알린다', () => {
  const ev = o => N.build(mk({}, { events: [Object.assign({ id: 'a', title: 'x', date: '2027-01-05', time: '', kid: '' }, o)] }), S, '2027-01-02').filter(n => n.subject === 'e:a').map(n => N.at(n) + ' ' + n.title);
  assert.deepEqual(ev({}), ['2027-01-04T09:00 내일 x', '2027-01-05T09:00 오늘 x']);
  assert.deepEqual(ev({ time: '14:05', rem: ['h1', 'm10', 'm0'] }), ['2027-01-05T13:05 1시간 뒤 x', '2027-01-05T13:55 10분 뒤 x', '2027-01-05T14:05 지금 x']);
  assert.deepEqual(ev({ time: '00:30', rem: ['d0', 'h1'] }), ['2027-01-04T23:30 1시간 뒤 x']); assert.deepEqual(ev({ time: '08:00', rem: ['d0'] }), ['2027-01-05T07:00 오늘 x']);
  assert.deepEqual(ev({ rem: [] }), []); assert.deepEqual(ev({ done: true }), []);
});
