/* 알림 화면과 휴대폰 알림 켜기 */
const PUSH_URL = 'https://baby-notebook-push.baby-calendar.workers.dev'; // 비어 있으면 휴대폰 알림 단추가 나오지 않는다
let bellSeen = new Set(); try { bellSeen = new Set(JSON.parse(localStorage.getItem('baby-seen') || '[]')); } catch { }
const noticeList = () => Notice.build(db, S, today());
const bellNow = () => Notice.active(noticeList(), nowText());
const bellNew = () => bellNow().some(n => !bellSeen.has(n.id));
const push = { state: 'off', sub: null, key: '', last: '' };
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const iosWeb = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !standalone();
const pushCan = () => Boolean(PUSH_URL && local && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
async function pushCall(path, body) {
  let r; try { r = await fetch(PUSH_URL + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined); } catch { throw new Error('알림 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.'); }
  const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(r.status === 429 ? '잠시 뒤 다시 눌러 주세요.' : '알림 서버에서 오류가 났어요.'), { status: r.status }); return j;
}
const keyBytes = k => Uint8Array.from(atob(k.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - k.length % 4) % 4)), c => c.charCodeAt(0));
// 알릴 시각만 서버에 맡긴다. 내용은 보내지 않는다.
async function pushSync(force) {
  if (!push.sub || push.state !== 'on') return;
  const times = Notice.wakes(noticeList(), Date.now(), s => new Date(s + ':00').getTime()), now = JSON.stringify(times);
  if (!force && now === push.last) return;
  await pushCall('/save', { endpoint: push.sub.endpoint, times }); push.last = now;
}
let pushTimer; const pushLater = () => { clearTimeout(pushTimer); pushTimer = setTimeout(() => pushSync().catch(() => { }), 1500); };
async function pushInit() {
  if (!pushCan()) { push.state = iosWeb() ? 'home' : 'none'; return; }
  const reg = await navigator.serviceWorker.ready; push.sub = await reg.pushManager.getSubscription();
  let off = false; try { off = localStorage.getItem('baby-push') === 'off'; } catch { }
  push.state = Notification.permission === 'denied' ? 'denied' : push.sub && Notification.permission === 'granted' && !off ? 'on' : 'ask';
  if (push.state === 'on') pushSync(true).catch(() => { }); else pushCall('/key').then(j => { push.key = j.key; }).catch(() => { });
}
async function pushOn() {
  const ok = await Notification.requestPermission();
  if (ok !== 'granted') { push.state = ok === 'denied' ? 'denied' : 'ask'; throw new Error(ok === 'denied' ? '알림이 막혀 있어요. 휴대폰 설정에서 이 앱의 알림을 켜 주세요.' : '알림을 켜지 않았어요.'); }
  if (!push.key) push.key = (await pushCall('/key')).key;
  const reg = await navigator.serviceWorker.ready; let sub = await reg.pushManager.getSubscription();
  if (sub && sub.options && sub.options.applicationServerKey) { const a = new Uint8Array(sub.options.applicationServerKey), b = keyBytes(push.key); if (a.length !== b.length || a.some((x, i) => x !== b[i])) { await sub.unsubscribe(); sub = null; } }
  push.sub = sub || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(push.key) });
  push.state = 'on'; try { localStorage.setItem('baby-push', 'on'); } catch { }
  try { await pushSync(true); } catch (e) { push.state = 'ask'; throw e; }
}
async function pushOff() {
  const s = push.sub; push.sub = null; push.last = ''; push.state = 'ask'; try { localStorage.setItem('baby-push', 'off'); } catch { }
  if (s) { await pushCall('/drop', { endpoint: s.endpoint }).catch(() => { }); await s.unsubscribe().catch(() => { }); }
}
function pushCard() {
  if (!PUSH_URL || !local || push.state === 'none') return '';
  if (push.state === 'home') return `<div class="notice"><b>휴대폰으로 알림 받기</b><p class="sub">아이폰은 공유 단추에서 '홈 화면에 추가'한 앱에서 알림을 켤 수 있어요.</p></div>`;
  if (push.state === 'denied') return `<div class="notice"><b>알림이 꺼져 있어요</b><p class="sub">휴대폰 설정에서 이 앱의 알림을 켠 뒤 앱을 다시 열어 주세요.</p></div>`;
  if (push.state === 'on') return `<div class="notice"><b>휴대폰 알림이 켜져 있어요</b><p class="sub">접종·검진·예약과 달력의 모든 일정을 알려요. 아침 알림은 ${db.hour}시이고 설정에서 바꿀 수 있어요.</p><div class="row"><button type="button" class="btn" data-act="pushtest">시험 알림 보내기</button><button type="button" class="btn" data-act="pushoff">끄기</button></div></div>`;
  return `<div class="notice"><b>휴대폰으로 알림 받기</b><p class="sub">앱을 닫아 두어도 알려드려요. 알림 서버에는 기기 주소와 알릴 시각만 맡기고, 아기 정보는 보내지 않아요.</p><div class="row"><button type="button" class="btn main" data-act="pushon">알림 켜기</button></div></div>`;
}
function alertsDlg() {
  const l = bellNow();
  l.forEach(n => bellSeen.add(n.id)); try { localStorage.setItem('baby-seen', JSON.stringify([...bellSeen].slice(-400))); } catch { }
  const ic = n => n.ref.type === 'log' ? n.ref.log : n.ref.type === 'event' ? 'cal' : n.ref.type === 'due' ? 'baby' : 'shield';
  const act = n => n.ref.type === 'item' ? `data-act="item" data-id="${n.ref.id}" data-kid="${n.kid}"` : n.ref.type === 'event' ? `data-act="event" data-id="${n.ref.id}"` : n.ref.type === 'log' ? `data-act="editlog" data-id="${n.ref.id}"` : 'data-act="close"';
  const when = n => n.date === today() ? `오늘 ${Care.clock(n.time)}` : n.date === S.addDays(today(), -1) ? '어제' : kd(n.date);
  openDlg(`<form data-form="none"><h2>알림</h2>${pushCard()}${l.length ? `<div class="list">${l.map(n => `<button type="button" class="bellrow" ${act(n)}><span class="lic">${icon(ic(n))}</span><span><b>${esc(Notice.title(n))}</b>${n.body ? `<em>${esc(n.body)}</em>` : ''}<small>${when(n)}</small></span></button>`).join('')}</div>` : '<p class="empty">지금 알릴 것이 없어요.</p>'}<p class="sub">등록한 날부터 오늘 날짜에 맞는 것만 보여요. 시기가 지난 접종은 더보기의 접종·검진에서 볼 수 있어요.</p></form>`);
  $('#top').innerHTML = topBar();
}
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => { if (e.data === 'alerts' && ready && started) alertsDlg(); });
// 앱을 켜 둔 동안에도 새 알림이 생기면 종에 점을 찍는다.
setInterval(() => { if (ready && started && !document.hidden && !dlg.open) $('#top').innerHTML = topBar(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && ready && started && !dlg.open) $('#top').innerHTML = topBar(); });
