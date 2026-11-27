'use strict';
const APP_VERSION = '0.26.1';
const S = Schedule, $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toLocaleDateString('sv-SE');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const WD = '일월화수목금토';
const dow = d => new Date(d + 'T00:00:00Z').getUTCDay();
const kd = (d, y) => { const [a, b, c] = d.split('-').map(Number); return (y || d.slice(0, 4) !== today().slice(0, 4) ? a + '년 ' : '') + `${b}월 ${c}일 (${WD[dow(d)]})`; };
const isDate = d => /^\d{4}-\d\d-\d\d$/.test(d || '');
const TYPE = { vaccine: '예방접종', check: '건강검진', oral: '구강검진', screen: '신생아 검사', prev: '예방약', care: '건강 관리', anniv: '기념일', mine: '내 일정', diary: '일기' };
const SIDO = Regions.SIDO.map(s => s.name);

const fresh = () => ({ v: 1, kids: [Family.newKid('k1', { birth: today(), options: Object.assign({}, S.DEFAULT_OPTIONS) })], cur: 'k1', sido: '', sigungu: '', leads: [7, 1], hour: 9, events: [], diary: [], photos: [], faces: [], logs: [], exports: 0 });
const K = () => db.kids.find(k => k.id === db.cur) || db.kids[0];
const kidOf = id => db.kids.find(k => k.id === id) || K();
// many: 지금 보는 수첩과 같은 종류가 둘 이상(쌍둥이, 여러 마리). manyAll: 수첩이 둘 이상(빼기, 고르기)
const catKids = () => db.kids.filter(k => kcat(k) === kcat(K()));
const many = () => catKids().length > 1, manyAll = () => db.kids.length > 1;
const josa = n => { const c = n.charCodeAt(n.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? '이' : '가'; };
let db = fresh(), rev = 0, ready = false, started = false, ai = false, tab = 'home', month = today().slice(0, 7), sel = today();
const aiData = { tips: null, benefits: null, busy: {}, err: {} };

// 두 손가락·두 번 눌러 확대 막기(아이폰은 viewport 설정만으로는 막히지 않는다)
['gesturestart', 'gesturechange', 'gestureend'].forEach(n => document.addEventListener(n, e => e.preventDefault(), { passive: false }));
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', e => e.preventDefault());

/* ── 저장 ── */
const GOOGLE_ID = '61502815483-ocflesj39gb56pif53m7qae951jkil49.apps.googleusercontent.com'; // 구글 로그인용 클라이언트 ID(공개해도 되는 값). 비어 있으면 로그인 화면이 나오지 않는다.
const G_LOGO = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
const gBtn = `<button type="button" class="gbtn" data-act="login">${G_LOGO}Google 계정으로 로그인</button>`;
const AI_URL = ''; // 비워 두면 웹에서는 AI를 쓰지 않는다(무료). 주소를 넣으면 설정에 접근 코드 칸이 나온다. // 배포한 AI 서버 주소
let conf = { url: '', code: '' };
try { conf = Object.assign(conf, JSON.parse(localStorage.getItem('baby-ai') || '{}')); } catch { }
const aiBase = () => AI_URL && (conf.url || AI_URL);
function saveAI(code) {
  const changed = code !== conf.code;
  conf = Object.assign({}, conf, { code }); ai = Boolean(aiBase() && conf.code); aiData.err = {};
  try { localStorage.setItem('baby-ai', JSON.stringify(conf)); } catch { }
  // 코드가 맞는지 바로 확인한다. AI를 실행하지 않아 요금은 들지 않는다.
  if (changed && ai) remoteAI('/api/status').then(() => toast('AI가 연결됐어요')).catch(e => toast(e.message));
}
// 웹 서버는 기다리는 동안 빈 줄을 보내고 마지막 줄에 결과를 준다.
async function remoteAI(url, opt) {
  let r, text;
  try { r = await fetch(aiBase() + url, Object.assign({}, opt, { headers: { authorization: 'Bearer ' + encodeURIComponent(conf.code) } })); text = await r.text(); }
  catch { throw new Error('AI 서버에 연결하지 못했어요. 잠시 뒤 다시 누르면 찾던 결과를 이어서 받아요.'); }
  let j; try { j = JSON.parse(text.trim().split('\n').pop()); } catch { throw new Error('AI 서버 응답이 끊겼어요. 잠시 뒤 다시 눌러 주세요.'); }
  const status = r.ok && j.status ? j.status : r.status, body = r.ok && j.status ? j.body : j;
  if (status !== 200) throw Object.assign(new Error(body.error || 'AI 서버에서 오류가 났어요.'), { status });
  return body;
}
let local = false; // 서버 없이 열었으면 이 기기에 저장
async function api(url, opt) {
  if (local && (url === '/api/tips' || url === '/api/benefits')) return remoteAI(url, opt);
  if (local) return Local.api(url, opt);
  let r; try { r = await fetch(url, opt); } catch { throw Object.assign(new Error('서버에 연결하지 못했어요. 터미널에서 앱이 켜져 있는지 확인하세요.'), {}); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || '오류가 났어요.'), { status: r.status, needKey: j.needKey });
  return j;
}
let chain = Promise.resolve(true);
let handoff = ''; // 로그인이 다른 창에서 끝나 이 창으로 온 경우
// 저장은 순서대로 한 번씩. 실패하면 화면에 알리고 false를 준다.
function save(change) {
  return chain = chain.then(async () => {
    const before = JSON.stringify(db);
    change(db);
    try { rev = (await api('/api/state', { method: 'PUT', body: JSON.stringify({ rev, data: db }) })).rev; render(); pushLater(); syncLater(); famLater(); return true; }
    catch (e) {
      db = JSON.parse(before);
      if (e.status === 409) { const s = await api('/api/state').catch(() => null); if (s) { rev = s.rev; db = Object.assign(fresh(), Family.migrate(s.data)); } toast('다른 창에서 바뀐 내용을 불러왔어요. 다시 저장해 주세요.'); }
      else toast('저장하지 못했어요. ' + e.message);
      render(); return false;
    }
  });
}
// 열린 창 위에도 보이도록 맨 위층(popover)에 띄운다. 지원하지 않으면 열린 창 안으로 옮긴다.
let tt; function toast(m) {
  const t = $('#toast'), top = typeof t.showPopover === 'function'; t.textContent = m; t.hidden = false;
  if (top) { if (t.matches(':popover-open')) t.hidePopover(); t.showPopover(); } else ([...document.querySelectorAll('dialog[open]')].pop() || document.body).append(t);
  clearTimeout(tt); tt = setTimeout(() => { if (top && t.matches(':popover-open')) t.hidePopover(); t.hidden = true; if (!top) document.body.append(t); }, 3500);
}
// 가져오고 저장하는 동안 보이는 창. 저장 중에는 닫히지 않는다.
const busyDlg = $('#busy'); let busyLock = false, busyWait = 0;
busyDlg.addEventListener('cancel', e => { if (busyLock) e.preventDefault(); });
function busy(title, sub, done, total) {
  busyLock = total != null;
  if (!busyDlg.open) { busyDlg.innerHTML = `<div class="bz"><div class="spin" aria-hidden="true"></div><b id="busyt" role="status"></b><span id="busys"></span><progress id="busyp" hidden></progress><button type="button" class="btn" data-act="close" id="busyx">취소</button></div>`; busyDlg.showModal(); }
  $('#busyt').textContent = title; $('#busys').textContent = sub || '';
  $('#busyp').hidden = !busyLock || total < 2; if (busyLock) { $('#busyp').max = total; $('#busyp').value = done; }
  $('#busyx').hidden = busyLock;
}
function busyOff() { clearTimeout(busyWait); busyLock = false; if (busyDlg.open) busyDlg.close(); }
// 파일 고르기. 아이폰은 화면에 붙어 있지 않은 칸의 결과를 버릴 수 있어, 다 고를 때까지 문서(열린 창이 있으면 그 안)에 붙여 둔다.
let picker = null;
// 사진만(동영상은 고르는 목록에 안 보이게). 'image/*'만 주면 휴대폰에 따라 동영상도 보여서 종류를 하나씩 적는다.
const PHOTO_ONLY = 'image/jpeg,image/png,image/heic,image/heif,image/webp,image/gif,.jpg,.jpeg,.png,.heic,.heif,.webp';
function pickFiles(o, done) {
  if (picker) picker.remove();
  const i = picker = document.createElement('input'); i.type = 'file'; i.className = 'vh'; i.tabIndex = -1; i.setAttribute('aria-hidden', 'true');
  i.accept = o.accept || 'image/*'; i.multiple = Boolean(o.multiple); if (o.capture) i.capture = o.capture;
  i.addEventListener('change', () => { const fs = [...i.files]; i.remove(); if (picker === i) picker = null; if (fs.length) done(fs); else if (o.busy) busyOff(); });
  i.addEventListener('cancel', () => { i.remove(); if (picker === i) picker = null; if (o.busy) busyOff(); });
  ([...document.querySelectorAll('dialog[open]')].pop() || document.body).append(i); i.click();
  // 다 고른 뒤 휴대폰이 동영상을 준비하는 몇 초 동안 보이도록 고르는 화면 뒤에 미리 띄운다. 아이폰의 고르기 메뉴와 겹치지 않게 조금 늦춘다.
  clearTimeout(busyWait); if (o.busy) busyWait = setTimeout(() => { if (picker === i) busy(o.busy, '휴대폰이 사진과 동영상을 준비하고 있어요. 잠시 기다려 주세요'); }, o.capture ? 1200 : 1500);
  // 고르는 화면이 닫히고 앱으로 돌아오면 바로 띄운다(동영상이 많으면 휴대폰이 준비하는 데 오래 걸린다).
  if (o.busy) { const back = () => { if (picker === i) { clearTimeout(busyWait); busyWait = setTimeout(() => { if (picker === i) busy(o.busy, '휴대폰이 사진과 동영상을 준비하고 있어요. 잠시 기다려 주세요'); }, 300); } }; window.addEventListener('focus', back, { once: true }); document.addEventListener('visibilitychange', () => { if (!document.hidden) back(); }, { once: true }); }
}
const isPet = k => Pet.isPet(k);
const items = (k = K()) => (isPet(k) ? Pet.build(k.kind, k.birth, k.records, { since: k.since, today: today() }) : Couple.is(k) ? Couple.build(k.birth, k.records, { since: k.since }) : Me.is(k) ? Me.build(k.birth, k.sex, k.records, { today: today() }) : S.build(k.birth, k.options, k.records)).map(i => Object.assign(i, { kid: k.id }));
// 달력은 지금 보는 수첩과 같은 종류만(아기끼리, 반려동물끼리)
const sameCat = x => { const k = x.kid && db.kids.find(y => y.id === x.kid); return x.kid ? Boolean(k) && kcat(k) === kcat(K()) : true; };
const schedName = () => ({ baby: '접종·검진', pet: '접종·건강', couple: '기념일', me: '건강검진' })[kcat(K())];
const famItems = () => db.kids.filter(k => kcat(k) === kcat(K())).flatMap(k => items(k)).sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
const tag = id => many() ? `<span class="chip">${id ? esc(kidOf(id).name) : '모두'}</span>` : '';

/* ── 날짜 표현 ── */
function stageOf(d, k = K()) {
  const n = S.diffDays(k.birth, d);
  if (!k.born) return n < 0 ? `예정일 D-${-n}` : n === 0 ? '예정일' : `예정일 +${n}일`;
  if (Couple.is(k)) return n < 0 ? '' : `만난 지 ${n + 1}일째`;
  if (Me.is(k)) return '';
  return n < 0 ? `태어나기 ${-n}일 전` : `태어난 지 ${n + 1}일째`;
}
function ageText(t) {
  const m = S.ageMonths(K().birth, t);
  if (m < 0) return '';
  return m < 1 ? '신생아' : m < 24 ? `만 ${m}개월` : `만 ${Math.floor(m / 12)}세${m % 12 ? ' ' + m % 12 + '개월' : ''}`;
}
const chipOf = it => {
  const s = S.status(it, today());
  if (s === 'done') return `<span class="stampmark">${{ vaccine: '접종', prev: '예방', care: '할 일', anniv: '챙김' }[it.type] || '검사'}<br>완료</span>`;
  if (it.type === 'anniv' && s !== 'late') { const l = S.diffDays(today(), it.end); return `<span class="chip ${l <= 7 ? 'hot' : ''}">${l ? 'D-' + l : '오늘'}</span>`; }
  if (it.appt) return `<span class="chip">예약 ${esc(it.appt.slice(5).replace('-', '/'))}</span>`;
  if (!kidOf(it.kid).born) return '<span class="chip">예정</span>';
  if (s === 'late') return '<span class="chip hot">시기 지남</span>';
  if (s === 'open') { const l = it.hard ? S.diffDays(today(), it.hard) : null; return l !== null && l <= 14 ? `<span class="chip hot">마감 ${l === 0 ? '오늘' : l + '일 전'}</span>` : '<span class="chip">받을 시기</span>'; }
  return `<span class="chip">${S.diffDays(today(), it.start)}일 뒤</span>`;
};
const itemRow = it => `<button class="item t-${it.type}" data-act="item" data-id="${it.id}" data-kid="${it.kid}"><span class="dot"></span><span><b>${tab === 'cal' && many() ? esc(kidOf(it.kid).name) + ', ' : ''}${esc(it.title)}</b><span class="when">${it.done ? kd(it.done) + ' 완료' : it.start === it.end ? kd(it.start) : `${kd(it.start)} ~ ${kd(it.end)}`}</span></span>${chipOf(it)}</button>`;
const evRow = e => `<button class="item t-mine" data-act="${e.course ? 'courseview' : 'event'}" data-id="${e.id}"><span class="dot"></span><span><b>${esc(e.title)}</b><span class="when">${kd(e.date)}${e.time ? ' ' + esc(e.time) : ''}</span></span>${many() ? tag(e.kid) : '<span class="chip">내 일정</span>'}</button>`;

/* ── 아이 등록 칸 ── */
// 아이 한 명을 적는 칸. 첫 화면과 아이 추가 창에서 같이 쓴다.
// 성별 고르기. 태어난 아이는 남자·여자, 출산 예정이면 모름까지 고른다.
const sexOpts = (n, sex, born, L) => `<div class="f sexf" data-sexbox><span>성별</span><div class="opts">${[['boy', (L || Family.SEX).boy], ['girl', (L || Family.SEX).girl], ['', '모름']].map(([v, t]) => `<label ${v ? '' : `data-unk ${born ? 'hidden' : ''}`}><input type="radio" name="${n}" value="${v}" ${v ? (sex === v ? 'checked' : '') : !sex && !born ? 'checked' : ''}><span class="${v}">${t}</span></label>`).join('')}</div></div>`;
// 성별이 비었으면 그 칸으로 데려가 무엇이 빠졌는지 보여 준다.
function flagSex(box) {
  if (!box) return;
  if (!box.querySelector('.errm')) box.insertAdjacentHTML('beforeend', '<p class="errm" role="alert">남자나 여자 중에 골라 주세요</p>');
  box.classList.add('err'); box.scrollIntoView({ block: 'center' });
}
document.addEventListener('change', ev => { const b = ev.target.closest && ev.target.closest('[data-sexbox]'); if (b) { b.classList.remove('err'); const m = b.querySelector('.errm'); if (m) m.remove(); } });
const sexBoxOf = (f, name) => { const i = f.querySelector(`[name="${name}"]`); return i && i.closest('[data-sexbox]'); };
// 태어났는지가 바뀌면 '모름'을 보이거나 감춘다.
function syncSex(box, born) {
  const u = box.querySelector('[data-unk]'); if (!u) return;
  u.hidden = born; const i = u.querySelector('input');
  if (born) i.checked = false; else if (!box.querySelector('[data-sexbox] input:checked')) i.checked = true;
}
// fixed: 첫 화면에서 이미 골랐으므로 태어났는지 다시 묻지 않는다.
const kidFields = (i, v, first, fixed) => `<fieldset class="${first ? '' : 'kidbox'}" data-kidbox="${i}" style="gap:16px">${first ? '' : `<div class="row between"><b>${i + 1}번째 아이</b><button type="button" class="btn danger" data-act="dropkid" data-i="${i}">빼기</button></div>`}
  ${fixed ? `<button type="button" class="avpick" data-act="obphoto" data-i="${i}"><span class="av xl">${FACE}</span><span>${icon('cam', 's')}사진 넣기</span></button>` : ''}
  <label class="f">${v.born ? '이름이나 애칭' : '태명이나 이름'}<input name="name${i}" maxlength="20" placeholder="예: 콩이 (비워 둬도 돼요)" autocomplete="off" value="${esc(v.name || '')}"></label>
  ${fixed && first ? `<input type="hidden" name="born${i}" value="${v.born ? '1' : ''}">` : `<div class="opts"><label><input type="radio" name="born${i}" value="1" ${v.born ? 'checked' : ''}><span>태어났어요</span></label><label><input type="radio" name="born${i}" value="" ${v.born ? '' : 'checked'}><span>출산 예정이에요</span></label></div>`}
  ${sexOpts('sex' + i, v.sex || '', Boolean(v.born))}
  <div class="two"><label class="f"><span class="lb">${v.born ? '태어난 날' : '출산 예정일'}</span><input type="date" name="birth${i}" required value="${v.birth || ''}"></label><label class="f"><span class="lt">${v.born ? '태어난 시각' : '예정 시각'} (선택)</span><input type="time" name="time${i}" value="${v.time || ''}"></label></div>
  <div class="pv stack" aria-live="polite"></div></fieldset>`;
const kidRows = f => [...f.querySelectorAll('[data-kidbox]')].map(b => Number(b.dataset.kidbox));
const readKid = (f, i) => ({ name: f.elements['name' + i].value.trim(), born: f.elements['born' + i].value === '1', birth: f.elements['birth' + i].value, time: f.elements['time' + i].value, sex: f.elements['sex' + i].value });
// 날짜가 말이 되는지 보고, 안 되면 이유를 돌려준다.
function dateProblem(d, born) {
  if (!isDate(d)) return '날짜를 골라 주세요.';
  const n = S.diffDays(today(), d);
  if (born) return n > 0 ? '생일이 오늘보다 뒤예요.' : n < -4745 ? '만 13세 미만 아이의 생일을 넣어 주세요.' : '';
  return n > 300 ? '예정일이 너무 멀어요. 날짜를 확인해 주세요.' : n < -30 ? '예정일이 많이 지났어요. 태어났다면 "이미 태어났어요"를 골라 주세요.' : '';
}
function startPreview(f) {
  f.querySelectorAll('[data-kidbox]').forEach(box => {
    const { born, birth: d, time } = readKid(f, box.dataset.kidbox);
    syncSex(box, born);
    box.querySelector('.lb').textContent = born ? '태어난 날' : '출산 예정일';
    box.querySelector('.lt').textContent = (born ? '태어난 시각' : '예정 시각') + ' (선택)';
    if (!d) return;
    const bad = dateProblem(d, born), n = S.diffDays(today(), d), g = 280 - n, tm = Family.timeText(time);
    box.querySelector('.pv').innerHTML = bad ? `<p style="color:var(--stamp);font-weight:600">${esc(bad)}</p>` : `<div class="dday">${born ? 1 - n + '일' : n > 0 ? 'D-' + n : n === 0 ? 'D-DAY' : 'D+' + -n}</div><p>${kd(d, true)}${tm ? ' ' + tm : ''} ${born ? '출생' : `예정, 임신 ${Math.floor(g / 7)}주 ${g % 7}일`}</p>`;
  });
}
document.addEventListener('input', ev => { if (ev.target.form && ['start', 'addkid'].includes(ev.target.form.dataset.form)) startPreview(ev.target.form); });
// 여러 아이를 한 번에 읽는다. 문제가 있으면 어느 아이인지 알려준다.
function readKids(f) {
  const rows = kidRows(f), out = [];
  for (const i of rows) {
    const v = readKid(f, i), bad = Family.sexProblem(v.sex, v.born) || dateProblem(v.birth, v.born);
    if (Family.sexProblem(v.sex, v.born)) flagSex(sexBoxOf(f, 'sex' + i));
    if (bad) return { bad: rows.length > 1 ? `${out.length + 1}번째 아이: ${bad}` : bad };
    out.push(Object.assign(v, { row: i }));
  }
  return { list: out };
}
// 반려동물 한 마리를 적는 칸. 첫 화면, 더하기, 고치기 창에서 같이 쓴다.
const petFields = (v, first) => `<fieldset data-kidbox="0" style="gap:16px">${first ? `<button type="button" class="avpick" data-act="obphoto" data-i="0"><span class="av xl pet">${icon('paw')}</span><span>${icon('cam', 's')}사진 넣기</span></button>` : ''}
  <div class="opts">${Object.entries(Pet.KINDS).map(([k, n], i) => `<label><input type="radio" name="kind" value="${k}" ${(v.kind || 'dog') === k ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
  <label class="f">이름<input name="name" maxlength="20" placeholder="예: 보리" autocomplete="off" value="${esc(v.name || '')}"></label>
  ${sexOpts('sex', v.sex || '', false, Pet.SEX)}
  <label class="f">생일<input type="date" name="birth" required max="${today()}" value="${v.birth || ''}"></label><p class="sub">생일을 모르면 데려온 날과 그때 나이로 대략 넣어 주세요. 나이에 맞춰 접종과 검진 일정을 보여 줘요.</p></fieldset>`;
function petDateProblem(d) {
  if (!isDate(d)) return '생일을 골라 주세요.';
  const n = S.diffDays(today(), d);
  return n > 0 ? '생일이 오늘보다 뒤예요.' : n < -365 * 30 ? '생일을 확인해 주세요.' : '';
}
// 개인 수첩: 이름, 생일, 성별, 솔로인지
const meFields = v => `<label class="f">이름<input name="name" maxlength="20" placeholder="예: 나" autocomplete="off" value="${esc(v.name || '')}"></label><label class="f">생일<input type="date" name="birth" required max="${today()}" value="${v.birth || ''}"></label>${sexOpts('sex', v.sex || '', true)}<div class="f"><span>지금은</span><div class="opts"><label><input type="radio" name="solo" value="1" ${v.solo !== false ? 'checked' : ''}><span>솔로예요</span></label><label><input type="radio" name="solo" value="" ${v.solo === false ? 'checked' : ''}><span>연애 중·결혼했어요</span></label></div></div><p class="sub">솔로면 혼자 사는 팁, 여행, 만남 팁을 더 보여 드려요. 나이와 성별에 맞는 건강검진도 챙겨 드려요.</p>`;
function meDlg(id) {
  const k = id ? kidOf(id) : null;
  openDlg(`<form data-form="${k ? 'me' : 'addme'}" data-id="${k ? k.id : ''}"><h2>${k ? esc(k.name) + ' 정보' : '개인 수첩 더하기'}</h2>${k ? `<button type="button" class="avpick" data-act="avatar" data-id="${k.id}">${face(k, 'xl')}<span>${icon('cam', 's')}사진 ${k.photo ? '바꾸기' : '넣기'}</span></button>` : ''}${meFields(k || {})}${acts(k && manyAll() && ['kid', k.id, '이 수첩 빼기'])}</form>`);
}
// 연애 수첩: 이름과 사귄 날
const coupleFields = v => `<label class="f">수첩 이름<input name="name" maxlength="20" placeholder="예: 우리 둘" autocomplete="off" value="${esc(v.name || '')}"></label><label class="f">사귄 날<input type="date" name="birth" required max="${today()}" value="${v.birth || ''}"></label><p class="sub">사귄 날이 1일이에요. 100일, 주년 같은 기념일을 챙겨 드려요.</p>`;
function coupleDlg(id) {
  const k = id ? kidOf(id) : null;
  openDlg(`<form data-form="${k ? 'couple' : 'addcouple'}" data-id="${k ? k.id : ''}"><h2>${k ? esc(k.name) + ' 정보' : '연애 수첩 더하기'}</h2>${k ? `<button type="button" class="avpick" data-act="avatar" data-id="${k.id}">${face(k, 'xl')}<span>${icon('cam', 's')}사진 ${k.photo ? '바꾸기' : '넣기'}</span></button>` : ''}${coupleFields(k || {})}${acts(k && manyAll() && ['kid', k.id, '이 수첩 빼기'])}</form>`);
}
const addPetDlg = () => openDlg(`<form data-form="addpet"><h2>반려동물 수첩 더하기</h2>${petFields({})}${acts()}</form>`);
function petDlg(id) {
  const k = kidOf(id);
  openDlg(`<form data-form="pet" data-id="${k.id}"><h2>${esc(k.name)} 정보</h2><button type="button" class="avpick" data-act="avatar" data-id="${k.id}">${face(k, 'xl')}<span>${icon('cam', 's')}사진 ${k.photo ? '바꾸기' : '넣기'}</span></button>${k.photo ? `<button type="button" class="btn" data-act="avatardel" data-id="${k.id}">프로필 사진 빼기</button>` : ''}${petFields(k)}${acts(manyAll() && ['kid', k.id, '이 수첩 빼기'])}${manyAll() ? '<p class="sub">수첩을 빼면 접종·돌봄 기록은 지워지고, 일기와 사진은 \'모두\'의 기록으로 남아요.</p>' : ''}</form>`);
}
const blankName = (list, v, i) => v.name || (list.length > 1 ? `아기 ${i + 1}` : '아기');

/* ── 오늘 ── */
function ruler(pos, marks, labels) {
  return `<div class="ruler" aria-hidden="true"><div class="ticks">${marks.map(m => `<i class="${m.l ? 'l' : ''}" style="left:${m.x}%"></i>`).join('')}<b style="left:${Math.max(0, Math.min(100, pos))}%"></b></div><div class="rl">${labels.map(l => `<span>${l}</span>`).join('')}</div></div>`;
}
function hero() {
  const t = today(), n = S.diffDays(t, K().birth);
  if (!K().born) {
    const g = 280 - n, w = Math.floor(g / 7);
    return `<section class="hero"><div><div class="row between"><h3>${esc(K().name)} 만나는 날</h3></div><div class="dday">${n > 0 ? 'D-' + n : n === 0 ? 'D-DAY' : 'D+' + -n}</div></div>
      <p>${kd(K().birth, true)}${K().time ? ' ' + Family.timeText(K().time) : ''} 예정${g >= 0 && g <= 301 ? `, 예정일 기준 임신 ${w}주 ${g % 7}일` : ''}</p>
      ${ruler(g / 280 * 100, Array.from({ length: 41 }, (_, i) => ({ x: i / 40 * 100, l: i % 10 === 0 })), ['0주', '10주', '20주', '30주', '40주'])}
      <div class="row"><button class="btn main" data-act="born">태어났어요</button><button class="btn" data-act="due">예정일 바꾸기</button></div></section>`;
  }
  const d = -n + 1, next = [[100, '백일'], [200, '200일']].map(([k, l]) => [S.addDays(K().birth, k - 1), l]);
  for (let y = 1; y <= 12; y++) next.push([S.addMonths(K().birth, 12 * y), y === 1 ? '첫돌' : y + '번째 생일']);
  const up = next.find(x => x[0] >= t);
  const yr = S.ageMonths(K().birth, t) < 12, a = S.diffDays(K().birth, t), start = yr ? K().birth : S.addMonths(K().birth, Math.floor(S.ageMonths(K().birth, t) / 12) * 12);
  const p = S.diffDays(start, t) / Math.max(1, S.diffDays(start, S.addMonths(start, 12))) * 100, base = Math.floor(S.ageMonths(K().birth, t) / 12) * 12;
  return `<section class="hero"><div><div class="row between"><h3>${esc(K().name)}, 태어난 지</h3></div><div class="dday">${d > 0 ? d + '일' : '곧'}</div></div>
    <p class="sub">${kd(K().birth, true)}${K().time ? ' ' + Family.timeText(K().time) : ''} 출생</p><p>${ageText(t)}${up ? `, ${up[1]}까지 ${S.diffDays(t, up[0]) === 0 ? '오늘이에요!' : S.diffDays(t, up[0]) + '일'}` : ''}</p>
    ${a >= 0 ? ruler(p, Array.from({ length: 49 }, (_, i) => ({ x: i / 48 * 100, l: i % 12 === 0 })), [0, 3, 6, 9, 12].map(k => base + k + '개월')) : ''}</section>`;
}
/* ── 달력 ── */
// 그날의 일정 [접종·검진, 내 일정]과 완료 개수
function dayList(d, all) {
  const its = all.filter(i => (i.done || i.appt || i.start) === d), evs = db.events.filter(e => e.date === d && sameCat(e)).sort((a, b) => (a.time || '') < (b.time || '') ? -1 : 1);
  return { its, evs, total: its.length + evs.length, done: its.filter(i => i.done).length + evs.filter(e => e.done).length, diary: db.diary.filter(x => x.date === d && sameCat(x)) };
}
function calendar() {
  const [y, m] = month.split('-').map(Number), first = month + '-01', n = new Date(Date.UTC(y, m, 0)).getUTCDate(), all = famItems(), t = today();
  let cells = [...WD].map(w => `<span class="w">${w}</span>`).join('') + '<span></span>'.repeat(dow(first));
  for (let i = 1; i <= n; i++) {
    const d = `${month}-${String(i).padStart(2, '0')}`, k = dayList(d, all);
    cells += `<button class="day ${d === t ? 'today' : ''} ${d === sel ? 'sel' : ''} ${k.total && k.done === k.total ? 'all' : ''} ${dow(d) ? '' : 'sun'}" data-act="day" data-d="${d}" ${d === sel ? 'aria-current="date"' : ''} aria-label="${kd(d)}${k.total ? `, ${k.total}개 중 ${k.done}개 완료` : ''}${k.diary.length ? ', 일기 있음' : ''}"><em>${i}</em>${k.total ? `<b>${k.done}<small>/${k.total}</small></b>` : '<b class="zero">·</b>'}${k.diary.length ? '<i class="wr"></i>' : ''}</button>`;
  }
  const s = dayList(sel, all), [, sm, sd] = sel.split('-').map(Number), who = id => many() ? (id ? kidOf(id).name : '모두') : '';
  const row = (on, check, open, title, sub, chip, del) => `<div class="${on ? 'on' : ''}"><button class="ckb" ${check}><i>${on ? '✓' : ''}</i></button><button class="tx" ${open}><b>${title}</b>${sub ? `<span class="sub">${sub}</span>` : ''}</button><span class="chip">${chip}</span>${del}</div>`;
  const list = s.its.map(i => { const at = `data-act="item" data-id="${i.id}" data-kid="${i.kid}"`; return row(i.done, at + ` aria-label="${esc(i.title)} 받은 날 적기"`, at, esc(i.title), [who(i.kid), i.done ? '완료' : i.appt ? '예약' : i.start === i.end ? '' : `${kd(i.end)}까지`].filter(Boolean).map(esc).join(', '), TYPE[i.type], '<span></span>'); }).join('')
    + s.evs.map(e => row(e.done, `data-act="evdone" data-id="${e.id}" aria-label="${esc(e.title)} 완료 표시" aria-pressed="${Boolean(e.done)}"`, `data-act="${e.course ? 'courseview' : 'event'}" data-id="${e.id}"`, esc(e.title), [who(e.kid), e.time].filter(Boolean).map(esc).join(', '), '내 일정', `<button class="del" data-act="evdel" data-id="${e.id}" aria-label="${esc(e.title)} 지우기">×</button>`)).join('');
  return `<section class="stack" style="gap:12px"><div class="calhead"><button data-act="mon" data-n="-1" aria-label="이전 달">‹</button><h2>${y}년 ${m}월</h2><button data-act="mon" data-n="1" aria-label="다음 달">›</button></div>
    <div class="cal">${cells}</div><p class="sub">칸의 숫자는 그날 완료한 개수 / 전체 개수예요. 초록색 칸은 모두 마친 날, 분홍 점은 일기를 쓴 날이에요.</p></section>
    <section class="stack"><h2>${sm}월 ${sd}일${sel === t ? ' (오늘)' : sel > t ? ' (예정)' : ''}${s.total ? ` · ${s.done}/${s.total} 완료` : ''}</h2>
    ${s.total ? `<div class="todo">${list}</div>` : '<p class="sub">이날은 아직 일정이 없어요.</p>'}
    <form class="addrow" data-form="quick"><input name="title" maxlength="80" autocomplete="off" aria-label="일정 제목" placeholder="${sm}월 ${sd}일 일정 추가하기"><button class="btn main">추가</button></form>
    <div class="row"><button class="btn" data-act="event">시간·메모와 함께 추가</button><button class="btn" data-act="write">일기 쓰기</button></div>
    ${s.diary.length ? `<div class="list">${s.diary.map(x => `<button class="item t-diary" data-act="write" data-id="${x.id}"><span class="dot"></span><span><b>${esc(x.body.slice(0, 40) || '사진 일기')}</b><span class="when">${stageOf(x.date, kidOf(x.kid))}</span></span><span class="chip">${many() ? esc(who(x.kid)) : '일기'}</span></button>`).join('')}</div>` : ''}</section>
    <details><summary>전체 ${schedName()} ${all.length}개 보기</summary><div class="list">${all.map(itemRow).join('')}</div></details>`;
}

/* ── 기록 ── */
const pic = (id, t) => local ? `data-pic="${id}" data-t="${t || ''}"` : `${t ? 'loading="lazy" ' : ''}src="photos/${id}${t ? '/thumb' : ''}"`;
// 이 기기에 저장한 사진은 화면에 그려진 뒤 불러온다.
new MutationObserver(() => document.querySelectorAll('img[data-pic]').forEach(i => {
  const id = i.dataset.pic, t = i.dataset.t; i.removeAttribute('data-pic');
  picUrl(id, Boolean(t)).then(u => { if (!u) return; i.src = u; if (!t) i.onload = () => URL.revokeObjectURL(u); }).catch(() => {});
})).observe(document.body, { childList: true, subtree: true });
// 빈 날짜·시각 칸 표시
if (/Android/.test(navigator.userAgent)) document.documentElement.classList.add('android');
const markBlank = () => document.querySelectorAll('input[type=date],input[type=time]').forEach(i => i.classList.toggle('blank', !i.value));
new MutationObserver(markBlank).observe(document.body, { childList: true, subtree: true });
['input', 'change', 'focusout'].forEach(n => document.addEventListener(n, markBlank));
const thumb = p => `<button type="button" data-act="photo" data-id="${p.id}" aria-label="${kd(p.date)} ${p.type ? '동영상' : '사진'}"><img ${pic(p.id, 1)} alt="${esc(p.caption || kd(p.date) + ' 사진')}"></button>`;
function records() {
  const ds = Family.forKid(db.diary, K().id).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  return `<div class="albtop"><div class="albhead"><h2>일기</h2><button class="sq" data-act="write" aria-label="일기 쓰기">${icon('plus')}</button></div></div>` + (ds.length ? ds.map(x => `<article class="paper"><div class="row between"><div><h2>${kd(x.date)}</h2><span class="sub">${stageOf(x.date)}${x.priv ? ' · 나만 보기' : ''}</span></div>${many() && !x.kid ? tag('') : ''}<button class="btn" data-act="write" data-id="${x.id}">고치기</button></div>${x.body ? `<p class="body">${esc(x.body)}</p>` : ''}${x.photos.length ? `<div class="grid">${x.photos.map(id => db.photos.find(p => p.id === id)).filter(Boolean).map(thumb).join('')}</div>` : ''}${talkBar(Fam.target('diary', x.id))}</article>`).join('') : `<div class="empty">${icon('diary', 'xl')}<p>아직 쓴 일기가 없어요.<br>${K().born ? '오늘 있었던 일을' : '기다리는 마음을'} 적어 보세요.</p></div>`) ;
}

/* ── 육아 팁 ── */
const src = (url, label) => /^https?:\/\//.test(url) ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : '<span class="sub">확인된 출처 없음</span>';
const tipCard = t => `<article class="paper"><div class="row"><span class="chip">${esc(t.topic)}</span>${t.timing ? `<span class="sub">${esc(t.timing)}</span>` : ''}</div><h2>${esc(t.title)}</h2><p>${esc(t.body)}</p><p class="sub">${t.source ? src(t.url, t.source) : src(t.url, t.trust === 'official' ? '공식 출처 보기' : '출처 보기')}</p></article>`;
const keyHelp = `<div class="notice"><b>AI 기능을 켜려면 API 키가 필요해요</b><p class="sub">Anthropic 콘솔에서 만든 키를 터미널에서 ANTHROPIC_API_KEY로 넣고 앱을 다시 켜세요. 키가 없어도 아래 기본 자료는 볼 수 있어요.</p></div>`;
function aiBox(kind, title, desc, label) {
  if (local && !ai) return '';
  const b = aiData.busy[kind], e = aiData.err[kind], d = aiData[kind];
  if (!ai && !d) return keyHelp;
  return `<div class="notice"><b>${title}</b><p class="sub">${desc}${d ? ` 마지막 확인 ${kd(new Date(d.checkedAt).toLocaleDateString('sv-SE'))}.` : ''}</p>${e ? `<p>${esc(e)}</p>` : ''}<div class="row"><button class="btn main" data-act="ai" data-k="${kind}" ${b || !ai ? 'disabled' : ''}>${b ? '찾는 중이에요. 1~3분 걸려요' : d ? '다시 찾기' : label}</button></div></div>`;
}
function tips() {
  if (isPet(K())) return petTips();
  if (Couple.is(K())) return coupleTips();
  if (Me.is(K())) return meTips();
  const t = today(), m = K().born ? S.ageMonths(K().birth, t) : -1, mm = Math.min(m, 71), d = aiData.tips;
  return tipSeg() + `<section class="stack"><h2>${m < 0 ? '출산을 앞두고' : ageText(t) + ' 육아'}</h2><p class="sub">${m < 0 ? '태어나면 개월 수를 확인해 그때 필요한 팁으로 바꿔 보여줘요.' : m > 71 ? '자료가 만 5세까지라 마지막 시기의 팁을 보여줘요.' : '앱이 개월 수를 확인해 지금 필요한 팁을 골랐어요.'}</p>${aiBox('tips', 'AI 육아 제안', '개월 수를 확인해 지금 필요한 육아법과 곧 준비할 것을 찾아요. AI에는 개월 수만 보내요.', '이번 달 제안 받기')}</section>`
    + (d ? `<section class="stack"><p>${esc(d.summary)}</p>${d.tips.map(tipCard).join('')}${d.doctor.length ? `<div class="notice hot"><b>이럴 땐 소아과에 상의하세요</b>${d.doctor.map(x => `<p>${esc(x)}</p>`).join('')}</div>` : ''}</section>` : '')
    + `<section class="stack"><h2>${m < 0 ? '미리 준비할 것' : '지금 필요한 팁'}</h2>${BaseTips.forMonth(mm).map(tipCard).join('') || '<p class="empty">이 시기의 기본 팁은 아직 없어요.</p>'}</section>`
    + `<section class="stack"><h2>곧 시작할 것</h2>${BaseTips.coming(mm, 3).map(x => tipCard(Object.assign({}, x, { timing: x.from < 1 ? '태어나면 바로' : `${x.from}개월 무렵` }))).join('') || '<p class="sub">석 달 안에 새로 시작할 것은 없어요.</p>'}</section>
    <p class="sub">아기마다 차이가 있어요. 이른둥이로 태어났거나 걱정되는 점이 있으면 소아과 안내를 따르세요. 팁은 ${kd(BaseTips.checkedAt, true)}에 확인했고 미국 자료가 많아요.</p>`;
}

// 반려동물: 나이에 맞는 돌봄 팁과 병원에 가야 할 때
function petTips() {
  const k = K(), m = Math.max(0, S.ageMonths(k.birth, today())), st = Pet.stage(m);
  return tipSeg() + `<section class="stack"><h2>${Pet.STAGE[st]} ${Pet.KINDS[k.kind]} 돌보기</h2><p class="sub">${esc(k.name)}의 나이(${ageText(today()) || '아기'})에 맞춰 골랐어요.</p>${Pet.tips(k.kind, m).map(tipCard).join('')}</section>
    <div class="notice hot"><b>이럴 땐 바로 동물병원에 가세요</b>${Pet.WARN[k.kind].map(x => `<p>${esc(x)}</p>`).join('')}<div class="row"><button class="btn" data-act="vethosp">가까운 동물병원 찾기</button></div></div>
    <p class="sub">일반적인 안내예요. 아이마다 다르니 걱정되면 동물병원에 먼저 물어보세요. ${kd(Pet.checkedAt, true)}에 확인했어요.</p>`;
}
function petMoney() {
  const c = K().kind === 'dog' ? 'd' : 'c';
  const card = b => `<article class="paper"><div class="row"><span class="chip">${esc(b.provider)}</span></div><h2>${esc(b.title)}</h2><p><b>${esc(b.amount)}</b></p><p>${esc(b.eligibility)}</p><p>신청: ${esc(b.how)}</p><div class="row">${src(b.url, b.src)}</div></article>`;
  const ev = e => `<article class="paper"><div class="row"><span class="chip hot">행사</span></div><h2>${esc(e.title)}</h2><p>${esc(e.when)}</p><p class="sub">${esc(e.what)}</p><div class="row">${src(e.url, '이번 일정 찾아보기')}</div></article>`;
  return tipSeg() + `<section class="stack"><h2>혜택</h2>${Pet.BENEFITS.filter(b => b.kinds.includes(c)).map(card).join('')}</section><section class="stack"><h2>행사</h2>${Pet.EVENTS.map(ev).join('')}</section><p class="sub">${kd(Pet.checkedAt, true)}에 확인했어요. 금액, 조건, 일정은 해마다 바뀌니 신청하거나 가기 전에 공고를 확인하세요.</p>`;
}

// 연애: 팁과 이번 계절 데이트 코스, 지역별 데이트 명소와 행사
// 네이버 지도 앱으로 열고, 앱이 없으면 네이버 지도 웹으로
const nmapBtn = q => `<button type="button" class="pin" data-act="nmap" data-q="${esc(q)}" aria-label="${esc(q)} 네이버 지도에서 보기">${PIN}</button>`;
// 지도 단추가 오른쪽에 붙는 카드(병원 목록과 같은 모양)
// 해외는 구글 지도(앱이 있으면 앱으로 열린다)
const gmapUrl = q => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
const gmapBtn = q => `<a class="pin" data-act="ext" href="${gmapUrl(q)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(q)} 구글 지도에서 보기">${PIN}</a>`;
// 명소 사진(위키미디어 공용, 출처 표시)
const spotImg = n => { const i = Couple.IMG[n]; return i ? `<figure class="spotimg"><img src="${esc(i[1])}" alt="${esc(n)}" loading="lazy" referrerpolicy="no-referrer"><a data-act="ext" href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(i[0])}" target="_blank" rel="noopener noreferrer">사진 위키미디어 공용</a></figure>` : ''; };
const pinCard = (chip, title, body, q, g, n) => `<article class="paper">${spotImg(n || title)}<div class="hosp" style="border:0;padding:0"><span><span class="chip">${esc(chip)}</span><b style="margin-top:8px;font-size:17px">${esc(title)}</b><span class="sub">${esc(body)}</span></span>${g ? gmapBtn(q) : nmapBtn(q)}</div></article>`;
function openNmap(q) {
  const web = Couple.mapUrl(q); if (!/iPhone|iPad|iPod|Android/.test(navigator.userAgent)) return window.open(web, '_blank', 'noopener');
  let gone = false; const off = () => { gone = true; }; document.addEventListener('visibilitychange', off, { once: true }); window.addEventListener('pagehide', off, { once: true });
  location.href = 'nmap://search?query=' + encodeURIComponent(q) + '&appname=' + encodeURIComponent(location.hostname);
  setTimeout(() => { if (!gone && !document.hidden) window.open(web, '_blank', 'noopener'); }, 1500);
}
// ── 진짜 가게 추천과 경로 지도: 카카오 지도·장소 검색(카카오 개발자 콘솔에서 '카카오맵'이 켜져 있어야 한다)
let kmapP = null;
const kmap = () => kmapP || (kmapP = new Promise((ok, no) => {
  if (window.kakao && kakao.maps && kakao.maps.services) return ok();
  const s = document.createElement('script'); s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS}&libraries=services&autoload=false`;
  s.onload = () => { try { kakao.maps.load(ok); } catch (e) { kmapP = null; no(e); } }; s.onerror = () => { kmapP = null; no(new Error('kakao')); }; document.head.append(s);
}));
// 할 일 문구로 무엇을 찾을지 고른다: [분류 코드 또는 검색어, 카테고리 검색인지]
const STEP_Q = [[/점심|저녁|맛집|해산물/, 'FD6', 1], [/카페|디저트|만나기/, 'CE7', 1], [/공방/, '공방'], [/방탈출/, '방탈출카페'], [/보드게임/, '보드게임카페'], [/영화/, '영화관'], [/볼링|포켓볼/, '볼링장'], [/노래방/, '코인노래방'], [/서점/, '서점'], [/전시|팝업/, '전시'], [/아쿠아리움/, '아쿠아리움'], [/찜질방|스파/, '찜질방'], [/소품|가게/, '소품샵'], [/시장/, '시장'], [/공원|피크닉|산책/, '공원']];
const placeCache = new Map();
// base: 기준 장소 이름. steps: [[시각, 할 일, 명소이름?]] → 각 단계에 가게를 붙여 돌려준다.
async function realPlaces(base, steps) {
  const key = base + '|' + steps.map(s => s[1]).join('/'); if (placeCache.has(key)) return placeCache.get(key);
  await kmap(); const P = new kakao.maps.services.Places(), OK = kakao.maps.services.Status.OK;
  const q = (fn, a, o) => new Promise(r => fn.call(P, a, (d, st) => r(st === OK ? d : []), o));
  const b = (await q(P.keywordSearch, base))[0]; if (!b) return null;
  const o = { location: new kakao.maps.LatLng(b.y, b.x), radius: 1500, sort: kakao.maps.services.SortBy.ACCURACY }, seen = new Set([b.id]), got = {};
  const out = [];
  for (const st of steps) {
    if (st[2]) { out.push(Object.assign({ step: st }, { p: b })); continue; }
    const m = STEP_Q.find(([re]) => re.test(st[1])); if (!m) { out.push({ step: st }); continue; }
    const k = m[1]; got[k] = got[k] || (m[2] ? await q(P.categorySearch, k, o) : await q(P.keywordSearch, k, o));
    const pool = got[k].filter(x => !seen.has(x.id) && !(k === 'CE7' && /보드게임|방탈출|만화|PC방|스터디/.test(x.category_name + x.place_name))).slice(0, 8), p = pool[Math.floor(Math.random() * Math.min(3, pool.length))];
    if (p) seen.add(p.id); out.push({ step: st, p });
  }
  const res = { base: b, out }; placeCache.set(key, res); return res;
}
const placeLine = p => p ? `<span class="pl"><a data-act="ext" href="${esc(p.place_url)}" target="_blank" rel="noopener noreferrer">${esc(p.place_name)}</a><em>${esc((p.category_name || '').split(' > ').pop())}${p.distance ? ' · ' + (p.distance >= 1000 ? (p.distance / 1000).toFixed(1) + 'km' : p.distance + 'm') : ''}</em></span>` : '';
// 지도에 순서대로 번호를 찍고 선으로 잇는다
function drawRoute(el, res) {
  if (!el || !res) return; const pts = res.out.filter(x => x.p).map(x => x.p); if (!pts.length) return;
  el.hidden = false; const ll = p => new kakao.maps.LatLng(p.y, p.x), map = new kakao.maps.Map(el, { center: ll(pts[0]), level: 5 }), bd = new kakao.maps.LatLngBounds();
  pts.forEach((p, i) => { bd.extend(ll(p)); new kakao.maps.CustomOverlay({ map, position: ll(p), content: `<span class="rnum">${i + 1}</span>` }); });
  new kakao.maps.Polyline({ map, path: pts.map(ll), strokeWeight: 4, strokeColor: '#b87324', strokeOpacity: .85, strokeStyle: 'shortdash' });
  map.setBounds(bd, 40, 40, 40, 40);
}
// 코스 창 안의 목록·지도를 진짜 가게로 채운다
async function fillCourse(box, base, steps, after) {
  if (!box) return;
  try {
    const res = await realPlaces(base, steps); if (!box.isConnected) return;
    if (!res) { box.querySelector('.plnote').textContent = '이 장소를 지도에서 찾지 못해 가게 추천은 빠졌어요.'; return; }
    res.out.forEach((x, i) => { const li = box.querySelectorAll('.plan li')[i]; if (li && x.p && !x.step[2]) li.querySelector('span').insertAdjacentHTML('beforeend', placeLine(x.p)); });
    box.querySelector('.plnote').textContent = '가게는 카카오 지도에서 이 근처를 찾아 골랐어요. 누르면 가게 정보가 열려요.';
    drawRoute(box.querySelector('.route'), res); if (after) after(res);
  } catch { if (box.isConnected) box.querySelector('.plnote').textContent = '지금은 가게 추천과 지도를 불러올 수 없어요.'; }
}
const withPlaces = (steps, res) => steps.map((s, i) => { const p = res && res.out[i] && res.out[i].p; return [s[0], s[1] + (p && !s[2] ? ` - ${p.place_name}` : '')]; });
// 코스 창을 그대로 그림으로: 제목, 날짜, 단계와 가게, 경로 지도(OpenStreetMap 타일 위에 번호와 점선)
async function courseShot(o) { // o: { title, sub, steps } 또는 { title, sub, days:[{ head, steps }] }, steps:[[시각, 할 일, 명소?, 가게?]]
  const W = 1080, P = 64, c = document.createElement('canvas'), g = c.getContext('2d'), F = (sz, wt) => `${wt || 400} ${sz}px "Apple SD Gothic Neo","Noto Sans KR",sans-serif`;
  const wrap = (t, w, f) => { g.font = f; const out = []; let l = ''; for (const ch of t) { if (g.measureText(l + ch).width > w) { out.push(l); l = ''; } l += ch; } out.push(l); return out; };
  const tx = P + 150, tw = W - tx - P, mapH = 620;
  const days = (o.days || [{ head: '', steps: o.steps }]).map(d => ({ head: d.head, rows: d.steps.map(([a, b, n, p]) => ({ a, lines: wrap(b, tw, F(38, 600)), p: p && !n ? p : null })), pts: d.steps.map(s2 => s2[3]).filter(Boolean) }));
  const H = 200 + days.reduce((h, d) => h + (d.head ? 80 : 0) + d.rows.reduce((h2, r) => h2 + r.lines.length * 52 + (r.p ? 46 : 0) + 34, 0) + (d.pts.length ? mapH + 50 : 0), 0) + 120;
  c.width = W; c.height = H; g.fillStyle = '#fffdf9'; g.fillRect(0, 0, W, H);
  let y = 100; g.fillStyle = '#4f3f3a'; g.font = F(54, 800); g.fillText(o.title, P, y); y += 60; g.fillStyle = '#7a685d'; g.font = F(32); g.fillText(o.sub, P, y); y += 80;
  const wpx = (lon, lat, z) => { const s2 = 256 * 2 ** z, r = lat * Math.PI / 180; return [(+lon + 180) / 360 * s2, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * s2]; };
  for (const d of days) {
    if (d.head) { g.fillStyle = '#4f3f3a'; g.font = F(40, 800); g.fillText(d.head, P, y); y += 80; }
    d.rows.forEach(r => {
      g.fillStyle = '#b87324'; g.font = F(38, 800); g.fillText(r.a, P, y);
      g.fillStyle = '#4f3f3a'; g.font = F(38, 600); r.lines.forEach((l, i2) => g.fillText(l, tx, y + i2 * 52)); y += r.lines.length * 52;
      if (r.p) { g.fillStyle = '#2f6ea8'; g.font = F(32, 700); g.fillText(r.p.place_name, tx, y - 4); const nw = g.measureText(r.p.place_name).width; g.fillStyle = '#7a685d'; g.font = F(28); g.fillText(`${r.p.category_name || ''}${r.p.distance ? ' · ' + (r.p.distance >= 1000 ? (r.p.distance / 1000).toFixed(1) + 'km' : r.p.distance + 'm') : ''}`, tx + nw + 16, y - 4); y += 46; }
      y += 34;
    });
    if (!d.pts.length) continue;
    const mx = P, my = y, mw = W - 2 * P;
    let z = 17; for (; z > 3; z--) { const q = d.pts.map(p => wpx(p.x, p.y, z)), xs = q.map(a => a[0]), ys = q.map(a => a[1]); if (Math.max(...xs) - Math.min(...xs) < mw - 160 && Math.max(...ys) - Math.min(...ys) < mapH - 160) break; }
    const xy = d.pts.map(p => wpx(p.x, p.y, z)), cx = (Math.max(...xy.map(a => a[0])) + Math.min(...xy.map(a => a[0]))) / 2, cy = (Math.max(...xy.map(a => a[1])) + Math.min(...xy.map(a => a[1]))) / 2, ox = cx - mw / 2, oy = cy - mapH / 2;
    g.save(); g.beginPath(); g.roundRect(mx, my, mw, mapH, 36); g.clip(); g.fillStyle = '#eee8df'; g.fillRect(mx, my, mw, mapH);
    const tiles = []; for (let a = Math.floor(ox / 256); a <= Math.floor((ox + mw) / 256); a++) for (let b = Math.floor(oy / 256); b <= Math.floor((oy + mapH) / 256); b++) tiles.push([a, b]);
    await Promise.all(tiles.map(([a, b]) => new Promise(r => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { g.drawImage(im, mx + a * 256 - ox, my + b * 256 - oy); r(); }; im.onerror = r; im.src = `https://tile.openstreetmap.org/${z}/${a}/${b}.png`; })));
    const sp = xy.map(([a, b]) => [mx + a - ox, my + b - oy]);
    g.setLineDash([18, 14]); g.lineWidth = 8; g.strokeStyle = 'rgba(184,115,36,.9)'; g.beginPath(); sp.forEach(([a, b], i2) => i2 ? g.lineTo(a, b) : g.moveTo(a, b)); g.stroke(); g.setLineDash([]);
    sp.forEach(([a, b], i2) => { g.fillStyle = '#b87324'; g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.arc(a, b, 30, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.font = F(30, 800); g.textAlign = 'center'; g.fillText(String(i2 + 1), a, b + 11); g.textAlign = 'left'; });
    g.restore(); y += mapH + 50;
  }
  const mapH2 = days.some(d => d.pts.length);
  g.fillStyle = '#b87324'; g.font = F(30, 800); g.fillText('우리 수첩', P, H - 56); if (mapH2) { g.fillStyle = '#a59585'; g.font = F(22); g.textAlign = 'right'; g.fillText('지도 © OpenStreetMap 기여자', W - P, H - 56); g.textAlign = 'left'; }
  const blob = await new Promise(r => { try { c.toBlob(r, 'image/png'); } catch { r(null); } }); if (!blob) return toast('이미지를 만들지 못했어요');
  return shotOut(new File([blob], o.file, { type: 'image/png' }), o.title);
}
// ── 고른 코스를 달력 일정에 담아 두고(가게 위치까지), 달력·홈에서 코스와 경로를 다시 본다
const slimP = p => p ? { place_name: p.place_name, x: p.x, y: p.y, place_url: p.place_url, category_name: (p.category_name || '').split(' > ').pop(), distance: p.distance } : null;
const courseData = (steps, res, base) => ({ base: base || '', steps: steps.map((st, i) => [st[0], st[1], st[2] || '', slimP(res && res.out[i] && res.out[i].p)]) });
const cvText = e => `[우리 수첩] ${e.title}\n${kd(e.date)}${e.course.base ? ' · ' + e.course.base + ' 근처' : ''}\n\n${e.course.steps.map(([a, b, n, p]) => `${a}  ${b}${p && !n ? ' - ' + p.place_name : ''}`).join('\n')}`;
function courseView(id) {
  const e = db.events.find(x => x.id === id); if (!e || !e.course) return eventDlg(id); const c = e.course;
  openDlg(`<form data-form="none"><div class="row between"><h2>${esc(e.title)}</h2><span class="row" style="gap:6px;flex-wrap:nowrap"><button type="button" class="sq" data-act="cvcap" data-id="${id}" aria-label="사진에 저장">${icon('capture')}</button><button type="button" class="sq" data-act="cvcap" data-id="${id}" aria-label="공유하기" data-share="1">${icon('share')}</button></span></div><p class="sub">${kd(e.date)}${c.base ? ' · ' + esc(c.base) + ' 근처' : ''}</p><ol class="plan">${c.steps.map(([a, b, n, p]) => `<li><b>${a}</b><span>${n ? `<button type="button" class="linkb" data-act="plan" data-n="${esc(n)}">${esc(b)}</button>` : esc(b)}${p && !n ? placeLine(p) : ''}</span></li>`).join('')}</ol><div class="route" hidden></div><div class="row"><button type="button" class="btn main" data-act="cedit" data-id="${id}">코스 고치기</button><button type="button" class="btn" data-act="event" data-id="${id}">일정 고치기</button></div></form>`);
  if (c.steps.some(st => st[3])) kmap().then(() => drawRoute(dlg.querySelector('.route'), { out: c.steps.map(st => ({ p: st[3] })) })).catch(() => { });
}
// ── 저장한 코스 고치기: 시간·할 일·장소 바꾸기, 단계 더하기·빼기
let ced = null, cedHits = [];
function cedOpen(id) { const e = db.events.find(x => x.id === id); if (!e || !e.course) return; ced = { id, title: e.title, base: e.course.base, steps: JSON.parse(JSON.stringify(e.course.steps)) }; cedShow(); }
function cedSync() { const f = dlg.querySelector('form[data-form=cedit]'); if (!f) return; ced.title = f.elements.title.value.trim() || ced.title; ced.steps.forEach((st, i) => { st[0] = f.elements['t' + i].value || st[0]; st[1] = f.elements['b' + i].value.trim() || st[1]; }); }
function cedShow() {
  openDlg(`<form data-form="cedit"><h2>코스 고치기</h2><label class="f">제목<input name="title" maxlength="40" value="${esc(ced.title)}"></label><div class="stack" style="gap:12px">${ced.steps.map(([a, b, n, p], i) => `<div class="cedrow"><div class="two" style="grid-template-columns:110px 1fr"><input type="time" name="t${i}" value="${a}" aria-label="시간"><input name="b${i}" maxlength="60" value="${esc(b)}" aria-label="할 일"></div><div class="row" style="gap:6px">${p ? `<span class="chip">${esc(p.place_name)}</span>` : n ? `<span class="chip">${esc(n)}</span>` : '<span class="sub">장소 없음</span>'}<button type="button" class="btn" data-act="cedplace" data-i="${i}">${p || n ? '장소 바꾸기' : '장소 넣기'}</button>${p && !n ? `<button type="button" class="btn" data-act="cednoplace" data-i="${i}">장소 빼기</button>` : ''}<button type="button" class="btn danger" data-act="ceddel" data-i="${i}">단계 지우기</button></div></div>`).join('')}</div><button type="button" class="btn" data-act="cedadd">+ 단계 더하기</button><p class="sub">저장하면 시간 순서대로 정리되고, 경로 지도도 바뀐 장소로 다시 그려요.</p>${acts()}</form>`);
}
// 장소 바꾸기: 코스 근처에서 검색(카카오 장소 검색)
const cedCenter = () => { const p = ced.steps.map(st => st[3]).find(Boolean); return p ? { x: p.x, y: p.y } : null; };
function cedPlaceDlg(i) { cedSync(); openDlg(`<form data-form="cedsearch" data-i="${i}"><h2>장소 찾기</h2><p class="sub">${esc(ced.steps[i][1])}</p><div class="addrow"><input name="q" maxlength="40" autocomplete="off" placeholder="예: 파스타, 카페, 공방 이름" required><button class="btn main">찾기</button></div><div id="cedres" class="list"></div><button type="button" class="btn" data-act="cedback">돌아가기</button></form>`); }
async function cedSearch(i, q) {
  const box = $('#cedres'); box.innerHTML = '<p class="sub">찾는 중이에요</p>';
  try {
    await kmap(); const P = new kakao.maps.services.Places(), c = cedCenter(), o = c ? { location: new kakao.maps.LatLng(c.y, c.x), radius: 3000, sort: kakao.maps.services.SortBy.ACCURACY } : {};
    cedHits = await new Promise(r => P.keywordSearch(q, (d, st) => r(st === kakao.maps.services.Status.OK ? d.slice(0, 12) : []), o));
    box.innerHTML = cedHits.map((p, k) => `<button type="button" class="item" data-act="cedpick" data-i="${i}" data-k="${k}" style="grid-template-columns:minmax(0,1fr) auto"><span><b>${esc(p.place_name)}</b><span class="when">${esc((p.category_name || '').split(' > ').pop())}${p.distance ? ' · ' + (p.distance >= 1000 ? (p.distance / 1000).toFixed(1) + 'km' : p.distance + 'm') : ''} · ${esc(p.road_address_name || p.address_name || '')}</span></span><span class="chip">고르기</span></button>`).join('') || '<p class="sub">찾은 곳이 없어요. 다른 말로 찾아보세요.</p>';
  } catch { box.innerHTML = '<p class="sub">지금은 장소를 찾을 수 없어요.</p>'; }
}
async function cedSave() {
  cedSync(); ced.steps.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  if (!ced.steps.length) return toast('단계가 하나는 있어야 해요');
  const id = ced.id, c = { base: ced.base, steps: ced.steps };
  if (await save(x => { const e = x.events.find(y => y.id === id); if (e) Object.assign(e, { title: ced.title, time: ced.steps[0][0], course: c }); })) { ced = null; toast('코스를 고쳤어요'); render(); courseView(id); }
}
// 홈: 오늘 코스가 있으면 위에 보여 준다
const todayCourses = k => db.events.filter(e => e.course && e.date === today() && (!e.kid || e.kid === k.id));
const courseCard = k => todayCourses(k).map(e => `<button class="strip" data-act="courseview" data-id="${e.id}">${icon('heart')}<span><b>오늘의 ${esc(e.title)}</b><em>${esc(e.course.steps.slice(0, 3).map(st => st[3] && !st[2] ? st[3].place_name : st[1]).join(' → '))}${e.course.steps.length > 3 ? ' …' : ''}</em></span>${icon('right', 's')}</button>`).join('');
// 명소 코스를 날짜를 골라 일정으로
function planPickDlg(n) { openDlg(`<form data-form="planpick" data-n="${esc(n)}"><h2>${esc(n)} 데이트 날짜</h2><label class="f">날짜<input type="date" name="date" required min="${today()}" value="${nextSat()}"></label><p class="sub">달력에 넣으면 그날 달력과 홈에서 코스와 경로를 볼 수 있어요.</p>${acts()}</form>`); }
// 명소 데이트 코스 창
let planRes = null;
function planDlgFor(n) {
  const x = Couple.SPOTS.find(y => y.name === n); if (!x) return; const p = Couple.plan(x), g = x.sido === '해외';
  openDlg(`<form data-form="none"><div class="row between"><h2>${esc(p.title)}</h2><span class="row" style="gap:6px;flex-wrap:nowrap"><button type="button" class="sq" data-act="plancap" data-n="${esc(n)}" aria-label="사진에 저장">${icon('capture')}</button><button type="button" class="sq" data-act="plancap" data-n="${esc(n)}" aria-label="공유하기" data-share="1">${icon('share')}</button></span></div>${spotImg(n)}<p class="sub">${esc(x.desc)}</p><ol class="plan">${p.steps.map(([a, b]) => `<li><b>${a}</b><span>${esc(b)}</span></li>`).join('')}</ol>${g ? '' : '<div class="route" hidden></div><p class="sub plnote">근처 가게를 찾는 중이에요</p>'}<p class="notice">${esc(p.tip)}</p><button type="button" class="btn main" data-act="planpick" data-n="${esc(n)}">이 코스로 데이트 정하기</button><div class="row">${g ? `<a class="btn" data-act="ext" href="${gmapUrl(x.c + ' ' + n)}" target="_blank" rel="noopener noreferrer">구글 지도</a>` : `<button type="button" class="btn" data-act="nmap" data-q="${esc(n)}">네이버 지도</button>`}</div><h3 style="margin-top:6px">근처에서 같이 가기 좋은 곳</h3><div class="nearby">${[['meal', '맛집', g ? 'restaurants' : '맛집'], ['cafe', '카페', g ? 'cafe' : '카페'], ['craft', '공방', g ? 'workshop' : '공방'], ['bar', '술집', g ? 'bar' : '분위기 좋은 술집'], ['photo', '사진 명소', g ? 'photo spot' : '사진 명소']].map(([k, t, w]) => g ? `<a class="btn" data-act="ext" href="${gmapUrl(w + ' near ' + n)}" target="_blank" rel="noopener noreferrer">${t}</a>` : `<button type="button" class="btn" data-act="nmap" data-q="${esc(n + ' ' + w)}">${t}</button>`).join('')}</div><p class="sub">누르면 지도에서 이 명소 근처의 맛집·카페·공방을 찾아 보여 줘요.</p><p class="sub">장소 성격에 맞춰 만든 추천 코스예요. 운영 시간은 가기 전에 확인하세요.</p></form>`);
  if (!g) fillCourse(dlg.querySelector('form'), n, p.steps.map(st => [st[0], st[1], st[1].startsWith(n) ? n : '']), res => { planRes = res; });
}
// 캡처 단추는 사진에 저장, 공유 단추는 공유 창. 아이폰 웹앱은 사진 앱에 바로 저장할 수 없어 그림을 띄우고 길게 눌러 저장하게 한다.
let shotMode = 'save';
function shotOut(file, title) {
  const share = () => navigator.share({ files: [file], title }).catch(() => { });
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent), can = navigator.canShare && navigator.canShare({ files: [file] });
  // 아이폰은 사진 저장도 공유 창으로(맨 위 '이미지 저장'을 누르면 된다)
  if (can && (shotMode === 'share' || ios)) { if (ios && shotMode === 'save') toast("'이미지 저장'을 누르면 사진에 저장돼요"); return share(); }
  const u = URL.createObjectURL(file);
  if (shotMode === 'save' && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
    openDlg(`<form data-form="none"><h2>사진에 저장</h2><p class="sub">그림을 길게 누르고 <b>'사진 앱에 저장'</b>을 고르세요.</p><img src="${u}" alt="${esc(title)}" style="width:100%;border-radius:18px;-webkit-touch-callout:default;user-select:auto"></form>`, true); return;
  }
  const a = document.createElement('a'); a.href = u; a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 60000); toast('사진을 저장했어요');
}
// 코스를 그림으로 만들어 저장·공유한다(사진은 위키미디어에서 받아 그린다)
async function courseImage(o) { // o: { title, sub, steps:[[시각, 할 일]], tip, img:[파일, 주소], file }
  const W = 1080, c = document.createElement('canvas'), g = c.getContext('2d');
  let pic = null; if (o.img) pic = await new Promise(r => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => r(i); i.onerror = () => r(null); i.src = o.img[1]; });
  const ph = pic ? 608 : 0, H = ph + 260 + o.steps.length * 96 + 220; c.width = W; c.height = H;
  g.fillStyle = '#faf5ee'; g.fillRect(0, 0, W, H);
  if (pic) { const s = Math.max(W / pic.width, ph / pic.height), w = pic.width * s, h = pic.height * s; g.drawImage(pic, (W - w) / 2, (ph - h) / 2, w, h); }
  const F = (sz, wt) => `${wt || 400} ${sz}px "Apple SD Gothic Neo","Noto Sans KR",sans-serif`; let y = ph + 90;
  g.fillStyle = '#4f3f3a'; g.font = F(54, 800); g.fillText(o.title, 64, y); y += 60; g.font = F(34); g.fillStyle = '#7a685d'; g.fillText(o.sub, 64, y); y += 80;
  o.steps.forEach(([a, b]) => { g.fillStyle = '#b87324'; g.font = F(36, 800); g.fillText(a, 64, y); g.fillStyle = '#4f3f3a'; g.font = F(38, 600); g.fillText(b, 220, y); y += 96; });
  g.fillStyle = '#7a685d'; g.font = F(30); let line = ''; for (const ch of o.tip) { if (g.measureText(line + ch).width > W - 128) { g.fillText(line, 64, y); y += 44; line = ''; } line += ch; } g.fillText(line, 64, y);
  g.fillStyle = '#b87324'; g.font = F(30, 800); g.fillText('우리 수첩', 64, H - 50); if (pic) { g.fillStyle = '#a59585'; g.font = F(22); g.textAlign = 'right'; g.fillText('사진 위키미디어 공용', W - 64, H - 50); }
  const blob = await new Promise(r => { try { c.toBlob(r, 'image/png'); } catch { r(null); } }); if (!blob) return toast('이미지를 만들지 못했어요');
  return shotOut(new File([blob], o.file, { type: 'image/png' }), o.title);
}
function planImage(n) { const x = Couple.SPOTS.find(y => y.name === n), p = Couple.plan(x); if (x.sido !== '해외') { const st = p.steps.map(s2 => [s2[0], s2[1], s2[1].startsWith(n) ? n : '']); return courseShot({ title: p.title, sub: x.desc, steps: courseData(st, planRes, n).steps, file: `${n}-데이트코스.png` }); } return courseImage({ title: p.title, sub: x.desc, steps: planRes ? withPlaces(p.steps.map(st => [st[0], st[1], st[1].startsWith(n) ? n : '']), planRes) : p.steps, tip: '팁: ' + p.tip, img: Couple.IMG[n], file: `${n}-데이트코스.png` }); }

/* ── 랜덤 데이트 코스(연애 수첩 홈) ── */
// 시·도 대표 좌표: 날씨를 물을 때 이 좌표만 보낸다(내 위치는 보내지 않는다).
const SIDO_XY = { 서울특별시: [37.57, 126.98], 부산광역시: [35.18, 129.08], 대구광역시: [35.87, 128.6], 인천광역시: [37.46, 126.71], 대전광역시: [36.35, 127.38], 울산광역시: [35.54, 129.31], 세종특별자치시: [36.48, 127.29], 경기도: [37.27, 127.01], 강원특별자치도: [37.88, 127.73], 충청북도: [36.64, 127.49], 충청남도: [36.66, 126.67], 전북특별자치도: [35.82, 127.15], 전남광주통합특별시: [35.16, 126.85], 경상북도: [36.57, 128.73], 경상남도: [35.23, 128.68], 제주특별자치도: [33.5, 126.53] };
let rdc = null; // { date, nights, from, to, area, days:[{ date, from, to, w, course, base, res }] }
const nextSat = () => { const d = new Date(); d.setDate(d.getDate() + (6 - d.getDay() + 7) % 7); return d.toLocaleDateString('sv-SE'); };
const hourOpts = (a, b, v) => Array.from({ length: b - a + 1 }, (_, i) => a + i).map(h => `<option value="${String(h).padStart(2, '0')}:00" ${v === String(h).padStart(2, '0') + ':00' ? 'selected' : ''}>${h}시</option>`).join('');
const NIGHTS = ['당일', '1박 2일', '2박 3일', '3박 4일', '4박 5일'];
function rdcDlg() {
  const v = rdc || { date: nextSat(), nights: 0, from: '11:00', to: '21:00', area: SIDO_XY[spotArea()] ? spotArea() : SIDO_XY[db.sido] ? db.sido : '서울특별시' };
  openDlg(`<form data-form="rdc"><h2>랜덤 데이트 코스 짜기</h2><p class="sub">날짜와 시간대를 고르면 그 안에서 코스를 뽑아요. 비가 오면 실내 위주로 짜요.</p><div class="two"><label class="f">시작 날짜<input type="date" name="date" required min="${today()}" value="${v.date}"></label><label class="f">기간<select name="nights">${NIGHTS.map((t, i) => `<option value="${i}" ${Number(v.nights) === i ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div><div class="two"><label class="f">첫날 시작<select name="from">${hourOpts(8, 20, v.from)}</select></label><label class="f">마지막 날 끝<select name="to">${hourOpts(11, 23, v.to)}</select></label></div><label class="f">지역<select name="area">${Object.keys(SIDO_XY).map(x => `<option ${x === v.area ? 'selected' : ''}>${x}</option>`).join('')}</select></label><button class="btn main big">코스 뽑기</button><p class="sub">여러 날이면 가운데 날은 10시~21시로 짜고, 밤에는 숙소 체크인, 다음 날 아침엔 체크아웃을 넣어요. 날씨는 Open-Meteo에서 고른 지역의 대표 좌표로 알아와요(2주 안의 날짜만).</p></form>`);
}
const WX = c => c == null ? '' : c === 0 ? '맑음' : c <= 3 ? '구름' : c <= 48 ? '안개' : c <= 67 ? '비' : c <= 77 ? '눈' : c <= 82 ? '소나기' : '뇌우';
// 날마다 그 시간대의 날씨(한 번에 받아 날짜별로 나눈다)
async function rdcWeather() {
  const [la, lo] = SIDO_XY[rdc.area], last = rdc.days[rdc.days.length - 1].date; if (S.diffDays(today(), rdc.days[0].date) > 15) return;
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&hourly=precipitation_probability,weather_code,temperature_2m&timezone=Asia%2FSeoul&start_date=${rdc.days[0].date}&end_date=${S.diffDays(today(), last) > 15 ? S.addDays(today(), 15) : last}`, { signal: AbortSignal.timeout(10000) });
    const h = (await r.json()).hourly;
    rdc.days.forEach(d => {
      const a = Number(d.from.slice(0, 2)), b = Number(d.to.slice(0, 2)), idx = h.time.map((t, i) => i).filter(i => h.time[i].startsWith(d.date) && Number(h.time[i].slice(11, 13)) >= a && Number(h.time[i].slice(11, 13)) < b); if (!idx.length) return;
      const pr = Math.max(...idx.map(i => h.precipitation_probability[i] || 0)), codes = idx.map(i => h.weather_code[i]), tmp = idx.map(i => h.temperature_2m[i]);
      d.w = { rain: pr >= 50 || codes.some(c => c >= 51), pr, hi: Math.round(Math.max(...tmp)), lo: Math.round(Math.min(...tmp)), sky: WX(Math.max(...codes)) };
    });
  } catch { }
}
function rdcSetup(v) {
  const n = Number(v.nights) || 0;
  rdc = { date: v.date, nights: n, from: v.from, to: v.to, area: v.area, days: Array.from({ length: n + 1 }, (_, i) => ({ date: S.addDays(v.date, i), from: i === 0 ? v.from : '10:00', to: i === n ? v.to : '22:00' })) };
  if (n && rdc.days[0].to <= rdc.days[0].from) rdc.days[0].to = '23:00';
}
function rdcRoll() {
  const sp = Couple.SPOTS.filter(x => x.sido === rdc.area), used = new Set(), n = rdc.days.length;
  rdc.days.forEach((d, i) => {
    const w = d.w || {}, left = sp.filter(x => !used.has(x.name)), pool = left.length ? left : sp;
    // 여러 날이면 첫날 밤엔 체크인, 다음 날 아침엔 체크아웃 시간을 비운다
    const to = n > 1 && i < n - 1 ? '21:00' : d.to, from = i > 0 ? '11:00' : d.from;
    d.res = null; d.course = Couple.randomCourse({ from, to, rain: w.rain, hot: w.hi >= 28, cold: w.lo <= 3, spots: pool });
    if (i > 0) d.course.unshift(['10:00', '숙소 체크아웃']);
    if (n > 1 && i < n - 1) d.course.push(['21:00', '숙소 체크인하고 쉬기']);
    const sn = d.course.find(x => x[2]); d.base = sn ? sn[2] : pool.length ? pool[Math.floor(Math.random() * pool.length)].name : ''; used.add(d.base);
  });
}
const md = dt => { const [, m, dd] = dt.split('-').map(Number); return `${m}월 ${dd}일 (${WD[dow(dt)]})`; };
const rdcTitle = () => rdc.days.length > 1 ? `${NIGHTS[rdc.nights]} 데이트 코스` : `${md(rdc.date).replace(/ \(.\)$/, '')} 데이트 코스`;
const wxText = d => d.w ? `${d.w.sky}, ${d.w.lo}~${d.w.hi}°, 비 올 확률 ${d.w.pr}%${d.w.rain ? ' · 실내 위주' : ''}` : '날씨 정보 없음(2주 안의 날짜만)';
const rdcSub = () => `${rdc.area.replace(/(특별자치|광역|특별)?(시|도)$/, '').replace('전남광주통합', '전남·광주')} · ${md(rdc.days[0].date)}${rdc.days.length > 1 ? ' ~ ' + md(rdc.days[rdc.days.length - 1].date) : ''}`;
const dayHead = (d, i) => rdc.days.length > 1 ? `${i + 1}일차 · ${md(d.date)}` : md(d.date);
const rdcText = () => `[우리 수첩] ${rdcTitle()}\n${rdcSub()}\n` + rdc.days.map((d, i) => `\n■ ${dayHead(d, i)}\n날씨: ${wxText(d)}${d.base ? `\n${d.base} 근처` : ''}\n${withPlaces(d.course, d.res).map(([a, b]) => `${a}  ${b}`).join('\n')}`).join('\n');
function rdcShow() {
  openDlg(`<form data-form="none"><div class="row between"><h2>${rdcTitle()}</h2><span class="row" style="gap:6px;flex-wrap:nowrap"><button type="button" class="sq" data-act="rdccap" aria-label="사진에 저장">${icon('capture')}</button><button type="button" class="sq" data-act="rdccap" aria-label="공유하기" data-share="1">${icon('share')}</button></span></div><p class="sub">${esc(rdcSub())}</p>${rdc.days.map((d, i) => `<section class="rday" data-i="${i}"><h3>${dayHead(d, i)}</h3><p class="notice${d.w && d.w.rain ? ' hot' : ''}">${esc(wxText(d))}${d.base ? `<br><b>${esc(d.base)} 근처</b>에서 짰어요` : ''}</p><ol class="plan">${d.course.map(([a, b, nm]) => `<li><b>${a}</b><span>${nm ? `<button type="button" class="linkb" data-act="plan" data-n="${esc(nm)}">${esc(b)}</button>` : esc(b)}</span></li>`).join('')}</ol>${d.base ? '<div class="route" hidden></div><p class="sub plnote">근처 가게를 찾는 중이에요</p>' : ''}</section>`).join('')}<div class="row"><button type="button" class="btn main" data-act="rdcroll">다시 뽑기</button><button type="button" class="btn" data-act="rdcadd">달력에 넣기</button><button type="button" class="btn" data-act="rdc">조건 바꾸기</button></div><p class="sub">명소 이름을 누르면 그곳 코스를 볼 수 있어요.</p></form>`);
  rdc.days.forEach((d, i) => { if (d.base) fillCourse(dlg.querySelector(`.rday[data-i="${i}"]`), d.base, d.course, res => { d.res = res; }); });
}
const rdcCard = () => `<button class="strip" data-act="rdc">${icon('heart')}<span><b>랜덤 데이트 코스 짜기</b><em>날짜와 시간만 고르면 날씨에 맞춰 뽑아 드려요</em></span>${icon('right', 's')}</button>`;
const plainCard = (chip, title, body, link) => `<article class="paper"><div class="row"><span class="chip">${esc(chip)}</span></div><h2>${esc(title)}</h2><p>${esc(body)}</p>${link ? `<div class="row">${link}</div>` : ''}</article>`;
function coupleTips() {
  const s = Couple.SEASON[Couple.season(today())];
  return tipSeg() + `<section class="stack"><h2>${s}에 가기 좋은 데이트 코스</h2>${Couple.courses(today()).map(x => plainCard(x.tag, x.title, x.body)).join('')}</section><section class="stack"><h2>오래 사랑하는 팁</h2>${Couple.TIPS.map(x => plainCard(x.topic, x.title, x.body)).join('')}</section>`;
}
// 데이트 명소: 지역(전국·시도·해외)과 검색으로 고른다. 고른 지역은 이 기기에만 둔다.
let spotQ = '';
const spotArea = () => { const a = localStorage.getItem('baby-spot-area'); return a == null ? db.sido || '' : a; };
const spotCard = x => `<div data-act="plan" data-n="${esc(x.name)}" class="tapcard">` + pinCard(x.c || x.sido.replace(/(특별자치|광역|특별)?(시|도)$/, '').replace('전남광주통합', '전남·광주'), x.name, x.desc, x.c ? x.c + ' ' + x.name : x.name, x.sido === '해외') + '</div>';
function spotList() {
  const a = spotArea(), q = spotQ.trim().toLowerCase();
  const l = Couple.SPOTS.filter(x => q ? (x.name + x.desc + x.sido + (x.c || '')).toLowerCase().includes(q) : !a || x.sido === a);
  return (l.map(spotCard).join('') || '<p class="sub">찾는 명소가 목록에 없어요.</p>') + (q ? `<div class="row">${a === '해외' ? `<a class="btn main" href="${gmapUrl(spotQ.trim())}" target="_blank" rel="noopener noreferrer">구글 지도에서 '${esc(spotQ.trim())}' 찾기</a>` : `<button type="button" class="btn main" data-act="nmap" data-q="${esc(spotQ.trim())}">네이버 지도에서 '${esc(spotQ.trim())}' 찾기</button>`}</div>` : '');
}
document.addEventListener('input', e => { if (e.target.id === 'spotq') { spotQ = e.target.value; const l = $('#spotlist'); if (l) l.innerHTML = spotList(); } });
document.addEventListener('change', e => { if (e.target.id === 'spotarea') { localStorage.setItem('baby-spot-area', e.target.value); render(); } });
// 행사: 지역(전국·시도·해외)별 축제, 가까운 달 순서. 지역은 명소와 따로 고른다.
const evtArea = () => { const a = localStorage.getItem('baby-evt-area'); return a == null ? spotArea() : a; };
document.addEventListener('change', e => { if (e.target.id === 'evtarea') { localStorage.setItem('baby-evt-area', e.target.value); render(); } });
function coupleEvents() {
  const sido = evtArea(), abroad = sido === '해외', now = Number(today().slice(5, 7)), q = abroad ? '해외 축제' : (sido || '전국') + ' 축제';
  const card = x => { const g = x.sido === '해외', soon = x.months.includes(now) ? '<span class="chip hot">이번 달</span>' : ''; return `<article class="paper"><div class="hosp" style="border:0;padding:0"><span><span class="row" style="gap:6px"><span class="chip">${esc(x.c || x.sido.replace(/(특별자치|광역|특별)?(시|도)$/, '').replace('전남광주통합', '전남·광주'))}</span><span class="chip">보통 ${x.months.join('·')}월</span>${soon}</span><b style="margin-top:8px;font-size:17px">${esc(x.name)}</b><span class="sub">${esc(x.desc)}</span><span style="display:block;margin-top:6px">${src(Couple.searchUrl(x.name + ' ' + today().slice(0, 4)), '올해 일정 찾아보기')}</span></span>${x.at ? (g ? gmapBtn(x.at) : nmapBtn(x.at)) : ''}</div></article>`; };
  const list = Couple.festsFor(sido, now);
  return tipSeg() + `<section class="stack"><div class="row between"><h2>축제</h2><select id="evtarea" class="areasel" aria-label="지역"><option value="">전국</option>${SIDO.map(x => `<option ${x === sido ? 'selected' : ''}>${x}</option>`).join('')}<option value="해외" ${abroad ? 'selected' : ''}>해외</option></select></div>${list.map(card).join('') || '<p class="sub">이 지역은 아직 정리한 축제가 없어요. 아래에서 찾아보세요.</p>'}</section>
    <section class="stack"><h2>공연장</h2>${Couple.hallsFor(sido).map(x => { const g = x.sido === '해외'; return `<article class="paper"><div class="hosp" style="border:0;padding:0"><span><span class="chip">${esc(x.c || x.sido.replace(/(특별자치|광역|특별)?(시|도)$/, '').replace('전남광주통합', '전남·광주'))}</span><b style="margin-top:8px;font-size:17px">${esc(x.name)}</b><span class="sub">${esc(x.desc)}</span><span style="display:block;margin-top:6px">${src(Couple.searchUrl(x.name + ' 공연 일정'), '지금 하는 공연 보기')}</span></span>${g ? gmapBtn(x.name) : nmapBtn(x.name)}</div></article>`; }).join('') || '<p class="sub">이 지역은 아직 정리한 공연장이 없어요.</p>'}</section>
    <section class="stack"><h2>더 찾아보기</h2>${plainCard('행사', `${sido && !abroad ? esc(sido) + ' ' : abroad ? '해외 ' : ''}이번 달 축제와 행사`, '지역 축제, 공연, 빛축제 일정을 찾아봐요.', src(Couple.searchUrl(q), '일정 찾아보기'))}${plainCard('공연', `${sido && !abroad ? esc(sido) + ' ' : abroad ? '해외 ' : ''}이번 주 공연`, '뮤지컬, 연극, 콘서트, 클래식 일정을 찾아봐요.', src(Couple.searchUrl((sido && !abroad ? sido + ' ' : abroad ? '해외 ' : '') + '공연 일정'), '공연 찾아보기'))}${abroad ? '' : plainCard('행사', '이번 주말 전시·팝업', '데이트하기 좋은 전시와 팝업 스토어를 찾아봐요.', src(Couple.searchUrl((sido ? sido + ' ' : '') + '이번 주말 전시 팝업'), '찾아보기'))}</section><p class="sub">축제는 보통 열리는 달이에요. 해마다 날짜가 바뀌니 가기 전에 올해 일정을 확인하세요.</p>`;
}
function coupleMoney() {
  const sido = spotArea(), abroad = sido === '해외';
  const q = abroad ? '해외 축제' : (sido || '전국') + ' 축제';
  return tipSeg() + `<section class="stack"><div class="row between"><h2>데이트 명소</h2><select id="spotarea" class="areasel" aria-label="지역"><option value="">전국</option>${SIDO.map(x => `<option ${x === sido ? 'selected' : ''}>${x}</option>`).join('')}<option value="해외" ${abroad ? 'selected' : ''}>해외</option></select></div><input id="spotq" type="search" class="spotq" placeholder="명소 이름이나 지역으로 찾기" value="${esc(spotQ)}" autocomplete="off"><div id="spotlist" class="stack">${spotList()}</div></section><p class="sub">명소와 행사는 바뀔 수 있어요. 가기 전에 운영 시간을 확인하세요.</p>`;
}

// 개인·솔로: 건강, 생활, 연애 팁 / 재테크, 여행, 만남
const tipList = (h, l) => l.length ? `<section class="stack"><h2>${h}</h2>${l.map(x => plainCard(x.topic, x.title, x.body)).join('')}</section>` : '';
function meTips() {
  const k = K(), d = Me.tips(k, today()), solo = Me.isSolo(k);
  return tipSeg() + `<p class="sub">만 ${Me.age(k.birth, today())}세 ${k.sex === 'girl' ? '여성' : '남성'}에게 맞춰 골랐어요.</p>` + tipList('건강', d.health) + (solo ? tipList('혼자 사는 팁', Me.SOLO_LIVE) + tipList('연애를 시작하는 팁', Me.DATE_TIPS) : '');
}
function meMoney() {
  const k = K(), d = Me.tips(k, today()), solo = Me.isSolo(k), place = x => pinCard('추천', x.name, x.desc, x.name);
  return tipSeg() + tipList('재테크', d.money) + '<p class="sub">일반적인 안내이고 투자 권유가 아니에요. 상품 조건은 바뀔 수 있으니 가입 전에 확인하세요.</p>' + tipList('여행 팁', d.travel)
    + `<section class="stack"><h2>${solo ? '혼자 가기 좋은 여행지' : '가 볼 만한 여행지'}</h2>${Me.SOLO_TRIP.map(place).join('')}</section>` + (solo ? `<section class="stack"><h2>새 인연을 만나기 좋은 곳</h2>${Me.MEET.map(place).join('')}</section>` : '');
}

/* ── 혜택 ── */
function dueOf(b) { return b.deadlineMonths != null ? S.addMonths(K().birth, b.deadlineMonths) : b.deadlineDays != null ? S.addDays(K().birth, b.deadlineDays) : null; }
function moneyCard(b, key) {
  const due = dueOf(b), left = due ? S.diffDays(today(), due) : null, open = b.startDays != null && today() >= S.addDays(K().birth, b.startDays) && !K().born;
  const added = db.events.some(e => e.from === key && (!e.kid || e.kid === K().id));
  return `<article class="paper"><div class="row">${b.provider ? `<span class="chip">${esc(b.provider)}</span>` : ''}${b.isNew ? '<span class="chip hot">새로 찾음</span>' : ''}${open ? '<span class="chip hot">지금 신청할 수 있어요</span>' : ''}${K().born && left !== null && left >= 0 && left <= 14 ? `<span class="chip hot">마감 ${left}일 전</span>` : ''}</div><h2>${esc(b.title)}</h2>${b.amount ? `<p><b>${esc(b.amount)}</b></p>` : ''}${b.eligibility ? `<p>${esc(b.eligibility)}</p>` : ''}${b.deadlineText ? `<p>기한: ${esc(b.deadlineText)}${due ? ` (${K().born ? '' : '예정일 기준 '}${kd(due)})` : ''}</p>` : ''}${b.how ? `<p>신청: ${esc(b.how)}</p>` : ''}${b.note ? `<p class="sub">${esc(b.note)}</p>` : ''}<div class="row between"><span>${src(b.url, b.trust === 'official' ? '공식 출처 보기' : '출처 보기')}</span>${due ? `<button class="btn" data-act="adddue" data-key="${esc(key)}" data-title="${esc(b.title)} 신청 마감" data-date="${due}" ${added ? 'disabled' : ''}>${added ? '달력에 있어요' : '마감일을 달력에 추가'}</button>` : ''}</div></article>`;
}
const regionData = { key: '', rows: null, info: null, err: '' };
let cashOnly = false;
async function loadRegion() {
  const r = Regions.find(db.sido); if (!r || regionData.key === r.file) return;
  Object.assign(regionData, { key: r.file, rows: null, err: '' });
  const get = f => fetch('regions/' + f + '.json').then(x => { if (!x.ok) throw 0; return x.json(); });
  try { const [rows, info] = await Promise.all([get(r.file), get('index')]); if (regionData.key === r.file) Object.assign(regionData, { rows, info }); }
  catch { if (regionData.key === r.file) Object.assign(regionData, { key: '', err: '지역 자료를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.' }); }
  if (tab === 'money') render();
}
function localCard(b) {
  const key = 'gov:' + b.id + ':' + b.g;
  return `<article class="paper"><div class="row"><span class="chip">${esc(b.g || db.sido)}</span>${b.k ? `<span class="chip">${esc(b.k)}</span>` : ''}</div><h2>${esc(b.t)}</h2>${b.d ? `<p>기한: ${esc(b.d)}</p>` : ''}<details data-key="${esc(key)}"><summary>대상과 내용 보기</summary>${b.q ? `<p class="sub">대상</p><p class="body" style="white-space:pre-wrap">${esc(b.q)}</p>` : ''}${b.s ? `<p class="sub" style="margin-top:8px">내용</p><p class="body" style="white-space:pre-wrap">${esc(b.s)}</p>` : ''}${b.h ? `<p class="sub" style="margin-top:8px">신청: ${esc(b.h)}</p>` : ''}</details>${src(b.u, '정부24에서 보기')}</article>`;
}
const nationalList = () => `<section class="stack"><h2>전국 공통 혜택</h2>${BaseBenefits.list.map(b => moneyCard(b, 'base:' + b.id)).join('')}</section><p class="sub">전국 혜택은 ${kd(BaseBenefits.checkedAt, true)}에 확인했어요. 금액과 조건은 바뀔 수 있으니 신청 전에 정부24나 주민센터(129)에서 확인하세요.</p>`;
function money() {
  if (isPet(K())) return petMoney();
  if (Couple.is(K())) return coupleMoney();
  if (Me.is(K())) return meMoney();
  if (!db.sido) return tipSeg() + `<section class="notice"><b>사는 지역의 혜택을 볼까요?</b><p class="sub">위치를 허용하면 그 지역에서 주는 혜택을 먼저 보여줘요.</p><div class="row"><button class="btn main" data-act="locate">현재 위치로 찾기</button><button class="btn" data-act="region">직접 고르기</button></div></section>` + nationalList();
  loadRegion();
  const d = regionData, show = x => !cashOnly || /현금|이용권/.test(x.k), cash = x => /현금|이용권/.test(x.k) ? 0 : 1;
  const rows = (d.rows || []).filter(show).sort((a, b) => cash(a) - cash(b)), mine = db.sigungu ? rows.filter(x => x.g === db.sigungu) : [], wide = rows.filter(x => !x.g);
  const known = !db.sigungu || (d.rows || []).some(x => x.g === db.sigungu);
  const head = `<section class="stack"><div class="row between"><h2>${esc((db.sido + ' ' + db.sigungu).trim())}</h2><button class="btn" data-act="region">지역 바꾸기</button></div>
    ${d.rows ? `<div class="row between"><label class="ck"><input type="checkbox" id="cashOnly" ${cashOnly ? 'checked' : ''}>현금·이용권만 보기</label><span class="sub">${d.info.asOf.replace(/-/g, '.')} 자료</span></div>` : ''}</section>`;
  const body = d.err ? `<div class="notice"><p>${esc(d.err)}</p><div class="row"><button class="btn" data-act="reload">다시 불러오기</button></div></div>` : !d.rows ? '<p class="empty">지역 혜택을 불러오는 중</p>' :
    (db.sigungu ? `<section class="stack"><h2>${esc(db.sigungu)} 혜택 ${mine.length}개</h2>${mine.map(localCard).join('') || `<p class="sub">${known ? '조건에 맞는 혜택이 없어요.' : '이 지역으로 등록된 혜택을 찾지 못했어요. 지역 이름이 맞는지 확인해 주세요.'}</p>`}</section>` : `<div class="notice"><p>시·군·구를 고르면 더 가까운 혜택을 볼 수 있어요.</p><div class="row"><button class="btn" data-act="region">시·군·구 고르기</button></div></div>`)
    + `<section class="stack"><h2>${esc(db.sido)} 공통 혜택 ${wide.length}개</h2>${wide.map(localCard).join('') || '<p class="sub">조건에 맞는 혜택이 없어요.</p>'}</section>`;
  return tipSeg() + head + (!local && ai ? aiBox('benefits', 'AI 혜택 찾기', 'AI로 더 찾아볼 수 있어요. API 요금이 들어요.', '혜택 찾기') + (aiData.benefits ? aiData.benefits.items.map(b => moneyCard(b, 'ai:' + b.title)).join('') : '') : '') + body + nationalList()
    + (d.info ? `<p class="sub">지역 자료 출처: ${esc(d.info.source)}. 지자체가 등록한 내용을 그대로 옮겼고, 지난해 내용이 남아 있을 수 있어요. 임신 중에 받는 혜택도 함께 나와요.</p>` : '');
}

/* ── 위치 ── */
function locateIntro() {
  openDlg(`<form data-form="none"><h2>사는 지역의 혜택을 보여드릴까요?</h2><p>위치를 허용하면 시·군·구를 찾아 그 지역 혜택을 먼저 보여줘요.</p><p class="sub">대략적인 위치(약 1km)만 OpenStreetMap에 보내 지역 이름을 받아요. 좌표는 저장하지 않고, 위치를 계속 추적하지도 않아요.</p><div class="row"><button type="button" class="btn main" data-act="locate">위치 허용하기</button><button type="button" class="btn" data-act="region">직접 고르기</button><button type="button" class="btn" data-act="close">나중에</button></div></form>`);
}
async function findPlace() {
  if (!navigator.geolocation) throw new Error('이 기기에서는 위치를 쓸 수 없어요.');
  const pos = await new Promise((ok, no) => navigator.geolocation.getCurrentPosition(ok, e => no(new Error(e.code === 1 ? '위치가 허용되지 않았어요. 휴대폰 설정에서 이 브라우저의 위치를 켜거나 지역을 직접 골라 주세요.' : '위치를 찾지 못했어요. 지역을 직접 골라 주세요.')), { timeout: 15000, maximumAge: 600000 }));
  const r2 = n => n.toFixed(2); // 약 1km로 뭉뚱그려 보낸다
  let a;
  try { const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${r2(pos.coords.latitude)}&lon=${r2(pos.coords.longitude)}&zoom=12&accept-language=ko`, { signal: AbortSignal.timeout(15000) }); if (!r.ok) throw 0; a = (await r.json()).address; }
  catch { throw new Error('지역 이름을 받지 못했어요. 지역을 직접 골라 주세요.'); }
  const at = Regions.fromAddress(a);
  if (!at) throw new Error('국내 지역을 찾지 못했어요. 지역을 직접 골라 주세요.');
  return at;
}
async function locate() {
  openDlg('<form data-form="none"><h2>위치를 찾는 중이에요</h2><p class="sub">휴대폰이 물어보면 허용을 눌러 주세요.</p></form>');
  try { const at = await findPlace(); if (dlg.open) regionDlg(at, true); } catch (e) { if (dlg.open) regionDlg(null, false, e.message); }
}
async function regionDlg(at, found, msg) {
  const v = at || { sido: db.sido, sigungu: db.sigungu };
  openDlg(`<form data-form="region"><h2>${found ? '이 지역이 맞나요?' : '지역 고르기'}</h2>${msg ? `<p>${esc(msg)}</p>` : ''}<p class="sub">부모님이 사는 곳이 다르면 바꿔 주세요. 혜택은 주민등록 주소 기준이에요.</p><label class="f">시·도<select name="sido" id="rSido" required><option value="">고르기</option>${SIDO.map(x => `<option ${v.sido === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label><label class="f">시·군·구<select name="sigungu" id="rGu"><option value="">전체</option></select></label>${found ? '' : '<button type="button" class="btn" data-act="locate">현재 위치로 찾기</button>'}${acts()}${found ? '<p class="sub">위치 이름: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap 기여자</a></p>' : ''}</form>`);
  fillGu(v.sigungu);
}
async function fillGu(keep) {
  const sel = $('#rGu'), r = Regions.find($('#rSido').value); if (!sel) return;
  let names = [];
  if (r) try { names = [...new Set((await (await fetch('regions/' + r.file + '.json')).json()).map(x => x.g).filter(Boolean))]; } catch { }
  if (!document.body.contains(sel) || (r && $('#rSido').value !== r.name)) return;
  if (keep && !names.includes(keep)) names.push(keep);
  sel.innerHTML = '<option value="">전체</option>' + names.sort((a, b) => a.localeCompare(b, 'ko')).map(n => `<option ${n === keep ? 'selected' : ''}>${esc(n)}</option>`).join('');
}
document.addEventListener('change', ev => { if (ev.target.id === 'nearSido' || ev.target.id === 'nearGu') { const box = ev.target.closest('section'), s = $('#nearSido').value; nearAt = { sido: s, sigungu: ev.target.id === 'nearGu' ? $('#nearGu').value : '' }; nearOther = true; spot = null; fillNear(box, Number(ev.target.dataset.n)); return; } if (ev.target.id === 'rSido') fillGu(''); if (ev.target.id === 'cashOnly') { cashOnly = ev.target.checked; render(); } });
// 지역을 아직 안 정했으면 앱을 켤 때 한 번 안내한다.
function askLocationOnce() {
  if (!started || db.sido || dlg.open || isPet(K())) return;
  try { if (sessionStorage.getItem('baby-loc')) return; sessionStorage.setItem('baby-loc', '1'); } catch { }
  locateIntro();
}
const aiBody = k => k === 'tips' ? { ageMonths: K().born ? Math.min(71, S.ageMonths(K().birth, today())) : -1 } : { sido: db.sido, sigungu: db.sigungu, birthMonth: K().birth.slice(0, 7), order: K().order };
const aiKeys = {};
async function runAI(kind, refresh) {
  if (!ai || aiData.busy[kind] || K().kind || (kind === 'benefits' && !db.sido)) return;
  const body = aiBody(kind), key = JSON.stringify(body);
  aiData.busy[kind] = true; delete aiData.err[kind]; render();
  try { const r = await api('/api/' + kind, { method: 'POST', body: JSON.stringify(Object.assign({ refresh }, body)) }); if (key === JSON.stringify(aiBody(kind))) { aiData[kind] = r; aiKeys[kind] = key; } }
  catch (e) { if (!e.needKey) aiData.err[kind] = e.message; }
  aiData.busy[kind] = false; render();
}
// 개월 수가 바뀌면 육아 제안을 새로 받는다(한 달에 한 번, 저장된 것이 있으면 그것을 쓴다).
function syncAI() {
  if (aiKeys.tips !== JSON.stringify(aiBody('tips'))) { aiData.tips = null; if (tab === 'tips' && !aiData.err.tips) runAI('tips', false); }
  if (aiKeys.benefits !== JSON.stringify(aiBody('benefits'))) aiData.benefits = null;
}

/* ── 화면 ── */
function render() {
  if (!ready) return;
  $('#top').hidden = $('nav').hidden = !started; document.body.classList.toggle('on', started);
  if (!started) { $('#main').className = 'stack tab-' + tab; $('#main').innerHTML = join ? joinView() : handoff ? handoffView(handoff === 'google') : tab === 'visit' && vis ? visitView() : visits.length && !ob.mine ? visitsView() : onboard(); return; }
  if (join) { $('#top').hidden = $('nav').hidden = true; document.body.classList.remove('on'); $('#main').className = 'stack'; $('#main').innerHTML = joinView(); scrollTo(0, 0); return; }
  $('#top').innerHTML = topBar(); $('nav').innerHTML = navBar();
  const q = $('#main .pill'), qx = q ? q.scrollLeft : 0, mt = $('#main .mtabs'), mx = mt ? mt.scrollLeft : 0;
  const opened = [...document.querySelectorAll('#main details[open]')].map(x => x.dataset.key || 'all');
  if (tab === 'grow' && Couple.is(K())) tab = 'album'; // 연애 수첩은 하루 한 장이 없다
  $('#main').className = 'stack tab-' + tab;
  $('#main').innerHTML = { home, cal: calendar, diary: records, album, more, tips, money, evt: coupleEvents, vax, visits: visitsView, visit: visitView, grow: () => `<div class="albtop">${albSeg()}</div>` + growth() }[tab]();
  document.querySelectorAll('#main details').forEach(x => { if (opened.includes(x.dataset.key || 'all')) x.open = true; });
  if ($('#main .pill')) $('#main .pill').scrollLeft = qx; if ($('#main .mtabs')) $('#main .mtabs').scrollLeft = mx;
  if (vw) viewRefresh();
}
const dlg = $('#dlg');
function openDlg(html, wide) { if (dlg.open) dlg.close(); dlg.className = wide ? 'wide' : ''; dlg.innerHTML = html; showDlg(dlg); }
// 창을 열면 첫 입력칸이 저절로 선택돼 아이폰에서 날짜 창이나 자판이 바로 뜬다. 대신 제목에 초점을 둔다.
function showDlg(d) {
  d.insertAdjacentHTML('afterbegin', '<div class="xbar"><button type="button" data-act="close" aria-label="닫기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg></button></div>');
  const h = d.querySelector('h2') || d;
  h.tabIndex = -1; h.setAttribute('autofocus', ''); d.showModal();
  if (document.activeElement !== h) h.focus({ preventScroll: true });
}
const acts = (del) => `<div class="row between"><div class="row"><button class="btn main" value="ok">저장</button></div>${del ? `<button type="button" class="btn danger" data-act="del" data-k="${del[0]}" data-id="${del[1]}">${del[2]}</button>` : ''}</div>`;

const whoField = v => many() ? `<label class="f">누구의 기록인가요<select name="kid">${catKids().map(k => `<option value="${k.id}" ${v === k.id ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}<option value="" ${v === '' ? 'selected' : ''}>모두</option></select></label>` : '';
function itemDlg(id, kid) {
  const k = kidOf(kid), it = items(k).find(i => i.id === id); if (!it) return;
  openDlg(`<form data-form="item" data-id="${id}" data-kid="${k.id}"><div class="row between"><div><h3>${many() ? esc(k.name) + ', ' : ''}${TYPE[it.type]}</h3><h2>${esc(it.title)}</h2></div>${it.done ? chipOf(it) : ''}</div><p>권장 시기: ${esc(it.age)}<br><span class="sub">${kd(it.start, true)} ~ ${kd(it.end, true)}${k.born ? '' : ' (예정일 기준)'}</span></p>${it.hard && it.hard !== it.end ? `<p>지원 기한: ${kd(it.hard, true)}까지</p>` : ''}${it.note ? `<p class="sub">${esc(it.note)}</p>` : ''}
  <div class="two"><label class="f">예약한 날<input type="date" name="appt" value="${it.appt || ''}"></label><label class="f">받은 날<input type="date" name="done" value="${it.done || ''}" max="${today()}"></label></div>${k.born ? '<button type="button" class="btn" data-act="donetoday">오늘 했어요</button>' : ''}${acts()}${k.kind && !isPet(k) ? '' : isPet(k) ? '<button type="button" class="btn" data-act="vethosp">가까운 동물병원 찾기</button>' : ['vaccine', 'check'].includes(it.type) ? `<section class="stack" id="near"><h2>${it.type === 'vaccine' ? '가까운 접종 병원' : '가까운 소아청소년과'}</h2><p class="sub">불러오는 중</p></section>` : ''}</form>`);
  if ($('#near')) fillNear($('#near'), 3);
}
function eventDlg(id) {
  const e = db.events.find(x => x.id === id) || { title: '', date: tab === 'cal' ? sel : today(), time: '', memo: '', kid: tab === 'cal' ? '' : K().id };
  openDlg(`<form data-form="event" data-id="${id || ''}"><h2>${id ? '일정 고치기' : '일정 추가'}</h2><label class="f">제목<input name="title" required maxlength="80" value="${esc(e.title)}" placeholder="${({ baby: '예: 백일 사진 예약', pet: '예: 미용 예약', couple: '예: 기념일 레스토랑 예약', me: '예: 치과 예약' })[kcat(K())]}"></label>${whoField(e.kid)}<div class="two"><label class="f">날짜<input type="date" name="date" required value="${e.date}"></label><label class="f">시간 (선택)<input type="time" name="time" value="${e.time || ''}"></label></div><div class="sexf"><span>알림 (여러 개 고를 수 있어요)</span><div class="opts rem">${[['d1', '하루 전'], ['d0', '당일 아침'], ['h1', '1시간 전'], ['m10', '10분 전'], ['m0', '정시']].map(([r, t]) => `<label><input type="checkbox" name="rem" value="${r}" ${(e.rem || Notice.REM).includes(r) ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div><span class="sub">1시간 전·10분 전·정시는 시간을 넣었을 때 울려요.</span></div><label class="f">메모<textarea name="memo" maxlength="1000" style="min-height:80px">${esc(e.memo)}</textarea></label>${acts(id && ['event', id, '일정 지우기'])}</form>`);
}
let draft = []; // 일기 창에서 고른 사진 id
const draftGrid = () => draft.map(id => `<button type="button" data-act="undraft" data-id="${id}" aria-label="일기에서 사진 빼기"><img ${pic(id, 1)} alt=""><span class="x">빼기</span></button>`).join('');
function writeDlg(id) {
  const x = db.diary.find(d => d.id === id) || { date: tab === 'cal' ? sel : today(), body: '', photos: [], kid: K().id };
  draft = [...x.photos];
  openDlg(`<form data-form="diary" data-id="${id || ''}"><h2>${id ? '일기 고치기' : '일기 쓰기'}</h2><div class="two"><label class="f">날짜<input type="date" name="date" required value="${x.date}"></label>${whoField(x.kid)}</div><label class="f">내용<textarea name="body" maxlength="10000" placeholder="${Me.is(K()) ? '오늘 하루는 어땠나요?' : Couple.is(K()) ? '오늘 우리는 어땠나요?' : isPet(K()) ? `오늘 ${esc(K().name)}${josa(K().name) === '이' ? '은' : '는'} 어땠나요?` : K().born ? '오늘 아기는 어땠나요?' : '아기를 기다리는 오늘, 어떤 하루였나요?'}">${esc(x.body)}</textarea></label><label class="ck"><input type="checkbox" name="priv" ${x.priv ? 'checked' : ''}>나만 보기 (보기만 초대받은 가족에게 안 보여요)</label><label class="f">사진<input type="file" id="dfile" accept="image/*" multiple></label><div class="grid" id="dgrid">${draftGrid()}</div><p class="sub">넣은 사진은 사진첩에도 이 날짜로 저장돼요.</p>${acts(id && ['diary', id, '일기 지우기'])}</form>`);
}
function photoDlg(id) {
  const p = db.photos.find(x => x.id === id); if (!p) return;
  openDlg(`<form data-form="photo" data-id="${id}"><h2>${p.type ? '동영상 정보' : '사진 정보'}</h2><label class="f">날짜<input type="date" name="date" required value="${p.date}"></label><label class="f">설명<textarea name="caption" class="cap1" maxlength="1000" placeholder="이 사진의 이야기를 적어 보세요">${esc(p.caption)}</textarea></label>${whoField(p.kid)}<label class="ck"><input type="checkbox" name="priv" ${p.priv ? 'checked' : ''}>나만 보기 (보기만 초대받은 가족에게 안 보여요)</label><p class="sub">${stageOf(p.date, kidOf(p.kid))}</p><div class="row"><button type="button" class="btn favb" data-act="fav" data-id="${id}" aria-pressed="${Boolean(p.fav)}">${icon('heart', p.fav ? 'fill' : '')}즐겨찾기</button><button type="button" class="btn" data-act="sharephoto" data-id="${id}">내보내기</button></div>${acts(['photo', id, p.type ? '동영상 지우기' : '사진 지우기'])}</form>`);
}
function settingsDlg() {
  openDlg(`<form data-form="settings"><h2>설정</h2>
  <fieldset><legend>수첩</legend><div class="list">${db.kids.map(k => `<button type="button" class="item" data-act="kidedit" data-id="${k.id}" style="grid-template-columns:minmax(0,1fr) auto"><span><b>${esc(k.name)}</b><span class="when">${kd(k.birth, true)}${k.time ? ' ' + Family.timeText(k.time) : ''} ${Me.is(k) ? '생일' : Couple.is(k) ? '사귄 날' : isPet(k) ? Pet.KINDS[k.kind] + ' 생일' : k.born ? '출생' : '예정'}</span></span><span class="chip">고치기</span></button>`).join('')}</div>${addBtns()}</fieldset>
  <div class="f"><span style="font-weight:600;font-size:13.5px">지역</span><div class="row" style="margin-top:5px"><span>${esc((db.sido + " " + db.sigungu).trim() || "아직 안 정했어요")}</span><button type="button" class="btn" data-act="region">바꾸기</button></div></div>
  <fieldset><legend>알림 (당일 알림은 항상 포함)</legend><div class="row">${[14, 7, 3, 1].map(n => `<label class="ck"><input type="checkbox" name="lead" value="${n}" ${db.leads.includes(n) ? 'checked' : ''}>${n}일 전</label>`).join('')}</div><label class="f">알림 시각<select name="hour">${[7, 8, 9, 10, 12, 18, 20].map(h => `<option value="${h}" ${db.hour === h ? 'selected' : ''}>${h}시</option>`).join('')}</select></label></fieldset>
  ${local ? `${AI_URL ? `<fieldset><legend>AI 연결</legend><label class="f">접근 코드<input name="aiCode" id="aiCode" type="password" autocomplete="off" maxlength="100" value="${esc(conf.code)}"></label><p class="sub">이 기기에만 저장되고 백업 파일에는 들어가지 않아요.</p></fieldset>` : ''}<fieldset><legend>백업</legend><p class="sub">일기와 사진은 이 기기에 저장돼요. 휴대폰을 바꾸거나 브라우저 기록을 지우기 전에 꼭 백업하세요. 아이폰에서는 '파일에 저장'을 골라 iCloud Drive에 둘 수 있어요.</p><div class="row"><button type="button" class="btn" data-act="backup">백업 파일 만들기</button><button type="button" class="btn" data-act="restore">백업 되돌리기</button></div></fieldset>` : ''}${acts()}<p class="sub">버전 ${APP_VERSION}</p></form>`);
}
function kidDlg(id) {
  const k = kidOf(id), r = (n, v, l) => `<label class="ck"><input type="radio" name="${n}" value="${v}" ${k.options[n] === v ? 'checked' : ''}>${l}</label>`;
  openDlg(`<form data-form="kid" data-id="${k.id}"><h2>${esc(k.name)} 정보</h2><button type="button" class="avpick" data-act="avatar" data-id="${k.id}">${face(k, 'xl')}<span>${icon('cam', 's')}사진 ${k.photo ? '바꾸기' : '넣기'}</span></button>${k.photo ? `<button type="button" class="btn" data-act="avatardel" data-id="${k.id}">프로필 사진 빼기</button>` : ''}<label class="f">이름이나 태명<input name="name" required maxlength="20" autocomplete="off" value="${esc(k.name)}"></label><label class="ck"><input type="checkbox" name="born" ${k.born ? 'checked' : ''}>태어났어요</label>${sexOpts('sex', k.sex || '', k.born)}
  <div class="two"><label class="f">${k.born ? '생일' : '출산 예정일'}<input type="date" name="birth" required value="${k.birth}"></label><label class="f">${k.born ? '태어난 시각' : '예정 시각'} (선택)<input type="time" name="time" value="${k.time || ''}"></label></div>
  <label class="f">몇째<select name="order">${[1, 2, 3].map(n => `<option value="${n}" ${k.order === n ? 'selected' : ''}>${['첫째', '둘째', '셋째 이상'][n - 1]}</option>`).join('')}</select></label>
  <fieldset><legend>혼합백신 (2·4·6개월)</legend>${r('combo', '5', '4가·5가, 1개월에 B형간염 2차 따로')}${r('combo', '6', '6가, B형간염 포함')}</fieldset><fieldset><legend>로타바이러스</legend>${r('rota', 'RV1', '2회 (RV1)')}${r('rota', 'RV5', '3회 (RV5)')}</fieldset><fieldset><legend>일본뇌염</legend>${r('je', 'dead', '불활성화 백신 5회')}${r('je', 'live', '생백신 2회')}</fieldset><p class="sub">백신 종류는 병원에서 정한 뒤 바꾸면 돼요.</p>${acts(manyAll() && ['kid', k.id, '이 아이 빼기'])}${manyAll() ? '<p class="sub">아이를 빼면 접종·육아 기록은 지워지고, 일기와 사진은 \'모두\'의 기록으로 남아요.</p>' : ''}</form>`);
}
function addKidDlg() {
  const last = db.kids[db.kids.length - 1], v = last.born ? {} : { birth: last.birth };
  openDlg(`<form data-form="addkid"><h2>${db.kids.some(k => !k.kind) ? "쌍둥이·형제 더하기" : "아기 수첩 만들기"}</h2>${kidFields(0, v, true)}<p class="sub">쌍둥이면 날짜를 똑같이 두세요.</p>${acts()}</form>`);
  startPreview(dlg.querySelector('form'));
}
function bornDlg() {
  const k = K(), twins = db.kids.filter(x => x.id !== k.id && !x.born && x.birth === k.birth);
  openDlg(`<form data-form="born"><h2>축하해요! 생일을 넣어 주세요</h2><div class="two"><label class="f">태어난 날<input type="date" name="birth" required max="${today()}" value="${today()}"></label><label class="f">태어난 시각 (선택)<input type="time" name="time"></label></div><label class="f">이름 (정해졌다면 바꿔 주세요)<input name="name" required maxlength="20" autocomplete="off" value="${esc(k.name)}"></label>${sexOpts('sex', k.sex || '', true)}${twins.map(x => `<div class="kidbox stack"><label class="ck"><input type="checkbox" name="twin" value="${x.id}" checked>${esc(x.name)}도 같은 날 태어났어요</label><div class="two"><label class="f">이름<input name="tn_${x.id}" maxlength="20" autocomplete="off" value="${esc(x.name)}"></label><label class="f">태어난 시각 (선택)<input type="time" name="tt_${x.id}"></label></div>${sexOpts('ts_' + x.id, x.sex || '', true)}</div>`).join('')}${acts()}</form>`);
}

/* ── 사진 ── */
// JPEG에 적힌 촬영일을 읽는다.
const exifDate = async file => { const s = await exifStamp(file); return s && s.slice(0, 10); };
// 촬영 날짜와 시각 'YYYY-MM-DD HH:MM:SS'
async function exifStamp(file) {
  try {
    const v = new DataView(await file.slice(0, 131072).arrayBuffer());
    if (v.getUint16(0) !== 0xffd8) return null;
    let o = 2;
    while (o < v.byteLength - 10) {
      if (v.getUint16(o) === 0xffe1 && v.getUint32(o + 4) === 0x45786966) {
        const t = o + 10, le = v.getUint16(t) === 0x4949, u16 = a => v.getUint16(a, le), u32 = a => v.getUint32(a, le);
        const find = (ifd, tag) => { for (let i = 0, n = u16(ifd); i < n; i++) if (u16(ifd + 2 + i * 12) === tag) return u32(ifd + 2 + i * 12 + 8); return 0; };
        const ex = find(t + u32(t + 4), 0x8769); if (!ex) return null;
        const s = find(t + ex, 0x9003); if (!s) return null;
        let str = ''; for (let i = 0; i < 19; i++) str += String.fromCharCode(v.getUint8(t + s + i));
        const d = str.slice(0, 10).replace(/:/g, '-'); return isDate(d) && d > '1990' ? d + str.slice(10) : null;
      }
      o += 2 + v.getUint16(o + 2);
    }
  } catch { } return null;
}
async function upload(files, fixedDate) {
  const added = [], bad = []; let n = 0;
  for (const f of files) {
    const v = Media.isVideo(f); n++;
    busy(files.length > 1 ? `${files.length}개를 앨범에 넣는 중이에요` : v ? '동영상을 넣는 중이에요' : '사진을 넣는 중이에요', `${files.length > 1 ? `${n}번째 ${v ? '동영상' : '사진'}, ` : ''}${v ? '썸네일을 만들고 있어요. ' : ''}화면을 켜 두세요`, n - 1, files.length);
    await new Promise(r => setTimeout(r, 30)); // 창이 먼저 그려지게 한다
    try {
      const m = await storeMedia(f), made = m.type ? await Media.madeAt(f) : null;
      added.push(Object.assign(m, { date: fixedDate || (made ? made.toLocaleDateString('sv-SE') : await exifDate(f)) || new Date(f.lastModified || Date.now()).toLocaleDateString('sv-SE'), caption: '', kid: K().id }));
    } catch (e) { bad.push((f.name || '파일') + (e.status ? ': ' + e.message : ': 열 수 없는 파일이에요')); }
  }
  if (files.length > 1) { busy(`${files.length}개를 앨범에 넣는 중이에요`, '거의 다 됐어요', files.length, files.length); }
  const kept = added.length && await save(d => d.photos.push(...added)); busyOff(); if (kept) { autoUpload(); upShow(); }
  if (bad.length) toast(bad[0] + (bad.length > 1 ? ` 외 ${bad.length - 1}장` : '')); else if (added.length) { const v = added.filter(x => x.type).length, n = added.length - v; toast([n ? `사진 ${n}장` : '', v ? `동영상 ${v}개` : ''].filter(Boolean).join(', ') + (v ? '를' : '을') + ' 넣었어요'); }
  return added;
}

/* ── 매일 얼굴 사진(성장 앨범) ── */
const facesOf = k => db.faces.filter(f => f.kid === k.id).sort((a, b) => a.date < b.date ? -1 : 1);
const dayNo = (k, d) => S.diffDays(k.birth, d) + 1;
// 백일·200일·생일까지 남은 날
function nextDay(k) {
  const t = today(), l = [[S.addDays(k.birth, 99), '백일'], [S.addDays(k.birth, 199), '200일']]; for (let y = 1; y <= 13; y++) l.push([S.addMonths(k.birth, 12 * y), y === 1 ? '첫돌' : y + '번째 생일']);
  const u = l.find(x => x[0] >= t); return u ? ` ${u[1]}${u[0] === t ? '이 오늘이에요!' : `까지 ${S.diffDays(t, u[0])}일` }` : '';
}
function mission() {
  const k = K(), t = today();
  if (!k.born) return `<section class="notice"><b>매일 사진 미션</b><p class="sub">태어난 날부터 1일차, 2일차 얼굴 사진을 하루 한 장씩 모아요. 나중에 성장 앨범 영상으로 만들 수 있어요.</p></section>`;
  const n = dayNo(k, t); if (n < 1) return '';
  const f = facesOf(k).find(x => x.date === t), cnt = facesOf(k).length;
  return `<section class="hero"><div class="mission">${f ? `<button class="face on" data-act="face" data-id="${f.id}" aria-label="오늘 찍은 얼굴 사진"><img ${pic(f.id, 1)} alt="${n}일차 얼굴 사진"></button>` : `<button class="face" data-act="faceask" data-d="${t}" aria-label="${n}일차 사진 넣기">${icon('cam')}</button>`}<div class="stack" style="gap:6px"><h3>오늘의 미션</h3><h2>${f ? `${n}일차 사진을 찍었어요` : `${n}일차 ${Me.is(k) ? '' : '얼굴 '}사진 찍기`}</h2><p class="sub">지금까지 ${cnt}장 모았어요.${nextDay(k)}</p></div></div><div class="row">${tab === 'grow' ? (cnt ? '<button class="btn" data-act="growview">' + growName() + ' 보기</button>' : '') : '<button class="btn" data-act="grow">' + growName() + ' 보기</button>'}</div></section>`;
}
function growth() {
  const k = K(), t = today();
  if (!k.born) return mission();
  const fs = facesOf(k), has = new Set(fs.map(f => f.date)), n = dayNo(k, t);
  // 최근 두 주 안에 빠진 날은 빈칸으로 보여 나중에 채울 수 있게 한다.
  const miss = Array.from({ length: Math.min(14, n) }, (_, i) => S.addDays(t, -i)).filter(d => d >= k.birth && !has.has(d));
  const cells = fs.map(f => ({ d: f.date, f })).concat(miss.map(d => ({ d }))).sort((a, b) => a.d < b.d ? 1 : -1);
  return mission() + driveBar() + `<section class="stack"><div class="row between"><h2>${growName()} ${fs.length}장</h2><button class="btn main" data-act="video" ${fs.length < 2 ? 'disabled' : ''}>성장 영상 만들기</button></div><p class="sub">${fs.length < 2 ? '사진이 두 장부터 영상을 만들 수 있어요. ' : ''}여기 사진은 사진첩과 따로 저장돼요. 빈칸을 누르면 지난 날짜 사진도 넣을 수 있어요.</p>
    <div class="grid">${cells.map(c => c.f ? `<button data-act="face" data-id="${c.f.id}" aria-label="${dayNo(k, c.d)}일차 사진"><img ${pic(c.f.id, 1)} alt="${dayNo(k, c.d)}일차 얼굴 사진"><span class="d">${dayNo(k, c.d)}일차</span></button>` : `<button class="miss" data-act="faceask" data-d="${c.d}" aria-label="${dayNo(k, c.d)}일차 사진 넣기">${dayNo(k, c.d)}일차<br>넣기</button>`).join('')}</div><div class="row"><button class="btn main" data-act="facebulk">여러 장 한 번에 넣기</button><button class="btn" data-act="faceadd">다른 날짜 사진 넣기</button></div></section>`;
}
// 얼굴 사진을 날짜 순서로 한 장씩 넘겨 본다.
let gv = null;
function growView() {
  const k = K(), fs = facesOf(k); if (!fs.length) return;
  gv = { k, fs, i: fs.length - 1, url: '', timer: 0 };
  openDlg(`<form data-form="none"><h2 id="gvt"></h2><div class="gvimg"><img id="gvi" alt=""></div><p class="sub mid" id="gvn" aria-live="polite"></p><div class="gvbar"><button type="button" class="btn" data-act="gv" data-n="-1">이전</button><button type="button" class="btn main" data-act="gvplay" id="gvp">처음부터 재생</button><button type="button" class="btn" data-act="gv" data-n="1">다음</button></div></form>`, true);
  growShow();
}
async function growShow() {
  const g = gv, f = g.fs[g.i], b = await photoBlob(f.id); if (gv !== g || g.fs[g.i] !== f || !$('#gvi')) return;
  const old = g.url; g.url = b ? URL.createObjectURL(b) : ''; $('#gvi').src = g.url; if (old) setTimeout(() => URL.revokeObjectURL(old), 1000);
  $('#gvt').textContent = `${g.k.name} ${dayNo(g.k, f.date)}일차`; $('#gvn').textContent = `${kd(f.date, true)}, ${g.i + 1}/${g.fs.length}`;
  dlg.querySelectorAll('[data-act=gv]').forEach(x => { x.disabled = x.dataset.n === '-1' ? g.i === 0 : g.i === g.fs.length - 1; });
}
function growStop() { if (gv && gv.timer) { clearInterval(gv.timer); gv.timer = 0; if ($('#gvp')) $('#gvp').textContent = '처음부터 재생'; } }
function growStep(n) { growStop(); gv.i = Math.max(0, Math.min(gv.fs.length - 1, gv.i + n)); growShow(); }
function growPlay() {
  if (gv.timer) return growStop();
  gv.i = 0; growShow(); $('#gvp').textContent = '멈추기';
  gv.timer = setInterval(() => { if (!$('#gvi') || !dlg.open) { clearInterval(gv.timer); gv.timer = 0; return; } if (gv.i >= gv.fs.length - 1) return growStop(); gv.i++; growShow(); }, 900);
}
// 찍을지 고를지 묻는 창
const shootBtns = (cam, pick) => `<div class="picks two2"><button type="button" ${cam}>${icon('cam', 'xl')}<b>사진 찍기</b></button><button type="button" ${pick}>${icon('album', 'xl')}<b>앨범에서 고르기</b></button></div>`;
const addDlg = () => openDlg(`<form data-form="none"><h2>사진·동영상 추가</h2><div class="picks two2 three"><button type="button" data-act="albcam">${icon('cam', 'xl')}<b>사진 찍기</b></button><button type="button" data-act="albvid">${icon('video', 'xl')}<b>동영상 찍기</b></button><button type="button" data-act="albpick">${icon('album', 'xl')}<b>앨범에서 고르기</b></button></div><p class="sub">여기서 찍은 것은 ${albName()}에 오늘 날짜로 들어가요. 휴대폰 사진첩에도 두려면 열어서 내보내기를 눌러 주세요. 동영상은 하나에 200MB까지 넣을 수 있어요.</p></form>`);
const faceAsk = d => openDlg(`<form data-form="none"><h2>${esc(K().name)} ${dayNo(K(), d)}일차</h2>${shootBtns(`data-act="faceadd" data-d="${d}" data-cam="1"`, `data-act="faceadd" data-d="${d}"`)}</form>`);
function pickFace(date, cam) {
  pickFiles({ accept: PHOTO_ONLY, capture: cam ? 'environment' : '' }, async ([f]) => cropDlg(f, date || await exifDate(f) || new Date(f.lastModified).toLocaleDateString('sv-SE'), !date));
}
// 얼굴을 원 안에 맞춘다. 같은 자리에 맞춰 두면 영상이 매끄럽다.
let crop = null;
async function cropDlg(file, date, freeDate) {
  const k = K();
  let bmp; try { bmp = await createImageBitmap(file); } catch { return toast('열 수 없는 사진이에요'); }
  openDlg(`<form data-form="crop"><h2>얼굴을 원 안에 맞춰 주세요</h2><div class="crop"><canvas id="cropc" width="1080" height="1080" aria-label="사진을 끌어서 옮기기"></canvas><i></i></div><label class="f">크기<input type="range" id="cropz" min="1" max="5" step="0.01" value="1"></label><label class="f">날짜<input type="date" name="date" required min="${k.birth}" max="${today()}" value="${date}" ${freeDate ? '' : 'readonly'}></label><p class="sub" id="cropd"></p>${acts()}</form>`);
  crop = { bmp, z: 1, x: bmp.width / 2, y: bmp.height / 2, kid: k.id };
  const label = () => { const d = dlg.querySelector('[name=date]').value; $('#cropd').textContent = isDate(d) && d >= k.birth ? `${k.name} ${dayNo(k, d)}일차` + (db.faces.some(f => f.kid === k.id && f.date === d) ? ', 저장하면 이날 사진이 바뀌어요' : '') : '태어난 날부터 고를 수 있어요'; };
  dlg.querySelector('[name=date]').addEventListener('input', label); label();
  bindCrop(1080);
}
// 끌어서 옮기고 크기를 바꾼다. 빈 곳이 생기지 않게 가장자리에서 멈춘다.
function bindCrop(size) {
  const { bmp } = crop, c = $('#cropc'), g = c.getContext('2d'), base = Math.min(bmp.width, bmp.height);
  const draw = () => {
    const w = base / crop.z; crop.x = Math.max(w / 2, Math.min(bmp.width - w / 2, crop.x)); crop.y = Math.max(w / 2, Math.min(bmp.height - w / 2, crop.y));
    g.drawImage(bmp, crop.x - w / 2, crop.y - w / 2, w, w, 0, 0, size, size);
  };
  $('#cropz').addEventListener('input', e => { crop.z = Number(e.target.value); draw(); });
  let p = null;
  c.addEventListener('pointerdown', e => { p = [e.clientX, e.clientY]; c.setPointerCapture(e.pointerId); });
  c.addEventListener('pointermove', e => { if (!p) return; const s = base / crop.z / c.clientWidth; crop.x -= (e.clientX - p[0]) * s; crop.y -= (e.clientY - p[1]) * s; p = [e.clientX, e.clientY]; draw(); });
  ['pointerup', 'pointercancel'].forEach(n => c.addEventListener(n, () => { p = null; }));
  draw();
}
async function saveFace(date) {
  const k = kidOf(crop.kid);
  if (date < k.birth || date > today()) return toast('태어난 날부터 오늘까지 고를 수 있어요');
  const c = $('#cropc'), b = await new Promise(x => c.toBlob(x, 'image/jpeg', .9));
  const s = document.createElement('canvas'); s.width = s.height = 360; s.getContext('2d').drawImage(c, 0, 0, 360, 360);
  const th = await new Promise(x => s.toBlob(x, 'image/jpeg', .82));
  let r; try { r = await api('/api/photos', { method: 'POST', body: b }); await api(`/photos/${r.id}/thumb`, { method: 'PUT', body: th }).catch(() => { }); } catch (e) { return toast(e.message); }
  const old = db.faces.filter(f => f.kid === k.id && f.date === date);
  if (!await save(d => { d.faces = d.faces.filter(f => !(f.kid === k.id && f.date === date)); d.faces.push({ id: r.id, date, kid: k.id, caption: old[0] && old[0].caption || '' }); })) { await api('/api/photos/' + r.id, { method: 'DELETE' }).catch(() => { }); return; }
  old.forEach(f => api('/api/photos/' + f.id, { method: 'DELETE' }).catch(() => { }));
  dlg.close(); toast(`${dayNo(k, date)}일차 사진을 저장했어요`); autoUpload();
}
// 여러 장을 한 번에: 촬영 날짜로 나누고, 같은 날은 가장 이른 시각 사진 한 장을 고른다. 넣기 전에 확인한다.
let bulk = null;
const bulkFree = () => { if (bulk) bulk.groups.forEach(g => g.files.forEach(x => URL.revokeObjectURL(x.url))); bulk = null; };
async function faceBulk(files) {
  const k = K(); bulkFree(); busy('사진 날짜를 읽고 있어요', `${files.length}장`);
  const by = {}; let out = 0;
  for (const f of files) {
    if (!/^image\//.test(f.type || 'image/')) { out++; continue; }
    const st = await exifStamp(f) || new Date(f.lastModified || Date.now()).toLocaleString('sv-SE'), date = st.slice(0, 10);
    if (date < k.birth || date > today()) { out++; continue; }
    (by[date] = by[date] || []).push({ f, st, url: URL.createObjectURL(f) });
  }
  busyOff();
  const groups = Object.keys(by).sort().map(date => ({ date, files: by[date].sort((a, b) => a.st < b.st ? -1 : 1), pick: 0, has: db.faces.some(x => x.kid === k.id && x.date === date) }));
  if (!groups.length) return toast(out ? `${k.name} 태어난 날부터 오늘까지 찍은 사진이 없어요` : '사진을 열 수 없어요');
  bulk = { kid: k.id, groups };
  const tm = st => st.length > 10 ? st.slice(11, 16) : '';
  openDlg(`<form data-form="none" class="bulk"><h2>${growName()}에 넣을 사진</h2><p class="sub">${groups.length}일치를 찾았어요. 같은 날 사진이 여러 장이면 가장 이른 시각 사진을 골랐어요. 다른 사진을 누르면 바뀌어요.${out ? ` 태어나기 전이거나 날짜를 알 수 없는 ${out}장은 뺐어요.` : ''} 사진은 가운데를 정사각형으로 잘라 넣고, 나중에 한 장씩 바꿀 수 있어요.</p>
    <div class="bulkl">${groups.map((g, gi) => `<section><div class="row between"><b>${dayNo(k, g.date)}일차 <span class="sub">${kd(g.date)}</span></b>${g.has ? `<label class="ck"><input type="checkbox" name="re${gi}"> 이미 있어요, 바꾸기</label>` : ''}</div><div class="bulkr">${g.files.map((x, i) => `<button type="button" data-act="bulkpick" data-g="${gi}" data-i="${i}" aria-pressed="${i === 0}" aria-label="${tm(x.st) || '사진'} ${i + 1}"><img src="${x.url}" alt="">${tm(x.st) ? `<span>${tm(x.st)}</span>` : ''}</button>`).join('')}</div></section>`).join('')}</div>
    <div class="row"><button type="button" class="btn main big" data-act="bulksave" style="flex:1">넣기</button></div></form>`);
  dlg.addEventListener('close', bulkFree, { once: true });
}
function bulkPick(gi, i) {
  if (!bulk) return; bulk.groups[gi].pick = i;
  dlg.querySelectorAll(`[data-act=bulkpick][data-g="${gi}"]`).forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.i) === i)));
}
async function bulkSave() {
  if (!bulk) return; const k = kidOf(bulk.kid), b0 = bulk;
  const todo = b0.groups.filter((g, gi) => !g.has || (dlg.querySelector(`[name=re${gi}]`) || {}).checked);
  if (!todo.length) return toast('넣을 사진이 없어요. 이미 있는 날은 "바꾸기"를 골라 주세요');
  const made = [], c = document.createElement('canvas'), s = document.createElement('canvas'); c.width = c.height = 1080; s.width = s.height = 360; let bad = 0, n = 0;
  for (const g of todo) {
    busy(`${todo.length}장을 ${growName()}에 넣는 중이에요`, '화면을 켜 두세요', n++, todo.length); await new Promise(r => setTimeout(r, 30));
    try {
      const bmp = await createImageBitmap(g.files[g.pick].f), w = Math.min(bmp.width, bmp.height);
      c.getContext('2d').drawImage(bmp, (bmp.width - w) / 2, (bmp.height - w) / 2, w, w, 0, 0, 1080, 1080); bmp.close && bmp.close();
      s.getContext('2d').drawImage(c, 0, 0, 360, 360);
      const b = await new Promise(x => c.toBlob(x, 'image/jpeg', .9)), th = await new Promise(x => s.toBlob(x, 'image/jpeg', .82));
      const r = await api('/api/photos', { method: 'POST', body: b }); await api(`/photos/${r.id}/thumb`, { method: 'PUT', body: th }).catch(() => { });
      made.push({ id: r.id, date: g.date });
    } catch { bad++; }
  }
  busy(`${todo.length}장을 ${growName()}에 넣는 중이에요`, '거의 다 됐어요', todo.length, todo.length);
  const dates = new Set(made.map(m => m.date)), old = db.faces.filter(f => f.kid === k.id && dates.has(f.date));
  const ok = made.length && await save(d => { d.faces = d.faces.filter(f => !(f.kid === k.id && dates.has(f.date))); made.forEach(m => d.faces.push({ id: m.id, date: m.date, kid: k.id, caption: (old.find(f => f.date === m.date) || {}).caption || '' })); });
  busyOff();
  if (!ok) { made.forEach(m => api('/api/photos/' + m.id, { method: 'DELETE' }).catch(() => { })); return toast('저장하지 못했어요. 다시 해 주세요'); }
  old.forEach(f => api('/api/photos/' + f.id, { method: 'DELETE' }).catch(() => { }));
  dlg.close(); render(); autoUpload();
  toast(`${growName()}에 ${made.length}장을 넣었어요` + (bad ? `, ${bad}장은 열 수 없었어요` : ''));
}
function faceDlg(id) {
  const f = db.faces.find(x => x.id === id); if (!f) return; const k = kidOf(f.kid);
  openDlg(`<form data-form="face" data-id="${id}"><h2>${esc(k.name)} ${dayNo(k, f.date)}일차</h2><label class="f">날짜<input type="date" name="date" required min="${k.birth}" max="${today()}" value="${f.date}"></label><label class="f">설명<textarea name="caption" class="cap1" maxlength="1000" placeholder="이 사진의 이야기를 적어 보세요">${esc(f.caption || '')}</textarea></label><div class="row"><button type="button" class="btn" data-act="faceask" data-d="${f.date}">사진 바꾸기</button><button type="button" class="btn" data-act="sharephoto" data-id="${id}">내보내기</button></div>${acts(['face', id, '사진 지우기'])}</form>`);
}
const photoBlob = id => local ? picBlob(id) : fetch('photos/' + id).then(r => r.ok ? r.blob() : null);

/* ── 성장 영상 ── */
let video = null;
const videoType = () => ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
function videoDlg() {
  const n = facesOf(K()).length;
  if (!videoType() || !HTMLCanvasElement.prototype.captureStream) return toast('이 브라우저에서는 영상을 만들 수 없어요. 최신 사파리나 크롬에서 열어 주세요.');
  openDlg(`<form data-form="video"><h2>${esc(K().name)} 성장 영상</h2><p>사진 ${n}장을 날짜 순서로 이어요.</p><label class="f">빠르기<select name="sec"><option value="0.3">빠르게 (약 ${Math.ceil(n * .3 + 2)}초)</option><option value="0.6" selected>보통 (약 ${Math.ceil(n * .6 + 2)}초)</option><option value="1.2">천천히 (약 ${Math.ceil(n * 1.2 + 2)}초)</option></select></label><p class="sub">영상 길이만큼 시간이 걸려요. 만드는 동안 화면을 켜 두세요. 사진은 밖으로 보내지 않아요.</p><div class="row"><button class="btn main">만들기</button></div></form>`);
}
async function makeVideo(sec) {
  const k = K(), fs = facesOf(k), type = videoType();
  openDlg(`<form data-form="none"><h2>영상을 만드는 중이에요</h2><canvas id="vc" width="720" height="720" style="width:100%;max-width:340px;margin:auto;border-radius:10px"></canvas><progress id="vp" max="1" value="0"></progress><div class="row"><button type="button" class="btn" data-act="close">그만두기</button></div></form>`);
  const c = $('#vc'), g = c.getContext('2d'), job = video = { stop: false }, chunks = [];
  const still = () => !job.stop && document.body.contains(c) && dlg.open;
  const load = async f => { const b = await photoBlob(f.id); return b ? createImageBitmap(b).catch(() => null) : null; };
  const draw = (img, next, a, text) => {
    g.globalAlpha = 1; g.fillStyle = '#33291a'; g.fillRect(0, 0, 720, 720); if (img) g.drawImage(img, 0, 0, 720, 720);
    if (next && a > 0) { g.globalAlpha = a; g.drawImage(next, 0, 0, 720, 720); g.globalAlpha = 1; }
    if (text) { g.font = '700 34px NanumSquareRound,"Apple SD Gothic Neo","Noto Sans KR",sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(51,41,26,.62)'; g.fillRect(0, 648, 720, 72); g.fillStyle = '#fffefa'; g.fillText(text, 360, 696); }
  };
  const title = () => { g.fillStyle = '#faf5ee'; g.fillRect(0, 0, 720, 720); g.fillStyle = '#33291a'; g.textAlign = 'center'; g.font = '800 60px NanumSquareRound,"Apple SD Gothic Neo","Noto Sans KR",sans-serif'; g.fillText(k.name, 360, 350, 640); g.font = '500 30px NanumSquareRound,"Apple SD Gothic Neo","Noto Sans KR",sans-serif'; g.fillText(`${kd(fs[0].date, true)}부터 ${dayNo(k, fs[fs.length - 1].date)}일차까지`, 360, 410, 640); };
  let rec;
  try {
    title();
    const stream = c.captureStream(30);
    rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 4000000 });
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const ended = new Promise(x => { rec.onstop = x; });
    const hide = () => { if (rec.state === 'recording' && document.hidden) rec.pause(); else if (rec.state === 'paused' && !document.hidden) rec.resume(); };
    document.addEventListener('visibilitychange', hide);
    rec.start(1000);
    // 화면이 가려지면 시간이 멈추도록 실제로 지나간 만큼만 센다.
    const hold = (s, paint) => new Promise(done => { let left = s, last = performance.now(); const step = now => { if (!still()) return done(); left -= Math.min(.25, (now - last) / 1000); last = now; paint(Math.max(0, left)); left <= 0 ? done() : requestAnimationFrame(step); }; requestAnimationFrame(step); });
    await hold(1.4, title);
    let cur = await load(fs[0]);
    for (let i = 0; i < fs.length && still(); i++) {
      const next = fs[i + 1] ? await load(fs[i + 1]) : null, fade = Math.min(.25, sec / 2), text = `${dayNo(k, fs[i].date)}일차  ${fs[i].date.replace(/-/g, '.')}`;
      if (cur) await hold(i === fs.length - 1 ? sec + .6 : sec, left => draw(cur, next, next ? 1 - Math.min(1, left / fade) : 0, text));
      if (cur) cur.close(); cur = next || (i === fs.length - 1 ? null : cur); if ($('#vp')) $('#vp').value = (i + 1) / fs.length;
    }
    const ok = still(); rec.stop(); await ended; document.removeEventListener('visibilitychange', hide); stream.getTracks().forEach(t => t.stop());
    if (!ok) return;
    const blob = new Blob(chunks, { type: type.split(';')[0] });
    if (blob.size < 1000) throw new Error('빈 영상');
    readyDlg(blob, `${k.name.replace(/[\\/:*?"<>|]/g, '')}-성장영상-${today()}.${type.includes('mp4') ? 'mp4' : 'webm'}`, '성장 영상이 완성됐어요');
  } catch (e) { console.error(e); if (rec && rec.state !== 'inactive') rec.stop(); if (dlg.open) dlg.close(); toast('영상을 만들지 못했어요. 다시 시도해 주세요.'); }
}

/* ── 내보내기: 공유 창(아이폰은 '파일에 저장'에서 iCloud Drive) 또는 내려받기 ── */
let out = null;
function readyDlg(blob, name, title) {
  if (out && out.url) URL.revokeObjectURL(out.url);
  const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
  out = { blob, name, file, url: blob.type.startsWith('video') ? URL.createObjectURL(blob) : '' };
  const can = navigator.canShare && navigator.canShare({ files: [file] });
  openDlg(`<form data-form="none"><h2>${esc(title)}</h2>${out.url ? `<video src="${out.url}" controls playsinline></video>` : ''}<p class="sub">${esc(name)}, ${(blob.size / 1048576).toFixed(1)}MB${can ? ". 아이폰은 '저장·공유'를 누르고 '파일에 저장'에서 iCloud Drive를 고르면 돼요." : ''}</p><div class="row">${can ? '<button type="button" class="btn main" data-act="outshare">저장·공유</button>' : ''}<button type="button" class="btn ${can ? '' : 'main'}" data-act="outsave">이 기기에 내려받기</button></div></form>`);
}

/* ── 인근 병원 ── */
const hosp = { rows: null, info: null };
let spot = null; // 이번에 켠 동안만 기억하는 내 위치. 밖으로 보내지 않는다.
const PIN = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
async function loadHosp() {
  if (hosp.rows) return;
  const r = await fetch('hospitals.json'); if (!r.ok) throw new Error();
  const j = await r.json(); hosp.rows = j.rows; hosp.info = j;
}
const where = () => new Promise((ok, no) => { if (!navigator.geolocation) return no(new Error('이 기기에서는 위치를 쓸 수 없어요.')); navigator.geolocation.getCurrentPosition(p => ok({ lat: p.coords.latitude, lng: p.coords.longitude }), e => no(new Error(e.code === 1 ? '위치가 허용되지 않았어요. 휴대폰 설정에서 이 브라우저의 위치를 켜 주세요.' : '위치를 찾지 못했어요. 잠시 뒤 다시 눌러 주세요.')), { timeout: 15000, maximumAge: 300000, enableHighAccuracy: true }); });
let nearAt = null, nearOther = false; // 다른 위치를 고르면 이번에 켠 동안만 기억
const nearArea = () => nearAt || { sido: db.sido, sigungu: db.sigungu };
const listHosp = n => { const rows = n < 10 ? hosp.rows.filter(Hospitals.kids) : hosp.rows, a = nearArea(); return spot ? Hospitals.nearest(rows, spot, n) : Hospitals.inRegion(rows, a.sido, a.sigungu).sort((a, b) => Hospitals.kids(b.r) - Hospitals.kids(a.r)).slice(0, n); };
const hospRow = ({ r, km }) => { const i = hosp.rows.indexOf(r); return `<div class="hosp"><span><b>${esc(r[0])}</b><span class="when sub">${km == null ? '' : Hospitals.dist(km) + ', '}${esc(r[5])}${r[6] ? `, 소아청소년과 전문의 ${r[6]}명` : ''}</span><br><span class="sub">${esc(r[1])}</span>${/^[\d-]{7,}$/.test(r[2]) ? `<br><a href="tel:${r[2]}">${r[2]}</a>` : ''}</span><button type="button" class="pin" data-act="map" data-i="${i}" aria-label="${esc(r[0])} 지도에서 보기">${PIN}</button></div>`; };
async function fillNear(box, n) {
  try { await loadHosp(); } catch { if (box.isConnected) box.querySelector('p').textContent = '병원 자료를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'; return; }
  if (!spot && !nearOther) { box.querySelector('p').textContent = '내 위치를 찾는 중이에요'; try { spot = await where(); } catch { nearOther = true; } } // 처음엔 내 위치로
  if (!box.isConnected) return;
  const head = box.querySelector('h2').outerHTML, list = listHosp(n), at = (nearArea().sido + ' ' + nearArea().sigungu).trim();
  box.innerHTML = head + `<p class="sub">${spot ? '지금 위치에서 가까운 순서예요.' : at ? `${esc(at)}에 있는 곳이에요. 내 위치를 켜면 가까운 순서로 볼 수 있어요.` : '내 위치를 켜면 가까운 병원을 찾아드려요.'}</p><div class="row">${spot ? '' : `<button type="button" class="btn main" data-act="nearme" data-n="${n}">내 위치로 찾기</button>`}<button type="button" class="btn" data-act="nearpick" data-n="${n}">다른 위치 선택</button></div>${list.length ? `<div class="list">${list.map(hospRow).join('')}</div>` : spot || at ? '<p class="sub">찾은 병원이 없어요.</p>' : ''}${n < 10 && list.length ? '<button type="button" class="btn" data-act="hospitals">더 보기</button>' : ''}<p class="sub">맞으려는 백신이 있는지, 무료로 맞을 수 있는지는 가기 전에 전화로 확인하세요. 무료 접종 기관은 <a href="https://nip.kdca.go.kr" target="_blank" rel="noopener noreferrer">예방접종도우미</a>에서 볼 수 있어요. 자료: ${esc(hosp.info.source)}, ${hosp.info.asOf.replace(/-/g, '.')}</p>`;
}
function hospDlg() { openDlg('<form data-form="none"><div class="row between"><h2>인근 병원</h2></div><section class="stack" id="near"><h2 style="font-size:15px">소아청소년과와 보건소</h2><p class="sub">불러오는 중</p></section></form>'); fillNear($('#near'), 20); }
// 휴대폰에서는 새 창 없이 네이버지도 앱을 바로 연다. 웹 주소로 열면 돌아왔을 때 빈 창이 남는다.
const android = () => /Android/.test(navigator.userAgent);
const phone = () => /iPhone|iPad|iPod|Android/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
function naverApp(x) {
  const q = `place?lat=${x[3]}&lng=${x[4]}&name=${encodeURIComponent(x[0])}&appname=${encodeURIComponent('https://amerikwano.github.io/baby-calendar/')}`;
  return android() ? `intent://${q}#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;end` : 'nmap://' + q;
}
const naverWeb = (x, cls, label) => `<a class="${cls}" target="_blank" rel="noopener noreferrer" href="https://map.naver.com/p/search/${encodeURIComponent(x[1].split(' ').slice(0, 2).join(' ') + ' ' + x[0])}">${label}</a>`;
document.addEventListener('click', ev => { if (ev.target.closest('[data-naver]')) setTimeout(() => { const n = $('#nonaver'); if (n) n.hidden = false; }, 1500); });
let leaflet = null;
function loadLeaflet() {
  return leaflet || (leaflet = new Promise((ok, no) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; css.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='; css.crossOrigin = '';
    const js = document.createElement('script'); js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; js.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='; js.crossOrigin = '';
    css.onload = () => { js.onload = ok; js.onerror = no; document.head.append(js); }; css.onerror = no; document.head.append(css);
  }).catch(e => { leaflet = null; throw e; }));
}
const mapDlg = $('#mapdlg'); let map = null;
const dropMap = () => { if (map) { map.remove(); map = null; } };
mapDlg.addEventListener('close', () => { if (mapDlg.open) return; dropMap(); mapDlg.innerHTML = ''; }); // 닫자마자 다시 연 창은 비우지 않는다
async function showMap(i) {
  const r = hosp.rows[i]; if (!r) return;
  const card = x => `<b>${esc(x[0])}</b><span class="sub">${esc(x[1])}</span><div class="row">${/^[\d-]{7,}$/.test(x[2]) ? `<a class="btn" href="tel:${x[2]}">전화 ${x[2]}</a>` : ''}${phone() ? `<a class="btn" data-naver="1" href="${esc(naverApp(x))}">네이버지도로 보기</a>` : naverWeb(x, 'btn', '네이버지도로 보기')}</div>${phone() ? `<p class="sub" id="nonaver" hidden>네이버지도 앱이 없어 열리지 않으면 ${naverWeb(x, '', '웹 지도로 보기')}</p>` : ''}`;
  if (mapDlg.open) mapDlg.close(); dropMap();
  mapDlg.innerHTML = `<form data-form="none"><div class="row between"><h2>병원 위치</h2></div><div id="map"></div><div class="stack" id="mapcard">${card(r)}</div></form>`;
  showDlg(mapDlg);
  try { await loadLeaflet(); } catch { if ($('#map')) $('#map').innerHTML = '<p class="empty">지도를 불러오지 못했어요. 아래 네이버지도로 열어 주세요.</p>'; return; }
  if (!$('#map') || !mapDlg.open) return;
  map = L.map('map', { attributionControl: true }).setView([r[3], r[4]], 16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> 기여자' }).addTo(map);
  const icon = c => L.divIcon({ className: '', html: `<div class="mk ${c}"></div>`, iconSize: c === 'me' ? [18, 18] : [30, 30], iconAnchor: c === 'me' ? [9, 9] : [15, 36] });
  const ms = [];
  const near = Hospitals.nearest(hosp.rows, { lat: r[3], lng: r[4] }, 15).map(x => x.r); if (!near.includes(r)) near.push(r);
  near.forEach(x => { const m = L.marker([x[3], x[4]], { icon: icon(x === r ? 'on' : ''), title: x[0], alt: x[0] }).addTo(map); if (x === r) m.setZIndexOffset(1000); ms.push(m); m.on('click', () => { ms.forEach(o => o.setIcon(icon(o === m ? 'on' : ''))); $('#mapcard').innerHTML = card(x); }); });
  if (spot) L.marker([spot.lat, spot.lng], { icon: icon('me'), title: '내 위치', interactive: false }).addTo(map);
}

/* ── 구글 드라이브 ── */
const sentKey = 'baby-drive-sent';
let sent = new Set(); try { sent = new Set(JSON.parse(localStorage.getItem(sentKey) || '[]')); } catch { }
const keepSent = () => { try { localStorage.setItem(sentKey, JSON.stringify([...sent])); } catch { } };
const canDrive = () => Boolean(local && GOOGLE_ID);
const allPhotos = () => db.photos.map(p => Object.assign({ kind: 'album' }, p)).concat(db.faces.map(p => Object.assign({ kind: 'face' }, p)));
const pid = p => p.drive || p.id;
let skip = new Set(); try { skip = new Set(JSON.parse(localStorage.getItem('baby-drive-skip') || '[]')); } catch { } // 드라이브에서 일부러 뺀 사진은 다시 올리지 않는다
const waiting = () => drivePhotos().filter(p => !sent.has(pid(p)) && !skip.has(pid(p)));
let autoUp = false; try { autoUp = localStorage.getItem('baby-drive-auto') === '1'; } catch { }
const autoBox = () => `<label class="ck"><input type="checkbox" id="autoUp" ${autoUp ? 'checked' : ''}>로그인한 동안 새로 넣는 사진도 자동으로 올리기</label>`;
document.addEventListener('change', ev => { if (ev.target.id === 'autoUp') { autoUp = ev.target.checked; try { localStorage.setItem('baby-drive-auto', autoUp ? '1' : '0'); } catch { } } });
const job = { on: false, done: 0, total: 0, stop: false };
// 로그인하지 않은 사람에게 안내한다. 닫으면 일주일 동안 보이지 않는다.
function loginCard() {
  if (!canLogin() || account()) return '';
  try { if (Date.now() - Number(localStorage.getItem('baby-login-later') || 0) < 7 * 86400000) return ''; } catch { }
  const n = allPhotos().length;
  return `<section class="acct"><div><b>${n ? `사진 ${n}장을 안전하게 보관하세요` : '로그인하고 기록을 안전하게 보관하세요'}</b><p class="sub">구글로 로그인하면 기록과 사진을 내 구글 드라이브에 보관해서, 다른 브라우저나 새 휴대폰에서도 이어서 쓸 수 있어요. 로그인하지 않으면 기록은 이 브라우저에만 남아요.</p></div><div class="socs">${socialBtns()}</div><button class="btn" data-act="loginlater">나중에</button></section>`;
}
function driveBar() {
  if (!canDrive()) return '';
  if (!Drive.account()) return account() ? '' : loginCard();
  const n = waiting().length;
  if (job.on) return `<section class="notice"><b id="upn">드라이브에 올리는 중 ${job.done}/${job.total}</b><progress id="upp" max="${job.total}" value="${job.done}"></progress><div class="row"><button class="btn" data-act="upstop">멈추기</button></div></section>`;
  return `<section class="notice"><div class="row between"><b>${n ? `드라이브에 안 올린 사진 ${n}장` : '사진을 모두 드라이브에 올렸어요'}</b><button class="btn" data-act="drive">관리</button></div>${n ? `<div class="row"><button class="btn main" data-act="upload">지금 올리기</button></div>` : ''}</section>`;
}
async function afterLogin(r) {
  if (r.error) { toast(r.error); return; }
  if (!started) { try { await Drive.me(); await syncNow(); } catch (e) { toast(e.message); } ob.step = ''; render(); return; }
  try { await Drive.me(); toast('로그인했어요'); const how = await syncNow().catch(e => { toast(e.message); return ''; }); await syncSent(); render(); if (how === 'ask' || how === 'down' || dlg.open) return; const n = waiting().length; openDlg(`<form data-form="none"><h2>${n ? `사진 ${n}장을 드라이브에 올릴까요?` : '구글 드라이브를 쓸 준비가 됐어요'}</h2><p class="sub">${esc(Drive.account().email)}의 드라이브 '우리 아기 수첩' 폴더에 기록과 사진을 담아요. 나만 볼 수 있어요. 기록은 이미 맞춰 두었어요.</p>${autoBox()}<div class="row">${n ? '<button type="button" class="btn main" data-act="upload">올리기</button>' : ''}${n ? '<button type="button" class="btn" data-act="close">나중에</button>' : ''}</div></form>`); } catch (e) { toast(e.message); render(); }
}
async function syncSent() { const files = await Drive.list(); sent = new Set(files.map(f => f.appProperties && f.appProperties.pid).filter(Boolean)); keepSent(); return files; }
const extOf = b => Media.ext(b.type);
async function uploadAll() {
  if (job.on) return;
  if (!Drive.token()) return Drive.login(GOOGLE_ID);
  Object.assign(job, { on: true, done: 0, total: waiting().length, stop: false, at: Date.now() }); setTimeout(upShow, 1500);
  const paint = () => { upShow(); if ($('#upn')) { $('#upn').textContent = `드라이브에 올리는 중 ${job.done}/${job.total}`; $('#upp').max = job.total; $('#upp').value = job.done; } };
  render(); let bad = 0;
  try {
    await syncSent(); // 다른 기기에서 이미 올린 사진은 건너뛴다
    const list = waiting(); job.total = list.length; paint();
    for (const p of list) {
      if (job.stop) break;
      try {
        const b = await photoBlob(p.id); if (!b) { bad++; continue; }
        const k = kidOf(p.kid);
        await Drive.upload(b, `${p.kind === 'face' ? `얼굴_${dayNo(k, p.date)}일차_` : p.kind === 'profile' ? `프로필_${k.name}_` : ''}${p.date}_${p.id.slice(0, 6)}.${extOf(b)}`, { pid: pid(p), kind: p.kind, kid: p.kid || '', date: p.date });
        sent.add(pid(p)); keepSent(); job.done++; paint();
      } catch (e) { if (e.login || e.full || !e.status) throw e; bad++; }
    }
    toast(job.stop ? '올리기를 멈췄어요' : bad ? `${job.done}장을 올렸고 ${bad}장은 올리지 못했어요` : job.done ? `사진 ${job.done}장을 드라이브에 올렸어요` : '새로 올릴 사진이 없어요');
  } catch (e) { toast(e.message); }
  job.on = false; render(); upShow();
}
// 로그인이 살아 있을 때 새 사진을 바로 올린다.
// 화면 아래 작은 알림: 드라이브나 가족 수첩에 사진을 올리는 중이면 보여 준다.
let upPill = null;
function upShow() {
  if (typeof document === 'undefined') return;
  const fam = typeof famUp !== 'undefined' && famUp.total && Date.now() - (famUp.at || 0) >= 1400 ? famUp : null;
  const slow = job.on && Date.now() - (job.at || 0) >= 1400; // 금방 끝나면 띄우지 않는다
  const t = slow ? `구글 드라이브에 올리는 중 ${job.done}/${job.total}` : fam ? `가족 수첩에 올리는 중 ${fam.done}/${fam.total}` : '';
  if (!upPill) { upPill = document.createElement('div'); upPill.className = 'uppill'; upPill.setAttribute('role', 'status'); document.body.append(upPill); }
  upPill.hidden = !t || !started; upPill.innerHTML = t ? `<i class="spin" aria-hidden="true"></i>${esc(t)}` : '';
}
function autoUpload() { if (autoUp && canDrive() && Drive.account() && Drive.token() && !job.on && !dlg.open) uploadAll(); }
let driveFiles = [];
async function driveDlg() {
  if (!Drive.token()) return Drive.login(GOOGLE_ID);
  const who = Drive.account() || {};
  openDlg('<form data-form="none"><h2>드라이브 사진 관리</h2><p class="sub">불러오는 중</p></form>');
  try { driveFiles = await syncSent(); } catch (e) { if (dlg.open) dlg.close(); return toast(e.message); }
  if (!dlg.open) return;
  const here = new Map(drivePhotos().map(p => [pid(p), p]));
  driveFiles.sort((a, b) => (a.appProperties.date || '') < (b.appProperties.date || '') ? 1 : -1);
  const only = driveFiles.filter(f => !here.has(f.appProperties.pid) && f.appProperties.kind !== 'profile'), n = waiting().length;
  openDlg(`<form data-form="none"><div class="row between"><h2>드라이브 사진 관리</h2></div><p class="sub">${esc(who.email || who.name || '')}, 내 드라이브의 '우리 아기 수첩' 폴더에 ${driveFiles.length}장</p><div class="row">${n ? `<button type="button" class="btn main" data-act="upload">안 올린 ${n}장 올리기</button>` : ''}${only.length ? `<button type="button" class="btn" data-act="pull">드라이브에만 있는 ${only.length}장 가져오기</button>` : ''}</div>${autoBox()}
    ${driveFiles.length ? `<div class="list">${driveFiles.map(f => { const p = here.get(f.appProperties.pid); return `<div class="hosp"><span class="row" style="flex-wrap:nowrap">${p ? `<img ${pic(p.id, 1)} alt="" width="52" height="52" style="object-fit:cover;border-radius:8px;flex:none">` : ''}<span style="min-width:0"><b>${esc(f.name)}</b><span class="sub">${p ? '이 기기에도 있어요' : '드라이브에만 있어요'}${f.size ? `, ${(f.size / 1048576).toFixed(1)}MB` : ''}</span></span></span><button type="button" class="btn danger" data-act="drivedel" data-id="${esc(f.id)}">빼기</button></div>`; }).join('')}</div>` : '<p class="empty">아직 올린 사진이 없어요.</p>'}<p class="sub">빼기를 누르면 구글 드라이브 휴지통으로 옮겨요. 이 기기의 사진은 그대로예요.</p></form>`);
}
async function pull() {
  const here = new Set(drivePhotos().map(pid)), list = driveFiles.filter(f => !here.has(f.appProperties.pid) && f.appProperties.kind !== 'profile'); let n = 0;
  for (const f of list) {
    try {
      const a = f.appProperties, b = await Drive.download(f.id), r = await storeMedia(b);
      const date = isDate(a.date) ? a.date : today(), kid = db.kids.some(k => k.id === a.kid) ? a.kid : '', face = a.kind === 'face' && kid && !db.faces.some(x => x.kid === kid && x.date === date);
      if (await save(d => face ? d.faces.push({ id: r.id, date, kid, drive: a.pid }) : d.photos.push(Object.assign({}, r, { date, caption: '', kid, drive: a.pid })))) n++;
      const s = dlg.querySelector('[data-act=pull]'); if (s) s.textContent = `가져오는 중 ${n}/${list.length}`;
    } catch (e) { if (e.login) { toast(e.message); break; } }
  }
  toast(n === list.length ? `사진 ${n}장을 가져왔어요` : `${list.length}장 중 ${n}장을 가져왔어요`); if (dlg.open) driveDlg();
}

// 위 화면들의 단추. 처리했으면 true.
async function moreActs(act, b, id) {
  const d = b.dataset;
  if (act === 'morekid') { const f = b.form, i = Math.max(...kidRows(f)) + 1, v = readKid(f, 0); $('#kidrows').insertAdjacentHTML('beforeend', kidFields(i, { birth: v.birth, born: v.born }, false, true)); startPreview(f); }
  else if (act === 'dropkid') b.closest('[data-kidbox]').remove();
  else if (act === 'evdone') await save(x => { const e = x.events.find(y => y.id === id); if (e) e.done = !e.done; });
  else if (act === 'evdel') { if (d.sure !== '1') { d.sure = '1'; b.textContent = '지우기'; } else if (await save(x => { x.events = x.events.filter(y => y.id !== id); })) toast('일정을 지웠어요'); }
  else if (act === 'kidedit') isPet(kidOf(id)) ? petDlg(id) : Couple.is(kidOf(id)) ? coupleDlg(id) : Me.is(kidOf(id)) ? meDlg(id) : kidDlg(id);
  else if (act === 'addkid') addKidDlg();
  else if (act === 'addpet') addPetDlg();
  else if (act === 'addcouple') coupleDlg();
  else if (act === 'newcat') newCatDlg();
  else if (act === 'nmap') openNmap(d.q);
  else if (act === 'plan') { planRes = null; planDlgFor(d.n); }
  else if (act === 'planpick') { const keep = planRes; planPickDlg(d.n); planRes = keep; }
  else if (act === 'courseview') courseView(id);
  else if (act === 'cedit') cedOpen(id);
  else if (act === 'cedplace') cedPlaceDlg(Number(d.i));
  else if (act === 'cednoplace') { cedSync(); ced.steps[Number(d.i)][3] = null; cedShow(); }
  else if (act === 'ceddel') { cedSync(); ced.steps.splice(Number(d.i), 1); cedShow(); }
  else if (act === 'cedadd') { cedSync(); const last = ced.steps[ced.steps.length - 1], t = last ? Math.min(23 * 60, Couple.mins(last[0]) + 60) : 720; ced.steps.push([`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`, '새 일정', '', null]); cedShow(); }
  else if (act === 'cedback') cedShow();
  else if (act === 'cedpick') { const st = ced.steps[Number(d.i)]; st[3] = slimP(cedHits[Number(d.k)]); st[2] = ''; cedShow(); }
  else if (act === 'cvcopy') { const e = db.events.find(x => x.id === id); try { await navigator.clipboard.writeText(cvText(e)); toast('코스를 복사했어요'); } catch { toast('복사하지 못했어요'); } }
  else if (act === 'cvcap') { shotMode = d.share ? 'share' : 'save'; { const e = db.events.find(x => x.id === id); courseShot({ title: e.title, sub: kd(e.date) + (e.course.base ? ' · ' + e.course.base + ' 근처' : ''), steps: e.course.steps, file: `${e.date}-데이트코스.png` }); } }
  else if (act === 'plancopy') { const x = Couple.SPOTS.find(y => y.name === d.n); try { const p = Couple.plan(x); await navigator.clipboard.writeText(Couple.planText(x, planRes && planRes.base && dlg.open ? Object.assign({}, p, { steps: withPlaces(p.steps.map(st => [st[0], st[1], st[1].startsWith(x.name) ? x.name : '']), planRes) }) : p)); toast('코스를 복사했어요'); } catch { toast('복사하지 못했어요'); } }
  else if (act === 'plancap') { shotMode = d.share ? 'share' : 'save'; planImage(d.n); }
  else if (act === 'rdc') rdcDlg();
  else if (act === 'rdcroll') { rdcRoll(); rdcShow(); }
  else if (act === 'rdccopy') { try { await navigator.clipboard.writeText(rdcText()); toast('코스를 복사했어요'); } catch { toast('복사하지 못했어요'); } }
  else if (act === 'rdccap') { shotMode = d.share ? 'share' : 'save'; courseShot({ title: rdcTitle(), sub: rdcSub(), days: rdc.days.map((d, i) => ({ head: `${rdc.days.length > 1 ? i + 1 + '일차 · ' : ''}${md(d.date)} · ${wxText(d)}${d.base ? ' · ' + d.base + ' 근처' : ''}`, steps: courseData(d.course, d.res, d.base).steps })), file: `${rdc.date}-데이트코스.png` }); }
  else if (act === 'rdcadd') { if (await save(x => rdc.days.forEach((d, i) => x.events.push({ id: uid(), title: rdc.days.length > 1 ? `데이트 ${i + 1}일차` : '데이트', date: d.date, time: d.course[0] ? d.course[0][0] : d.from, memo: '', course: courseData(d.course, d.res, d.base), kid: K().id })))) { dlg.close(); toast('달력에 넣었어요'); } }
  else if (act === 'grapeok') openDlg(`<form data-form="grape"><h2>정말 성공하셨나요?</h2><p><b>${esc(missionNow(K()))}</b></p><p class="sub">네를 누르면 포도 한 알을 채워요.</p><div class="row"><button class="btn main" value="ok">네</button><button type="button" class="btn" data-act="close">아니요</button></div></form>`);
  else if (act === 'grapenext') await save(x => { const k = x.kids.find(y => y.id === K().id); k.grape = Object.assign(grapeOf(k), { mi: grapeOf(k).mi + 1 }); });
  else if (act === 'grapeown') openDlg(`<form data-form="grapeown"><h2>미션 직접 쓰기</h2><label class="f">미션<input name="m" required maxlength="40" autocomplete="off" placeholder="예: 둘만의 암호 만들기"></label><p class="sub">쓴 미션은 이 수첩을 함께 쓰는 사람만 볼 수 있어요.</p>${acts()}</form>`);
  else if (act === 'mkcat') ({ baby: addKidDlg, pet: addPetDlg, couple: () => coupleDlg(), me: () => meDlg() })[d.c]();
  else if (act === 'addme') meDlg();
  else if (act === 'vethosp') window.open('https://map.kakao.com/?q=' + encodeURIComponent('동물병원'), '_blank', 'noopener');
  else if (act === 'grow') { tab = 'grow'; render(); scrollTo(0, 0); }
  else if (act === 'external') location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.origin + location.pathname);
  else if (act === 'handoffnew') { handoff = ''; render(); }
  else if (act === 'obstep') { ob.step = d.s; render(); scrollTo(0, 0); }
  else if (act === 'obpick') { ob.born = d.b === '1'; ob.step = d.b === 'pet' ? 'pet' : d.b === 'couple' ? 'couple' : d.b === 'me' ? 'me' : 'form'; ob.photo = {}; render(); scrollTo(0, 0); }
  else if (act === 'obphoto') pickAvatar(bl => { ob.photo[d.i] = bl; const s = document.querySelector(`[data-kidbox="${d.i}"] .av`); if (s) s.innerHTML = `<img src="${URL.createObjectURL(bl)}" alt="">`; });
  else if (act === 'avatar') pickAvatar(bl => setAvatar(id, bl));
  else if (act === 'avatardel') { const old = kidOf(id).photo; if (await save(x => { x.kids.find(k => k.id === id).photo = ''; })) { api('/api/photos/' + old, { method: 'DELETE' }).catch(() => { }); kidDlg(id); } }
  else if (act === 'kids') kidsDlg();
  else if (act === 'pickkid') { dlg.close(); if (id !== db.cur) { await save(x => { x.cur = id; }); albView = ''; albYear = ''; syncAI(); } }
  else if (act === 'report') reportDlg(d.d);
  else if (act === 'alerts') alertsDlg();
  else if (act === 'vaxnow') enterSub('vax');
  else if (act === 'growview') growView();
  else if (act === 'gv') growStep(Number(d.n));
  else if (act === 'gvplay') growPlay();
  else if (act === 'pushon') { b.disabled = true; b.textContent = '켜는 중'; try { await pushOn(); toast('알림을 켰어요'); } catch (e) { toast(e.message); } if (dlg.open) alertsDlg(); else render(); }
  else if (act === 'pushoff') { b.disabled = true; await pushOff(); toast('알림을 껐어요'); if (dlg.open) alertsDlg(); }
  else if (act === 'pushtest') { b.disabled = true; try { await Local.setKV('test', Date.now()); const r = await pushCall('/test', { endpoint: push.sub.endpoint }); if (r.status >= 200 && r.status < 300) toast('보냈어요. 잠시 뒤 휴대폰에 알림이 떠요.'); else throw new Error(`알림을 보내지 못했어요 (${r.status}). 껐다가 다시 켜 주세요.`); } catch (e) { toast(e.message); } b.disabled = false; }
  else if (act === 'log') logDlg(d.t);
  else if (act === 'plan') logDlg(d.t, null, true);
  else if (act === 'planlog') planDlg();
  else if (act === 'editlog') { const l = db.logs.find(x => x.id === id); if (l) logDlg(l.type, l); }
  else if (act === 'moredays') { careDays += 7; render(); }
  else if (act === 'albview') { albView = d.v; render(); scrollTo(0, 0); }
  else if (act === 'albyear') { if (dlg.open) dlg.close(); albYear = d.y; albView = Album.months(albPhotos(), d.y)[0] || 'col'; render(); scrollTo(0, 0); }
  else if (act === 'years') yearsDlg();
  else if (act === 'favs') favsDlg();
  else if (act === 'albmenu') albMenu();
  else if (act === 'fav') { if (await save(x => { const p = x.photos.find(y => y.id === id); if (p) p.fav = !p.fav; })) { const on = db.photos.find(y => y.id === id).fav; b.setAttribute('aria-pressed', Boolean(on)); b.querySelector('svg').classList.toggle('fill', Boolean(on)); } }
  else if (act === 'social') Social.begin(AUTH.url, d.p);
  else if (act === 'sharek') shareDlg();
  else if (act === 'sendkakao') sendKakao();
  else if (act === 'sharelink') shareLink();
  else if (act === 'faceask') faceAsk(d.d);
  else if (act === 'faceadd') pickFace(d.d || '', Boolean(d.cam));
  else if (act === 'facebulk') pickFiles({ accept: PHOTO_ONLY, multiple: true, busy: '사진을 준비하고 있어요' }, faceBulk);
  else if (act === 'bulkpick') bulkPick(Number(d.g), Number(d.i));
  else if (act === 'bulksave') bulkSave();
  else if (act === 'face') { const f = db.faces.find(x => x.id === id); if (f) viewPhoto('face', id, () => facesOf(kidOf(f.kid)).reverse()); }
  else if (act === 'vmenu') { const p = vItem(), pl = vVideo(); if (pl) pl.pause(); if (p && vw.kind === 'visit') openDlg(`<form data-form="none"><h2>${kd(p.date, true)}</h2>${p.caption ? `<p>${esc(p.caption)}</p>` : '<p class="sub">설명이 없어요</p>'}</form>`); else if (p) (vw.kind === 'face' ? faceDlg : photoDlg)(p.id); }
  else if (act === 'vtip') vTip($('#vtip').hidden);
  else if (act === 'vgo') vGo(Number(d.n));
  else if (act === 'vplay') vPlay();
  else if (act === 'video') videoDlg();
  else if (act === 'sharephoto') { const p = allPhotos().find(x => x.id === id), bl = await photoBlob(id); if (bl) readyDlg(bl, `${p.date}.${extOf(bl)}`, p.type ? '동영상 내보내기' : '사진 내보내기'); else toast('파일을 찾지 못했어요'); }
  else if (act === 'outshare') navigator.share({ files: [out.file] }).catch(e => { if (e.name !== 'AbortError') toast('공유 창을 열지 못했어요. 내려받기를 눌러 주세요.'); });
  else if (act === 'outsave') saveFile(out.blob, out.name);
  else if (act === 'hospitals') hospDlg();
  else if (act === 'nearpick') { const box = b.closest('section'), a = nearArea(), gus = s => [...new Set(hosp.rows.filter(r => r[1].startsWith(s)).map(r => r[1].split(' ')[1]).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'ko'));
    b.closest('.row').outerHTML = `<div class="two"><label class="f">시·도<select id="nearSido" data-n="${d.n}">${SIDO.map(x => `<option ${x === a.sido ? 'selected' : ''}>${x}</option>`).join('')}</select></label><label class="f">시·군·구<select id="nearGu" data-n="${d.n}"><option value="">전체</option>${gus(a.sido || SIDO[0]).map(x => `<option ${x === a.sigungu ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label></div>`; box.dataset.picking = '1'; }
  else if (act === 'nearme') { nearOther = false; nearAt = null; b.disabled = true; b.textContent = '위치를 찾는 중'; const box = b.closest('section'); try { spot = await where(); } catch (e) { toast(e.message); } if (box.isConnected) fillNear(box, Number(d.n)); }
  else if (act === 'map') showMap(Number(d.i));
  else if (act === 'login') Drive.login(GOOGLE_ID);
  else if (act === 'loginlater') { try { localStorage.setItem('baby-login-later', Date.now()); } catch { } render(); }
  else if (act === 'logout') { Social.logout(); await Drive.logout(); sent = new Set(); keepSent(); setSync(null); dlg.close(); render(); toast('로그아웃했어요. 기록과 사진은 이 기기에 그대로 있어요.'); }
  else if (act === 'upload') { if (dlg.open) dlg.close(); uploadAll(); }
  else if (act === 'upstop') job.stop = true;
  else if (act === 'drive') driveDlg();
  else if (act === 'pull') { b.disabled = true; pull(); }
  else if (act === 'drivedel') {
    if (d.sure !== '1') { d.sure = '1'; b.textContent = '한 번 더'; return true; }
    try { const f = driveFiles.find(x => x.id === id); await Drive.trash(id); if (f) { skip.add(f.appProperties.pid); try { localStorage.setItem('baby-drive-skip', JSON.stringify([...skip])); } catch { } } await driveDlg(); } catch (e) { toast(e.message); }
  } else return false;
  return true;
}

/* ── 동작 ── */
/* ── 뒤로 가기 ──
   다른 화면 안에서 여는 화면(접종·검진, 놀러가기, 놀러 간 집)과 열린 창을 브라우저 기록에 하나씩 쌓는다.
   그래서 화면의 뒤로 단추, 갤럭시의 뒤로 버튼, 아이폰 사파리의 밀어서 뒤로 가기가 모두 같은 일을 한다:
   열린 창을 닫거나, 들어온 화면과 그때 보던 위치로 돌아간다. */
const SUB = ['vax', 'visits', 'visit']; let subFrom = null;
const navStack = []; let navSkip = 0;
function navPush(kind, undo) {
  // 방금 닫힌 창의 기록이 아직 남아 있으면 그 자리를 쓴다(뒤로를 한 번 더 눌러야 하는 일이 없게)
  const top = navStack[navStack.length - 1];
  if (top && top.kind === 'dlg' && !openDlgs().length) { navStack[navStack.length - 1] = { kind, undo }; return; }
  navStack.push({ kind, undo }); history.pushState({ baby: navStack.length }, '');
}
// 기록에서 맨 위의 것들을 조용히 뺀다(창을 단추로 닫았을 때, 아래 메뉴로 다른 곳에 갈 때)
function navDrop(...kinds) { let n = 0; while (navStack.length && kinds.includes(navStack[navStack.length - 1].kind)) { navStack.pop(); n++; } if (n) { navSkip++; history.go(-n); } }
window.addEventListener('popstate', () => {
  if (navSkip) { navSkip--; return; }
  const top = navStack.pop(); if (top) top.undo();
  repaintSoon();
});
// 아이폰은 밀어서 뒤로 간 뒤 위쪽 막대(고정)와 옆으로 미는 줄을 그리지 않고 비워 둘 때가 있다. 화면을 한 번 통째로 다시 그리게 한다.
function repaint() { const h = document.documentElement, y = scrollY; h.style.display = 'none'; void h.offsetHeight; h.style.display = ''; scrollTo(0, y); }
// 밀어서 뒤로 가는 움직임이 끝난 뒤에도 한 번 더, 위쪽 막대와 기록 단추 줄을 새로 만들어 그린다.
function repaintSoon() {
  if (!/iPhone|iPad|iPod/.test(navigator.userAgent)) return;
  requestAnimationFrame(repaint); setTimeout(repaint, 450);
  setTimeout(() => { if (!ready || !started || join || dlg.open) return; const y = scrollY; $('#top').innerHTML = topBar(); const q = document.querySelector('#main .quick'); if (q && typeof quickRow === 'function') q.outerHTML = quickRow(K()); repaint(); scrollTo(0, y); }, 900);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) repaintSoon(); });
// 화면의 뒤로 단추
function navBack(fallback) { if (navStack.length && navStack[navStack.length - 1].kind === 'sub') history.back(); else fallback(); }
// 창(사진 보기 포함)이 열리면 기록에 하나, 다 닫히면 뺀다.
const openDlgs = () => [...document.querySelectorAll('dialog[open]')].filter(d => d.id !== 'busy');
if (typeof HTMLDialogElement !== 'undefined') {
  const show = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function () {
    show.call(this); if (this.id === 'busy') return;
    if (!this.navHooked) { this.navHooked = true; this.addEventListener('close', () => setTimeout(() => { if (!openDlgs().length) navDrop('dlg'); }, 0)); }
    if (!navStack.length || navStack[navStack.length - 1].kind !== 'dlg') navPush('dlg', navDlgBack);
  };
}
function navDlgBack() { const d = openDlgs().pop(); if (!d) return; d.close(); setTimeout(() => { if (openDlgs().length) navPush('dlg', navDlgBack); }, 0); }
function enterSub(t, then) {
  const from = { tab, y: scrollY, vis };
  if (!SUB.includes(tab)) subFrom = from;
  navPush('sub', () => { if (dlg.open) dlg.close(); vis = from.vis; tab = from.tab; if (!SUB.includes(tab)) subFrom = null; if (tab === 'visit' && vis) render(); else render(); scrollTo(0, from.y); });
  tab = t; if (then) then(); else { render(); scrollTo(0, 0); }
}
function goTab(t, back) {
  if (back && navStack.length && navStack[navStack.length - 1].kind === 'sub') return history.back();
  if (SUB.includes(t) && !SUB.includes(tab)) { if (dlg.open) dlg.close(); return enterSub(t); }
  // 아래 메뉴로 다른 곳에 가면 열린 창과 쌓아 둔 하위 화면은 버린다
  openDlgs().forEach(d => d.close()); navDrop('dlg', 'sub');
  const y = back && subFrom && subFrom.tab === t ? subFrom.y : 0; if (!SUB.includes(t)) subFrom = null;
  tab = t; syncAI(); render(); scrollTo(0, y);
}
document.addEventListener('click', async ev => {
  const nt = ev.target.closest('[data-tab]');
  if (nt && ready && started) { goTab(nt.dataset.tab, Boolean(nt.dataset.back)); return; }
  const b = ev.target.closest('[data-act]'); if (!b || !ready) return;
  const { act, id } = b.dataset;
  if (act === 'close') (b.closest('dialog') || dlg).close();
  else if (await moreActs(act, b, id)) return;
  else if (await famActs(act, b)) return;
  else if (await syncActs(act)) return;
  else if (act === 'settings') settingsDlg();
  else if (act === 'born') bornDlg();
  else if (act === 'locate') locate();
  else if (act === 'region') regionDlg();
  else if (act === 'reload') { regionData.err = ''; regionData.key = ''; render(); }
  else if (act === 'rename') openDlg(`<form data-form="rename"><h2>이름 바꾸기</h2><label class="f">태명이나 이름<input name="name" id="rName" required maxlength="20" autocomplete="off" value="${esc(K().name)}"></label>${acts()}</form>`);
  else if (act === 'due') openDlg(`<form data-form="due"><h2>출산 예정일 바꾸기</h2><div class="two"><label class="f">출산 예정일<input type="date" name="birth" required value="${K().birth}"></label><label class="f">예정 시각 (선택)<input type="time" name="time" value="${K().time || ''}"></label></div>${acts()}</form>`);
  else if (act === 'item') itemDlg(id, b.dataset.kid);
  else if (act === 'event') eventDlg(id);
  else if (act === 'write') writeDlg(id);
  else if (act === 'photo') {
    const fav = b.closest('[data-favs]'), all = fav ? () => albPhotos().filter(p => p.fav) : albPhotos;
    viewPhoto('photo', id, all().some(p => p.id === id) ? all : () => db.photos.filter(p => p.id === id));
  }
  else if (act === 'donetoday') { dlg.querySelector('[name=done]').value = today(); markBlank(); }
  else if (act === 'day') { sel = b.dataset.d; render(); }
  else if (act === 'mon') { month = S.addMonths(month + '-01', Number(b.dataset.n)).slice(0, 7); sel = month === today().slice(0, 7) ? today() : month + '-01'; render(); }
  else if (act === 'ai') runAI(b.dataset.k, Boolean(aiData[b.dataset.k]));
  else if (act === 'ics') await download();
  else if (act === 'backup') { try { readyDlg(await Local.backup(), `우리수첩-백업-${today()}.zip`, '백업 파일을 만들었어요'); } catch (e) { toast(e.message); } }
  else if (act === 'restore') {
    if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = '지금 내용을 지우고 되돌리기'; return; }
    pickFiles({ accept: '.zip,application/zip' }, async ([zip]) => { try { await Local.restore(zip); await load(); dlg.close(); toast('백업을 되돌렸어요'); } catch (e) { toast(e.message || '되돌리지 못했어요'); } });
  }
  else if (act === 'addphotos') addDlg();
  else if (act === 'albcam') { if (dlg.open) dlg.close(); pickFiles({ capture: 'environment', busy: '사진을 저장하는 중이에요' }, fs => upload(fs, today())); }
  else if (act === 'albvid') { if (dlg.open) dlg.close(); pickFiles({ accept: 'video/*', capture: 'environment', busy: '동영상을 저장하는 중이에요' }, fs => upload(fs, today())); }
  else if (act === 'albpick') { if (dlg.open) dlg.close(); pickFiles({ accept: 'image/*,video/*', multiple: true, busy: '사진·동영상을 저장하는 중이에요' }, fs => upload(fs)); }
  else if (act === 'undraft') { draft = draft.filter(x => x !== id); $('#dgrid').innerHTML = draftGrid(); }
  else if (act === 'adddue') { const k = b.dataset; if (await save(d => d.events.push({ id: uid(), title: k.title, date: k.date, time: '', memo: '혜택 신청 마감일', from: k.key, kid: K().id }))) toast('달력에 추가했어요'); }
  else if (act === 'del') {
    if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = '한 번 더 누르면 지워요'; return; }
    const k = b.dataset.k;
    if (k === 'event' && await save(d => { d.events = d.events.filter(x => x.id !== id); })) dlg.close();
    if (k === 'diary' && await save(d => { d.diary = d.diary.filter(x => x.id !== id); })) { dlg.close(); toast('일기를 지웠어요. 사진은 사진첩에 남아 있어요.'); }
    if (k === 'kid') { const av = kidOf(id).photo; if (!await save(d => { Family.removeKid(d, id); Family.rank(d.kids); })) return; if (av) api('/api/photos/' + av, { method: 'DELETE' }).catch(() => { }); dlg.close(); toast('수첩을 뺐어요. 일기와 사진은 남아 있어요.'); }
    if (k === 'log' && await save(d => { d.logs = d.logs.filter(x => x.id !== id); })) { dlg.close(); toast('기록을 지웠어요'); }
    if (k === 'face' && await save(d => { d.faces = d.faces.filter(x => x.id !== id); })) { await api('/api/photos/' + id, { method: 'DELETE' }).catch(() => { }); dlg.close(); toast('사진을 지웠어요'); }
    if (k === 'photo' && await save(d => { d.photos = d.photos.filter(x => x.id !== id); d.diary.forEach(x => x.photos = x.photos.filter(y => y !== id)); })) { await api('/api/photos/' + id, { method: 'DELETE' }).catch(() => { }); dlg.close(); toast('지웠어요'); }
  }
});
document.addEventListener('change', ev => { const f = ev.target.form; if (f && f.dataset.form === 'kid' && ev.target.name === 'born') syncSex(f, ev.target.checked); });
document.addEventListener('change', async ev => {
  if (ev.target.id !== 'dfile') return;
  const form = ev.target.form, files = [...ev.target.files], ok = form.querySelector('[value=ok]');
  ok.disabled = true;
  const added = await upload(files, form.elements.date.value || today());
  ok.disabled = false; ev.target.value = '';
  draft.push(...added.map(p => p.id)); if ($('#dgrid')) $('#dgrid').innerHTML = draftGrid();
});
document.addEventListener('submit', async ev => {
  ev.preventDefault();
  const f = ev.target, v = Object.fromEntries(new FormData(f)), id = f.dataset.id, kind = f.dataset.form;
  if (await famForms(f)) return;
  let ok = false;
  if (kind === 'item') ok = await save(d => { const r = (d.kids.find(k => k.id === f.dataset.kid) || d.kids[0]).records; if (v.appt || v.done) r[id] = { appt: v.appt || null, done: v.done || null }; else delete r[id]; });
  if (kind === 'event') ok = await save(d => { const e = d.events.find(x => x.id === id), n = { title: v.title.trim(), date: v.date, time: v.time, memo: v.memo, rem: new FormData(f).getAll('rem'), kid: v.kid != null ? v.kid : e ? e.kid : K().id }; if (e) Object.assign(e, n); else d.events.push(Object.assign({ id: uid() }, n)); });
  if (kind === 'diary') {
    if (!v.body.trim() && !draft.length) return toast('내용을 쓰거나 사진을 넣어 주세요');
    ok = await save(d => { const e = d.diary.find(x => x.id === id), n = { date: v.date, body: v.body.trim(), priv: Boolean(v.priv), photos: [...draft], kid: v.kid != null ? v.kid : e ? e.kid : K().id }; if (e) Object.assign(e, n); else d.diary.push(Object.assign({ id: uid() }, n)); d.photos.forEach(p => { if (draft.includes(p.id)) { p.date = v.date; if (v.kid != null) p.kid = v.kid; if (v.priv) p.priv = true; } }); });
  }
  if (kind === 'photo') ok = await save(d => Object.assign(d.photos.find(x => x.id === id), { date: v.date, caption: v.caption.trim(), priv: Boolean(v.priv) }, v.kid != null ? { kid: v.kid } : {}));
  if (kind === 'due') {
    const bad = dateProblem(v.birth, false); if (bad) return toast(bad);
    ok = await save(d => Object.assign(d.kids.find(k => k.id === K().id), { birth: v.birth, time: v.time }));
  }
  if (kind === 'start' || kind === 'addkid') {
    const { bad, list } = readKids(f); if (bad) return toast(bad);
    if (kind === 'start') {
      const ids = []; try { for (const x of list) ids.push(ob.photo[x.row] ? await saveAvatarBlob(ob.photo[x.row]) : ''); } catch (e) { return toast(e.message); }
      started = true;
      ok = await save(d => { d.kids = list.map((x, i) => Family.newKid('k' + (i + 1), { name: blankName(list, x, i), born: x.born, birth: x.birth, time: x.time, sex: x.sex, since: today(), photo: ids[i], options: Object.assign({}, S.DEFAULT_OPTIONS) })); d.cur = 'k1'; Family.rank(d.kids); });
      if (!ok) { started = false; render(); return; }
      tab = 'home'; scrollTo(0, 0); await showSplash(`${db.kids[0].name} 수첩을 준비하고 있어요`, db.kids[0].photo);
      setTimeout(askLocationOnce, 300);
    } else {
      const nid = uid();
      ok = await save(d => { d.kids.push(Family.newKid(nid, Object.assign({}, { born: list[0].born, birth: list[0].birth, time: list[0].time, sex: list[0].sex, since: today() }, { name: list[0].name || '아기 ' + (d.kids.length + 1), options: Object.assign({}, S.DEFAULT_OPTIONS) }))); d.cur = nid; Family.rank(d.kids); });
    }
  }
  if (['mestart', 'addme', 'me'].includes(kind)) {
    if (!isDate(v.birth) || v.birth > today()) return toast('생일을 확인해 주세요.');
    if (!Family.SEX[v.sex]) { flagSex(sexBoxOf(f, 'sex')); return toast('성별을 골라 주세요.'); }
    const p = { kind: 'me', name: (v.name || '').trim() || '나', birth: v.birth, sex: v.sex, solo: v.solo === '1', born: true, time: '' };
    if (kind === 'me') ok = await save(d => Object.assign(d.kids.find(x => x.id === id), p));
    else {
      if (kind === 'addme' && db.kids.some(Me.is)) return toast('개인 수첩은 하나만 만들 수 있어요.');
      const nid = kind === 'mestart' ? 'k1' : uid(), kid = Family.newKid(nid, Object.assign(p, { since: today() }));
      if (kind === 'mestart') { started = true; ok = await save(d => { d.kids = [kid]; d.cur = nid; }); if (!ok) { started = false; render(); return; } tab = 'home'; scrollTo(0, 0); await showSplash(`${kid.name} 수첩을 준비하고 있어요`); }
      else ok = await save(d => { d.kids.push(kid); d.cur = nid; });
    }
    if (ok && p.solo && ['album', 'grow'].includes(tab)) tab = 'home';
  }
  if (['couplestart', 'addcouple', 'couple'].includes(kind)) {
    if (!isDate(v.birth) || v.birth > today()) return toast('사귄 날을 확인해 주세요.');
    const p = { kind: 'couple', name: (v.name || '').trim() || '우리 둘', birth: v.birth, born: true, sex: '', time: '' };
    if (kind === 'couple') ok = await save(d => Object.assign(d.kids.find(x => x.id === id), p));
    else {
      if (kind === 'addcouple' && db.kids.some(Couple.is)) return toast('연애 수첩은 하나만 만들 수 있어요.');
      const nid = kind === 'couplestart' ? 'k1' : uid(), kid = Family.newKid(nid, Object.assign(p, { since: today() }));
      if (kind === 'couplestart') { started = true; ok = await save(d => { d.kids = [kid]; d.cur = nid; }); if (!ok) { started = false; render(); return; } tab = 'home'; scrollTo(0, 0); await showSplash(`${kid.name} 수첩을 준비하고 있어요`); }
      else ok = await save(d => { d.kids.push(kid); d.cur = nid; });
    }
  }
  if (['petstart', 'addpet', 'pet'].includes(kind)) {
    const bad = petDateProblem(v.birth); if (bad) return toast(bad);
    const p = { kind: v.kind, name: (v.name || '').trim(), birth: v.birth, sex: v.sex || '', born: true, time: '' };
    if (kind === 'pet') ok = await save(d => { const k = d.kids.find(x => x.id === id); Object.assign(k, p, { name: p.name || k.name }); });
    else {
      let photo = ''; if (kind === 'petstart' && ob.photo[0]) try { photo = await saveAvatarBlob(ob.photo[0]); } catch (e) { return toast(e.message); }
      const nid = kind === 'petstart' ? 'k1' : uid(), kid = Family.newKid(nid, Object.assign(p, { name: p.name || Pet.KINDS[p.kind], since: today(), photo }));
      if (kind === 'petstart') {
        started = true; ok = await save(d => { d.kids = [kid]; d.cur = nid; });
        if (!ok) { started = false; render(); return; }
        tab = 'home'; scrollTo(0, 0); await showSplash(`${kid.name} 수첩을 준비하고 있어요`, photo);
      } else ok = await save(d => { d.kids.push(kid); d.cur = nid; });
    }
  }
  if (kind === 'grape') {
    const m = missionNow(K()); let full = false;
    ok = await save(x => { const k = x.kids.find(y => y.id === K().id), g = grapeOf(k); g.n++; g.mi++; g.log = (g.log || []).concat({ d: today(), m }).slice(-200); full = g.n % GRAPE_N === 0; k.grape = g; });
    if (ok) { dlg.close(); render(); return toast(full ? '포도송이 하나를 다 채웠어요! 축하해요' : '포도 한 알을 채웠어요'); }
  }
  if (kind === 'grapeown') {
    const m = (v.m || '').trim(); if (!m) return;
    ok = await save(x => { const k = x.kids.find(y => y.id === K().id), g = grapeOf(k); g.custom = [m].concat(g.custom || []).slice(0, 30); g.mi = 0; k.grape = g; });
  }
  if (kind === 'rdc') { const ok2 = f.querySelector('.btn.main'); if (!Number(v.nights) && v.to <= v.from) return toast('끝 시간이 시작보다 늦어야 해요'); ok2.disabled = true; ok2.textContent = '날씨를 보고 있어요'; rdcSetup(v); await rdcWeather(); rdcRoll(); rdcShow(); return; }
  if (kind === 'cedit') return cedSave();
  if (kind === 'cedsearch') return cedSearch(Number(f.dataset.i), v.q);
  if (kind === 'planpick') {
    const n = f.dataset.n, x = Couple.SPOTS.find(y => y.name === n), p = Couple.plan(x), steps = p.steps.map(st => [st[0], st[1], st[1].startsWith(n) ? n : '']);
    if (await save(dd => dd.events.push({ id: uid(), title: `${n} 데이트`, date: v.date, time: steps[0][0], memo: '', course: courseData(steps, planRes, n), kid: K().id }))) { dlg.close(); toast('달력에 넣었어요. 그날 달력과 홈에서 코스를 볼 수 있어요'); render(); }
    return;
  }
  if (kind === 'none') return;
  if (kind === 'quick') { if (!v.title.trim()) return toast('일정을 적어 주세요'); if (await save(d => d.events.push({ id: uid(), title: v.title.trim(), date: sel, time: '', memo: '', kid: '' }))) toast(push.state === 'ask' && PUSH_URL ? '추가했어요. 종 모양에서 알림을 켜면 휴대폰으로 알려드려요.' : '일정을 추가했어요'); return; }
  if (kind === 'crop') { const ok = f.querySelector('[value=ok]'); ok.disabled = true; await saveFace(v.date); ok.disabled = false; return; }
  if (kind === 'avatar') { const bl = await new Promise(x => $('#cropc').toBlob(x, 'image/jpeg', .9)), fn = crop.done; dlg.close(); if (bl) fn(bl); return; }
  if (kind === 'log') ok = await saveLog(f, v);
  if (kind === 'video') return makeVideo(Number(v.sec));
  if (kind === 'region') { ok = await save(d => { d.sido = v.sido; d.sigungu = v.sigungu || ''; }); if (ok) { tab = 'money'; scrollTo(0, 0); } }
  if (kind === 'rename') { if (!v.name.trim()) return toast('이름을 적어 주세요'); ok = await save(d => { d.kids.find(k => k.id === K().id).name = v.name.trim(); }); }
  if (kind === 'born') {
    const tw = new FormData(f).getAll('twin');
    const miss = Family.sexProblem(v.sex, true) ? 'sex' : tw.map(x => 'ts_' + x).find(n => Family.sexProblem(v[n], true));
    if (miss) { flagSex(sexBoxOf(f, miss)); return toast('성별을 골라 주세요.'); }
    ok = await save(d => { Object.assign(d.kids.find(k => k.id === K().id), { birth: v.birth, time: v.time, born: true, sex: v.sex, name: v.name.trim() || K().name }); tw.forEach(x => { const k = d.kids.find(y => y.id === x); Object.assign(k, { birth: v.birth, time: v['tt_' + x], born: true, sex: v['ts_' + x], name: v['tn_' + x].trim() || k.name }); }); Family.rank(d.kids); });
  }
  if (kind === 'kid') {
    if (Family.sexProblem(v.sex, Boolean(v.born))) flagSex(sexBoxOf(f, 'sex'));
    const bad = Family.sexProblem(v.sex, Boolean(v.born)) || dateProblem(v.birth, Boolean(v.born)); if (bad) return toast(bad);
    ok = await save(d => { const k = d.kids.find(x => x.id === id); Object.assign(k, { name: v.name.trim() || k.name, birth: v.birth, time: v.time, sex: v.sex || '', born: Boolean(v.born), order: Number(v.order), options: { combo: v.combo, rota: v.rota, je: v.je } }); });
  }
  if (kind === 'face') { ok = await save(d => { const x = d.faces.find(y => y.id === id); if (d.faces.some(y => y.id !== id && y.kid === x.kid && y.date === v.date)) { v.dup = 1; return; } x.date = v.date; x.caption = v.caption.trim(); }); if (v.dup) return toast('그 날짜에는 이미 사진이 있어요'); }
  if (kind === 'settings') {
    if (local && v.aiCode != null) saveAI(v.aiCode.trim());
    ok = await save(d => Object.assign(d, { leads: new FormData(f).getAll('lead').map(Number), hour: Number(v.hour) }));
  }
  if (ok) { dlg.close(); toast(kind === 'event' && push.state === 'ask' && PUSH_URL ? '저장했어요. 종 모양에서 알림을 켜면 휴대폰으로 알려드려요.' : '저장했어요'); syncAI(); render(); }
});
async function download() {
  if (!await save(d => { d.exports++; })) return;
  const one = many() ? '' : K().name, list = catKids().flatMap(k => items(k).map(i => Object.assign(i, { who: k.name, uid: (k.id === 'k1' ? '' : k.id + '-') + i.id })));
  const { text, count } = S.toICS(list, { name: one || '우리 수첩', today: today(), leads: db.leads, hour: db.hour, sequence: db.exports, events: db.events.filter(e => e.date >= today()).map(e => many() && e.kid ? Object.assign({}, e, { title: kidOf(e.kid).name + ' ' + e.title }) : e), stamp: new Date().toISOString().replace(/[-:]|\.\d+/g, '') });
  saveFile(new Blob([text], { type: 'text/calendar' }), (one || '우리수첩').replace(/[\\/:*?"<>|]/g, '') + '-일정.ics');
  toast(`일정 ${count}개를 담았어요`);
}
function saveFile(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); }
async function load() { const s = await api('/api/state'); rev = s.rev; db = Object.assign(fresh(), Family.migrate(s.data) || {}); ready = true; started = Boolean(s.data); const r = Regions.find(db.sido); if (db.sido && r) db.sido = r.name; render();
  // 예전에 등록한 아이는 이 기능을 처음 켠 날부터 알린다.
  if (started && db.kids.some(k => !k.since)) await save(d => d.kids.forEach(k => { if (!k.since) k.since = today(); }));
}
(async () => {
  try {
    // 내 컴퓨터에서 npm start로 켰을 때만 서버가 있다.
    local = !(['localhost', '127.0.0.1'].includes(location.hostname) && await fetch('/api/status').then(r => r.ok && (r.headers.get('content-type') || '').includes('json')).catch(() => false));
    ai = local ? Boolean(aiBase() && conf.code) : (await api('/api/status')).ai;
    let soc = local ? Social.finish() : null, back = local && GOOGLE_ID && !soc ? Drive.finish() : null;
    if (soc && soc.handoff || back && back.handoff) handoff = soc ? 'social' : 'google';
    await load();
    if (handoff) { if (started) { toast((soc || back).error); handoff = ''; } soc = soc || {}; back = null; }
    else if (soc) { toast(soc.error || `${Social.NAME[soc.acct.provider]}로 로그인했어요`); }
    if (back) afterLogin(back); else if (!soc && !location.search.includes('alerts')) setTimeout(askLocationOnce, 1500);
    if (started && K().photo) { const u = local ? await Local.photoUrl(K().photo, true).catch(() => '') : `photos/${K().photo}/thumb`; if (u) $('#splashFace').innerHTML = `<img src="${u}" alt="">`; }
    if (local && !back && Drive.token() && Drive.account()) syncNow().catch(() => { });
    if (local && !back && Drive.token() && !Drive.account()) Drive.me().then(() => { if (!dlg.open) { if (!started) ob.step = ''; render(); } }).catch(() => { });
    // 갤럭시 카카오톡 안에서 초대 링크를 열면 휴대폰으로 넘긴다. 앱을 설치했으면 앱이, 없으면 크롬이 연다.
    if (local && IN_APP === 'kakao' && /Android/i.test(navigator.userAgent) && /[?&](join|talk)=/.test(location.search) && !sessionStorage.getItem('baby-ext')) { sessionStorage.setItem('baby-ext', '1'); location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href); }
    if (local && await joinCheck()) render();
    if (local && bound && started) famPull();
    if (local) { waitPoll(); famRestore(); famCredsSave(); } // 카카오로 로그인해 둔 사람은 들어가 있는 가족 수첩과 놀러 갈 집을 다시 맞춘다 // 새 기기에서 로그인하면 들어가 있던 가족 수첩을 다시 연다
    hideSplash(); if (local) { checkAuth(); if (!soc) resumeSocial(); }
    const bell = new URLSearchParams(location.search).has('alerts'), talkId = new URLSearchParams(location.search).get('talk'); if (bell || talkId) history.replaceState(null, '', location.pathname);
    if (talkId && local) setTimeout(() => talkOpen(talkId), 500);
    if (bell && started) setTimeout(alertsDlg, 1500);
    if (local && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    if (local && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').then(pushInit).catch(() => {});
  } catch (e) { hideSplash(0); $('#main').innerHTML = `<div class="notice hot"><b>수첩을 열지 못했어요</b><p>${esc(e.message)}</p></div>`; }
})();
// 아래로 내리면 아래 메뉴를 숨기고, 위로 올리면 다시 보인다. 많이 내려가면 '맨 위로' 단추가 생긴다.
(() => {
  let last = scrollY;
  const top = $('#totop'), cls = document.body.classList;
  const tick = () => {
    const y = Math.max(0, scrollY), nav = $('nav'), end = y + innerHeight >= document.documentElement.scrollHeight - 4;
    if (y < 60 || end || nav.hidden) { cls.remove('navhide'); last = y; }
    else if (Math.abs(y - last) > 8) { cls.toggle('navhide', y > last); last = y; }
    top.hidden = nav.hidden || y < innerHeight * 0.8;
  };
  addEventListener('scroll', tick, { passive: true });
  addEventListener('resize', tick, { passive: true });
  // 브라우저의 부드러운 스크롤은 화면 모양이 바뀌면 중간에 멈추므로 직접 움직인다
  top.addEventListener('click', () => {
    const y0 = scrollY, t0 = performance.now(), ms = matchMedia('(prefers-reduced-motion:reduce)').matches ? 0 : Math.min(500, 200 + y0 / 8);
    const step = t => { const p = ms ? Math.min(1, (t - t0) / ms) : 1; scrollTo(0, Math.round(y0 * (1 - (1 - Math.pow(1 - p, 3))))); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
})();
