// 수정할 때 CACHE와 index.html의 APP_VERSION을 함께 올린다.
const CACHE = 'baby-notebook-v0.37.3';
const FILES = ['./', 'index.html', 'schedule.js', 'pet.js', 'couple.js', 'me.js', 'base-benefits.js', 'base-tips.js', 'local.js', 'regions.js', 'family.js', 'hospitals.js', 'drive.js', 'login.js', 'share.js', 'icons.js', 'care.js', 'album.js', 'notice.js', 'bell.js', 'swipe.js', 'media.js', 'viewer.js', 'sync.js', 'home.js', 'onboard.js', 'app.js', 'app.css', 'manifest.webmanifest', 'icon-192.png', 'apple-touch-icon.png'];
importScripts('schedule.js', 'pet.js', 'couple.js', 'me.js', 'family.js', 'local.js', 'notice.js');
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('baby-notebook-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// 인터넷이 되면 최신 화면, 안 되면 저장된 화면
const FONT = 'baby-fonts'; // 글꼴은 한 번 받으면 인터넷 없이도 쓴다
self.addEventListener('fetch', e => {
  if (e.request.method === 'GET' && /^https:\/\/cdn\.jsdelivr\.net\/npm\/@kfonts\//.test(e.request.url)) return e.respondWith(caches.open(FONT).then(c => c.match(e.request).then(m => m || fetch(e.request).then(r => { if (r.ok) e.waitUntil(c.put(e.request, r.clone())); return r; }))));
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) { const c = r.clone(); e.waitUntil(caches.open(CACHE).then(k => k.put(e.request, c))); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || Response.error())));
});

/* 알림: 서버는 시각만 알려 주고, 글은 이 기기에 저장된 내용으로 여기서 만든다. */
// 서버와 휴대폰 시계가 조금 다를 수 있어 1분 반까지는 때가 된 것으로 본다.
const localNow = () => { const d = new Date(Date.now() + 90000), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
// 가족 수첩의 새 좋아요·댓글. 내가 한 것과 이미 알린 것은 빼고, 처음에는 오래된 것을 알리지 않는다.
async function talkNews() {
  const c = await Local.getKV('fam-creds'); if (!c || !c.list || !c.list.length) return null;
  const seen = new Set((await Local.getKV('talk-seen')) || []), first = false, news = [], now = Date.now(); // 처음 것은 앱이 미리 적어 둔다(talkPrime)
  for (const h of c.list) {
    let t; try { const r = await fetch(`${c.url}/h/${h.id}/talk`, { headers: { authorization: 'Bearer ' + h.token } }); if (!r.ok) continue; t = await r.json(); } catch { continue; }
    const nick = id => (t.nicks || {})[id] || '가족';
    for (const n of t.notes || []) { const k = 'n:' + n.id; if (seen.has(k)) continue; seen.add(k); if (n.who !== h.mid && now - n.at < 3600000 * (first ? 1 : 72)) news.push({ h, note: true, nick: (t.nicks || {})[n.who] || n.nick, text: n.text }); }
    for (const p of t.pending || []) { const k = 'p:' + h.id + p.rid; if (seen.has(k)) continue; seen.add(k); news.push({ h, ask: true, nick: p.nick, kname: p.kname }); }
    if (h.role !== 'viewer') for (const [tg, who] of Object.entries(t.likes || {})) for (const m of who) { const k = 'l:' + h.id + tg + '|' + m; if (seen.has(k)) continue; seen.add(k); if (m !== h.mid && !first) news.push({ h, nick: nick(m) }); }
  }
  await Local.setKV('talk-seen', [...seen].slice(-4000));
  if (!news.length) return null;
  const ask = news.find(x => x.ask); // 승인 요청이 있으면 그것부터 알린다
  if (ask) return { ids: ['talk:' + ask.h.id], title: `${ask.nick}${ask.kname ? `(${ask.kname})` : ''}가 들어오려고 해요`, body: `${ask.h.name} · 눌러서 승인해 주세요` };
  const home = news[0].h, one = news.length === 1 ? news[0] : null;
  return one ? { ids: ['talk:' + home.id], title: one.note ? `${one.nick}가 댓글을 남겼어요` : `${one.nick}가 하트를 눌렀어요`, body: (one.note ? one.text.slice(0, 80) + ' · ' : '') + home.name }
    : { ids: ['talk:' + home.id], title: `${home.name}에 새 소식 ${news.length}개`, body: news.slice(0, 4).map(x => `${x.nick} ${x.note ? '댓글' : '하트'}`).join(' · ') };
}
async function notify() {
  let m = null, shown = [];
  try { m = await talkNews(); } catch { }
  if (!m) try {
    const test = await Local.getKV('test');
    if (test && Date.now() - test < 120000) { await Local.setKV('test', 0); m = { ids: [], title: '알림이 잘 와요', body: '앞으로 이렇게 알려드릴게요' }; }
    else {
      const now = localNow(), st = await Local.api('/api/state'); shown = (await Local.getKV('shown')) || [];
      if (st.data) m = Notice.message(Notice.build(Family.migrate(st.data), Schedule, now.slice(0, 10)), now, shown, Notice.logName);
      if (m) await Local.setKV('shown', shown.concat(m.ids).slice(-400));
    }
  } catch { }
  // 받은 알림은 반드시 보여 줘야 한다(아이폰은 보여 주지 않으면 알림 권한을 거둔다).
  if (!m) m = { ids: ['check'], title: '우리 아기 수첩', body: '오늘 일정을 확인해 보세요' };
  await self.registration.showNotification(m.title, { body: m.body, icon: 'icon-192.png?v=3', badge: 'icon-192.png?v=3', tag: m.ids[0] || 'test', lang: 'ko' });
}
self.addEventListener('push', e => e.waitUntil(notify()));
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const talk = String(e.notification.tag || '').startsWith('talk:') ? e.notification.tag : ''; // 좋아요·댓글 알림이면 그 집 일기로
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => { const c = l.find(x => x.url.startsWith(self.registration.scope)); if (c) { c.postMessage(talk || 'alerts'); return c.focus(); } return clients.openWindow(talk ? './?talk=' + talk.slice(5) : './?alerts'); }));
});
