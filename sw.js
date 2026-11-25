// 수정할 때 CACHE와 index.html의 APP_VERSION을 함께 올린다.
const CACHE = 'baby-notebook-v0.8.0';
const FILES = ['./', 'index.html', 'schedule.js', 'base-benefits.js', 'base-tips.js', 'local.js', 'regions.js', 'family.js', 'hospitals.js', 'drive.js', 'login.js', 'icons.js', 'care.js', 'album.js', 'notice.js', 'bell.js', 'onboard.js', 'app.js', 'app.css', 'manifest.webmanifest', 'icon-192.png', 'apple-touch-icon.png'];
importScripts('schedule.js', 'family.js', 'local.js', 'notice.js');
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
const localNow = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
async function notify() {
  let m = null, shown = [];
  try {
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
  await self.registration.showNotification(m.title, { body: m.body, icon: 'icon-192.png?v=2', badge: 'icon-192.png?v=2', tag: m.ids[0] || 'test', lang: 'ko' });
}
self.addEventListener('push', e => e.waitUntil(notify()));
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => { const c = l.find(x => x.url.startsWith(self.registration.scope)); if (c) { c.postMessage('alerts'); return c.focus(); } return clients.openWindow('./?alerts'); }));
});
