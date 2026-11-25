/* 동영상: 형식, 찍은 날짜 읽기, 대표 그림 만들기 */
(function (root) {
  'use strict';
  const EXT = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/3gpp': '3gp', 'video/x-m4v': 'm4v', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic', 'image/heif': 'heif' };
  const TYPE = Object.fromEntries(Object.entries(EXT).map(([t, e]) => [e, t]));
  const MAX = 200 * 1048576;
  const typeOf = f => { const t = String(f.type || '').split(';')[0].toLowerCase(); if (t) return t; const m = String(f.name || '').match(/\.(\w+)$/); return m ? TYPE[m[1].toLowerCase()] || '' : ''; };
  const isVideo = f => typeOf(f).startsWith('video/');
  const ext = t => EXT[String(t).split(';')[0]] || (String(t).startsWith('video/') ? 'mp4' : 'jpg');
  const clock = s => { const n = Math.max(0, Math.round(s || 0)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
  // mp4·mov에 적힌 만든 시각(1904년부터의 초)을 읽는다.
  async function madeAt(blob) {
    try {
      const view = async (a, n) => new DataView(await blob.slice(a, a + n).arrayBuffer());
      const name = (v, o) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
      const find = async (from, to, want) => { for (let o = from, i = 0; o + 8 <= to && i < 200; i++) { const v = await view(o, 16); let n = v.getUint32(0), h = 8; if (n === 1 && v.byteLength >= 16) { n = v.getUint32(8) * 4294967296 + v.getUint32(12); h = 16; } if (n === 0) n = to - o; if (n < h) return null; if (name(v, 4) === want) return [o + h, o + n]; o += n; } return null; };
      const moov = await find(0, blob.size, 'moov'); if (!moov) return null;
      const m = await find(moov[0], moov[1], 'mvhd'); if (!m) return null;
      const v = await view(m[0], 12), sec = v.getUint8(0) === 1 ? v.getUint32(4) * 4294967296 + v.getUint32(8) : v.getUint32(4), ms = (sec - 2082844800) * 1000;
      return ms > Date.UTC(2005, 0, 1) && ms < Date.now() + 86400000 ? new Date(ms) : null;
    } catch { return null; }
  }
  const Media = { EXT, TYPE, MAX, typeOf, isVideo, ext, clock, madeAt };
  if (typeof module !== 'undefined' && module.exports) module.exports = Media; else root.Media = Media;
})(typeof window !== 'undefined' ? window : globalThis);

// 대표 그림과 길이. 못 만들면 기본 그림을 쓴다.
async function videoPoster(blob) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), v = document.createElement('video'), url = URL.createObjectURL(blob);
  const wait = (n, ms) => new Promise((ok, no) => { v.addEventListener(n, ok, { once: true }); v.addEventListener('error', () => no(new Error('video')), { once: true }); setTimeout(() => no(new Error('time')), ms); });
  let dur = 0, drawn = false;
  try {
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url; v.load();
    if (v.readyState < 1) await wait('loadedmetadata', 9000);
    dur = Number.isFinite(v.duration) ? v.duration : 0;
    const seek = wait('seeked', 6000); v.currentTime = Math.min(.5, (dur || 1) / 2); await seek;
    if (v.readyState < 2) await wait('loadeddata', 4000).catch(() => { });
    const z = Math.min(1, 960 / Math.max(v.videoWidth, v.videoHeight)); c.width = Math.max(1, Math.round(v.videoWidth * z)); c.height = Math.max(1, Math.round(v.videoHeight * z));
    g.drawImage(v, 0, 0, c.width, c.height); drawn = v.videoWidth > 0;
  } catch { }
  if (!drawn) { c.width = c.height = 480; g.fillStyle = '#d6c0a4'; g.fillRect(0, 0, 480, 480); g.fillStyle = '#fffdfa'; g.beginPath(); g.moveTo(195, 160); g.lineTo(325, 240); g.lineTo(195, 320); g.fill(); }
  v.removeAttribute('src'); v.load(); URL.revokeObjectURL(url);
  return { thumb: await new Promise(x => c.toBlob(x, 'image/jpeg', .84)), dur };
}
async function imageThumb(blob) {
  const bmp = await createImageBitmap(blob), k = Math.min(1, 480 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
  return new Promise(x => c.toBlob(x, 'image/jpeg', .82));
}
// 사진이나 동영상 하나를 저장하고 { id, type, dur }를 준다.
async function storeMedia(f) {
  const video = Media.isVideo(f); let thumb, dur = 0;
  if (video) {
    if (!local) throw Object.assign(new Error('동영상은 웹앱 주소에서만 넣을 수 있어요'), { status: 415 });
    if (f.size > Media.MAX) throw Object.assign(new Error('동영상은 200MB까지 넣을 수 있어요'), { status: 413 });
    if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate().catch(() => ({})); if (e.quota && e.quota - (e.usage || 0) < f.size * 1.2) throw Object.assign(new Error('이 기기의 저장 공간이 부족해요'), { status: 507 }); }
    ({ thumb, dur } = await videoPoster(f));
  } else thumb = await imageThumb(f);
  const body = video && f.type !== Media.typeOf(f) ? new Blob([f], { type: Media.typeOf(f) }) : f, r = await api('/api/photos', { method: 'POST', body });
  if (thumb) await api(`/photos/${r.id}/thumb`, { method: 'PUT', body: thumb }).catch(() => { });
  return Object.assign({ id: r.id }, video ? { type: 'video', dur: Math.round(dur * 10) / 10 } : {});
}
