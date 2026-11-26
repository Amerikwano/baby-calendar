/* 구글 로그인과 내 구글 드라이브. 이 앱이 만든 파일만 다루는 권한(drive.file)만 요청한다.
   토큰은 탭을 닫으면 사라지는 곳(sessionStorage)에만 두고 1시간 뒤 끝난다. */
(function (root) {
  'use strict';
  const SCOPE = 'https://www.googleapis.com/auth/drive.file', API = 'https://www.googleapis.com/drive/v3', UP = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
  const get = (s, k) => { try { return JSON.parse(s.getItem(k) || 'null'); } catch { return null; } };
  const put = (s, k, v) => { try { v === null ? s.removeItem(k) : s.setItem(k, JSON.stringify(v)); } catch { } };
  const expired = () => Object.assign(new Error('로그인 시간이 끝났어요. 다시 로그인해 주세요.'), { login: true });

  const loginUrl = (id, redirect, state, hint) => 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams(Object.assign({ client_id: id, redirect_uri: redirect, response_type: 'token', scope: SCOPE, state }, hint ? { login_hint: hint } : { prompt: 'select_account' }));
  // 구글에서 돌아온 주소를 읽는다. 내가 시작한 로그인(state)이 아니면 버린다.
  function readReturn(hash, saved, now) {
    const q = new URLSearchParams(String(hash).replace(/^#/, ''));
    if (!q.get('state') || !(q.get('access_token') || q.get('error'))) return null;
    if (!saved && q.get('access_token')) return { error: '로그인을 시작한 창이 아니에요. 처음 쓰던 창에서 다시 시도해 주세요.', handoff: true };
    if (!saved || saved.state !== q.get('state') || now - saved.t > 15 * 60000) return { error: '로그인을 확인하지 못했어요. 다시 시도해 주세요.' };
    if (q.get('error')) return { error: q.get('error') === 'access_denied' ? '로그인을 취소했어요. 로그인하지 않아도 계속 쓸 수 있어요.' : '구글 로그인에 실패했어요. 다시 시도해 주세요.' };
    if (!(q.get('scope') || '').split(' ').includes(SCOPE)) return { error: '드라이브 권한이 빠졌어요. 다시 로그인하면서 체크해 주세요.' };
    return { token: q.get('access_token'), until: now + (Number(q.get('expires_in')) || 3600) * 1000 - 60000 };
  }
  const here = () => location.origin + location.pathname.replace(/index\.html$/, '');
  function login(id) {
    const state = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    put(localStorage, 'baby-oauth', { state, t: Date.now() });
    const me = account(); location.assign(loginUrl(id, here(), state, me && me.email));
  }
  function finish() {
    const r = readReturn(location.hash, get(localStorage, 'baby-oauth'), Date.now());
    if (!r) return null;
    history.replaceState(null, '', location.pathname + location.search); // 주소에 토큰을 남기지 않는다
    put(localStorage, 'baby-oauth', null);
    if (r.token) { put(sessionStorage, 'baby-token', r); folder = null; }
    return r.error ? { error: r.error, handoff: r.handoff } : { ok: true };
  }
  const token = () => { const t = get(sessionStorage, 'baby-token'); return t && t.until > Date.now() ? t.token : ''; };
  const account = () => get(localStorage, 'baby-google');
  const setAccount = a => put(localStorage, 'baby-google', a);
  async function logout() {
    const t = token(); put(sessionStorage, 'baby-token', null); setAccount(null); folder = null;
    if (t) await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', body: new URLSearchParams({ token: t }) }).catch(() => { });
  }
  async function call(url, opt) {
    const t = token(); if (!t) throw expired();
    let r; try { r = await fetch(url.startsWith('http') ? url : API + url, Object.assign({}, opt, { headers: Object.assign({ authorization: 'Bearer ' + t }, opt && opt.headers) })); } catch { throw new Error('인터넷 연결을 확인해 주세요.'); }
    if (r.status === 401) { put(sessionStorage, 'baby-token', null); throw expired(); }
    if (!r.ok) {
      const why = await r.json().then(j => j.error.errors[0].reason).catch(() => '');
      throw Object.assign(new Error(why === 'storageQuotaExceeded' ? '구글 드라이브 저장 공간이 부족해요.' : `구글 드라이브에서 오류가 났어요 (${r.status}).`), { status: r.status, full: why === 'storageQuotaExceeded' });
    }
    return r;
  }
  const json = (url, body, method) => call(url, body ? { method: method || 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined).then(r => r.json());
  async function me() { const u = (await json('/about?fields=user(displayName,emailAddress)')).user; setAccount({ name: u.displayName || '', email: u.emailAddress || '' }); return account(); }
  let folder = null;
  async function ensureFolder() {
    if (folder) return folder;
    const q = "mimeType='application/vnd.google-apps.folder' and trashed=false and appProperties has { key='bn' and value='folder' }";
    const f = (await json('/files?' + new URLSearchParams({ q, fields: 'files(id)', pageSize: 1 }))).files[0];
    return folder = (f || await json('/files?fields=id', { name: '우리 아기 수첩', mimeType: 'application/vnd.google-apps.folder', appProperties: { bn: 'folder' } })).id;
  }
  async function list() {
    const out = []; let pageToken = '';
    do {
      const j = await json('/files?' + new URLSearchParams(Object.assign({ q: "trashed=false and appProperties has { key='bn' and value='photo' }", fields: 'nextPageToken,files(id,name,size,appProperties)', pageSize: 1000 }, pageToken ? { pageToken } : {})));
      out.push(...j.files); pageToken = j.nextPageToken || '';
    } while (pageToken);
    return out;
  }
  function multipart(meta, blob) {
    const b = 'bn' + Array.from(crypto.getRandomValues(new Uint8Array(12)), x => x.toString(16).padStart(2, '0')).join('');
    return { type: 'multipart/related; boundary=' + b, body: new Blob([`--${b}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\ncontent-type: ${blob.type || 'image/jpeg'}\r\n\r\n`, blob, `\r\n--${b}--`]) };
  }
  // 5MB가 넘으면(동영상 등) 이어 올리기 방식으로 보낸다.
  async function uploadBig(blob, meta) {
    const s = await call('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', { method: 'POST', headers: { 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-type': blob.type || 'application/octet-stream', 'x-upload-content-length': String(blob.size) }, body: JSON.stringify(meta) });
    const to = s.headers.get('location'); if (!to || !to.startsWith('https://www.googleapis.com/')) throw new Error('구글 드라이브에서 올릴 주소를 받지 못했어요.');
    return (await call(to, { method: 'PUT', headers: { 'content-type': blob.type || 'application/octet-stream' }, body: blob })).json();
  }
  async function upload(blob, name, props) {
    const meta = { name, parents: [await ensureFolder()], appProperties: Object.assign({ bn: 'photo' }, props) };
    if (blob.size > 5 * 1048576) return uploadBig(blob, meta);
    const m = multipart(meta, blob);
    return (await call(UP, { method: 'POST', headers: { 'content-type': m.type }, body: m.body })).json();
  }
  const download = id => call(`/files/${encodeURIComponent(id)}?alt=media`).then(r => r.blob());
  const trash = id => json('/files/' + encodeURIComponent(id), { trashed: true }, 'PATCH');
  // 수첩 기록(JSON 하나). 같은 구글 계정이면 어느 브라우저에서든 같은 파일을 본다.
  async function stateMeta() {
    const q = "trashed=false and appProperties has { key='bn' and value='state' }";
    const f = (await json('/files?' + new URLSearchParams({ q, fields: 'files(id,modifiedTime)', orderBy: 'modifiedTime desc', pageSize: 1 }))).files[0];
    return f ? { id: f.id, at: f.modifiedTime } : null;
  }
  const readState = id => call(`/files/${encodeURIComponent(id)}?alt=media`).then(r => r.json());
  async function writeState(data, id) {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const m = multipart(id ? {} : { name: '수첩 기록.json', parents: [await ensureFolder()], appProperties: { bn: 'state' } }, blob);
    const url = 'https://www.googleapis.com/upload/drive/v3/files' + (id ? '/' + encodeURIComponent(id) : '') + '?uploadType=multipart&fields=id,modifiedTime';
    const j = await (await call(url, { method: id ? 'PATCH' : 'POST', headers: { 'content-type': m.type }, body: m.body })).json();
    return { id: j.id, at: j.modifiedTime };
  }
  const out = { login, finish, token, account, me, logout, list, upload, download, trash, loginUrl, readReturn, multipart, stateMeta, readState, writeState };
  if (typeof module !== 'undefined' && module.exports) module.exports = out; else root.Drive = out;
})(this);
