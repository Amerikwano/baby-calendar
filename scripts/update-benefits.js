/* 행정안전부 「대한민국 공공서비스(혜택) 정보」 전체를 받아 regions/를 새로 만든다.
   인증키는 DATA_GO_KR_KEY 환경변수로만 받고 출력하지 않는다. */
'use strict';
const path = require('node:path');
const { fromApi, write } = require('./benefit-data.js');

async function fetchAll(key, get = fetch) {
  const raw = key.includes('%') ? decodeURIComponent(key) : key; // 인코딩된 키와 디코딩된 키 모두 받는다
  const rows = [];
  for (let page = 1; page <= 60; page++) {
    const u = `https://api.odcloud.kr/api/gov24/v3/serviceList?page=${page}&perPage=1000&returnType=JSON&serviceKey=${encodeURIComponent(raw)}`;
    let j = null, why = '';
    for (let i = 0; i < 3 && !j; i++) {
      try {
        const r = await get(u, { signal: AbortSignal.timeout(60000) });
        if (r.status === 401 || r.status === 403) throw Object.assign(new Error('인증키가 거절됐습니다'), { stop: true });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        j = await r.json();
        if (!Array.isArray(j.data)) { j = null; throw new Error('응답 모양이 다릅니다'); }
      } catch (e) { if (e.stop) throw e; why = e.name === 'TimeoutError' ? '시간 초과' : e.message.split('serviceKey')[0]; await new Promise(x => setTimeout(x, get === fetch ? 3000 * (i + 1) : 0)); }
    }
    if (!j) throw new Error(`${page}쪽을 받지 못했습니다: ${why}`);
    rows.push(...j.data);
    if (!j.data.length || rows.length >= Number(j.totalCount)) { if (rows.length < Number(j.totalCount)) throw new Error('일부만 받았습니다'); return rows; }
  }
  throw new Error('쪽수가 예상보다 많습니다');
}
async function main() {
  const key = (process.env.DATA_GO_KR_KEY || '').trim();
  if (!key) { console.log('::warning::DATA_GO_KR_KEY가 없어 갱신을 건너뜁니다.'); return; }
  const rows = (await fetchAll(key)).map(fromApi).filter(Boolean);
  const asOf = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  console.log(write(path.join(__dirname, '..', 'regions'), rows, { asOf, source: '행정안전부 「대한민국 공공서비스(혜택) 정보」(보조금24)' }));
}
if (require.main === module) main().catch(e => { console.error('::error::' + e.message); process.exit(1); });
module.exports = { fetchAll };
