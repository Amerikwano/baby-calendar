// 수정할 때 CACHE와 index.html의 APP_VERSION을 함께 올린다.
const CACHE = 'baby-notebook-v0.6.3';
const FILES = ['./', 'index.html', 'schedule.js', 'base-benefits.js', 'base-tips.js', 'local.js', 'regions.js', 'family.js', 'hospitals.js', 'drive.js', 'manifest.webmanifest', 'icon-192.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('baby-notebook-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// 인터넷이 되면 최신 화면, 안 되면 저장된 화면
const FONT = 'baby-fonts'; // 글꼴은 한 번 받으면 인터넷 없이도 쓴다
self.addEventListener('fetch', e => {
  if (e.request.method === 'GET' && /^fonts\.(googleapis|gstatic)\.com$/.test(new URL(e.request.url).hostname)) return e.respondWith(caches.open(FONT).then(c => c.match(e.request).then(m => m || fetch(e.request).then(r => { if (r.ok) e.waitUntil(c.put(e.request, r.clone())); return r; }))));
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) { const c = r.clone(); e.waitUntil(caches.open(CACHE).then(k => k.put(e.request, c))); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || Response.error())));
});
