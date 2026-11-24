/* 건강보험심사평가원 「전국 병의원 및 약국 현황」(공공데이터포털 15051059, 분기마다 갱신)에서
   소아청소년과 전문의가 있는 병원과 보건소만 골라 hospitals.json을 만든다.
   실행: node scripts/make-hospitals.js 1.병원정보서비스.csv 5.진료과목정보.csv 2026-09-30 */
'use strict';
const fs = require('node:fs'), path = require('node:path');

function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c !== '"') cell += c; else if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift().map(x => x.replace(/^﻿/, ''));
  return rows.filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((h, i) => [h, r[i].trim()])));
}
// 소아청소년과 전문의 수를 병원별로 모은다.
const pediatric = subjects => new Map(subjects.filter(r => r['진료과목코드명'] === '소아청소년과' && Number(r['과목별 전문의수']) > 0).map(r => [r['암호화요양기호'], Number(r['과목별 전문의수'])]));
const KIND = { 의원: '의원', 병원: '병원', 종합병원: '종합병원', 상급종합: '상급종합병원', 보건의료원: '보건소', 보건소: '보건소' };
function pick(list, ped) {
  return list.map(r => {
    const kind = KIND[r['종별코드명']], lat = Number(r['좌표(Y)']), lng = Number(r['좌표(X)']), doctors = ped.get(r['암호화요양기호']) || 0;
    if (!kind || !(lat > 32 && lat < 39.5 && lng > 124 && lng < 132)) return null;
    if (kind !== '보건소' && !doctors) return null;
    return [r['요양기관명'], r['주소'].replace(/\s+/g, ' '), r['전화번호'], Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5, kind, doctors];
  }).filter(Boolean).sort((a, b) => a[3] - b[3] || a[4] - b[4]);
}
if (require.main === module) {
  const [a, b, asOf] = process.argv.slice(2), read = f => parseCsv(new TextDecoder('euc-kr').decode(fs.readFileSync(f)));
  const rows = pick(read(a), pediatric(read(b)));
  if (rows.length < 2500) throw new Error('고른 병원이 너무 적습니다: ' + rows.length);
  const out = { asOf, source: '건강보험심사평가원 「전국 병의원 및 약국 현황」', rows };
  fs.writeFileSync(path.join(__dirname, '..', 'hospitals.json'), JSON.stringify(out).replace(/\],\[/g, '],\n['));
  console.log(rows.length);
}
module.exports = { parseCsv, pediatric, pick };
