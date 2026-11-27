/* 가족 수첩 서버의 한 집(수첩 하나). 초대받은 사람만 들어온다.
   - 함께 쓰기(owner, editor): 기록 전체를 보고 고친다.
   - 열람(viewer): 아이 정보, 일기, 앨범만 보고 좋아요와 댓글만 단다.
   열쇠(token)와 초대 번호는 원래 값을 저장하지 않고 SHA-256 값만 둔다.
   초대 링크는 한 번만 쓸 수 있다. 링크를 연 사람은 카카오(또는 네이버)로 로그인해야 하고,
   처음 한 번은 초대한 가족이 그 사람의 카카오 이름과 사진을 보고 승인해야 들어온다.
   승인된 사람은 카카오 계정(서버만 아는 값으로 바꾼 것)과 묶여서, 새 기기에서도 같은 계정으로 다시 들어온다. */
const ROLES = ['owner', 'editor', 'viewer'], EDIT = ['owner', 'editor'];
const CHUNK = 120000, MAX_STATE = 1500000, MAX_PHOTO = 1900000, MAX_BYTES = 400 * 1048576, MAX_MEMBERS = 30, MAX_NOTES = 20000, INVITE_DAYS = 3, WAIT_DAYS = 3, DAY = 86400000;
const VIEW_KEYS = ['v', 'kids', 'diary', 'photos', 'faces'];
const enc = new TextEncoder();
export const hex = u => Array.from(new Uint8Array(u), b => b.toString(16).padStart(2, '0')).join('');
export const rand = n => hex(crypto.getRandomValues(new Uint8Array(n)));
export const sha = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const b64 = u => btoa(String.fromCharCode(...new Uint8Array(u))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const hmacKey = key => crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
// 로그인 서버가 서명한 확인표 { p: 카카오·네이버, id: 이 앱에서만 쓰는 회원 값, n: 이름, i: 프로필 사진, e: 끝나는 때 }
export async function signWho(key, o) { const body = b64(enc.encode(JSON.stringify(o))); return body + '.' + b64(await crypto.subtle.sign('HMAC', await hmacKey(key), enc.encode(body))); }
export async function verifyWho(key, tok, now = Date.now()) {
  if (!key || typeof tok !== 'string' || tok.length > 3000) return null;
  const [body, sig] = tok.split('.'); if (!body || !sig) return null;
  try {
    if (!await crypto.subtle.verify('HMAC', await hmacKey(key), unb64(sig), enc.encode(body))) return null;
    const o = JSON.parse(new TextDecoder().decode(unb64(body)));
    if (!o || !['kakao', 'naver'].includes(o.p) || typeof o.id !== 'string' || !o.id || !(o.e > now)) return null;
    return { p: o.p, id: o.id, name: String(o.n || '').slice(0, 40), img: /^https:\/\/[^\s"'<>]{1,400}$/.test(o.i || '') ? o.i : '' };
  } catch { return null; }
}
export const whoKey = who => sha(`w:${who.p}:${who.id}`);
// 휴대폰 알림 주소: 브라우저 회사의 알림 서버만 받는다.
export function endpointOk(e) {
  if (typeof e !== 'string' || e.length > 800) return false;
  let u; try { u = new URL(e); } catch { return false; }
  return u.protocol === 'https:' && !u.port && !u.username && (['fcm.googleapis.com', 'updates.push.services.mozilla.com'].includes(u.hostname) || /^[a-z0-9-]+\.push\.apple\.com$/.test(u.hostname) || /^[a-z0-9.-]+\.notify\.windows\.com$/.test(u.hostname));
}
// 엄마·아빠(영어 포함)는 아기 부모님만 쓰는 별명이라, 보기만 초대받은 사람은 쓸 수 없다.
const parentNick = s => { const t = String(s || '').toLowerCase().replace(/[\s._\-\u200b-\u200d\u3164\ufeff]+/g, ''); return /엄마|아빠/.test(t.replace(/(큰|작은)(엄마|아빠)/g, '')) || !/^grand/.test(t) && /(mom|mommy|mum|mummy|mother|mama|momma|dad|daddy|father|papa)$/.test(t); };
export { parentNick };
const nickOk = s => typeof s === 'string' && s.trim().length >= 1 && s.trim().length <= 12;
const idOk = s => typeof s === 'string' && /^[0-9a-f]{24}$/.test(s);
const targetOk = s => typeof s === 'string' && /^[pd]:[\w-]{1,40}$/.test(s);
// 수첩 종류: 아기, 반려동물, 연애, 개인. 초대는 종류별로 받는다(cats가 없으면 모든 수첩).
export const CATS = ['baby', 'pet', 'couple', 'me'];
export const catOf = k => k && (k.kind === 'dog' || k.kind === 'cat') ? 'pet' : k && (k.kind === 'couple' || k.kind === 'me') ? k.kind : 'baby';
const LISTS = ['events', 'diary', 'photos', 'faces', 'logs'];
const inCats = (k, cats) => !cats || cats.includes(catOf(k));
// 그 사람이 볼 수 있는 수첩만 남긴다. '모두'의 기록(kid 없음)은 모든 수첩을 보는 사람만 본다.
export function scope(data, cats) {
  if (!cats || !data) return data;
  const kids = (data.kids || []).filter(k => inCats(k, cats)), ids = new Set(kids.map(k => k.id)), out = Object.assign({}, data, { kids });
  LISTS.forEach(n => { if (Array.isArray(data[n])) out[n] = data[n].filter(x => ids.has(x.kid)); });
  return out;
}
// 일부 수첩만 쓰는 사람이 저장하면 그 수첩만 바꾸고 나머지는 그대로 둔다.
export function unscope(stored, mine, cats) {
  if (!cats) return mine;
  stored = stored || {}; const out = Object.assign({}, stored);
  const myKids = (mine.kids || []).filter(k => inCats(k, cats)), ids = new Set(myKids.map(k => k.id).concat((stored.kids || []).filter(k => inCats(k, cats)).map(k => k.id)));
  out.kids = (stored.kids || []).filter(k => !inCats(k, cats)).concat(myKids);
  const first = myKids[0] && myKids[0].id;
  LISTS.forEach(n => { out[n] = (stored[n] || []).filter(x => !ids.has(x.kid)).concat((mine[n] || []).map(x => x.kid ? x : Object.assign({}, x, { kid: first })).filter(x => ids.has(x.kid))); });
  return out;
}
const nameFor = (data, cats) => homeName(scope(data, cats));
// 열람하는 사람에게는 보여 줄 것만 남긴다. 알림 설정, 지역, 육아 기록, 일정은 빼고, 아이 정보도 필요한 것만.
export function forViewer(data) {
  const out = {}; VIEW_KEYS.forEach(k => { if (data && data[k] !== undefined) out[k] = data[k]; });
  ['diary', 'photos'].forEach(k => { if (Array.isArray(out[k])) out[k] = out[k].filter(x => !x.priv); }); // 나만 보기
  out.kids = (out.kids || []).map(k => ({ id: k.id, kind: k.kind, name: k.name, birth: k.birth, born: k.born, sex: k.sex, photo: k.photo, order: k.order }));
  return out;
}
const homeName = data => { const k = data && Array.isArray(data.kids) && data.kids[0]; return k && k.name ? String(k.name).slice(0, 20) + '네' : '아기네'; };

export class HomeCore {
  constructor(store, now = Date.now(), key = '') { this.s = store; this.now = now; this.key = key; }
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
  // 처음 받은 열쇠는 m:<값>, 새 기기에서 다시 들어와 받은 열쇠는 tk:<값> → 같은 사람
  async member(token) {
    if (typeof token !== 'string' || token.length < 32) return null;
    let h = await sha(token), m = await this.s.get('m:' + h);
    if (!m) { const t = await this.s.get('tk:' + h); if (t) { h = t; m = await this.s.get('m:' + h); } }
    return m ? Object.assign(m, { h }) : null;
  }
  // 카카오 이름과 사진은 함께 쓰는 가족에게만 보인다.
  async members(full) { return [...(await this.s.list({ prefix: 'm:' })).values()].map(m => Object.assign({ id: m.id, nick: m.nick, role: m.role, cats: m.cats || null, nicks: m.nicks || null }, full && m.k ? { kname: m.kname || '', kimg: m.kimg || '', kp: m.kp } : {})); }
  async byWho(k) { for (const [key, m] of await this.s.list({ prefix: 'm:' })) if (m.k === k) return Object.assign(m, { h: key.slice(2) }); return null; }
  async addMember(role, nick, who) {
    const token = rand(32), id = rand(6), h = await sha(token);
    await this.s.put('m:' + h, Object.assign({ id, nick: nick.trim(), role, at: this.now, seen: this.now }, who || {})); return { token, id };
  }
  async dropMember(h) { const tk = [...(await this.s.list({ prefix: 'tk:' }))].filter(([, v]) => v === h).map(([k]) => k); await this.s.delete(['m:' + h, ...tk]); }
  async who(tok) { const w = await verifyWho(this.key, tok, this.now); return w ? { k: await whoKey(w), kname: w.name, kimg: w.img, kp: w.p } : null; }
  async create(nick, data, tok) {
    if (await this.meta()) return [409, { error: 'exists' }];
    if (!nickOk(nick)) return [400, { error: 'nick' }];
    const text = JSON.stringify(data || {}); if (text.length > MAX_STATE) return [413, { error: 'size' }];
    await this.s.put('meta', { name: homeName(data), at: this.now, bytes: 0, rev: 1 }); await this.putBig('state', enc.encode(text));
    const w = await this.who(tok), m = await this.addMember('owner', nick, w);
    return [200, Object.assign({ token: m.token, id: m.id, role: 'owner', rev: 1, name: homeName(data) }, w ? { _link: { k: w.k, role: 'owner', name: homeName(data) } } : {})];
  }
  async invite(me, role, cat) {
    if (!['editor', 'viewer'].includes(role)) return [400, { error: 'role' }];
    if (cat != null && !CATS.includes(cat)) return [400, { error: 'cat' }];
    if (me.cats && !(cat && me.cats.includes(cat))) return [403, { error: 'cat' }];
    const code = rand(12); await this.s.put('inv:' + await sha(code), Object.assign({ role, by: me.id, at: this.now }, cat ? { cat } : {})); return [200, { code }];
  }
  async peekInvite(code) {
    if (typeof code !== 'string' || !/^[0-9a-f]{24}$/.test(code)) return null;
    const h = await sha(code), i = await this.s.get('inv:' + h); return i && this.now - i.at < INVITE_DAYS * DAY ? Object.assign(i, { h }) : null;
  }
  async peek(code) {
    const i = await this.peekInvite(code), meta = await this.meta(); if (!i || !meta) return [404, { error: 'invite' }];
    const byM = (await this.members()).find(m => m.id === i.by), by = byM && { nick: (i.cat && byM.nicks && byM.nicks[i.cat]) || byM.nick }, name = i.cat ? nameFor(await this.data(), [i.cat]) : meta.name; return [200, { name, ...(i.cat ? { cat: i.cat } : {}), role: i.role, by: by ? by.nick : '', used: Boolean(i.used) }];
  }
  // 아직 아무도 안 쓴 초대 (끝난 것은 지운다)
  async invites() {
    const out = [], old = [];
    for (const [k, i] of await this.s.list({ prefix: 'inv:' })) { if (this.now - i.at >= INVITE_DAYS * DAY) old.push(k); else if (!i.used) out.push({ id: k.slice(4, 20), role: i.role, cat: i.cat || null, at: i.at, by: i.by }); }
    if (old.length) await this.s.delete(old); return out;
  }
  async uninvite(b) {
    for (const k of (await this.s.list({ prefix: 'inv:' })).keys()) if (b && typeof b.id === 'string' && b.id.length === 16 && k.slice(4, 20) === b.id) { await this.s.delete(k); return [200, { invites: await this.invites() }]; }
    return [404, { error: 'invite' }];
  }
  // 이미 들어온 사람이 새 기기에서 다시 들어온다(같은 카카오 계정이면).
  async back(tok) {
    const w = await this.who(tok); if (!w) return [401, { error: 'login' }];
    const m = await this.byWho(w.k); if (!m) return [404, { error: 'member' }];
    const token = rand(32); await this.s.put('tk:' + await sha(token), m.h);
    if (w.kname !== m.kname || w.kimg !== m.kimg) { const x = await this.s.get('m:' + m.h); x.kname = w.kname; x.kimg = w.kimg; await this.s.put('m:' + m.h, x); }
    const name = nameFor(await this.data(), m.cats); return [200, { token, id: m.id, role: m.role, nick: m.nick, name, _link: { k: w.k, role: m.role, name } }];
  }
  async data() { return JSON.parse(new TextDecoder().decode(await this.getBig('state'))); }
  // 초대 링크로 들어오기. 로그인한 확인표가 있어야 하고, 처음이면 승인을 기다린다.
  async join(code, nick, tok) {
    const w = await this.who(tok); if (!w) return [401, { error: 'login' }];
    const old = await this.byWho(w.k), i = await this.peekInvite(code);
    if (old) { // 이미 가족이면 새 수첩 종류만 더한다
      if (i && !i.used && old.cats) { const x = await this.s.get('m:' + old.h); x.cats = i.cat ? [...new Set(x.cats.concat(i.cat))] : undefined; if (!i.cat) delete x.cats; await this.s.put('m:' + old.h, x); i.used = w.k; await this.s.put('inv:' + i.h, (({ h, ...y }) => y)(i)); }
      return this.back(tok);
    }
    if (!i) return [404, { error: 'invite' }];
    if (i.used && i.used !== w.k) return [410, { error: 'used' }];
    if (!nickOk(nick)) return [400, { error: 'nick' }];
    if (i.role === 'viewer' && parentNick(nick)) return [400, { error: 'parent' }];
    if ((await this.members()).length + (await this.pendings()).length >= MAX_MEMBERS) return [503, { error: 'full' }];
    const rid = w.k.slice(0, 16), ticket = rand(24), meta = await this.meta();
    const was = await this.s.get('pend:' + rid); // 같은 사람이 다시 열면 기다리던 것을 이어 간다
    await this.s.put('pend:' + rid, { rid, role: i.role, cat: i.cat || null, nick: nick.trim(), k: w.k, kname: w.kname, kimg: w.kimg, kp: w.kp, at: was ? was.at : this.now, t: await sha(ticket), by: i.by, inv: i.h, ok: Boolean(was && was.ok) });
    i.used = w.k; await this.s.put('inv:' + i.h, (({ h, ...x }) => x)(i));
    if (!was) await this.ping({ id: '' }, true); // 함께 쓰는 가족에게 승인 요청 알림
    return [202, { wait: true, ticket, name: i.cat ? nameFor(await this.data(), [i.cat]) : meta.name, role: i.role }];
  }
  // 승인을 기다리는 사람들 (오래된 것은 지운다)
  async pendings() {
    const out = [], old = [];
    for (const [k, x] of await this.s.list({ prefix: 'pend:' })) { if (this.now - x.at >= WAIT_DAYS * DAY) old.push(k); else if (!x.no && !x.ok) out.push({ rid: x.rid, role: x.role, cat: x.cat || null, nick: x.nick, kname: x.kname, kimg: x.kimg, kp: x.kp, at: x.at, by: x.by }); }
    if (old.length) await this.s.delete(old); return out;
  }
  async approve(b) {
    const k = 'pend:' + (b && typeof b.rid === 'string' ? b.rid : ''), x = await this.s.get(k);
    if (!x || x.no || x.ok) return [404, { error: 'wait' }];
    if (b.ok) x.ok = true; else { x.no = true; if (x.inv) await this.s.delete('inv:' + x.inv); } // 거절하면 그 링크도 끝낸다
    await this.s.put(k, x);
    return [200, { pending: await this.pendings() }];
  }
  // 기다리는 사람이 묻는다: 승인됐나요?
  async wait(b) {
    if (!b || typeof b.ticket !== 'string' || b.ticket.length !== 48) return [404, { stage: 'none' }];
    const t = await sha(b.ticket);
    for (const [k, x] of await this.s.list({ prefix: 'pend:' })) {
      if (x.t !== t) continue;
      if (this.now - x.at >= WAIT_DAYS * DAY) { await this.s.delete(k); return [200, { stage: 'none' }]; }
      if (x.no) { await this.s.delete(k); return [200, { stage: 'no' }]; }
      if (!x.ok) return [200, { stage: 'wait' }];
      // 승인된 뒤 처음 물으면 가족으로 넣는다. 응답이 끊겨 다시 물어도 같은 사람의 새 열쇠를 준다(며칠 동안).
      const cats = x.cat ? [x.cat] : undefined, meta = { name: nameFor(await this.data(), cats) }, link = { k: x.k, role: x.role, name: meta.name };
      if (x.mh) {
        const m = await this.s.get('m:' + x.mh); if (!m) { await this.s.delete(k); return [200, { stage: 'none' }]; }
        const token = rand(32); await this.s.put('tk:' + await sha(token), x.mh);
        return [200, { stage: 'ok', token, id: m.id, role: m.role, nick: m.nick, name: meta.name, _link: link }];
      }
      const m = await this.addMember(x.role, x.nick, Object.assign({ k: x.k, kname: x.kname, kimg: x.kimg, kp: x.kp }, cats ? { cats, nicks: { [x.cat]: x.nick } } : {}));
      x.mh = await sha(m.token); await this.s.put(k, x);
      return [200, { stage: 'ok', token: m.token, id: m.id, role: x.role, nick: x.nick, name: meta.name, _link: link }];
    }
    return [200, { stage: 'none' }];
  }
  // 이미 들어와 있는 사람이 내 카카오 계정을 묶는다(새 기기에서 다시 들어오려고).
  async link(me, b) {
    const w = await this.who(b && b.tok); if (!w) return [401, { error: 'login' }];
    const o = await this.byWho(w.k); if (o && o.h !== me.h) return [409, { error: 'taken' }];
    const x = await this.s.get('m:' + me.h); Object.assign(x, w); await this.s.put('m:' + me.h, x);
    const meta = await this.meta(); return [200, { ok: true, _link: { k: w.k, role: x.role, name: meta.name } }];
  }
  async state(me, have) {
    const meta = await this.meta(), edit = EDIT.includes(me.role), all = await this.data(), base = { rev: meta.rev, name: me.cats ? nameFor(all, me.cats) : meta.name, me: { id: me.id, nick: me.nick, role: me.role, cats: me.cats || null, linked: Boolean(me.k) }, members: await this.members(edit) };
    if (edit) Object.assign(base, { pending: await this.pendings(), invites: await this.invites() });
    if (Number(have) === meta.rev) return [200, Object.assign(base, { same: true })];
    const data = scope(all, me.cats);
    return [200, Object.assign(base, { data: me.role === 'viewer' ? forViewer(data) : data })];
  }
  async write(me, body) {
    if (!EDIT.includes(me.role)) return [403, { error: 'role' }];
    if (!body || typeof body.data !== 'object' || !body.data) return [400, { error: 'data' }];
    const meta = await this.meta();
    if (body.rev !== meta.rev) return this.state(me, -1).then(([, s]) => [409, s]);
    const next = me.cats ? unscope(await this.data(), body.data, me.cats) : body.data;
    const text = JSON.stringify(next); if (text.length > MAX_STATE) return [413, { error: 'size' }];
    await this.putBig('state', enc.encode(text)); meta.rev++; meta.name = homeName(next); await this.s.put('meta', meta);
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
  async talk(me) {
    const notes = [...(await this.s.list({ prefix: 'note:' })).values()], likes = {};
    for (const k of (await this.s.list({ prefix: 'like:' })).keys()) { const [t, who] = k.slice(5).split('|'); (likes[t] = likes[t] || []).push(who); }
    const ms = await this.members(), one = me && me.cats && me.cats.length === 1 ? me.cats[0] : null;
    const nicks = Object.fromEntries(ms.map(m => [m.id, (one && m.nicks && m.nicks[one]) || m.nick])), nicksBy = Object.fromEntries(ms.filter(m => m.nicks).map(m => [m.id, m.nicks]));
    let ns = notes;
    if (me && me.cats) { // 볼 수 있는 수첩의 일기·사진에 달린 것만
      const d = scope(await this.data(), me.cats), ok = new Set((d.diary || []).map(x => 'd:' + x.id).concat((d.photos || []).concat(d.faces || []).map(x => 'p:' + x.id)));
      ns = notes.filter(n => ok.has(n.target)); Object.keys(likes).forEach(t => { if (!ok.has(t)) delete likes[t]; });
    }
    // 함께 쓰는 가족에게는 승인을 기다리는 사람도 알려 준다(휴대폰 알림용)
    return [200, Object.assign({ notes: ns.sort((a, b) => a.at - b.at), likes, nicks, nicksBy }, me && EDIT.includes(me.role) ? { pending: (await this.pendings()).map(p => ({ rid: p.rid, nick: p.nick, kname: p.kname, role: p.role })) } : {})];
  }
  async like(me, b) {
    if (!b || !targetOk(b.target)) return [400, { error: 'target' }];
    const k = `like:${b.target}|${me.id}`; if (b.on) { if (!await this.s.get(k)) await this.ping(me, true); await this.s.put(k, 1); } else await this.s.delete(k);
    return this.talk(me);
  }
  async note(me, b) {
    if (!b || !targetOk(b.target) || typeof b.text !== 'string' || !b.text.trim() || b.text.length > 500) return [400, { error: 'note' }];
    const all = await this.s.list({ prefix: 'note:' }); if (all.size >= MAX_NOTES) return [503, { error: 'full' }];
    let parent = '';
    if (b.parent) { const p = all.get('note:' + b.parent); if (!p || p.target !== b.target) return [400, { error: 'parent' }]; parent = p.parent || p.id; } // 대댓글의 대댓글은 같은 댓글 아래에 붙인다
    const n = { id: rand(8), target: b.target, parent, who: me.id, nick: me.nick, text: b.text.trim(), at: this.now };
    await this.s.put('note:' + n.id, n); await this.ping(me, false); return this.talk(me);
  }
  async unnote(me, b) {
    const n = b && typeof b.id === 'string' && await this.s.get('note:' + b.id); if (!n) return [404, { error: 'note' }];
    if (n.who !== me.id && me.role !== 'owner') return [403, { error: 'role' }];
    const kids = [...(await this.s.list({ prefix: 'note:' })).values()].filter(x => x.parent === n.id).map(x => 'note:' + x.id);
    await this.s.delete(['note:' + n.id, ...kids]); return this.talk(me);
  }
  // 좋아요·댓글이 달리면 다른 가족의 휴대폰에 알린다(하트는 함께 쓰는 가족에게만). 잠시 모았다가 한 번에 보낸다.
  async ping(me, editorsOnly) {
    const to = [...(await this.s.list({ prefix: 'm:' })).values()].filter(m => m.push && m.id !== me.id && (!editorsOnly || EDIT.includes(m.role))).map(m => m.push);
    if (!to.length) return;
    const q = new Set((await this.s.get('pingq')) || []); to.forEach(e => q.add(e)); await this.s.put('pingq', [...q].slice(-60)); this.wantAlarm = true;
  }
  async takePings() { const q = (await this.s.get('pingq')) || []; await this.s.delete('pingq'); return q; }
  async setPush(me, b) {
    const e = b && b.endpoint; if (e && !endpointOk(e)) return [400, { error: 'endpoint' }];
    const x = await this.s.get('m:' + me.h); if (e) x.push = e; else delete x.push; await this.s.put('m:' + me.h, x); return [200, { ok: true }];
  }
  async rename(me, b) {
    if (!b || !nickOk(b.nick)) return [400, { error: 'nick' }];
    if (me.role === 'viewer' && parentNick(b.nick)) return [400, { error: 'parent' }];
    const m = await this.s.get('m:' + me.h);
    if (b.cat && CATS.includes(b.cat) && b.cat !== 'baby') m.nicks = Object.assign({}, m.nicks, { [b.cat]: b.nick.trim() }); else m.nick = b.nick.trim(); // 수첩 종류마다 별명
    await this.s.put('m:' + me.h, m); return [200, { nick: b.nick.trim() }];
  }
  async leave(me) { if (me.role === 'owner') return [400, { error: 'owner' }]; await this.dropMember(me.h); return [200, Object.assign({ ok: true }, me.k ? { _unlink: { k: me.k } } : {})]; }
  // 처음 만든 사람이 가족의 역할(함께 쓰기·보기만)을 바꾼다.
  async setRole(me, b) {
    if (me.role !== 'owner') return [403, { error: 'role' }];
    if (!b || !['editor', 'viewer'].includes(b.role)) return [400, { error: 'role' }];
    for (const [k, m] of await this.s.list({ prefix: 'm:' })) {
      if (m.id !== b.id || m.role === 'owner') continue;
      if (b.role === 'viewer' && parentNick(m.nick)) return [400, { error: 'parent' }];
      m.role = b.role; await this.s.put(k, m); const meta = await this.meta();
      return [200, Object.assign({ members: await this.members(true) }, m.k ? { _link: { k: m.k, role: m.role, name: meta.name } } : {})];
    }
    return [404, { error: 'member' }];
  }
  async kick(me, b) {
    if (me.role !== 'owner') return [403, { error: 'role' }];
    for (const [k, m] of await this.s.list({ prefix: 'm:' })) if (b && m.id === b.id && m.role !== 'owner') { await this.dropMember(k.slice(2)); return [200, Object.assign({ members: await this.members(true) }, m.k ? { _unlink: { k: m.k } } : {})]; }
    return [404, { error: 'member' }];
  }
  // 주소 모양: /h/<집>/<일>[/<사진>]
  async route(req, path) {
    const p = path.split('/').filter(Boolean), what = p[2] || '', m = req.method, url = new URL(req.url);
    const body = async () => { const t = await req.text(); if (t.length > MAX_STATE + 1000) throw 413; try { return JSON.parse(t); } catch { throw 400; } };
    try {
      if (what === 'new' && m === 'POST') { const b = await body(); return this.create(b.nick, b.data, b.tok); }
      if (!await this.meta()) return [404, { error: 'home' }];
      if (what === 'peek' && m === 'GET') return this.peek(url.searchParams.get('c'));
      if (what === 'join' && m === 'POST') { const b = await body(); return this.join(b.c, b.nick, b.tok); }
      if (what === 'wait' && m === 'POST') return this.wait(await body());
      if (what === 'back' && m === 'POST') return this.back((await body()).tok);
      const me = await this.member((req.headers.get('authorization') || '').replace(/^Bearer /, ''));
      if (!me) return [401, { error: 'token' }];
      if (this.now - me.seen > 3600000) { const k = 'm:' + me.h, x = await this.s.get(k); x.seen = this.now; await this.s.put(k, x); }
      if (what === 'state' && m === 'GET') return this.state(me, url.searchParams.get('have'));
      if (what === 'state' && m === 'PUT') return this.write(me, await body());
      if (what === 'invite' && m === 'POST') { if (!EDIT.includes(me.role)) return [403, { error: 'role' }]; { const b = await body(); return this.invite(me, b.role, b.cat); } }
      if (what === 'photo' && m === 'PUT') { const len = Number(req.headers.get('content-length') || 0); if (len > MAX_PHOTO) return [413, { error: 'size' }]; return this.putPhoto(me, p[3], url.searchParams.get('t') === '1', (req.headers.get('content-type') || '').split(';')[0], new Uint8Array(await req.arrayBuffer())); }
      if (what === 'photo' && m === 'GET') { const r = await this.getPhoto(p[3], url.searchParams.get('t') === '1'); return r ? [200, r] : [404, { error: 'photo' }]; }
      if (what === 'approve' && m === 'POST') { if (!EDIT.includes(me.role)) return [403, { error: 'role' }]; return this.approve(await body()); }
      if (what === 'uninvite' && m === 'POST') { if (!EDIT.includes(me.role)) return [403, { error: 'role' }]; return this.uninvite(await body()); }
      if (what === 'link' && m === 'POST') return this.link(me, await body());
      if (what === 'talk' && m === 'GET') return this.talk(me);
      if (what === 'like' && m === 'POST') return this.like(me, await body());
      if (what === 'note' && m === 'POST') return this.note(me, await body());
      if (what === 'unnote' && m === 'POST') return this.unnote(me, await body());
      if (what === 'me' && m === 'POST') return this.rename(me, await body());
      if (what === 'push' && m === 'POST') return this.setPush(me, await body());
      if (what === 'leave' && m === 'POST') return this.leave(me);
      if (what === 'kick' && m === 'POST') return this.kick(me, await body());
      if (what === 'role' && m === 'POST') return this.setRole(me, await body());
      return [404, { error: 'path' }];
    } catch (e) { if (typeof e === 'number') return [e, { error: 'body' }]; throw e; }
  }
}
// 한 사람(카카오 계정)이 들어가 있는 집 목록. 새 기기에서 로그인하면 이 목록으로 다시 들어간다.
export class PersonCore {
  constructor(store) { this.s = store; }
  async list() { return (await this.s.get('homes')) || []; }
  async add(home, role, name) { const l = (await this.list()).filter(x => x.home !== home); l.push({ home, role, name }); await this.s.put('homes', l.slice(-40)); }
  async del(home) { await this.s.put('homes', (await this.list()).filter(x => x.home !== home)); }
}
export { ROLES };
