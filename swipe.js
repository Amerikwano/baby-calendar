/* 화면을 좌우로 밀어 탭을 옮긴다. */
(function (root) {
  'use strict';
  const ORDER = ['home', 'cal', 'diary', 'album', 'grow', 'tips', 'money', 'more'];
  // dir: 1은 왼쪽으로 밀기(다음), -1은 오른쪽으로 밀기(이전). 더보기 안의 화면(접종·검진)은 더보기로만 돌아간다.
  function next(tab, dir) { const i = ORDER.indexOf(tab); return i < 0 ? (dir < 0 ? 'more' : '') : ORDER[i + dir] || ''; }
  // 짧고 분명하게 옆으로 민 것만 넘긴다(위아래로 훑는 것과 구별).
  function judge(dx, dy, ms) { const x = Math.abs(dx), y = Math.abs(dy); return ms < 800 && x > 60 && x > y * 1.7 ? (dx < 0 ? 1 : -1) : 0; }
  const out = { ORDER, next, judge };
  if (typeof module !== 'undefined' && module.exports) module.exports = out; else root.Swipe = out;
})(typeof window !== 'undefined' ? window : globalThis);

if (typeof document !== 'undefined') {
  let s = null;
  // 가로로 미는 줄, 입력칸, 지도, 화면 맨 가장자리(아이폰의 뒤로 가기)에서는 탭을 옮기지 않는다.
  const skip = el => el.closest('.pill,.mtabs,input[type=range],video,canvas,#map,nav') || document.querySelector('dialog[open]');
  const typing = () => { const a = document.activeElement; return a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || [...document.querySelectorAll('#main [data-form=quick] input')].some(i => i.value.trim()); };
  document.addEventListener('touchstart', e => {
    const t = e.touches[0]; s = null;
    if (e.touches.length > 1 || !ready || !started || t.clientX < 24 || t.clientX > innerWidth - 24 || skip(e.target)) return;
    s = { x: t.clientX, y: t.clientY, t: e.timeStamp, lock: '' };
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!s) return; if (e.touches.length > 1) { s = null; return; }
    const t = e.touches[0], dx = Math.abs(t.clientX - s.x), dy = Math.abs(t.clientY - s.y);
    if (!s.lock && Math.max(dx, dy) > 12) { s.lock = dx > dy ? 'x' : 'y'; if (s.lock === 'y') s = null; }
  }, { passive: true });
  document.addEventListener('touchcancel', () => { s = null; }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!s) return; const t = e.changedTouches[0], dir = Swipe.judge(t.clientX - s.x, t.clientY - s.y, e.timeStamp - s.t); s = null;
    if (!dir || typing() || skip(e.target)) return;
    if (dir < 0 && navStack.length && navStack[navStack.length - 1].kind === 'sub') { history.back(); return; } // 하위 화면에서 오른쪽으로 밀면 뒤로
    const to = Swipe.next(tab, dir); if (!to) return;
    goTab(to);
    const m = document.querySelector('#main'); m.classList.add(dir > 0 ? 'in-r' : 'in-l'); setTimeout(() => m.classList.remove('in-r', 'in-l'), 260);
  }, { passive: true });
  // 홈 화면에 추가한 앱(아이폰)은 사파리처럼 밀어서 뒤로 가기가 없어서, 왼쪽 가장자리에서 오른쪽으로 밀면 뒤로 간다.
  const STANDALONE = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  // 새 아이폰은 홈 화면 앱에서도 스스로 밀어서 뒤로 가기를 한다. 그걸 한 번이라도 보면 이 기능은 끈다(두 번 뒤로 가지 않게).
  let edge = null, popAt = 0, native = localStorage.getItem('baby-native-back') === '1';
  window.addEventListener('popstate', () => { popAt = Date.now(); if (edge) edge.pop = true; });
  document.addEventListener('touchstart', e => {
    const t = e.touches[0]; edge = null;
    if (native || !STANDALONE || !/iPhone|iPad|iPod/.test(navigator.userAgent) || e.touches.length > 1 || t.clientX > 24 || !navStack.length) return;
    edge = { x: t.clientX, y: t.clientY, at: Date.now(), el: openDlgs().pop() || document.querySelector('#main') };
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!edge) return; const t = e.touches[0], dx = t.clientX - edge.x, dy = Math.abs(t.clientY - edge.y);
    if (dy > 40 && dy > dx) { edge.el.style.transform = ''; edge = null; return; }
    if (dx > 0) { edge.el.style.transition = 'none'; edge.el.style.transform = `translateX(${Math.min(dx, innerWidth) * .6}px)`; }
  }, { passive: true });
  const edgeEnd = e => {
    if (!edge) return; const g = edge, el = g.el, t = e.changedTouches && e.changedTouches[0], go = t && t.clientX - g.x > 80; edge = null;
    el.style.transition = 'transform .18s'; el.style.transform = ''; setTimeout(() => { el.style.transition = ''; }, 200);
    if (!go) return;
    // 아이폰이 이미 뒤로 갔으면(기록이 바뀌었으면) 우리는 가지 않는다.
    setTimeout(() => { if (g.pop || popAt >= g.at) { native = true; localStorage.setItem('baby-native-back', '1'); return; } history.back(); }, 450);
  };
  document.addEventListener('touchend', edgeEnd, { passive: true }); document.addEventListener('touchcancel', edgeEnd, { passive: true });
}
