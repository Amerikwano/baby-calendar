/* 인근 병원: 거리 계산과 고르기. 자료는 hospitals.json [이름, 주소, 전화, 위도, 경도, 종류, 소아청소년과 전문의 수] */
(function (root) {
  'use strict';
  function km(a, b, c, d) {
    const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(x));
  }
  const nearest = (rows, here, n) => rows.map(r => ({ r, km: km(here.lat, here.lng, r[3], r[4]) })).sort((a, b) => a.km - b.km).slice(0, n);
  // 위치를 모를 때: 주소의 시·도와 시·군·구가 맞는 곳. 도 이름은 옛 이름과 새 이름을 모두 받는다.
  const OLD = { 강원특별자치도: ['강원도'], 전북특별자치도: ['전라북도'], 전남광주통합특별시: ['전라남도', '광주광역시'] };
  function inRegion(rows, sido, gu) {
    if (!sido) return [];
    const heads = [sido].concat(OLD[sido] || []);
    return rows.filter(r => heads.some(h => r[1].startsWith(h + ' ')) && (!gu || r[1].includes(' ' + gu + ' '))).map(r => ({ r, km: null }));
  }
  // 이름으로 보아 아이를 주로 보는 곳. 검진센터처럼 전문의만 있는 곳보다 먼저 보여준다.
  const kids = r => r[5] === '보건소' || /소아|아동|어린이|아이|키즈/.test(r[0]);
  const dist = k => k == null ? '' : k < 1 ? Math.max(10, Math.round(k * 100) * 10) + 'm' : k.toFixed(1) + 'km';
  const out = { km, nearest, inRegion, kids, dist };
  if (typeof module !== 'undefined' && module.exports) module.exports = out; else root.Hospitals = out;
})(this);
