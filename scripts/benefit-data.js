/* 보조금24 원문을 앱에서 쓰는 지역별 파일로 바꾼다. 문구는 고치지 않고, 길면 자르기만 한다. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { SIDO, fromAgency } = require('../regions.js');

const WANT = /출산|출생|임신|임산부|임부|산모|산후|신생아|영아|영유아|분만|첫돌|다자녀|다둥이|육아|아기|모유|기저귀|조리원|입양/;
const SKIP = /난임|불임|정관|난관|시험관|인공수정|난자|정자/; // 태어날 아기와 관계없는 사업
const clean = s => String(s || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const safeUrl = u => (/^https:\/\/([a-z0-9-]+\.)?gov\.kr\//.test(u || '') ? u : '');

// API 한 줄 → 앱 한 줄. 지역이나 주제가 아니면 null
function fromApi(r) {
  const at = fromAgency(r['소관기관명']);
  if (!at) return null;
  const name = clean(r['서비스명']);
  if (SKIP.test(name) || !WANT.test([name, r['서비스목적요약'], r['지원대상']].join(' '))) return null;
  return row(at, { id: r['서비스ID'], name, agency: r['소관기관명'], type: r['지원유형'], deadline: r['신청기한'], target: r['지원대상'], support: r['지원내용'], how: r['신청방법'], url: r['상세조회URL'] });
}
// 정리된 공개 자료(goodboxkr/korea-birth-support-2026) 한 줄 → 앱 한 줄
function fromSeed(x) {
  const at = fromAgency(x.agency) || fromAgency(x.sido);
  if (!at || SKIP.test(x.service_name)) return null;
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
module.exports = { fromApi, fromSeed, group, write, WANT, SKIP };
