/* 전체 화면 사진 보기: 좌우로 넘기기, ⋯ 정보 창, 아래쪽 설명 */
'use strict';
let vw = null; // { kind, list(), id, i, slides, urls }
const viewer = document.querySelector('#viewer');
// 시계가 있는 맨 윗줄도 사진 바탕과 같은 색으로
const vTheme = c => { const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = c; };
const vItem = () => vw && vw.items[vw.i];
function viewPhoto(kind, id, list) {
  vw = { kind, list, id, i: 0, items: [], slides: [], urls: new Map(), busy: false };
  viewer.innerHTML = `<div class="vstage">${'<div class="vs"><img alt="" draggable="false"></div>'.repeat(3)}</div><div class="vtop"><span id="vcount" aria-live="polite"></span><button type="button" data-act="vmenu" aria-label="사진 정보">${icon('dots')}</button><button type="button" data-act="close" aria-label="닫기">${icon('x')}</button></div><button type="button" class="vnav l" data-act="vgo" data-n="-1" aria-label="이전 사진">${icon('left')}</button><button type="button" class="vnav r" data-act="vgo" data-n="1" aria-label="다음 사진">${icon('right')}</button><div class="vbar" id="vbar" hidden><button type="button" data-act="vplay" id="vpb" aria-label="재생">${icon('vplay')}</button><input type="range" id="vrange" min="0" max="1000" value="0" aria-label="재생 위치"><span id="vtime"></span></div><div class="vtip" id="vtip" role="status" hidden></div><button type="button" class="vcap" id="vcap" data-act="vtip" aria-expanded="false" hidden>${icon('memo', 's')}설명</button>`;
  vw.slides = [...viewer.querySelectorAll('.vs')];
  vSwipe(viewer.querySelector('.vstage'));
  $('#vrange').addEventListener('input', e => { const v = vVideo(); if (v && v.duration) v.currentTime = v.duration * e.target.value / 1000; });
  if (!viewRefresh()) return;
  viewer.className = viewer.classList.contains('isvid') ? 'isvid' : ''; viewer.style.background = ''; vTheme('#120d0b'); viewer.tabIndex = -1; viewer.showModal(); viewer.focus({ preventScroll: true });
}
// 저장하거나 지운 뒤에도 같은 자리를 보여 준다. 남은 사진이 없으면 닫는다.
function viewRefresh() {
  vw.items = vw.list(); let i = vw.items.findIndex(p => p.id === vw.id);
  if (i < 0) i = Math.min(vw.i, vw.items.length - 1);
  if (i < 0) { if (viewer.open) viewer.close(); else vw = null; return false; }
  vw.i = i; vw.id = vw.items[i].id; vPaint(); return true;
}
function vPlace(dx, anim) { vw.slides.forEach((s, k) => { s.style.transition = anim ? 'transform .22s ease-out' : 'none'; s.style.transform = `translateX(calc(${(k - 1) * 100}% + ${dx}px))`; }); }
async function vLoad(slide, p) {
  const img = slide.firstElementChild, id = p ? p.id : '';
  if (slide.dataset.id === id) return;
  const was = slide.querySelector('video'); if (was) { was.pause(); was.removeAttribute('src'); was.load(); was.remove(); }
  slide.dataset.id = id; img.hidden = false; img.removeAttribute('src'); img.alt = p ? p.caption || kd(p.date) + ' 사진' : ''; if (!p) return;
  const now = vw, mine = () => vw === now && slide.dataset.id === id;
  const small = local ? await Local.photoUrl(id, true).catch(() => '') : `photos/${id}/thumb`;
  if (mine() && small) img.src = small; // 작은 사진을 먼저 보이고 원본으로 바꾼다
  // 동영상은 주소만 준비해 두고 재생을 누르면 튼다(아이폰은 누른 순간에 시작해야 한다)
  if (p.type) { if (!now.urls.get(id)) { const b = await photoBlob(id).catch(() => null); if (b && mine() && !now.urls.get(id)) now.urls.set(id, URL.createObjectURL(b)); } return; }
  let full = now.urls.get(id);
  if (!full) { const b = await photoBlob(id).catch(() => null); if (!mine() || !b) return; full = URL.createObjectURL(b); now.urls.set(id, full); }
  const pre = new Image(); pre.src = full; try { await pre.decode(); } catch { return; }
  if (mine()) img.src = full;
}
function vPaint() {
  vPlace(0); [-1, 0, 1].forEach(d => vLoad(vw.slides[d + 1], vw.items[vw.i + d]));
  const keep = new Set([-1, 0, 1].map(d => (vw.items[vw.i + d] || {}).id)); vw.urls.forEach((u, id) => { if (!keep.has(id)) { URL.revokeObjectURL(u); vw.urls.delete(id); } });
  const p = vItem(), n = vw.items.length;
  $('#vcount').textContent = n > 1 ? `${vw.i + 1} / ${n}` : '';
  viewer.querySelector('.vnav.l').hidden = vw.i === 0; viewer.querySelector('.vnav.r').hidden = vw.i === n - 1;
  $('#vbar').hidden = !p.type; viewer.classList.toggle('isvid', Boolean(p.type)); if (p.type) vBar();
  $('#vcap').hidden = !(p.caption || '').trim();
  if ($('#vcap').hidden) vTip(false); else if (!$('#vtip').hidden) vTip(true);
}
function vTip(on) {
  const t = $('#vtip'), p = vItem(), k = kidOf(p.kid);
  if (on) t.innerHTML = `<b>${kd(p.date, true)}</b><em>${vw.kind === 'face' ? `${esc(k.name)} ${dayNo(k, p.date)}일차` : esc(stageOf(p.date, k))}</em><p>${esc(p.caption)}</p>`;
  t.hidden = !on; $('#vcap').setAttribute('aria-expanded', String(on));
}
function vGo(n) {
  const to = vw.i + n; if (vw.busy || to < 0 || to >= vw.items.length) { vPlace(0, true); return; }
  const pl = vVideo(); if (pl) pl.pause();
  const now = vw, calm = matchMedia('(prefers-reduced-motion:reduce)').matches; vw.busy = true; vTip(false);
  vPlace(-n * viewer.clientWidth, !calm);
  setTimeout(() => {
    if (vw !== now) return;
    vw.busy = false; vw.i = to; vw.id = vw.items[to].id;
    // 옆에 있던 칸을 그대로 쓰면 넘길 때 깜빡이지 않는다
    if (n > 0) vw.slides.push(vw.slides.shift()); else vw.slides.unshift(vw.slides.pop());
    vPaint();
  }, calm ? 0 : 230);
}
const vVideo = () => vw && vw.slides[1] && vw.slides[1].querySelector('video');
function vBar() {
  const v = vVideo(), p = vItem(), d = v && Number.isFinite(v.duration) ? v.duration : p.dur || 0, on = v && !v.paused && !v.ended;
  $('#vpb').innerHTML = icon(on ? 'vpause' : 'vplay'); $('#vpb').setAttribute('aria-label', on ? '멈추기' : '재생');
  $('#vtime').textContent = `${Media.clock(v ? v.currentTime : 0)} / ${Media.clock(d)}`; if (document.activeElement !== $('#vrange') || on) $('#vrange').value = d ? Math.round((v ? v.currentTime : 0) / d * 1000) : 0;
  viewer.classList.toggle('playing', Boolean(on));
}
async function vPlay() {
  const p = vItem(), slide = vw.slides[1], now = vw; let v = vVideo();
  if (v) { if (v.paused || v.ended) v.play().catch(() => { }); else v.pause(); return; }
  // 누른 그 순간에 재생을 시작해야 아이폰에서 소리가 난다.
  v = document.createElement('video'); v.playsInline = true; v.preload = 'auto'; v.draggable = false; slide.append(v);
  ['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata'].forEach(n => v.addEventListener(n, () => { if (vw === now && vVideo() === v) vBar(); }));
  v.addEventListener('playing', () => { slide.querySelector('img').hidden = true; });
  v.addEventListener('timeupdate', () => { if (v.currentTime < 1.5) posterFromPlaying(p, v); }, { once: true });
  v.addEventListener('error', () => { if (v.getAttribute('src')) { v.remove(); slide.querySelector('img').hidden = false; toast('이 기기에서 재생할 수 없는 형식이에요. ⋯에서 내보내기로 저장해 보세요.'); } });
  let u = now.urls.get(p.id); if (!u) { const b = await photoBlob(p.id).catch(() => null); if (!b) { v.remove(); return toast('동영상을 찾지 못했어요'); } if (vw !== now || vItem() !== p) { v.remove(); return; } u = URL.createObjectURL(b); now.urls.set(p.id, u); }
  v.src = u; v.play().catch(() => vBar());
}
// 아래로 끌면 사진이 따라 내려가며 뒤가 비친다.
function vDrag(dy, anim) {
  const st = viewer.querySelector('.vstage'), k = Math.min(1, dy / Math.max(1, viewer.clientHeight * .6));
  st.style.transition = anim ? 'transform .2s ease-out' : 'none'; st.style.transform = dy ? `translateY(${dy}px) scale(${1 - k * .18})` : '';
  viewer.classList.toggle('drag', dy > 0); viewer.style.background = dy ? `rgb(18 13 11 / ${(1 - k * .85).toFixed(3)})` : '';
}
function vSwipe(st) {
  let s = null;
  st.addEventListener('pointerdown', e => { if (!e.isPrimary || vw.busy || e.button > 0) return; s = { x: e.clientX, y: e.clientY, t: e.timeStamp, dx: 0, dy: 0, on: '' }; st.setPointerCapture(e.pointerId); });
  st.addEventListener('pointermove', e => {
    if (!s || !e.isPrimary) return; const dx = e.clientX - s.x, dy = e.clientY - s.y;
    // 처음 움직인 방향으로 좌우 넘기기와 아래로 닫기를 나눈다
    if (!s.on && Math.max(Math.abs(dx), Math.abs(dy)) > 8) { s.on = Math.abs(dx) > Math.abs(dy) ? 'x' : dy > 0 ? 'y' : 'no'; if (s.on === 'y') vTip(false); }
    if (s.on === 'x') { const edge = dx > 0 && vw.i === 0 || dx < 0 && vw.i === vw.items.length - 1; s.dx = dx; vPlace(edge ? dx / 4 : dx); }
    if (s.on === 'y') { s.dy = Math.max(0, dy); vDrag(s.dy); }
  });
  const end = e => {
    if (!s || !e.isPrimary) return; const { dx, dy, on, t } = s, up = e.type === 'pointerup', ms = Math.max(1, e.timeStamp - t); s = null;
    if (!on) { if (up) { if (!$('#vtip').hidden) vTip(false); else if ((vItem() || {}).type) vPlay(); } return; }
    if (on === 'y') {
      if (up && (dy > 120 || dy / ms > .5 && dy > 40)) { const now = vw; vw.busy = true; vDrag(viewer.clientHeight, true); setTimeout(() => { if (vw === now && viewer.open) viewer.close(); }, matchMedia('(prefers-reduced-motion:reduce)').matches ? 0 : 190); }
      else vDrag(0, true);
      return;
    }
    if (on !== 'x') return;
    const quick = Math.abs(dx) / ms > .4 && Math.abs(dx) > 24;
    if (up && (quick || Math.abs(dx) > viewer.clientWidth * .28)) vGo(dx < 0 ? 1 : -1); else vPlace(0, true);
  };
  st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
}
viewer.addEventListener('keydown', e => { if (!vw || e.target.closest('input,textarea')) return; if (e.key === 'ArrowRight') vGo(1); else if (e.key === 'ArrowLeft') vGo(-1); });
viewer.addEventListener('close', () => { if (viewer.open || !vw) return; vTheme('#faf5ee'); const v = vVideo(); if (v) v.pause(); vw.urls.forEach(u => URL.revokeObjectURL(u)); vw = null; viewer.innerHTML = ''; viewer.className = ''; viewer.style.background = ''; });
