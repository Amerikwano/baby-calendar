/* 가족 수첩 서버의 한 집(수첩 하나). 초대받은 사람만 들어온다.
   - 함께 쓰기(owner, editor): 기록 전체를 보고 고친다.
   - 열람(viewer): 아이 정보, 일기, 앨범만 보고 좋아요와 댓글만 단다.
   열쇠(token)와 초대 번호는 원래 값을 저장하지 않고 SHA-256 값만 둔다. */
const ROLES = ['owner', 'editor', 'viewer'], EDIT = ['owner', 'editor'];
const CHUNK = 120000, MAX_STATE = 1500000, MAX_PHOTO = 1900000, MAX_BYTES = 400 * 1048576, MAX_MEMBERS = 30, MAX_NOTES = 20000, INVITE_DAYS = 7;
const VIEW_KEYS = ['v', 'kids', 'diary', 'photos', 'faces'];
const enc = new TextEncoder();
export const hex = u => Array.from(new Uint8Array(u), b => b.toString(16).padStart(2, '0')).join('');
export const rand = n => hex(crypto.getRandomValues(new Uint8Array(n)));
export const sha = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const nickOk = s => typeof s === 'string' && s.trim().length >= 1 && s.trim().length <= 12;
const idOk = s => typeof s === 'string' && /^[0-9a-f]{24}$/.test(s);
const targetOk = s => typeof s === 'string' && /^[pd]:[\w-]{1,40}$/.test(s);
// 열람하는 사람에게는 보여 줄 것만 남긴다. 알림 설정, 지역, 육아 기록, 일정은 빼고, 아이 정보도 필요한 것만.
export function forViewer(data) {
  const out = {}; VIEW_KEYS.forEach(k => { if (data && data[k] !== undefined) out[k] = data[k]; });
  out.kids = (out.kids || []).map(k => ({ id: k.id, name: k.name, birth: k.birth, born: k.born, sex: k.sex, photo: k.photo, order: k.order }));
  return out;
}
const homeName = data => { const k = data && Array.isArray(data.kids) && data.kids[0]; return k && k.name ? String(k.name).slice(0, 20) + '네' : '아기네'; };

export class HomeCore {
  constructor(store, now = Date.now()) { this.s = store; this.now = now; }
  // 여러 조각으로 나눠 저장한다(한 칸에 넣을 수 있는 크기가 정해져 있다).
  async putBig(key, bytes) {
    const old = await this.s.get(key), n = Math.ceil(bytes.length / CHUNK) || 1, puts = {};
    for (let i = 0; i < n; i++) puts[`${key}#${i}`] = bytes.slice(i * CHUNK, (i + 1) * CHUNK);
    await this.s.put(puts); await this.s.put(key, { n, size: bytes.length });
    if (old && old.n > n) await this.s.delete(Array.from({ length: old.n - n }, (_, i) => `${key}#${n + i}`));
  }
  async getBig(key) {
    const m = await this.s.get(key); if (!m) return null;
    const parts = await this.s.get(Array.from({ length: m.n }, (_, i) => `${key}#${i}`)), out = new Uint8Array(m.size); let at = 0;
    for (let i = 0; i < m.n; i++) { const p = parts.get(`${key}#${i}`); if (!p) return null; out.set(new Uint8Array(p), at); at += p.byteLength; }
    return out;
  }
  async dropBig(key) { const m = await this.s.get(key); if (!m) return 0; await this.s.delete([key, ...Array.from({ length: m.n }, (_, i) => `${key}#${i}`)]); return m.size; }
  async meta() { return (await this.s.get('meta')) || null; }
  async member(token) { if (typeof token !== 'string' || token.length < 32) return null; const h = await sha(token), m = await this.s.get('m:' + h); return m ? Object.assign(m, { h }) : null; }
  async members() { return [...(await this.s.list({ prefix: 'm:' })).values()].map(m => ({ id: m.id, nick: m.nick, role: m.role })); }
  async addMember(role, nick) {
    const token = rand(32), id = rand(6), h = await sha(token);
    await this.s.put('m:' + h, { id, nick: nick.trim(), role, at: this.now, seen: this.now }); return { token, id };
  }
  async create(nick, data) {
    if (await this.meta()) return [409, { error: 'exists' }];
    if (!nickOk(nick)) return [400, { error: 'nick' }];
    const text = JSON.stringify(data || {}); if (text.length > MAX_STATE) return [413, { error: 'size' }];
    await this.s.put('meta', { name: homeName(data), at: this.now, bytes: 0, rev: 1 }); await this.putBig('state', enc.encode(text));
    const m = await this.addMember('owner', nick); return [200, { token: m.token, id: m.id, role: 'owner', rev: 1, name: homeName(data) }];
  }
  async invite(me, role) {
    if (!['editor', 'viewer'].includes(role)) return [400, { error: 'role' }];
    const code = rand(12); await this.s.put('inv:' + await sha(code), { role, by: me.id, at: this.now }); return [200, { code }];
  }
  async peekInvite(code) {
    if (typeof code !== 'string' || !/^[0-9a-f]{24}$/.test(code)) return null;
    const i = await this.s.get('inv:' + await sha(code)); return i && this.now - i.at < INVITE_DAYS * 86400000 ? i : null;
  }
  async peek(code) {
    const i = await this.peekInvite(code), meta = await this.meta(); if (!i || !meta) return [404, { error: 'invite' }];
    const by = (await this.members()).find(m => m.id === i.by); return [200, { name: meta.name, role: i.role, by: by ? by.nick : '' }];
  }
  async join(code, nick) {
    const i = await this.peekInvite(code); if (!i) return [404, { error: 'invite' }];
    if (!nickOk(nick)) return [400, { error: 'nick' }];
    if ((await this.members()).length >= MAX_MEMBERS) return [503, { error: 'full' }];
    const m = await this.addMember(i.role, nick), meta = await this.meta(); return [200, { token: m.token, id: m.id, role: i.role, name: meta.name }];
  }
  async state(me, have) {
    const meta = await this.meta(), base = { rev: meta.rev, name: meta.name, me: { id: me.id, nick: me.nick, role: me.role }, members: await this.members() };
    if (Number(have) === meta.rev) return [200, Object.assign(base, { same: true })];
    const data = JSON.parse(new TextDecoder().decode(await this.getBig('state')));
    return [200, Object.assign(base, { data: me.role === 'viewer' ? forViewer(data) : data })];
  }
  async write(me, body) {
    if (!EDIT.includes(me.role)) return [403, { error: 'role' }];
    if (!body || typeof body.data !== 'object' || !body.data) return [400, { error: 'data' }];
    const meta = await this.meta();
    if (body.rev !== meta.rev) return this.state(me, -1).then(([, s]) => [409, s]);
    const text = JSON.stringify(body.data); if (text.length > MAX_STATE) return [413, { error: 'size' }];
    await this.putBig('state', enc.encode(text)); meta.rev++; meta.name = homeName(body.data); await this.s.put('meta', meta);
    return [200, { rev: meta.rev }];
  }
  async putPhoto(me, id, thumb, type, bytes) {
    if (!EDIT.includes(me.role)) return [403, { error: 'role' }];
    if (!idOk(id) || !/^(image|video)\/[\w.+-]+$/.test(type || '')) return [400, { error: 'photo' }];
    if (!bytes.length || bytes.length > MAX_PHOTO) return [413, { error: 'size' }];
    const meta = await this.meta(), key = `ph:${id}:${thumb ? 't' : 'f'}`, was = await this.dropBig(key);
    if (meta.bytes - was + bytes.length > MAX_BYTES) { meta.bytes -= was; await this.s.put('meta', meta); return [507, { error: 'full' }]; }
    await this.putBig(key, bytes); await this.s.put(key + ':type', type); meta.bytes += bytes.length - was; await this.s.put('meta', meta);
    return [200, { ok: true }];
  }
  async getPhoto(id, thumb) {
    if (!idOk(id)) return null; const key = `ph:${id}:${thumb ? 't' : 'f'}`, b = await this.getBig(key);
    return b ? { type: (await this.s.get(key + ':type')) || 'image/jpeg', bytes: b } : null;
  }
  async talk() {
    const notes = [...(await this.s.list({ prefix: 'note:' })).values()], likes = {};
    for (const k of (await this.s.list({ prefix: 'like:' })).keys()) { const [t, who] = k.slice(5).split('|'); (likes[t] = likes[t] || []).push(who); }
    return [200, { notes: notes.sort((a, b) => a.at - b.at), likes }];
  }
  async like(me, b) {
    if (!b || !targetOk(b.target)) return [400, { error: 'target' }];
    const k = `like:${b.target}|${me.id}`; if (b.on) await this.s.put(k, 1); else await this.s.delete(k);
    return this.talk();
  }
  async note(me, b) {
    if (!b || !targetOk(b.target) || typeof b.text !== 'string' || !b.text.trim() || b.text.length > 500) return [400, { error: 'note' }];
    const all = await this.s.list({ prefix: 'note:' }); if (all.size >= MAX_NOTES) return [503, { error: 'full' }];
    let parent = '';
    if (b.parent) { const p = all.get('note:' + b.parent); if (!p || p.target !== b.target) return [400, { error: 'parent' }]; parent = p.parent || p.id; } // 대댓글의 대댓글은 같은 댓글 아래에 붙인다
    const n = { id: rand(8), target: b.target, parent, who: me.id, nick: me.nick, text: b.text.trim(), at: this.now };
    await this.s.put('note:' + n.id, n); return this.talk();
  }
  async unnote(me, b) {
    const n = b && typeof b.id === 'string' && await this.s.get('note:' + b.id); if (!n) return [404, { error: 'note' }];
    if (n.who !== me.id && me.role !== 'owner') return [403, { error: 'role' }];
    const kids = [...(await this.s.list({ prefix: 'note:' })).values()].filter(x => x.parent === n.id).map(x => 'note:' + x.id);
    await this.s.delete(['note:' + n.id, ...kids]); return this.talk();
  }
  async rename(me, b) {
    if (!b || !nickOk(b.nick)) return [400, { error: 'nick' }];
    const m = await this.s.get('m:' + me.h); m.nick = b.nick.trim(); await this.s.put('m:' + me.h, m); return [200, { nick: m.nick }];
  }
  async leave(me) { if (me.role === 'owner') return [400, { error: 'owner' }]; await this.s.delete('m:' + me.h); return [200, { ok: true }]; }
  async kick(me, b) {
    if (me.role !== 'owner') return [403, { error: 'role' }];
    for (const [k, m] of await this.s.list({ prefix: 'm:' })) if (b && m.id === b.id && m.role !== 'owner') { await this.s.delete(k); return [200, { members: await this.members() }]; }
    return [404, { error: 'member' }];
  }
  // 주소 모양: /h/<집>/<일>[/<사진>]
  async route(req, path) {
    const p = path.split('/').filter(Boolean), what = p[2] || '', m = req.method, url = new URL(req.url);
    const body = async () => { const t = await req.text(); if (t.length > MAX_STATE + 1000) throw 413; try { return JSON.parse(t); } catch { throw 400; } };
    try {
      if (what === 'new' && m === 'POST') { const b = await body(); return this.create(b.nick, b.data); }
      if (!await this.meta()) return [404, { error: 'home' }];
      if (what === 'peek' && m === 'GET') return this.peek(url.searchParams.get('c'));
      if (what === 'join' && m === 'POST') { const b = await body(); return this.join(b.c, b.nick); }
      const me = await this.member((req.headers.get('authorization') || '').replace(/^Bearer /, ''));
      if (!me) return [401, { error: 'token' }];
      if (this.now - me.seen > 3600000) { const k = 'm:' + me.h, x = await this.s.get(k); x.seen = this.now; await this.s.put(k, x); }
      if (what === 'state' && m === 'GET') return this.state(me, url.searchParams.get('have'));
      if (what === 'state' && m === 'PUT') return this.write(me, await body());
      if (what === 'invite' && m === 'POST') { if (!EDIT.includes(me.role)) return [403, { error: 'role' }]; return this.invite(me, (await body()).role); }
      if (what === 'photo' && m === 'PUT') { const len = Number(req.headers.get('content-length') || 0); if (len > MAX_PHOTO) return [413, { error: 'size' }]; return this.putPhoto(me, p[3], url.searchParams.get('t') === '1', (req.headers.get('content-type') || '').split(';')[0], new Uint8Array(await req.arrayBuffer())); }
      if (what === 'photo' && m === 'GET') { const r = await this.getPhoto(p[3], url.searchParams.get('t') === '1'); return r ? [200, r] : [404, { error: 'photo' }]; }
      if (what === 'talk' && m === 'GET') return this.talk();
      if (what === 'like' && m === 'POST') return this.like(me, await body());
      if (what === 'note' && m === 'POST') return this.note(me, await body());
      if (what === 'unnote' && m === 'POST') return this.unnote(me, await body());
      if (what === 'me' && m === 'POST') return this.rename(me, await body());
      if (what === 'leave' && m === 'POST') return this.leave(me);
      if (what === 'kick' && m === 'POST') return this.kick(me, await body());
      return [404, { error: 'path' }];
    } catch (e) { if (typeof e === 'number') return [e, { error: 'body' }]; throw e; }
  }
}
export { ROLES };
