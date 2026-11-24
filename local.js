/* 서버 없이 열었을 때 이 기기(브라우저)에 저장한다. 백업 파일(zip) 만들기와 되돌리기도 여기서 한다. */
(function (root) {
  'use strict';
  let dbp;
  const open = () => dbp || (dbp = new Promise((ok, no) => {
    const r = indexedDB.open('baby-notebook', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('photos'); };
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  }));
  // work 안에서 요청을 걸고, 트랜잭션이 끝까지 저장된 뒤에 결과를 돌려준다.
  async function tx(stores, mode, work) {
    const d = await open();
    return new Promise((ok, no) => {
      const t = d.transaction(stores, mode); let out;
      t.oncomplete = () => ok(out); t.onerror = t.onabort = () => no(t.error || new Error('저장 실패'));
      work(t, v => { out = v; });
    });
  }
  const getState = () => tx(['kv'], 'readonly', (t, ret) => { t.objectStore('kv').get('state').onsuccess = e => ret(e.target.result || { rev: 0, data: null }); });
  const putState = (rev, data) => tx(['kv'], 'readwrite', (t, ret) => {
    const s = t.objectStore('kv');
    s.get('state').onsuccess = e => { const cur = e.target.result || { rev: 0 }; if (cur.rev !== rev) return ret(null); s.put({ rev: rev + 1, data }, 'state'); ret(rev + 1); };
  });
  const getPhoto = id => tx(['photos'], 'readonly', (t, ret) => { t.objectStore('photos').get(id).onsuccess = e => ret(e.target.result || null); });
  const putPhoto = (id, rec) => tx(['photos'], 'readwrite', t => { t.objectStore('photos').put(rec, id); });
  const delPhoto = id => tx(['photos'], 'readwrite', t => { t.objectStore('photos').delete(id); });
  const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
  const fail = (m, status) => Object.assign(new Error(m), { status });

  // server.js와 같은 주소·같은 결과를 흉내 낸다.
  async function api(url, opt) {
    const method = (opt && opt.method) || 'GET', body = opt && opt.body;
    try {
      if (url === '/api/status') return { ai: false };
      if (url === '/api/state' && method === 'GET') return await getState();
      if (url === '/api/state') { const b = JSON.parse(body), rev = await putState(b.rev, b.data); if (rev === null) throw fail('다른 창에서 먼저 저장했어요.', 409); return { rev }; }
      if (url === '/api/photos') { const id = newId(); await putPhoto(id, { type: body.type || 'image/jpeg', data: await body.arrayBuffer() }); return { id }; }
      const m = url.match(/photos\/([0-9a-f]{24})(\/thumb)?$/);
      if (m && m[2] && method === 'PUT') { const r = await getPhoto(m[1]); r.thumb = await body.arrayBuffer(); await putPhoto(m[1], r); return {}; }
      if (m && method === 'DELETE') { await delPhoto(m[1]); return {}; }
    } catch (e) {
      if (e.status) throw e;
      throw fail(e.name === 'QuotaExceededError' ? '이 기기의 저장 공간이 부족해요.' : '이 기기에 저장할 수 없어요. 시크릿 창이 아닌지 확인하세요.', 500);
    }
    throw fail('이 주소에서는 쓸 수 없는 기능이에요.', 404);
  }
  const urls = new Map();
  async function photoUrl(id, thumb) {
    const k = id + (thumb ? 't' : ''); if (urls.has(k)) return urls.get(k);
    const r = await getPhoto(id); if (!r) return '';
    const u = URL.createObjectURL(thumb && r.thumb ? new Blob([r.thumb], { type: 'image/jpeg' }) : new Blob([r.data], { type: r.type }));
    if (thumb) urls.set(k, u); return u;
  }

  async function photoBlob(id) { const r = await getPhoto(id); return r ? new Blob([r.data], { type: r.type }) : null; }

  /* ── zip (압축 없이 묶기만) ── */
  const T = new Uint32Array(256).map((_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
  function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function zip(files) {
    const parts = [], dir = []; let off = 0;
    const head = (sig, size, f) => { const v = new DataView(new ArrayBuffer(size)); v.setUint32(0, sig, true); return v; };
    for (const f of files) {
      const name = new TextEncoder().encode(f.name), crc = crc32(f.data), n = f.data.length;
      const common = (v, o) => { v.setUint16(o, 20, true); v.setUint16(o + 2, 0x800, true); v.setUint16(o + 8, 0x21, true); v.setUint32(o + 10, crc, true); v.setUint32(o + 14, n, true); v.setUint32(o + 18, n, true); v.setUint16(o + 22, name.length, true); };
      const h = head(0x04034b50, 30); common(h, 4); parts.push(h.buffer, name, f.data);
      const c = head(0x02014b50, 46); c.setUint16(4, 20, true); common(c, 6); c.setUint32(42, off, true); dir.push(c.buffer, name);
      off += 30 + name.length + n;
    }
    const size = dir.reduce((a, x) => a + x.byteLength, 0), e = head(0x06054b50, 22);
    e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...dir, e.buffer], { type: 'application/zip' });
  }
  async function unzip(blob) {
    const tail = new DataView(await blob.slice(-22).arrayBuffer());
    if (tail.byteLength < 22 || tail.getUint32(0, true) !== 0x06054b50) throw fail('이 앱에서 만든 백업 파일이 아니에요.', 400);
    const n = tail.getUint16(10, true), start = tail.getUint32(16, true);
    const d = new DataView(await blob.slice(start, start + tail.getUint32(12, true)).arrayBuffer()), out = [];
    for (let i = 0, o = 0; i < n; i++) {
      if (d.getUint32(o, true) !== 0x02014b50 || d.getUint16(o + 10, true) !== 0) throw fail('백업 파일이 손상됐거나 다시 압축됐어요.', 400);
      const len = d.getUint32(o + 24, true), nl = d.getUint16(o + 28, true), at = d.getUint32(o + 42, true);
      const name = new TextDecoder().decode(new Uint8Array(d.buffer, o + 46, nl));
      const data = new Uint8Array(await blob.slice(at + 30 + nl, at + 30 + nl + len).arrayBuffer());
      if (data.length !== len || crc32(data) !== d.getUint32(o + 16, true)) throw fail('백업 파일이 손상됐어요.', 400);
      out.push({ name, data }); o += 46 + nl + d.getUint16(o + 30, true) + d.getUint16(o + 32, true);
    }
    return out;
  }
  async function backup() {
    const s = await getState(), files = [{ name: 'state.json', data: new TextEncoder().encode(JSON.stringify(s.data)) }];
    for (const p of s.data ? (s.data.photos || []).concat((s.data.faces || []).map(f => Object.assign({ face: 1 }, f))) : []) {
      const r = await getPhoto(p.id); if (!r) continue;
      const ext = (r.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      files.push({ name: `photos/${p.face ? '얼굴_' : ''}${p.date}_${p.id}.${ext}`, data: new Uint8Array(r.data) });
      if (r.thumb) files.push({ name: `thumbs/${p.id}.jpg`, data: new Uint8Array(r.thumb) });
    }
    return zip(files);
  }
  // 파일을 끝까지 읽고 검사한 뒤에만 지금 내용을 바꾼다.
  async function restore(blob) {
    const files = await unzip(blob), st = files.find(f => f.name === 'state.json');
    if (!st) throw fail('이 앱에서 만든 백업 파일이 아니에요.', 400);
    const data = JSON.parse(new TextDecoder().decode(st.data));
    if (!data || data.v !== 1 || !Array.isArray(data.photos) || !Array.isArray(data.diary)) throw fail('이 앱에서 만든 백업 파일이 아니에요.', 400);
    const ph = new Map();
    for (const f of files) {
      let m = f.name.match(/^photos\/.*_([0-9a-f]{24})\.(jpg|png|webp|gif|heic|heif)$/);
      if (m) ph.set(m[1], Object.assign(ph.get(m[1]) || {}, { type: 'image/' + m[2].replace('jpg', 'jpeg'), data: f.data.buffer }));
      m = f.name.match(/^thumbs\/([0-9a-f]{24})\.jpg$/);
      if (m) ph.set(m[1], Object.assign(ph.get(m[1]) || {}, { thumb: f.data.buffer }));
    }
    const cur = await getState();
    await tx(['kv', 'photos'], 'readwrite', t => {
      const s = t.objectStore('photos'); s.clear();
      ph.forEach((r, id) => { if (r.data) s.put(r, id); });
      t.objectStore('kv').put({ rev: cur.rev + 1, data }, 'state');
    });
    urls.clear();
  }
  const out = { api, photoUrl, photoBlob, backup, restore, zip, unzip };
  if (typeof module !== 'undefined' && module.exports) module.exports = out; else root.Local = out;
})(this);
