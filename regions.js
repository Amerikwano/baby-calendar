/* 시·도 이름과 자료 파일, 좌표 변환 결과를 시·군·구로 바꾸는 규칙 */
(function (root) {
  // [정식 이름, 파일 이름, ISO 코드들, 다른 이름들]
  const SIDO = [
    ['서울특별시', 'seoul', ['KR-11'], ['서울']], ['부산광역시', 'busan', ['KR-26'], ['부산']], ['대구광역시', 'daegu', ['KR-27'], ['대구']],
    ['인천광역시', 'incheon', ['KR-28'], ['인천']], ['대전광역시', 'daejeon', ['KR-30'], ['대전']], ['울산광역시', 'ulsan', ['KR-31'], ['울산']],
    ['세종특별자치시', 'sejong', ['KR-50'], ['세종']], ['경기도', 'gyeonggi', ['KR-41'], ['경기']], ['강원특별자치도', 'gangwon', ['KR-42', 'KR-51'], ['강원', '강원도']],
    ['충청북도', 'chungbuk', ['KR-43'], ['충북']], ['충청남도', 'chungnam', ['KR-44'], ['충남']], ['전북특별자치도', 'jeonbuk', ['KR-45', 'KR-52'], ['전북', '전라북도']],
    ['전남광주통합특별시', 'jeonnam-gwangju', ['KR-29', 'KR-46'], ['광주', '광주광역시', '전남', '전라남도']],
    ['경상북도', 'gyeongbuk', ['KR-47'], ['경북']], ['경상남도', 'gyeongnam', ['KR-48'], ['경남']], ['제주특별자치도', 'jeju', ['KR-49'], ['제주', '제주도']],
  ].map(([name, file, iso, alias]) => ({ name, file, iso, alias }));
  const find = n => SIDO.find(s => s.name === n || s.alias.includes(n)) || null;
  const METRO = /(특별시|광역시)$/;
  // OpenStreetMap 주소 → { sido, sigungu }
  function fromAddress(a) {
    if (!a || (a.country_code && a.country_code !== 'kr')) return null;
    const s = SIDO.find(x => x.iso.includes(a['ISO3166-2-lvl4'])) || find(a.province) || find(a.state) || find(a.city);
    if (!s) return null;
    if (s.file === 'sejong') return { sido: s.name, sigungu: '' };
    const cityIsSido = !a.city || find(a.city) && METRO.test(a.city);
    // 광역시는 구·군, 도는 시·군 (수원시 권선구 → 수원시)
    const sigungu = (cityIsSido ? (a.county || a.borough) : a.city) || a.county || '';
    return { sido: s.name, sigungu: /[시군구]$/.test(sigungu) ? sigungu : '' };
  }
  // "경기도 수원시" 같은 소관기관 이름 → { sido, sigungu }
  function fromAgency(agency) {
    const [first, second] = String(agency || '').trim().split(/\s+/);
    const s = SIDO.find(x => x.name === first || x.alias.includes(first) || String(first).startsWith(x.name));
    if (!s) return null;
    return { sido: s.name, sigungu: second && /[시군구]$/.test(second) ? second : '' };
  }
  const api = { SIDO, find, fromAddress, fromAgency };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Regions = api;
})(this);
