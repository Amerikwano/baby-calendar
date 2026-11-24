const test = require('node:test'), assert = require('node:assert');
const F = require('./family.js'), H = require('./hospitals.js'), D = require('./drive.js'), M = require('./scripts/make-hospitals.js'), S = require('./schedule.js');
const old = () => ({ v: 1, name: '콩이', birth: '2027-01-15', born: false, order: 1, options: { combo: '6' }, records: { bcg: { done: '2027-01-20' } }, sido: '서울특별시', events: [{ id: 'e' }], diary: [{ id: 'd', photos: [] }], photos: [{ id: 'p', date: '2027-01-15' }] });
test('예전 저장 내용이 빠짐없이 옮겨진다', () => {
  const m = F.migrate(old());
  assert.equal(m.kids.length, 1); assert.deepEqual([m.kids[0].id, m.kids[0].name, m.kids[0].birth, m.kids[0].options.combo, m.kids[0].records.bcg.done, m.cur], ['k1', '콩이', '2027-01-15', '6', '2027-01-20', 'k1']);
  assert.deepEqual([m.events[0].kid, m.diary[0].kid, m.photos[0].kid, m.faces, m.name, m.sido], ['k1', 'k1', 'k1', [], undefined, '서울특별시']);
  assert.deepEqual(F.migrate(m), m); assert.equal(F.migrate(null), null);
});
test('아이 빼기: 기록은 남고 마지막 한 명은 못 뺀다', () => {
  const d = F.migrate(old()); d.kids.push(F.newKid('k2', { name: '알콩이', birth: '2027-01-15' })); d.cur = 'k2';
  d.faces.push({ id: 'f', date: '2027-01-16', kid: 'k2' }); d.diary.push({ id: 'x', kid: 'k2', photos: [] });
  assert.equal(F.removeKid(d, 'k2'), true);
  assert.deepEqual([d.cur, d.faces.length, d.photos.length, d.photos[1].kid, d.diary[1].kid], ['k1', 0, 2, '', '']);
  assert.equal(F.removeKid(d, 'k1'), false);
});
test('몇째와 시각', () => {
  const k = [F.newKid('a', { birth: '2027-01-15' }), F.newKid('b', { birth: '2020-01-01' }), F.newKid('c', { birth: '2027-01-15' })]; F.rank(k);
  assert.deepEqual(k.map(x => x.order), [2, 1, 3]);
  assert.deepEqual(['03:25', '00:00', '12:00', '23:05', ''].map(F.timeText), ['오전 3시 25분', '오전 12시', '오후 12시', '오후 11시 5분', '']);
});
test('여러 아이 캘린더: UID가 겹치지 않고 이름이 붙는다', () => {
  const mk = (id, who) => S.build('2027-01-15', {}, {}).map(i => Object.assign(i, { who, uid: (id === 'k1' ? '' : id + '-') + i.id }));
  const { text } = S.toICS(mk('k1', '콩이').concat(mk('k2', '알콩이')), { name: '우리 아이들', today: '2026-11-24', leads: [7], hour: 9, stamp: '20261124T000000Z' });
  const u = text.match(/UID:.*/g); assert.equal(new Set(u).size, u.length); assert.ok(text.includes('UID:bcg@') && text.includes('UID:k2-bcg@') && text.includes('알콩이 BCG'));
});
test('병원 자료와 거리', () => {
  const { rows } = require('./hospitals.json');
  assert.ok(rows.length > 2500); rows.forEach(r => assert.ok(r.length === 7 && r[3] > 32 && r[4] > 124));
  assert.ok(Math.abs(H.km(37.5665, 126.978, 35.1796, 129.0756) - 325) < 5);
  const n = H.nearest(rows, { lat: 37.5665, lng: 126.978 }, 5); assert.equal(n.length, 5); assert.ok(n[0].km < 1.5 && n[4].km >= n[0].km);
  const R = require('./regions.js'); R.SIDO.forEach(s => assert.ok(H.inRegion(rows, s.name, '').length > 10, s.name));
  assert.ok(H.inRegion(rows, '경기도', '수원시').every(x => x.r[1].startsWith('경기도 수원시'))); assert.deepEqual(H.inRegion(rows, '', ''), []);
  assert.deepEqual([H.dist(0.123), H.dist(2.34), H.dist(null)], ['120m', '2.3km', '']);
});
test('병원 고르기: 전문의 없는 곳과 좌표 없는 곳은 뺀다', () => {
  const c = M.parseCsv('a,b\r\n"x,""y""",2\r\n'); assert.deepEqual(c, [{ a: 'x,"y"', b: '2' }]);
  const row = (id, k, y) => ({ 암호화요양기호: id, 요양기관명: id, 종별코드명: k, 주소: '서울특별시 중구', 전화번호: '', '좌표(X)': '127', '좌표(Y)': y });
  const ped = M.pediatric([{ 암호화요양기호: 'A', 진료과목코드명: '소아청소년과', '과목별 전문의수': '1' }, { 암호화요양기호: 'B', 진료과목코드명: '소아청소년과', '과목별 전문의수': '0' }, { 암호화요양기호: 'C', 진료과목코드명: '소아청소년과', '과목별 전문의수': '1' }]);
  assert.deepEqual(M.pick([row('A', '의원', '37'), row('B', '의원', '37'), row('C', '의원', ''), row('D', '보건소', '37'), row('A', '요양병원', '37')], ped).map(r => r[0]), ['A', 'D']);
});
test('구글 로그인: 내가 시작한 로그인만 받는다', async () => {
  const s = { state: 'abc', t: 1000 }, scope = encodeURIComponent('https://www.googleapis.com/auth/drive.file'), ok = `#state=abc&access_token=T&expires_in=3599&scope=${scope}`;
  assert.equal(D.readReturn('', s, 2000), null); assert.equal(D.readReturn('#x=1', s, 2000), null);
  assert.equal(D.readReturn(ok, s, 2000).token, 'T');
  assert.ok(D.readReturn(ok, null, 2000).error); assert.ok(D.readReturn(ok, { state: 'zzz', t: 1000 }, 2000).error); assert.ok(D.readReturn(ok, s, 1000 + 16 * 60000).error);
  assert.match(D.readReturn('#state=abc&error=access_denied', s, 2000).error, /취소/);
  assert.match(D.readReturn('#state=abc&access_token=T&scope=email', s, 2000).error, /권한/);
  const u = new URL(D.loginUrl('ID', 'https://a/b/', 'st')); assert.deepEqual([u.searchParams.get('scope'), u.searchParams.get('redirect_uri'), u.searchParams.get('response_type')], ['https://www.googleapis.com/auth/drive.file', 'https://a/b/', 'token']);
  const m = D.multipart({ name: '가.jpg' }, new Blob(['BIN'], { type: 'image/jpeg' })), t = await m.body.text(); assert.ok(t.includes('"name":"가.jpg"') && t.includes('BIN') && t.endsWith('--'));
});
