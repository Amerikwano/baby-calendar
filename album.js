/* 아기앨범: 모아보기, 월별·연도별 보기, 즐겨찾기, 예전 오늘 */
(function (root) {
  'use strict';
  const year = p => p.date.slice(0, 4), mon = p => p.date.slice(0, 7);
  const sort = l => [...l].sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  const years = l => [...new Set(l.map(year))].sort().reverse();
  const months = (l, y) => [...new Set(l.filter(p => year(p) === y).map(mon))].sort().reverse();
  const cover = l => l.find(p => p.fav) || l[0];
  // 지난 해 같은 날(없으면 앞뒤 사흘 안)의 사진. 가까운 날을 먼저 고른다.
  function onThisDay(l, t) {
    const y = Number(t.slice(0, 4)), u = s => Date.UTC(+s.slice(0, 4), s.slice(5, 7) - 1, +s.slice(8, 10)); let best = null;
    l.forEach(p => { const ago = y - Number(year(p)); if (ago < 1) return; const gap = Math.abs(u(y + p.date.slice(4)) - u(t)) / 86400000; if (gap <= 3 && (!best || gap < best.gap || gap === best.gap && ago < best.ago)) best = { p, ago, gap }; });
    return best;
  }
  // 아홉 장마다 한 장을 크게 보여 준다(3칸 격자에 빈틈이 없도록 뒤에 두 장 이상 남았을 때만).
  const big = (i, n) => i % 9 === 3 && n - i > 2;
  const Album = { sort, years, months, cover, onThisDay, big, mon };
  if (typeof module !== 'undefined' && module.exports) module.exports = Album; else root.Album = Album;
})(typeof window !== 'undefined' ? window : globalThis);

let albView = '', albYear = ''; // 처음 열면 가장 최근 달
const EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const albPhotos = () => Album.sort(Family.forKid(db.photos, K().id));
// 출생일로부터 2년 7개월. 달이나 해 전체는 그 기간의 마지막 날(오늘까지)로 센다.
function sinceBirth(end) {
  const k = K(), d = end > today() ? today() : end;
  if (!k.born) { const n = S.diffDays(d, k.birth); return n > 0 ? `${k.name}, 만나기 ${n}일 전` : k.name; }
  const m = S.ageMonths(k.birth, d);
  return m < 0 ? `${k.name}, 태어나기 전` : `${k.name}, 출생일로부터 ${Math.floor(m / 12) ? Math.floor(m / 12) + '년 ' : ''}${m % 12}개월`;
}
const lastDay = ym => S.addDays(S.addMonths(ym + '-01', 1), -1);
const cell = (p, cls) => `<button class="${cls || ''}" data-act="photo" data-id="${p.id}" aria-label="${kd(p.date)} ${p.type ? '동영상' : '사진'}"><img ${pic(p.id, 1)} alt="${esc(p.caption || kd(p.date) + ' 사진')}">${p.type && p.th !== 1 && local ? `<video class="vfix" data-vfix="${p.id}" muted playsinline preload="auto" aria-hidden="true" tabindex="-1"></video>` : ''}${p.type ? `<s>${icon('vplay', 's')}${p.dur ? Media.clock(p.dur) : ''}</s>` : ''}${p.fav ? `<i>${icon('heart', 'fill')}</i>` : ''}</button>`;
const yearCard = (y, l) => { const c = Album.cover(l); return `<button class="ycard" data-act="albyear" data-y="${y}"><img ${pic(c.id, 1)} alt=""><b>${y}</b><em>${esc(sinceBirth(y + '-12-31'))}</em></button>`; };
// 한 메뉴 안의 두 화면을 오가는 위쪽 탭
const segTabs = (label, list) => `<div class="albseg" role="tablist" aria-label="${label}">${list.map(([t, n]) => `<button role="tab" data-tab="${t}" aria-selected="${tab === t}">${n}</button>`).join('')}</div>`;
const growName = () => Couple.is(K()) ? '하루 한 장' : '성장 앨범'; // 연애 수첩은 이름이 다르다
const albSeg = () => segTabs('앨범 종류', [['album', Couple.is(K()) ? '우리 앨범' : Pet.isPet(K()) ? '사진 앨범' : '아기 앨범'], ['grow', growName()]]);
const tipSeg = () => `<div class="albtop">${segTabs('꿀팁 종류', [['tips', Couple.is(K()) ? '연애 팁' : Pet.isPet(K()) ? '돌봄 팁' : '육아 팁'], ['money', Couple.is(K()) ? '명소·행사' : Pet.isPet(K()) ? '혜택·행사' : '혜택']])}</div>`;
function album() {
  if (db.photos.some(p => p.type === 'video' && p.th !== 1)) setTimeout(repairPosters, 500);
  const all = albPhotos(), ys = Album.years(all), ty = today().slice(0, 4);
  if (!albYear || !ys.includes(albYear)) albYear = ys[0] || ty;
  const ms = Album.months(all, albYear); if (!albView) albView = ms[0] || 'col';
  if (albView !== 'col' && !ms.includes(albView)) albView = 'col';
  const top = `<div class="albtop">${albSeg()}<div class="albhead">${albView === 'col' ? '<h2>컬렉션</h2>' : `<button class="yearpill" data-act="years">${albYear}${icon('down', 's')}</button>`}<div class="albbtns"><button class="sq" data-act="addphotos" aria-label="사진·동영상 추가">${icon('plus')}</button><button class="sq" data-act="albmenu" aria-label="앨범 메뉴">${icon('more')}</button></div></div>
    <div class="mtabs" role="group" aria-label="월 고르기"><button data-act="albview" data-v="col" aria-label="컬렉션" aria-pressed="${albView === 'col'}">${icon('grid')}</button>${ms.map(m => `<button data-act="albview" data-v="${m}" aria-pressed="${albView === m}">${Number(m.slice(5))}월</button>`).join('')}</div></div>`;
  if (!all.length) return top + `<div class="empty">${icon('album', 'xl')}<p>아직 사진이 없어요.<br>첫 사진을 넣어 보세요.</p></div>` + collections([], ys);
  if (albView === 'col') return top + collections(all, ys) + driveBar();
  const l = all.filter(p => Album.mon(p) === albView), c = Album.cover(l), old = albView === today().slice(0, 7) ? Album.onThisDay(all, today()) : null, m = Number(albView.slice(5));
  return top + `<section class="cover bleed"><button data-act="photo" data-id="${c.id}" aria-label="${m}월 대표 사진"><img ${pic(c.id, c.type ? 1 : 0)} alt=""></button><div class="cap"><b>${m}월</b><span>${EN[m - 1]}</span><em>${esc(sinceBirth(lastDay(albView)))}</em></div>${old ? `<button class="old" data-act="photo" data-id="${old.p.id}"><img ${pic(old.p.id, 1)} alt=""><span>${old.ago}년 전 ${old.gap ? '이맘때' : '오늘'}</span></button>` : ''}</section>
    <div class="mosaic bleed">${l.map((p, i) => cell(p, Album.big(i, l.length) ? 'big' : '')).join('')}</div>`;
}
function collections(all, ys) {
  const fav = all.filter(p => p.fav);
  const trio = (l, label, act) => `<button class="trio" ${act}>${[0, 1, 2].map(i => `<span>${l[i] ? `<img ${pic(l[i].id, 1)} alt="">` : ''}</span>`).join('')}<b>${label}</b></button>`;
  return (all.length ? `<section class="stack"><h2>즐겨찾기</h2>${fav.length ? trio(fav, `${fav.length}장의 사진`, 'data-act="favs"') : '<p class="sub">사진을 열고 하트를 누르면 여기에 모여요.</p>'}</section>
    <section class="stack"><h2>연도별</h2><div class="ygrid">${ys.map(y => yearCard(y, all.filter(p => p.date.startsWith(y)))).join('')}</div></section>` : '');
}
const yearsDlg = () => { const all = albPhotos(); openDlg(`<form data-form="none"><h2>연도 고르기</h2><div class="ygrid">${Album.years(all).map(y => yearCard(y, all.filter(p => p.date.startsWith(y)))).join('')}</div></form>`); };
const favsDlg = () => openDlg(`<form data-form="none"><h2>즐겨찾기</h2><div class="mosaic" data-favs>${albPhotos().filter(p => p.fav).map(p => cell(p)).join('')}</div></form>`);
const albMenu = () => openDlg(`<form data-form="none"><h2>앨범</h2><div class="stack">${albPhotos().length ? '<button type="button" class="btn" data-act="years">연도 고르기</button>' : ''}<button type="button" class="btn" data-act="addphotos">사진·동영상 추가</button>${canDrive() ? '<button type="button" class="btn" data-act="drive">구글 드라이브 사진 관리</button>' : ''}</div></form>`);
