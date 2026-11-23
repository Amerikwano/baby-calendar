/* 보조금24 원문을 앱에서 쓰는 지역별 파일로 바꾼다. 문구는 고치지 않고, 길면 자르기만 한다. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { SIDO, fromAgency } = require('../regions.js');

// 사업 이름으로 고른다. 대상·내용에는 "다자녀 감면"처럼 스쳐 가는 말이 많아 기준으로 쓰지 않는다.
const BABY = /출산|출생|임신|임산부|임부|산모|산후|산전|신생아|영아|영유아|분만|백일|첫돌|아기|모유|모자보건|조리원|육아|아이돌봄|아이\s?돌봄|예비\s?(맘|엄마|부모)|엽산|첫만남|부모급여|아동수당|양육수당|기저귀|분유|태교|시간제\s?보육|아픈\s?아이|아이사랑|어린이집.*입학/;
const MULTI = /(다자녀|다둥[이e]|세\s?자녀|둘째|셋째).*(양육|축하|장려|지원금|카드|돌봄|진료)/;
const SKIP = /난임|불임|정관|난관|시험관|인공수정|난자|정자|피임|동물|반려|노인|어르신|장수|치매|중풍|고등학|중학|초등|대학|교복|입학|등록금|학자금|장학|결혼장려|주차|상수도|하수도|수도요금|체육|미술관|박물관|휴양림|관람|보훈|탈북|북한이탈|졸업/;
const ADOPT = /입양/;
const wanted = (name, field) => {
  if (SKIP.test(/어린이집/.test(name) ? name.replace(/입학/g, '') : name) || (ADOPT.test(name) && !/출산|출생/.test(name))) return false;
  return BABY.test(name) || MULTI.test(name) || /임신|출산/.test(field || '');
};
const clean = s => String(s || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const safeUrl = u => (/^https:\/\/([a-z0-9-]+\.)?gov\.kr\//.test(u || '') ? u : '');

// API 한 줄 → 앱 한 줄. 지역이나 주제가 아니면 null
function fromApi(r) {
  const at = fromAgency(r['소관기관명']);
  if (!at) return null;
  const name = clean(r['서비스명']);
  if (!wanted(name, r['서비스분야'])) return null;
  return row(at, { id: r['서비스ID'], name, agency: r['소관기관명'], type: r['지원유형'], deadline: r['신청기한'], target: r['지원대상'], support: r['지원내용'], how: r['신청방법'], url: r['상세조회URL'] });
}
// 정리된 공개 자료(goodboxkr/korea-birth-support-2026) 한 줄 → 앱 한 줄
function fromSeed(x) {
  const at = fromAgency(x.agency) || fromAgency(x.sido);
  if (!at || !wanted(clean(x.service_name), '임신·출산')) return null;
  return row({ sido: at.sido, sigungu: x.sigungu || at.sigungu }, { id: x.service_id, name: clean(x.service_name), agency: x.agency, type: x.support_type, deadline: x.deadline, target: x.target, support: x.support, how: x.how_to_apply, url: x.gov24_url });
}
function row(at, v) {
  return { sido: at.sido, id: String(v.id || ''), g: at.sigungu, t: cut(v.name, 80), a: cut(clean(v.agency), 40), k: clean(v.type).replace(/\|\|/g, '·'), d: cut(clean(v.deadline), 100), q: cut(clean(v.target), 400), s: cut(clean(v.support), 600), h: cut(clean(v.how).replace(/\|\|/g, ' · '), 80), u: safeUrl(v.url) };
}

function group(rows) {
  const out = {};
  for (const s of SIDO) out[s.file] = [];
  const seen = new Set();
  for (const r of rows) {
    const key = r && r.id + '|' + r.g;
    if (!r || !r.t || seen.has(key)) continue;
    seen.add(key);
    const { sido, ...rest } = r;
    out[SIDO.find(s => s.name === sido).file].push(rest);
  }
  for (const k in out) out[k].sort((a, b) => (a.g < b.g ? -1 : a.g > b.g ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out;
}
// 받은 자료가 갑자기 줄었으면 잘못 받은 것으로 보고 덮어쓰지 않는다.
function write(dir, rows, meta) {
  const g = group(rows), total = Object.values(g).reduce((n, x) => n + x.length, 0);
  let before = 0;
  try { before = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')).total || 0; } catch { }
  if (total < 300 || total < before * 0.6) throw new Error(`자료가 너무 적어 중단했습니다 (${before} → ${total})`);
  if (Object.values(g).some(x => x.length === 0)) throw new Error('자료가 하나도 없는 시·도가 있어 중단했습니다');
  fs.mkdirSync(dir, { recursive: true });
  let changed = 0;
  const put = (f, text) => { const p = path.join(dir, f); if (fs.existsSync(p) && fs.readFileSync(p, 'utf8') === text) return; fs.writeFileSync(p, text); changed++; };
  for (const k in g) put(k + '.json', '[\n' + g[k].map(x => JSON.stringify(x)).join(',\n') + '\n]\n');
  put('index.json', JSON.stringify({ asOf: meta.asOf, source: meta.source, total }) + '\n');
  return { total, changed };
}
module.exports = { fromApi, fromSeed, group, write, wanted };
