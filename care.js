/* 육아 기록(수유·기저귀·수면…)과 홈 화면. 위쪽은 화면과 무관한 계산, 아래쪽은 화면이다. */
(function (root) {
  'use strict';
  // sub: 고르는 종류, unit: 양의 단위, end: 끝난 시각을 적는 기록
  const TYPES = {
    diaper: { name: '기저귀', sub: ['소변', '대변', '둘 다'], c: '#8a6a4f' },
    bottle: { name: '젖병수유', sub: ['분유', '유축 모유'], unit: 'ml', end: true, c: '#b95a94' },
    breast: { name: '모유수유', sub: ['왼쪽', '오른쪽', '양쪽'], end: true, c: '#c1606c' },
    sleep: { name: '수면', end: true, c: '#6c66bf' },
    food: { name: '이유식', sub: ['이유식', '간식', '물'], unit: 'ml', c: '#39808f' },
    hospital: { name: '병원', c: '#4a8a45' },
    bath: { name: '목욕', c: '#3f78b5' },
    play: { name: '놀이', end: true, c: '#b87324' },
    med: { name: '약', c: '#a3573f' },
    temp: { name: '체온', unit: '℃', c: '#b8473f' },
    kick: { name: '태동', unit: '회', c: '#b95a94' },
    weight: { name: '체중', unit: 'kg', c: '#39808f' },
    memo: { name: '메모', c: '#7a685d' },
    dateout: { name: '데이트', c: '#c1606c' },
    gift: { name: '선물', c: '#b95a94' },
    trip: { name: '여행', end: true, c: '#3f78b5' },
    workout: { name: '운동', sub: ['걷기', '달리기', '근력', '기타'], end: true, c: '#4a8a45' },
    spend: { name: '지출', sub: ['식비', '쇼핑', '교통', '생활', '기타'], unit: '원', c: '#a8641c' },
    // 반려동물
    meal: { name: '밥', sub: ['사료', '습식', '간식', '물'], unit: 'g', c: '#b87324' },
    walk: { name: '산책', end: true, c: '#4a8a45' },
    potty: { name: '배변', sub: ['소변', '대변', '둘 다'], c: '#8a6a4f' },
    groom: { name: '미용·손질', sub: ['빗질', '발톱', '귀 청소', '양치', '미용'], c: '#b95a94' },
  };
  const BORN = ['diaper', 'bottle', 'breast', 'sleep', 'food', 'hospital', 'bath', 'play', 'med', 'temp', 'memo'], WAIT = ['kick', 'hospital', 'med', 'weight', 'memo'];
  const at = l => l.date + 'T' + (l.time || '00:00');
  // 예정(아직 안 됨), 미완료(시각이 지났는데 완료하지 않음), 완료
  const state = (l, now) => l.done ? 'done' : at(l) > now ? 'plan' : 'miss';
  const minutes = l => { if (!l.end || !l.time) return 0; const m = t => { const [a, b] = t.split(':').map(Number); return a * 60 + b; }; return (m(l.end) - m(l.time) + 1440) % 1440; };
  const byDay = list => { const o = {}; list.forEach(l => (o[l.date] = o[l.date] || []).push(l)); Object.values(o).forEach(a => a.sort((x, y) => at(x) < at(y) ? 1 : at(x) > at(y) ? -1 : 0)); return o; };
  // 하루 요약은 완료한 기록만 센다.
  function report(list) {
    const d = list.filter(l => l.done), of = t => d.filter(l => l.type === t), sum = (a, f) => a.reduce((n, x) => n + (Number(f(x)) || 0), 0);
    const feeds = of('bottle').concat(of('breast')), pee = of('diaper').filter(l => l.sub !== '대변').length, poo = of('diaper').filter(l => l.sub === '대변' || l.sub === '둘 다').length;
    const temps = of('temp').map(l => Number(l.amount)).filter(n => n > 0);
    return { feeds: feeds.length, ml: sum(of('bottle'), l => l.amount), pee, poo, diaper: of('diaper').length, sleep: sum(of('sleep'), minutes), food: of('food').filter(l => l.sub !== '물').length, temp: temps.length ? Math.max(...temps) : 0, total: d.length };
  }
  const hm = m => m < 60 ? m + '분' : Math.floor(m / 60) + '시간' + (m % 60 ? ' ' + m % 60 + '분' : '');
  const clock = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2, '0')}`; };
  const Care = { TYPES, BORN, WAIT, at, state, minutes, byDay, report, hm, clock };
  if (typeof module !== 'undefined' && module.exports) module.exports = Care; else root.Care = Care;
})(typeof window !== 'undefined' ? window : globalThis);

/* ── 화면 ── */
let careDays = 3; // 홈에 보여 줄 기록 날짜 수
const nowText = () => today() + 'T' + new Date().toTimeString().slice(0, 5);
const logsOf = k => db.logs.filter(l => l.kid === k.id);
const face = (k, cls) => `<span class="av ${cls || ''}${k && !k.photo && k.kind ? ' pet' : ''}">${k && k.photo ? `<img ${pic(k.photo, 1)} alt="">` : Pet.isPet(k) ? icon('paw') : Couple.is(k) ? icon('heart') : Me.is(k) ? icon('user') : FACE}</span>`;
const addBtns = () => `<button type="button" class="btn" data-act="newcat">${icon('plus', 's')}새 수첩 만들기</button>`;
// 2개월 15일 (D+76)
function ageLine(k) {
  const t = today(), n = S.diffDays(t, k.birth);
  if (Couple.is(k)) return `만난 지 ${1 - n}일`;
  if (Me.is(k)) return `만 ${Me.age(k.birth, t)}세`;
  if (!k.born) { const g = 280 - n; return `${n > 0 ? 'D-' + n : n === 0 ? 'D-DAY' : 'D+' + -n}${g >= 0 && g <= 301 ? `, 임신 ${Math.floor(g / 7)}주 ${g % 7}일` : ''}`; }
  const m = S.ageMonths(k.birth, t), d = S.diffDays(S.addMonths(k.birth, m), t);
  return `${m < 24 ? (m ? m + '개월 ' : '') + d + '일' : `${Math.floor(m / 12)}${Pet.isPet(k) ? '살' : '세'} ${m % 12 ? m % 12 + '개월' : ''}`} (D+${1 - n})`;
}
// 지금 챙길 것: 접종·검진, 놓친 기록, 오늘과 내일 일정
function alerts(k) {
  const t = today(), its = items(k), st = i => S.status(i, t);
  const late = k.born ? its.filter(i => st(i) === 'late' && !/^(flu|phw|cp)/.test(i.id) && !Me.is(k)) : [], open = its.filter(i => st(i) === 'open').sort((a, b) => (a.hard || a.end) < (b.hard || b.end) ? -1 : 1);
  return { late, open: k.born ? open : [], next: its.filter(i => st(i) === 'next').slice(0, 5), miss: logsOf(k).filter(l => l.date === t && Care.state(l, nowText()) === 'miss'), events: Family.forKid(db.events, k.id).filter(e => !e.done && e.date >= t && e.date <= S.addDays(t, 1)) };
}
const todayText = () => { const [, m, x] = today().split('-').map(Number); return `${m}월 ${x}일 (${'일월화수목금토'[new Date(today() + 'T12:00').getDay()]})`; };
function topBar() {
  const k = K(), hot = bellNew() || !k.born && today() >= k.birth;
  return `<div><button class="me" data-act="kids" aria-label="${esc(k.name)}, 수첩 고르기">${face(k)}<span><b><span class="nm">${esc(k.name)}</span>${Me.is(k) ? icon('user', k.sex) : Couple.is(k) ? icon('heart', 'girl') : Pet.isPet(k) ? icon('paw', k.sex || 'unk') : icon('baby', k.sex || 'unk')}${k.sex ? `<span class="vh">${Pet.isPet(k) ? Pet.SEX[k.sex] : Me.is(k) ? Family.SEX[k.sex] : Family.SEX[k.sex] + '아이'}</span>` : ''}${many() ? icon('down', 's') : ''}</b><em>${ageLine(k)}</em></span></button></div><div class="hbar"><span class="todayd">${todayText()}</span><span class="hbtn">${visits.length ? `<button class="sq" data-act="visits" aria-label="놀러가기">${icon('visit')}</button>` : ''}<button class="sq" data-act="report" aria-label="하루 요약">${icon('pie')}</button><button class="sq" data-act="alerts" aria-label="알림${hot ? ', 확인할 것이 있어요' : ''}">${icon('bell')}${hot ? '<i></i>' : ''}</button></span></div>`;
}
function navBar() {
  const M = { home: 'home', cal: 'cal', diary: 'diary', album: 'album', grow: 'album', tips: 'tips', money: 'tips' };
  const main = M[SUB.includes(tab) && subFrom ? subFrom.tab : tab] || 'more';
  const b = (t, n, i) => `<button data-tab="${t}" ${main === t ? 'aria-current="page"' : ''}>${i}<span>${n}</span></button>`;
  return `<div>${b('home', '홈', `<span class="navface">${face(K())}</span>`)}${b('cal', '달력', icon('cal'))}${b('diary', '일기', icon('diary'))}${Me.isSolo(K()) ? '' : b('album', '앨범', icon('album'))}${b('tips', '꿀팁', icon('tips'))}${b('more', '더보기', icon('more'))}</div>`;
}
const typesFor = k => Me.is(k) ? Me.LOGS : Couple.is(k) ? Couple.LOGS : Pet.isPet(k) ? Pet.LOGS[k.kind] : k.born ? Care.BORN : Care.WAIT;
const typeBtn = (t, act) => `<button type="button" data-act="${act}" data-t="${t}" style="--c:${Care.TYPES[t].c}">${icon(t)}<span>${Care.TYPES[t].name}</span></button>`;
const quickRow = k => `<div class="quick"><button class="round" data-act="planlog" aria-label="예정 일정 넣기">${icon('cal')}</button><div class="pill">${typesFor(k).map(t => typeBtn(t, 'log')).join('')}</div></div>`;
function logRow(l) {
  const T = Care.TYPES[l.type] || Care.TYPES.memo, st = Care.state(l, nowText()), name = l.sub && !['food', 'meal', 'groom'].includes(l.type) ? (l.type === 'diaper' ? l.sub : `${T.name} ${l.sub}`) : l.sub || T.name;
  const time = st === 'done' ? `<span class="tm"><b>${Care.clock(l.time)}</b>${l.end ? `<em>${Care.clock(l.end)}</em>` : ''}</span>` : `<span class="tm"><em>${st === 'plan' ? '예정' : '미완료'}</em><b>${Care.clock(l.time)}</b></span>`;
  return `<button class="log ${st}" data-act="editlog" data-id="${l.id}" style="--c:${T.c}">${time}<span class="lic">${icon(l.type)}</span><span class="ln"><b>${esc(name)}</b>${l.amount ? `<em>${esc(l.amount)}${T.unit || ''}</em>` : ''}${l.type === 'sleep' && l.end ? `<em>${Care.hm(Care.minutes(l))}</em>` : ''}${l.memo ? `<small>${esc(l.memo)}</small>` : ''}</span>${icon('right', 's')}</button>`;
}
const dayLabel = (k, d) => { const n = S.diffDays(k.birth, d); return k.born ? (n >= 0 ? 'D+' + (n + 1) : '') : n < 0 ? 'D' + n : n === 0 ? 'D-DAY' : 'D+' + n; };
const dayBar = (k, d) => { const [, m, x] = d.split('-').map(Number); return `<div class="daybar ${d === today() ? 'on' : ''}"><span>${m}월 ${x}일${d === today() ? ' 오늘' : ''}</span><span>${dayLabel(k, d)}</span></div>`; };
function timeline(k) {
  const by = Care.byDay(logsOf(k)), t = today(); by[t] = by[t] || [];
  const days = Object.keys(by).sort().reverse(), future = days.filter(d => d > t), past = days.filter(d => d <= t);
  const fut = future.reverse().slice(0, 3);
  // 오늘 날짜는 홈 위쪽에 따로 보이므로, 앞에 예정된 날이 없으면 오늘 막대는 뺀다.
  return fut.map(d => dayBar(k, d) + by[d].map(logRow).join('')).join('')
    + past.slice(0, careDays).map(d => (d === t && !fut.length ? '' : dayBar(k, d)) + (d < t ? `<button class="rep" data-act="report" data-d="${d}">하루 요약</button>` : '') + (by[d].map(logRow).join('') || '<p class="empty" style="padding:18px 0">위의 그림을 눌러 첫 기록을 남겨 보세요.</p>')).join('')
    + (past.length > careDays ? '<button class="btn" data-act="moredays">지난 기록 더 보기</button>' : '');
}
// 홈에서는 한 줄로 줄인 얼굴 사진 미션
function missionStrip(k) {
  const t = today(), n = dayNo(k, t); if (!k.born || n < 1 || Me.is(k) || Couple.is(k)) return '';
  const f = facesOf(k).find(x => x.date === t);
  return `<div class="strip mis"><button class="fc ${f ? 'on' : ''}" ${f ? `data-act="face" data-id="${f.id}" aria-label="오늘 찍은 얼굴 사진"` : `data-act="faceask" data-d="${t}" aria-label="얼굴 사진 넣기"`}>${f ? `<img ${pic(f.id, 1)} alt="">` : icon('cam')}</button><button class="tx" data-tab="grow"><b>${f ? `${n}일차 사진을 찍었어요` : `${n}일차 ${Couple.is(k) ? '우리' : '얼굴'} 사진 찍기`}</b><em>오늘의 미션.${nextDay(k)}</em></button>${f ? icon('right', 's') : `<button class="btn" data-act="faceadd" data-d="${t}" data-cam="1">찍기</button>`}</div>`;
}
function home() {
  const k = K(), a = alerts(k), n = a.open.length, first = a.open[0];
  const strip = !k.born && today() >= k.birth ? `<div class="notice hot"><b>예정일이 되었어요. 아기가 태어났나요?</b><div class="row"><button class="btn main" data-act="born">생일 넣기</button></div></div>`
    : first ? `<details class="acc" ${localStorage.getItem('baby-acc-vax') === '0' ? '' : 'open'}><summary>${icon('shield')}<b>${Me.is(k) ? '올해 챙길 검진' : Couple.is(k) ? '다가오는 기념일' : '지금 받을 것'} ${n}개</b>${icon('down', 's')}</summary><div class="list">${a.open.map(itemRow).join('')}</div><button class="accall" data-act="vaxnow">전체 일정 보기${icon('right', 's')}</button></details>` : '';
  const ev = a.events.map(e => `<button class="strip" data-act="event" data-id="${e.id}">${icon('cal')}<span><b>${esc(e.title)}</b><em>${e.date === today() ? '오늘' : '내일'}${e.time ? ' ' + Care.clock(e.time) : ''}</em></span>${icon('right', 's')}</button>`).join('');
  return inAppCard() + syncCard() + quickRow(k) + (k.born ? '' : hero()) + growCar(k) + `<div class="stack">${strip}${ev}${missionStrip(k)}</div>` + (k.born ? '' : mission()) + grapeCard(k) + `<section class="logs">${timeline(k)}</section>` + loginCard();
}

// 홈 위쪽: 성장 앨범 사진을 날짜 순서로 옆으로 넘기며 보여 준다
let carI = 0;
function growCar(k) {
  const fs = k.born && !Couple.is(k) ? facesOf(k) : []; if (!fs.length) return '';
  if (carI >= fs.length) carI = 0;
  setTimeout(() => { const c = document.querySelector('.growcar'); if (c) c.scrollLeft = carI * c.clientWidth; });
  return `<div class="growcar" aria-label="${growName()}">${fs.map(f => `<button data-act="face" data-id="${f.id}"><img ${pic(f.id)} alt="${dayNo(k, f.date)}일차 얼굴 사진"><span class="d">${dayNo(k, f.date)}일차</span></button>`).join('')}</div>`;
}
if (typeof document !== 'undefined') (() => {
  let hold = 0;
  ['pointerdown', 'touchstart'].forEach(n => document.addEventListener(n, e => { if (e.target.closest && e.target.closest('.growcar')) hold = Date.now(); }, { passive: true, capture: true }));
  setInterval(() => {
    const c = document.querySelector('.growcar'); if (!c || document.hidden || Date.now() - hold < 6000 || matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    const w = c.clientWidth, n = c.children.length; if (!w || n < 2) return;
    carI = (Math.round(c.scrollLeft / w) + 1) % n;
    const x0 = c.scrollLeft, x1 = carI * w, t0 = performance.now(), ms = 520; c.style.scrollSnapType = 'none';
    const step = t => { const p = Math.min(1, (t - t0) / ms), e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; c.scrollLeft = x0 + (x1 - x0) * e; if (p < 1) requestAnimationFrame(step); else c.style.scrollSnapType = ''; };
    requestAnimationFrame(step);
  }, 3000);
  document.addEventListener('scroll', e => { const c = e.target; if (c.classList && c.classList.contains('growcar') && c.clientWidth && !c.style.scrollSnapType) carI = Math.round(c.scrollLeft / c.clientWidth); }, { capture: true, passive: true });
  // 접기·펴기 상태를 기억한다(처음엔 펼침)
  document.addEventListener('toggle', e => { if (e.target.matches && e.target.matches('details.acc')) try { localStorage.setItem('baby-acc-vax', e.target.open ? '1' : '0'); } catch { } }, true);
})();

/* ── 기록 창 ── */
function logDlg(type, l, plan) {
  const T = Care.TYPES[type], d = new Date(); if (plan) d.setHours(d.getHours() + 1, 0);
  const v = l || { date: d.toLocaleDateString('sv-SE'), time: d.toTimeString().slice(0, 5), end: '', sub: (T.sub || [''])[0], amount: '', memo: '', done: !plan };
  const st = l ? Care.state(l, nowText()) : '';
  openDlg(`<form data-form="log" data-id="${l ? l.id : ''}" data-t="${type}"><div class="row">${`<span class="lic" style="--c:${T.c}">${icon(type)}</span>`}<h2>${T.name}${plan ? ' 예정' : ''}</h2></div>
  ${T.sub ? `<div class="opts">${T.sub.map(x => `<label><input type="radio" name="sub" value="${x}" ${v.sub === x ? 'checked' : ''}><span>${x}</span></label>`).join('')}</div>` : ''}
  <div class="two"><label class="f">날짜<input type="date" name="date" required value="${v.date}"></label><label class="f">${T.end ? '시작 시각' : '시각'}<input type="time" name="time" required value="${v.time}"></label></div>
  ${T.end ? `<label class="f">끝난 시각 (선택)<input type="time" name="end" value="${v.end || ''}"></label>` : ''}
  ${T.unit ? `<label class="f">${{ '℃': '체온', kg: '체중', 회: '횟수' }[T.unit] || '양'} (${T.unit}${type === 'temp' ? '' : ', 선택'})<input type="number" inputmode="decimal" step="any" min="0" max="5000" name="amount" value="${esc(v.amount)}" ${type === 'temp' ? 'required' : ''}></label>` : ''}
  <label class="f">메모 (선택)<input name="memo" maxlength="200" autocomplete="off" value="${esc(v.memo)}"></label>
  ${st === 'plan' || st === 'miss' ? '<label class="ck"><input type="checkbox" name="done">완료했어요</label>' : ''}
  <p class="sub">앞으로의 시각을 넣으면 예정으로 저장돼요.</p>${acts(l && ['log', l.id, '지우기'])}</form>`);
}
const planDlg = () => openDlg(`<form data-form="none"><h2>어떤 일정을 넣을까요?</h2><div class="typegrid">${typesFor(K()).map(t => typeBtn(t, 'plan')).join('')}</div><button type="button" class="btn" data-act="event">달력에 일정 추가</button></form>`);
async function saveLog(f, v) {
  const id = f.dataset.id, old = db.logs.find(x => x.id === id), future = v.date + 'T' + v.time > nowText();
  // 예정이던 기록은 '완료했어요'를 눌러야 완료가 된다.
  const done = old && !old.done ? Boolean(v.done) : !future;
  const n = { type: f.dataset.t, sub: v.sub || '', date: v.date, time: v.time, end: v.end || '', amount: v.amount || '', memo: (v.memo || '').trim(), done };
  return save(d => { const e = d.logs.find(x => x.id === id); if (e) Object.assign(e, n); else d.logs.push(Object.assign({ id: uid(), kid: K().id }, n)); });
}
function reportDlg(d) {
  const k = K(), day = d || today(), r = Care.report(logsOf(k).filter(l => l.date === day)), [, m, x] = day.split('-').map(Number);
  const cell = (t, n, v, s) => `<div style="--c:${Care.TYPES[t].c}"><span class="lic">${icon(t)}</span><span>${n}</span><b>${v}</b><em>${s || ''}</em></div>`;
  openDlg(`<form data-form="none"><h2>${m}월 ${x}일 하루 요약</h2><div class="row between"><button type="button" class="btn" data-act="report" data-d="${S.addDays(day, -1)}">전날</button><span class="sub">${esc(k.name)} ${dayLabel(k, day)}</span><button type="button" class="btn" data-act="report" data-d="${S.addDays(day, 1)}" ${day >= today() ? 'disabled' : ''}>다음 날</button></div>
  ${r.total ? `<div class="rgrid">${k.born && !k.kind ? cell('bottle', '수유', r.feeds + '회', r.ml ? `젖병 ${r.ml}ml` : '') + cell('diaper', '기저귀', r.diaper + '회', r.diaper ? `소변 ${r.pee} 대변 ${r.poo}` : '') + cell('sleep', '수면', r.sleep ? Care.hm(r.sleep) : '-') + cell('food', '이유식', r.food + '회') + (r.temp ? cell('temp', '최고 체온', r.temp + '℃') : '') : typesFor(k).map(t => cell(t, Care.TYPES[t].name, logsOf(k).filter(l => l.date === day && l.type === t && l.done).length + '회')).join('')}</div>` : '<p class="empty">이날은 기록이 없어요.</p>'}</form>`);
}
// 수첩 목록: 종류별로 묶고, 아기와 반려동물은 그 종류 안에서 더할 수 있다. 새 종류는 오른쪽 위 +로 만든다.
const KCAT = [['baby', '아기', 'baby', '쌍둥이·형제 더하기', 'addkid'], ['pet', '반려동물', 'paw', '반려동물 더하기', 'addpet'], ['couple', '연애', 'heart'], ['me', '개인', 'user']];
const kcat = k => Pet.isPet(k) ? 'pet' : Couple.is(k) ? 'couple' : Me.is(k) ? 'me' : 'baby';
const kidRow = k => `<div class="kidrow"><button type="button" data-act="pickkid" data-id="${k.id}" ${k.id === K().id ? 'aria-current="true"' : ''}>${face(k)}<span><b>${esc(k.name)}</b><em>${Me.is(k) ? '' : Couple.is(k) ? '' : Pet.isPet(k) ? Pet.KINDS[k.kind] + (k.sex ? ' ' + Pet.SEX[k.sex] : '') + ', ' : k.sex ? Family.SEX[k.sex] + ', ' : k.born ? '' : '성별 모름, '}${ageLine(k)}</em></span></button><button type="button" class="btn" data-act="kidedit" data-id="${k.id}">고치기</button></div>`;
const kidsDlg = () => openDlg(`<form data-form="none"><div class="row between"><h2>수첩</h2><button type="button" class="sq" data-act="newcat" aria-label="새 수첩 만들기">${icon('plus')}</button></div>${KCAT.map(([c, n, , add, act]) => { const l = db.kids.filter(k => kcat(k) === c); return l.length ? `<h3 class="vcat">${n} 수첩</h3><div class="list">${l.map(kidRow).join('')}</div>${add ? `<button type="button" class="btn" data-act="${act}">${add}</button>` : ''}` : ''; }).join('')}</form>`);
// 새 수첩 종류 고르기. 이미 있는 종류는 고를 수 없다.
const newCatDlg = () => openDlg(`<form data-form="none"><h2>어떤 수첩을 만들까요?</h2><div class="picks">${KCAT.map(([c, n, ic]) => { const has = db.kids.some(k => kcat(k) === c); return `<button type="button" data-act="mkcat" data-c="${c}" ${has ? 'disabled' : ''}>${icon(ic, 'xl')}<b>${n} 수첩</b><span>${has ? '이미 있어요' : '새로 만들기'}</span></button>`; }).join('')}</div></form>`);

/* ── 더보기 ── */
function more() {
  const it = (i, t, s, at) => `<button class="menu" ${at}><span class="lic">${icon(i)}</span><span><b>${t}</b><em>${s}</em></span>${icon('right', 's')}</button>`;
  const pet = Pet.isPet(K()), cp = Couple.is(K()), me = Me.is(K());
  return accountCard() + `<section class="menus"><h3>${me ? '개인 수첩' : cp ? '연애' : pet ? '반려동물' : '아기'}</h3>${me ? (Me.isSolo(K()) ? '' : it('heart', growName(), '매일 사진 한 장', 'data-tab="grow"')) + it('shield', '건강검진', '나이와 성별에 맞는 국가검진', 'data-tab="vax"') + it('tips', '재테크·여행', '돈 관리와 여행 추천', 'data-tab="money"') : (cp ? '' : it('heart', growName(), '매일 얼굴 사진과 성장 영상', 'data-tab="grow"'))}${cp ? it('cal', '기념일', '100일, 주년 챙기기', 'data-tab="vax"') + it('visit', '데이트 명소', '지역별 명소와 행사', 'data-tab="money"') : pet ? it('shield', '접종·건강', '접종, 검진, 예방약 일정', 'data-tab="vax"') + it('hospital', '동물병원 찾기', '카카오맵에서 가까운 동물병원', 'data-act="vethosp"') : it('shield', '접종·검진', '전체 일정과 완료 기록', 'data-tab="vax"') + it('hospital', '인근 병원', '가까운 소아청소년과와 보건소', 'data-act="hospitals"')}${it('paw', '수첩 더하기', '아기, 반려동물, 연애, 개인 수첩을 더 만들어요', 'data-act="kids"')}${it('bell', '캘린더에 넣기', '일정을 캘린더 파일로 받기', 'data-act="ics"')}</section>
  <section class="menus"><h3>가족</h3>${me ? '' : it('diary', '함께 쓰기 초대', cp ? '연인과 같은 수첩을 같이 기록해요' : '아빠·엄마와 같은 수첩을 같이 기록해요', 'data-act="invite" data-role="editor"') + it('heart', '보기만 초대', cp ? '친구가 일기와 앨범을 보고 댓글을 달아요' : '할머니·이모가 일기와 앨범을 보고 댓글을 달아요', 'data-act="invite" data-role="viewer"')}${it('chat', '초대 링크로 들어가기', '받은 초대 링크를 붙여 넣어요', 'data-act="pastejoin"')}${it('visit', '놀러가기', visits.length ? `초대받은 집 ${visits.length}곳` : '보기만 초대를 받은 집에 놀러 가요', 'data-act="visits"')}${bound ? it('baby', '가족 수첩 보기', esc(bound.name || '') + ' 가족 목록', 'data-act="family"') : ''}${it('gear', '내 별명', myNick(kcat(K())) ? esc(myNick()) : '아직 정하지 않았어요', 'data-act="nick"')}</section>
  <section class="menus"><h3>앱</h3>${it('heart', '카카오톡으로 공유하기', '디데이나 앱 소개 보내기', 'data-act="sharek"')}${it('gear', '설정', '수첩 정보, 지역, 백업', 'data-act="settings"')}</section><p class="sub">${pet ? '반려동물 일정은 국내 동물병원에서 흔히 쓰는 순서예요. 실제 접종은 동물병원 안내를 먼저 따르세요.' : '질병관리청 표준예방접종일정표(2026) 기준이에요. 실제 접종은 병원 안내를 먼저 따르세요.'} 버전 ${APP_VERSION}</p>`;
}
// 들어온 곳(홈, 더보기 …)으로 돌아간다
const backRow = (t, to) => `<div class="backrow"><button data-tab="${to || (subFrom && subFrom.tab) || 'more'}" data-back="1" aria-label="뒤로">${icon('left')}</button><h2>${t}</h2></div>`;
function vax() {
  const a = alerts(K()), sec = (t, l) => l.length ? `<section class="stack"><h2>${t}</h2><div class="list">${l.map(itemRow).join('')}</div></section>` : '';
  return backRow(Me.is(K()) ? '건강검진' : Couple.is(K()) ? '기념일' : Pet.isPet(K()) ? '접종·건강' : '접종·검진') + sec('지금 받을 것', a.open) + sec(K().born ? '다음 일정' : '태어나면 바로 챙길 것', a.next) + sec('시기가 지난 일정', a.late) + sec('전체', items());
}

/* ── 포도송이 미션(연애: 우리들만 아는 시크릿 미션, 개인: 혼자만의 미션) ── */
const GRAPE_N = 30, GRAPE_ROWS = [7, 6, 5, 4, 3, 2, 2, 1];
const MISSIONS = {
  couple: ['서로의 장점 3개 말해 주기', '손 잡고 30분 산책하기', '처음 만난 날 이야기 나누기', '상대 사진 몰래 예쁘게 찍어 주기', '하루 동안 존댓말 쓰기', '상대가 좋아하는 간식 깜짝 선물', '같이 셀카 10장 찍기', '손편지 한 장 건네기', '같이 요리해서 먹기', '서로 어깨 안마 5분', '오늘 "고마워" 5번 말하기', '우리 노래 정해서 같이 듣기', '처음 가 보는 동네 같이 걷기', '서로의 버킷리스트 하나 이루기', '뜬금없이 칭찬 문자 보내기'],
  me: ['물 2리터 마시기', '만 보 걷기', '책 10쪽 읽기', '휴대폰 없이 30분 쉬기', '방 하나 정리하기', '처음 먹어 보는 음식 도전', '혼자 영화 보기', '밤 11시 전에 자기', '감사한 일 3개 적기', '스트레칭 10분', '안 가 본 카페 가 보기', '오늘 쓴 돈 기록하기', '오랜 친구에게 안부 묻기', '아침 챙겨 먹기', '30분 운동하기'],
};
const grapeOf = k => k.grape || { n: 0, mi: 0, custom: [], log: [] };
const missionList = k => (grapeOf(k).custom || []).concat(MISSIONS[Couple.is(k) ? 'couple' : 'me']);
const missionNow = k => { const l = missionList(k); return l[grapeOf(k).mi % l.length]; };
function grapeSvg(filled) {
  let i = 0, out = '<path d="M100 6c-4 10-4 18 0 24" fill="none" stroke="#6b8f3a" stroke-width="4" stroke-linecap="round"/><path d="M104 14c14-10 34-8 44 2-14 8-30 8-44-2z" fill="#7fae45"/>';
  GRAPE_ROWS.forEach((n, r) => { for (let j = 0; j < n; j++) { i++; const x = 100 + (j - (n - 1) / 2) * 25, y = 44 + r * 21, on = i <= filled; out += `<circle cx="${x}" cy="${y}" r="11.5" fill="${on ? '#7b3fa0' : '#fff'}" stroke="${on ? '#5d2b7d' : '#c9b4d6'}" stroke-width="2"/>${on ? `<circle cx="${x - 4}" cy="${y - 4}" r="3" fill="#fff" opacity=".45"/>` : `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="10" fill="#a58bb8">${i}</text>`}`; } });
  return `<svg class="grape" viewBox="0 0 200 212" role="img" aria-label="포도 ${filled}알 / ${GRAPE_N}알">${out}</svg>`;
}
function grapeCard(k) {
  if (!Couple.is(k) && !Me.is(k)) return '';
  const g = grapeOf(k), now = g.n % GRAPE_N, bunch = Math.floor(g.n / GRAPE_N);
  return `<section class="grapecard"><div class="row between"><h3>${Couple.is(k) ? '우리들만 아는 시크릿 미션' : '혼자만의 미션'}</h3><span class="chip">${bunch ? `송이 ${bunch}개 완성 · ` : ''}${now}/${GRAPE_N}</span></div>${grapeSvg(now)}<p class="mis">${esc(missionNow(k))}</p><div class="row"><button class="btn main" data-act="grapeok">성공</button><button class="btn" data-act="grapenext">다른 미션</button><button class="btn" data-act="grapeown">직접 쓰기</button></div></section>`;
}
