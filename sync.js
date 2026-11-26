/* 수첩 기록을 내 구글 드라이브와 맞춘다. 같은 구글 계정으로 로그인하면 다른 브라우저나 새 휴대폰에서도 같은 기록이 보인다.
   기록은 '우리 아기 수첩' 폴더의 '수첩 기록.json' 하나에 담고, 사진은 app.js가 따로 올린다. */
'use strict';
// 같은 기록인지 비교할 짧은 지문
function stamp(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + str.length; }
const SYNC_KEY = 'baby-sync';
const syncInfo = () => { try { return JSON.parse(localStorage.getItem(SYNC_KEY) || 'null') || {}; } catch { return {}; } };
const setSync = v => { try { v ? localStorage.setItem(SYNC_KEY, JSON.stringify(v)) : localStorage.removeItem(SYNC_KEY); } catch { } };
const myEmail = () => (Drive.account() || {}).email || '';
const mySync = () => { const s = syncInfo(); return s.who === myEmail() ? s : {}; };
const canSync = () => typeof canDrive === 'function' && canDrive() && Boolean(Drive.account());
const dirty = () => started && stamp(JSON.stringify(db)) !== mySync().hash;
// 로그인한 지 오래돼서 자동으로 못 올린 기록이 반나절 넘게 쌓이면 홈에서 알린다.
const syncStale = () => canSync() && !Drive.token() && dirty() && Date.now() - (mySync().t || 0) > 12 * 3600000;
const syncWhen = at => { const d = new Date(at); return isNaN(d) ? '' : d.toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
const pidOf = p => p.drive || p.id;
// 드라이브에 올리는 사진: 앨범·얼굴 사진과 아이 프로필 사진
const drivePhotos = () => db.photos.map(p => Object.assign({ kind: 'album' }, p)).concat(db.faces.map(p => Object.assign({ kind: 'face' }, p)), db.kids.filter(k => k.photo).map(k => ({ id: k.photo, kind: 'profile', kid: k.id, date: k.birth })));

let syncing = null, syncT = 0, theirs = null;
// 저장할 때마다 잠깐 기다렸다가 올린다. 로그인이 살아 있을 때만.
function syncLater() { if (!canSync() || !Drive.token()) return; clearTimeout(syncT); syncT = setTimeout(() => syncNow().catch(() => { }), 4000); }
async function pushState(id) {
  const text = JSON.stringify(db), r = await Drive.writeState(JSON.parse(text), id);
  setSync({ who: myEmail(), id: r.id, at: r.at, hash: stamp(text), t: Date.now() });
}
// 'up' 올림, 'down' 받아옴, 'same' 그대로, 'ask' 둘 중 고르기
function syncNow() {
  if (syncing) return syncing;
  return syncing = (async () => {
    if (!canSync() || !Drive.token()) return 'off';
    const mine = mySync(), r = await Drive.stateMeta();
    if (!r) { if (started) await pushState(null); return 'up'; }
    if (r.at === mine.at) { if (dirty()) await pushState(r.id); return 'same'; }
    const data = await Drive.readState(r.id), text = JSON.stringify(data);
    if (started && stamp(text) === stamp(JSON.stringify(db))) { setSync({ who: myEmail(), id: r.id, at: r.at, hash: stamp(text), t: Date.now() }); return 'same'; }
    if (!started || mine.at && !dirty()) { await adopt(data, r); return 'down'; }
    theirs = { data, r }; conflictDlg(); return 'ask';
  })().finally(() => { syncing = null; });
}
// 드라이브의 기록으로 바꾼다. 바꾸기 전 이 기기의 기록은 한 번 남겨 둔다.
async function adopt(data, r) {
  if (started) await Local.setKV('before-sync', { at: Date.now(), data: db }).catch(() => { });
  const next = Object.assign(fresh(), Family.migrate(data));
  if (!await save(d => { Object.keys(d).forEach(k => delete d[k]); Object.assign(d, next); })) return false;
  started = true; ob.step = '';
  setSync({ who: myEmail(), id: r.id, at: r.at, hash: stamp(JSON.stringify(db)), t: Date.now() });
  render(); toast('구글 드라이브의 기록을 불러왔어요');
  await pullMissing();
  return true;
}
const summary = x => { const d = Object.assign(fresh(), Family.migrate(x)); return `${d.kids.map(k => esc(k.name)).join(', ')} · 기록 ${d.logs.length + d.diary.length + d.events.length}개 · 사진 ${d.photos.length + d.faces.length}장`; };
function conflictDlg() {
  if (!theirs) return;
  openDlg(`<form data-form="none"><h2>어떤 기록을 쓸까요?</h2><p class="sub">구글 드라이브의 기록과 이 기기의 기록이 서로 달라요. 하나를 고르면 다른 쪽도 같게 맞춰요.</p><div class="list"><div class="hosp"><span><b>구글 드라이브</b><span class="sub">${summary(theirs.data)}<br>${syncWhen(theirs.r.at)} 저장</span></span><button type="button" class="btn main" data-act="syncdown">이걸로</button></div><div class="hosp"><span><b>이 기기</b><span class="sub">${summary(db)}</span></span><button type="button" class="btn" data-act="syncup">이걸로</button></div></div><p class="sub">사진은 어느 쪽을 골라도 지워지지 않아요.</p></form>`);
}
// 기록에는 있는데 이 기기에 없는 사진을 드라이브에서 받아 온다.
async function pullMissing() {
  const need = []; for (const p of drivePhotos()) if (!await Local.has(p.id).catch(() => true)) need.push(p);
  if (!need.length || !Drive.token()) return;
  const files = await syncSent(), by = new Map(files.map(f => [f.appProperties && f.appProperties.pid, f])), list = need.filter(p => by.has(pidOf(p)));
  if (!list.length) return;
  let n = 0; busy('사진을 가져오는 중', `0/${list.length}`, 0, list.length);
  for (const p of list) {
    try {
      const b = await Drive.download(by.get(pidOf(p)).id); await Local.keep(p.id, b);
      const th = Media.isVideo(b) ? (await videoPoster(b).catch(() => ({}))).thumb : await imageThumb(b).catch(() => null);
      if (th) await api(`/photos/${p.id}/thumb`, { method: 'PUT', body: th }).catch(() => { });
      n++; busy('사진을 가져오는 중', `${n}/${list.length}`, n, list.length);
    } catch (e) { if (e.login) { toast(e.message); break; } }
  }
  busyOff(); render(); toast(`사진 ${n}장을 가져왔어요`);
}
async function syncActs(act) {
  if (act === 'syncdown' && theirs) { dlg.close(); const t = theirs; theirs = null; try { await adopt(t.data, t.r); } catch (e) { toast(e.message); } }
  else if (act === 'syncup' && theirs) { dlg.close(); const t = theirs; theirs = null; try { await pushState(t.r.id); toast('이 기기의 기록을 드라이브에 올렸어요'); render(); } catch (e) { toast(e.message); } }
  else if (act === 'syncnow') {
    if (!Drive.token()) return Drive.login(GOOGLE_ID), true;
    try { const how = await syncNow(); if (how !== 'ask') toast(how === 'down' ? '구글 드라이브의 기록을 불러왔어요' : '구글 드라이브와 기록을 맞췄어요'); render(); } catch (e) { toast(e.message); }
  } else return false;
  return true;
}
function syncCard() {
  if (!syncStale()) return '';
  return `<section class="notice"><div class="row between"><b>드라이브에 아직 안 올린 기록이 있어요</b><button class="btn" data-act="syncnow">맞추기</button></div></section>`;
}
function syncRow() {
  if (!canSync()) return '';
  const s = mySync();
  return `<div class="row between"><span class="sub">기록 ${s.at ? syncWhen(s.at) + '에 맞춤' : '아직 안 맞춤'}${dirty() ? ', 바뀐 내용 있음' : ''}</span><button class="btn" data-act="syncnow">기록 맞추기</button></div>`;
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (!document.hidden && ready && canSync() && Drive.token() && !dlg.open) syncNow().catch(() => { }); });
