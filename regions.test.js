const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const R = require('./regions.js');
const { fromApi, write } = require('./scripts/benefit-data.js');
const { fetchAll } = require('./scripts/update-benefits.js');
const A = (o) => R.fromAddress(Object.assign({ country_code: 'kr' }, o));

test('좌표 변환 결과를 지역으로', () => {
  assert.deepEqual(A({ borough: '종로구', city: '서울특별시', 'ISO3166-2-lvl4': 'KR-11' }), { sido: '서울특별시', sigungu: '종로구' });
  assert.deepEqual(A({ borough: '권선구', city: '수원시', province: '경기도', 'ISO3166-2-lvl4': 'KR-41' }), { sido: '경기도', sigungu: '수원시' });
  assert.deepEqual(A({ county: '군위군', city: '대구광역시', town: '군위읍', 'ISO3166-2-lvl4': 'KR-27' }), { sido: '대구광역시', sigungu: '군위군' });
  assert.deepEqual(A({ city: '세종특별자치시', quarter: '보람동', 'ISO3166-2-lvl4': 'KR-50' }), { sido: '세종특별자치시', sigungu: '' });
  assert.deepEqual(A({ city: '제주시', province: '제주특별자치도', 'ISO3166-2-lvl4': 'KR-49' }), { sido: '제주특별자치도', sigungu: '제주시' });
  assert.deepEqual(A({ county: '담양군', province: '전라남도', 'ISO3166-2-lvl4': 'KR-46' }), { sido: '전남광주통합특별시', sigungu: '담양군' });
  assert.deepEqual(A({ borough: '광산구', city: '광주광역시', 'ISO3166-2-lvl4': 'KR-29' }), { sido: '전남광주통합특별시', sigungu: '광산구' });
  assert.deepEqual(A({ city: '광주시', province: '경기도', 'ISO3166-2-lvl4': 'KR-41' }), { sido: '경기도', sigungu: '광주시' });
  assert.equal(A({ country_code: 'jp', city: '도쿄' }), null);
});
test('소관기관 이름을 지역으로', () => {
  assert.deepEqual(R.fromAgency('경기도 수원시'), { sido: '경기도', sigungu: '수원시' });
  assert.deepEqual(R.fromAgency('서울특별시관악구시설관리공단'), { sido: '서울특별시', sigungu: '' });
  assert.equal(R.fromAgency('보건복지부'), null);
});
test('모든 지역 파일이 있고 링크는 정부24만', () => {
  for (const s of R.SIDO) {
    const rows = JSON.parse(fs.readFileSync(path.join(__dirname, 'regions', s.file + '.json'), 'utf8'));
    assert.ok(rows.length > 0, s.name);
    for (const r of rows) { assert.ok(r.t && r.id); assert.match(r.u, /^https:\/\/([a-z0-9-]+\.)?gov\.kr\//); assert.ok(!/난임/.test(r.t)); }
  }
});
const row = (i, o) => Object.assign({ '서비스ID': 'S' + i, '서비스명': '출산지원금', '소관기관명': R.SIDO[i % R.SIDO.length].name + ' 가나시', '지원대상': '출생아', '지원내용': '50만원', '상세조회URL': 'https://www.gov.kr/x', '신청기한': '상시', '신청방법': '방문', '지원유형': '현금' }, o);
test('API 자료 거르기', () => {
  assert.equal(fromApi(row(1, { '서비스명': '난임 시술 지원' })), null);
  assert.equal(fromApi(row(1, { '소관기관명': '보건복지부' })), null);
  assert.equal(fromApi(row(1, { '서비스명': '농기계 임대', '지원대상': '농업인' })), null);
  assert.equal(fromApi(row(1, { '상세조회URL': 'javascript:alert(1)' })).u, '');
});
test('관계없는 사업은 빼고 아기 사업은 남긴다', () => {
  const { wanted } = require('./scripts/benefit-data.js');
  for (const n of ['장수노인수당 지원', '유실·유기동물 입양비 지원', '하수도요금 감면', '귀향청년 주택 수리비 지원', '다자녀가정 대학등록금 지원', '치매환자 조호물품 지원(기저귀, 위생매트 등)', '공영주차장 이용요금 감면', '보훈명예수당', '청년 월세 지원', '장애인 도우미 지원']) assert.equal(wanted(n, '생활안정'), false, n);
  for (const n of ['수원시 출생·입양 지원금 지급', '산모·신생아 건강관리 지원', '서울형 아이돌봄비 지원', '아빠 육아휴직장려금 지원', '다자녀가정 양육비 지원', '기저귀·조제분유 지원', '임신부 운동교실 지원 서비스', '쑥쑥크는 우리아기 오감발달교실', '어린이집 입학축하금 지원', '아픈아이 병원진료 동행서비스', '맘편한 태교 패키지 지원']) assert.equal(wanted(n, '생활안정'), true, n);
  assert.equal(wanted('풍진검사 지원', '임신·출산'), true);
  assert.equal(wanted('난임부부 시술비', '임신·출산'), false);
});
test('자료가 갑자기 줄면 덮어쓰지 않는다', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'reg-')), many = Array.from({ length: 640 }, (_, i) => fromApi(row(i)));
  assert.equal(write(d, many, { asOf: '2026-11-23', source: 's' }).total, 640);
  assert.equal(write(d, many, { asOf: '2026-11-23', source: 's' }).changed, 0);
  assert.throws(() => write(d, many.slice(0, 320), { asOf: 'x', source: 's' }), /너무 적어/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(d, 'index.json'))).total, 640);
});
test('여러 쪽 받기, 키 노출 없음, 일부만 받으면 실패', async () => {
  const urls = [], page = (n, total) => async u => { urls.push(u); const p = Number(new URL(u).searchParams.get('page')); return { ok: true, status: 200, json: async () => ({ totalCount: total, data: p <= n ? Array.from({ length: 1000 }, (_, i) => i) : [] }) }; };
  assert.equal((await fetchAll('ab%2Bc%3D%3D', page(3, 3000))).length, 3000);
  assert.equal(new URL(urls[0]).searchParams.get('serviceKey'), 'ab+c==');
  await assert.rejects(fetchAll('k', page(2, 3000)), /일부만/);
  await assert.rejects(fetchAll('SECRET', async () => { throw new Error('fail ?serviceKey=SECRET'); }), e => !e.message.includes('SECRET'));
  await assert.rejects(fetchAll('k', async () => ({ ok: false, status: 401 })), /인증키/);
});
