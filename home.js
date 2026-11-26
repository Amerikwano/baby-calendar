/* 가족 수첩: 함께 쓰기(같은 기록을 여럿이 고침)와 열람(일기·앨범만 보고 좋아요·댓글).
   기록과 줄인 사진은 가족 수첩 서버(family/)에 두고, 초대 링크를 받아 들어온 사람만 볼 수 있다.
   초대 링크는 한 사람만 쓸 수 있고, 링크를 연 사람은 카카오로 로그인한 뒤 초대한 가족의 승인을 받아야 들어온다. */
(function (root) {
  'use strict';
  const ARR = ['kids', 'events', 'diary', 'photos', 'faces', 'logs'];
  const DEVICE = ['cur', 'leads', 'hour', 'exports']; // 사람마다 다른 것(고른 아이, 알림 설정)은 나누지 않는다
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const key = x => x && x.id != null ? 'i:' + x.id : 'j:' + JSON.stringify(x);
  function shared(d) { const o = {}; Object.keys(d || {}).forEach(k => { if (!DEVICE.includes(k)) o[k] = d[k]; }); return o; }
  // 마지막으로 맞춘 기록(base)에서 내가 바꾼 것만 남이 바꾼 기록(theirs) 위에 얹는다.
  // 목록은 항목(id)마다 합치고, 같은 항목을 둘 다 고쳤으면 내 것을 쓴다.
  function merge(base, mine, theirs) {
    base = base || {}; const out = Object.assign({}, theirs);
    Object.keys(mine).forEach(k => { if (!ARR.includes(k) && !same(mine[k], base[k])) out[k] = mine[k]; });
    ARR.forEach(k => {
      const B = new Map((base[k] || []).map(x => [key(x), x])), M = new Map((mine[k] || []).map(x => [key(x), x])), T = theirs[k] || [];
      const res = new Map(T.map(x => [key(x), x]));
      M.forEach((x, id) => { const b = B.get(id); if (!b || !same(b, x)) res.set(id, x); });
      B.forEach((x, id) => { if (!M.has(id)) res.delete(id); });
      const order = T.map(key).filter(id => res.has(id)).concat([...M.keys()].filter(id => res.has(id) && !T.some(x => key(x) === id)));
      out[k] = order.map(id => res.get(id));
    });
    return out;
  }
  const target = (kind, id) => (kind === 'diary' ? 'd:' : 'p:') + id;
  // 댓글과 대댓글을 묶는다
  function thread(notes, t) {
    const mine = notes.filter(n => n.target === t), tops = mine.filter(n => !n.parent);
    return tops.map(n => ({ n, replies: mine.filter(r => r.parent === n.id) }));
  }
  const count = (talk, t) => ({ likes: ((talk && talk.likes[t]) || []).length, notes: talk ? talk.notes.filter(n => n.target === t).length : 0 });
  const parseJoin = s => { const m = /^([0-9a-f]{24})\.([0-9a-f]{24})$/.exec(s || ''); return m ? { home: m[1], code: m[2] } : null; };
  const out = { ARR, DEVICE, shared, merge, same, target, thread, count, parseJoin };
  if (typeof module !== 'undefined' && module.exports) module.exports = out; else root.Fam = out;
})(typeof window !== 'undefined' ? window : globalThis);

// 내 컴퓨터에서 시험할 때만 다른 서버를 쓸 수 있다.
const FAMILY_URL = (typeof location !== 'undefined' && location.hostname === 'localhost' && localStorage.getItem('baby-family-url')) || 'https://baby-notebook-family.baby-calendar.workers.dev';
const jget = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const jput = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { } if (k === 'baby-home' || k === 'baby-visits') setTimeout(famCredsSave); };
// 휴대폰 알림이 오면 서비스 워커가 새 좋아요·댓글을 가족 수첩에서 받아 글을 만든다. 그때 쓸 열쇠를 기기 안(IndexedDB)에 둔다.
function famCredsSave() {
  const list = (bound ? [{ id: bound.id, token: bound.token, mid: bound.mid, name: bound.name, role: bound.role }] : []).concat(visits.map(v => ({ id: v.id, token: v.token, mid: v.mid, name: v.name, role: 'viewer' })));
  Local.setKV('fam-creds', { url: FAMILY_URL, list }).catch(() => { }); famPushReg(); talkPrime(list);
}
// 알림에 예전 좋아요·댓글이 한꺼번에 뜨지 않게, 처음 한 번 지금까지의 것을 본 것으로 적어 둔다.
async function talkPrime(list) {
  const seen = new Set((await Local.getKV('talk-seen').catch(() => null)) || []), homes = new Set(jget('baby-talk-primed') || []); let changed = false;
  for (const h of list) {
    if (homes.has(h.id)) continue;
    const t = await famCall(h, 'talk').catch(() => null); if (!t) continue;
    (t.notes || []).forEach(n => seen.add('n:' + n.id)); (t.pending || []).forEach(p => seen.add('p:' + h.id + p.rid)); Object.entries(t.likes || {}).forEach(([tg, who]) => who.forEach(m => seen.add('l:' + h.id + tg + '|' + m)));
    homes.add(h.id); changed = true;
  }
  if (changed) { await Local.setKV('talk-seen', [...seen].slice(-4000)).catch(() => { }); jput('baby-talk-primed', [...homes]); }
}
// 휴대폰 알림을 켰으면, 내가 들어가 있는 가족 수첩마다 알림 주소를 알려 둔다(좋아요·댓글 알림용).
async function famPushReg() {
  if (typeof push === 'undefined') return;
  const e = push.state === 'on' && push.sub ? push.sub.endpoint : '', homes = (bound ? [bound] : []).concat(visits), was = jget('baby-push-reg') || {};
  const done = new Set(was.e === e ? was.homes || [] : []), todo = homes.filter(h => !done.has(h.id));
  if (was.e && was.e !== e) for (const h of homes) await famCall(h, 'push', { body: { endpoint: e } }).catch(() => { });
  for (const h of todo) if (e) { try { await famCall(h, 'push', { body: { endpoint: e } }); done.add(h.id); } catch { } }
  localStorage.setItem('baby-push-reg', JSON.stringify({ e, homes: [...done].filter(id => homes.some(h => h.id === id)) }));
}
// 내 별명(엄마, 아빠, 이모 …). 댓글과 가족 목록에 보인다.
const myNick = () => (jget('baby-me') || {}).nick || '';
// 내 수첩이 가족 수첩이면 { id, token, role, mid, name }
let bound = jget('baby-home');
// 열람 초대를 받은 집들 [{ id, token, mid, nick, name, kid }]
let visits = jget('baby-visits') || [];
let vis = null; // 지금 놀러 간 집 { …visit, data, talk, view }
let join = null; // 초대 링크로 들어왔을 때 { home, code, role, name, by, wait }
// 승인을 기다리는 초대 [{ home, ticket, role, nick, name, by, at }]
let waits = jget('baby-waits') || [];
let famPending = [], famInvites = [];
// 가족 수첩 서버에 보낼 로그인 확인표(카카오·네이버 로그인 서버가 서명함, 7일)
const myTok = () => { const a = typeof Social !== 'undefined' && Social.account(); return a && a.tok && Date.now() - (a.tokAt || 0) < 6.5 * 86400000 ? a.tok : ''; };
const famErr = s => s === 401 ? '초대가 끝났거나 가족 목록에서 빠졌어요.' : s === 404 ? '초대 링크가 끝났어요. 새 링크를 받아 주세요.' : s === 410 ? '이 초대 링크는 이미 다른 사람이 썼어요. 초대한 분께 새 링크를 받아 주세요.' : s === 413 || s === 507 ? '가족 수첩 저장 공간이 가득 찼어요.' : '가족 수첩 서버와 연결하지 못했어요. 잠시 뒤 다시 해 주세요.';
async function famCall(h, path, opt = {}) {
  const headers = {}; if (h && h.token) headers.authorization = 'Bearer ' + h.token;
  if (opt.body && !(opt.body instanceof Blob)) headers['content-type'] = 'application/json';
  if (opt.body instanceof Blob) headers['content-type'] = opt.body.type || 'image/jpeg';
  let r; try { r = await fetch(FAMILY_URL + (h ? `/h/${h.id}/` : '/') + path, { method: opt.method || (opt.body ? 'POST' : 'GET'), headers, body: opt.body instanceof Blob ? opt.body : opt.body ? JSON.stringify(opt.body) : undefined, signal: AbortSignal.timeout(opt.slow ? 60000 : 15000) }); }
  catch { throw Object.assign(new Error(famErr(0)), { status: 0 }); }
  if (opt.raw && r.ok) return r;
  const j = await r.json().catch(() => ({}));
  if (!r.ok && !(r.status === 409 && opt.conflict)) throw Object.assign(new Error(famErr(r.status)), { status: r.status, body: j });
  return Object.assign(j, { status: r.status });
}

/* ── 내 수첩을 가족과 맞추기 ── */
let famQ = Promise.resolve(), famT = 0, famBusy = false;
const famBase = () => Local.getKV('home-base').then(b => b && bound && b.home === bound.id ? b : null);
const setBase = (rev, data) => Local.setKV('home-base', { home: bound.id, rev, data });
// 서버의 기록을 내 수첩에 넣는다. 사람마다 다른 설정은 그대로 둔다.
async function famApply(x) {
  famBusy = true;
  try { return await save(d => { Object.keys(d).forEach(k => { if (!Fam.DEVICE.includes(k)) delete d[k]; }); Object.assign(d, Fam.shared(fresh()), Family.migrate(Object.assign({ v: 1 }, x))); if (!d.kids.some(k => k.id === d.cur)) d.cur = d.kids[0].id; }); }
  finally { famBusy = false; }
}
const famRun = fn => famQ = famQ.then(fn).catch(e => { if (e.status === 401) famLost(); else if (e.status) toast(e.message); });
function famPull() {
  if (!bound || !started) return famQ;
  return famRun(async () => {
    const base = await famBase(), r = await famCall(bound, 'state' + (base ? '?have=' + base.rev : ''));
    famMembers = r.members || famMembers; famSeen(r);
    if (!r.same) {
      const mine = Fam.shared(db);
      if (!base || Fam.same(mine, base.data)) await famApply(r.data); else await famApply(Fam.merge(base.data, mine, r.data));
      await setBase(r.rev, r.data); await famPushNow();
    }
    await famTalk();
    famUpload();
  });
}
async function famPushNow() {
  for (let i = 0; i < 3; i++) {
    const base = await famBase(), mine = Fam.shared(db); if (base && Fam.same(mine, base.data)) break;
    const r = await famCall(bound, 'state', { method: 'PUT', body: { rev: base ? base.rev : 0, data: mine }, conflict: true });
    if (r.status === 200) { await setBase(r.rev, mine); break; }
    await famApply(Fam.merge(base ? base.data : {}, mine, r.data)); await setBase(r.rev, r.data); // 다른 가족이 먼저 고쳤으면 합쳐서 다시 올린다
  }
  famUpload();
}
// 저장할 때마다 잠깐 기다렸다 올린다.
function famLater() { if (!bound || famBusy || bound.role === 'viewer') return; clearTimeout(famT); famT = setTimeout(() => famRun(famPushNow), 1500); }
function famLost() { toast('가족 수첩에서 빠졌어요. 기록은 이 기기에 그대로 있어요.'); bound = null; jput('baby-home', null); render(); }
let famMembers = [];
// 서버가 알려 준 승인 대기와 안 쓴 초대. 처음 보는 승인 대기는 바로 물어본다.
const asked = new Set();
function famSeen(r) {
  famPending = r.pending || []; famInvites = r.invites || [];
  if (r.me && bound.linked !== r.me.linked) { bound.linked = r.me.linked; jput('baby-home', bound); }
  if (r.me && !r.me.linked && myTok()) famCall(bound, 'link', { body: { tok: myTok() } }).then(() => { bound.linked = true; jput('baby-home', bound); }).catch(() => { });
  const p = famPending.find(x => !asked.has(x.rid));
  if (p && !dlg.open && !busyLock && started) { asked.add(p.rid); approveDlg(p); }
}
const ROLE = { owner: '처음 만든 사람', editor: '함께 쓰기', viewer: '보기만' };
const kface = (img, name) => img ? `<img class="kimg" src="${esc(img)}" alt="" referrerpolicy="no-referrer">` : `<span class="nick kimg">${esc((name || '?').slice(0, 1))}</span>`;
function approveDlg(p) {
  openDlg(`<form data-form="none" class="approve"><h2>들어오려는 사람이 있어요</h2><div class="kwho">${kface(p.kimg, p.kname)}<b>${esc(p.kname || '이름 없음')}</b><span class="sub">${Social.NAME[p.kp] || '카카오'} 이름${p.kimg ? '과 사진' : ''}</span></div><p><b>${esc(p.nick)}</b>(이)라는 별명으로 <b>${p.role === 'editor' ? '함께 쓰기' : '보기만'} 초대</b>를 받아 들어오려고 해요.</p><p class="sub">카카오톡에서 보던 이름과 사진이 맞는지 확인해 주세요. 모르는 사람이면 거절하세요. 거절하면 그 초대 링크도 끝나요.</p><button type="button" class="btn main" data-act="approve" data-rid="${esc(p.rid)}" data-ok="1">들어오게 하기</button><button type="button" class="btn danger" data-act="approve" data-rid="${esc(p.rid)}">거절</button></form>`);
}
async function famTalk() { const t = await famCall(bound, 'talk').catch(() => null); if (t) { bound.talk = t; if (['diary', 'album'].includes(tab) || vw) talkPaint(); } }
// 보기 좋게 줄인 사진(긴 변 1600px)을 올린다. 동영상은 첫 장면만.
async function shrink(blob, max) {
  const bmp = await createImageBitmap(blob), k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
  return new Promise(x => c.toBlob(x, 'image/jpeg', .85));
}
let upping = null, famUp = { done: 0, total: 0 };
const upKey = (h, k) => `baby-home-${k}:${h.id}`;
// 썸네일을 새로 만든 동영상은 가족 수첩에 다시 올린다.
function famRedo(id) { if (!bound) return; ['upt', 'up'].forEach(k => jput(upKey(bound, k), (jget(upKey(bound, k)) || []).filter(x => x !== id))); famUpload(); }
// 아직 안 올린 사진 수(작은 사진 기준)
const famLeft = () => bound && bound.role !== 'viewer' ? drivePhotos().filter(p => !(p.type === 'video' && p.th !== 1) && !(jget(upKey(bound, 'upt')) || []).includes(p.id)).length : 0;
// 사진 올리기. 목록에 보일 작은 사진을 먼저 모두 올리고, 그다음 크게 볼 줄인 사진(긴 변 1600px)을 올린다.
// 중간에 끊겨도(카카오톡으로 넘어가는 등) 다음에 앱을 열거나 돌아오면 이어서 올린다. onStep(올린 수, 전체)는 작은 사진 단계만 알린다.
function famUpload(onStep, thumbsOnly) {
  if (!bound || bound.role === 'viewer') return Promise.resolve();
  if (upping) return upping;
  return upping = (async () => {
    const h = bound, done = { t: new Set(jget(upKey(h, 'upt')) || []), f: new Set(jget(upKey(h, 'up')) || []) };
    const keep = k => jput(upKey(h, k === 't' ? 'upt' : 'up'), [...done[k]]);
    const kinds = thumbsOnly ? ['t'] : ['t', 'f'], wait = p => p.type === 'video' && p.th !== 1; // 썸네일을 아직 못 만든 동영상은 만든 뒤에 올린다
    famUp = { done: 0, total: kinds.reduce((a, k) => a + drivePhotos().filter(p => !done[k].has(p.id) && !wait(p)).length, 0) }; upShow();
    for (const k of kinds) {
      const list = drivePhotos().filter(p => !done[k].has(p.id) && !wait(p)); let n = 0;
      for (const p of list) {
        if (bound !== h) return;
        try {
          if (!await Local.has(p.id)) { n++; continue; } // 이 기기에 없는 사진은 가진 사람이 올린다
          const rec = await photoBlob(p.id), video = rec.type.startsWith('video/');
          let small = await Local.photoUrl(p.id, true).then(u => u ? fetch(u).then(r => r.blob()) : null).catch(() => null);
          if (!small && !video) small = await shrink(rec, 480).catch(() => null);
          const body = k === 't' ? small : video ? small : (await shrink(rec, 1600).catch(() => null)) || small;
          if (body) await famCall(h, `photo/${p.id}${k === 't' ? '?t=1' : ''}`, { method: 'PUT', body, slow: k === 'f' });
          done[k].add(p.id); keep(k);
        } catch (e) { if (e.status === 507) { toast(e.message); return; } if (!e.status || e.status === 401) return; } // 연결이 끊기면 다음에 이어서
        n++; famUp.done++; upShow(); if (k === 't' && onStep) onStep(n, list.length);
      }
    }
  })().finally(() => { upping = null; famUp = { done: 0, total: 0 }; upShow(); });
}
// 이 기기에 없는 사진은 가족 수첩 서버에서 받아 온다. 내 수첩이면 이 기기에 저장해 둔다.
const remoteUrls = new Map();
async function remotePic(h, id, thumb, keep) {
  const k = h.id + id + (thumb ? 't' : ''); if (remoteUrls.has(k)) return remoteUrls.get(k);
  let p = null; p = (async () => {
    let r = await famCall(h, `photo/${id}${thumb ? '?t=1' : ''}`, { raw: true }).catch(() => null);
    let exact = Boolean(r);
    if (!r) { r = await famCall(h, `photo/${id}${thumb ? '' : '?t=1'}`, { raw: true }).catch(() => null); p.rough = true; } // 대신 받은 사진은 다음에 다시 받아 본다
    if (!r) return '';
    const b = await r.blob(); if (keep && exact) await Local.keepPart(id, thumb ? { thumb: b } : { data: b }).catch(() => { });
    return URL.createObjectURL(b);
  })();
  remoteUrls.set(k, p); const u = await p; if (!u || p.rough) remoteUrls.delete(k); return u;
}
// 화면에 그릴 사진 주소. 놀러 간 집이면 그 집, 아니면 이 기기, 없으면 가족 수첩 서버.
async function picUrl(id, thumb) {
  if (vis && tab === 'visit') return remotePic(vis, id, thumb);
  const u = await Local.photoUrl(id, thumb).catch(() => ''); if (u || !bound) return u;
  return remotePic(bound, id, thumb, true);
}
async function picBlob(id) {
  if (vis && tab === 'visit') { const u = await remotePic(vis, id); return u ? fetch(u).then(r => r.blob()) : null; }
  const b = await Local.photoBlob(id).catch(() => null); if (b || !bound) return b;
  const u = await remotePic(bound, id, false, true); return u ? fetch(u).then(r => r.blob()) : null;
}

/* ── 초대하기 ── */
// 내 수첩을 처음 나눌 때 가족 수첩으로 만든다.
async function famCreate() {
  if (bound) return bound;
  const nick = myNick() || '엄마', data = Fam.shared(db);
  const tok = myTok(), r = await famCall(null, 'new', { body: Object.assign({ nick, data }, tok ? { tok } : {}) });
  bound = { id: r.home, token: r.token, role: 'owner', mid: r.id, name: r.name, linked: Boolean(tok) }; jput('baby-home', bound);
  await setBase(r.rev, data); return bound;
}
async function inviteDlg(role) {
  if (!myNick()) return nickDlg(() => inviteDlg(role));
  const edit = role === 'editor';
  openDlg(`<form data-form="none"><h2>${edit ? '함께 쓰기 초대' : '보기만 초대'}</h2><p class="sub">${edit ? '초대받은 사람은 이 수첩을 같이 보고 고칠 수 있어요. 아빠·엄마처럼 함께 기록할 사람에게 보내세요.' : '초대받은 사람은 일기와 앨범만 보고 좋아요와 댓글을 달 수 있어요. 할머니·이모처럼 아기 소식을 나눌 사람에게 보내세요.'}</p><p class="sub">초대 링크는 한 사람만, 3일 안에 쓸 수 있어요. 받은 사람이 카카오로 로그인하면, 내가 그 사람의 카카오 이름과 사진을 보고 승인해야 들어와요. 여러 명을 부르려면 한 사람씩 따로 보내 주세요. 사진은 줄여서 가족 수첩 서버에 올라가요.</p><button type="button" class="soc kakao" data-act="sendinvite" data-role="${role}">${KAKAO_MARK}카카오톡으로 초대 보내기</button><button type="button" class="btn" data-act="sendinvite" data-role="${role}" data-other="1">다른 앱으로 보내기</button></form>`);
}
async function sendInvite(role, other) {
  busy('초대 링크를 만드는 중');
  try {
    const h = await famCreate();
    if (famLeft()) await famUpload((n, all) => busy('사진을 가족 수첩에 올리는 중', `${n}/${all}`, n, all), true);
    busy('초대 링크를 만드는 중'); const r = await famCall(h, 'invite', { body: { role } });
    const url = `${Share.APP}?join=${h.id}.${r.code}`, kid = db.kids[0], name = h.name || (kid.name + '네');
    const title = role === 'editor' ? `${name} 수첩에 함께 기록해요` : `${name}에 놀러 오세요`, desc = role === 'editor' ? `${myNick()}가 아기 수첩을 같이 쓰자고 초대했어요` : `${myNick()}가 아기 일기와 사진을 보여 드리고 싶대요`;
    busyOff(); famUpload();
    if (!other) { try { await loadKakao(); const link = { mobileWebUrl: url, webUrl: url }; Kakao.Share.sendDefault({ objectType: 'feed', content: { title, description: desc, imageUrl: Share.APP + 'icon-512.png?v=2', imageWidth: 512, imageHeight: 512, link }, buttons: [{ title: role === 'editor' ? '함께 쓰기' : '놀러 가기', link }] }); return; } catch { toast('카카오톡을 열지 못했어요. 다른 앱으로 보내기를 눌러 주세요.'); return; } }
    if (navigator.share) return navigator.share({ title, text: desc, url }).catch(() => { });
    await navigator.clipboard.writeText(`${title}\n${desc}\n${url}`); toast('초대 링크를 복사했어요');
  } catch (e) { busyOff(); toast(e.message); }
}
// 별명 정하기. 엄마·아빠는 바로 고르고, 다른 이름은 직접 쓴다.
function nickPick(cur, ph) {
  const picks = ['엄마', '아빠'];
  return `<div class="nicks">${picks.map(n => `<label><input type="radio" name="nick" value="${n}" ${cur === n ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div><input name="nickx" maxlength="12" placeholder="${ph || '직접 쓰기 (예: 이모, 할머니)'}" value="${picks.includes(cur) ? '' : esc(cur || '')}" autocomplete="off">`;
}
const readNick = f => ((f.querySelector('[name=nickx]').value || '').trim() || (f.querySelector('[name=nick]:checked') || {}).value || '').slice(0, 12);
let nickThen = null;
function nickDlg(then) { nickThen = then || null; openDlg(`<form data-form="nick"><h2>내 별명</h2><p class="sub">가족에게 댓글과 함께 보이는 이름이에요.</p>${nickPick(myNick())}<button class="btn main">저장</button></form>`); }
async function saveNick(f) {
  const n = readNick(f); if (!n) return toast('별명을 골라 주세요');
  jput('baby-me', { nick: n }); dlg.close();
  if (bound) await famCall(bound, 'me', { body: { nick: n } }).catch(() => { });
  for (const v of visits) await famCall(v, 'me', { body: { nick: n } }).catch(() => { });
  toast('별명을 저장했어요'); render(); const t = nickThen; nickThen = null; if (t) t();
}
function familyDlg() {
  const list = famMembers.length ? famMembers : [];
  const edit = bound.role !== 'viewer', when = at => new Date(at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
  const pend = edit && famPending.length ? `<h3>승인을 기다려요</h3><div class="list">${famPending.map(p => `<div class="hosp"><span class="row" style="flex-wrap:nowrap">${kface(p.kimg, p.kname)}<span><b>${esc(p.nick)}</b><span class="sub">${esc(p.kname)} · ${ROLE[p.role]}</span></span></span><button type="button" class="btn main" data-act="approveask" data-rid="${esc(p.rid)}">확인</button></div>`).join('')}</div>` : '';
  const inv = edit && famInvites.length ? `<h3>아직 안 쓴 초대 링크</h3><div class="list">${famInvites.map(i => `<div class="hosp"><span><b>${ROLE[i.role]} 초대</b><span class="sub">${when(i.at)}에 보냄 · 3일 동안 쓸 수 있어요</span></span><button type="button" class="btn danger" data-act="uninvite" data-id="${esc(i.id)}">취소</button></div>`).join('')}</div>` : '';
  openDlg(`<form data-form="none"><h2>${esc(bound.name || '가족 수첩')}</h2>${pend}<div class="list">${list.map(m => `<div class="hosp"><span class="row" style="flex-wrap:nowrap">${m.kname !== undefined ? kface(m.kimg, m.nick) : `<span class="nick">${esc(m.nick.slice(0, 1))}</span>`}<span><b>${esc(m.nick)}${m.id === bound.mid ? ' (나)' : ''}</b><span class="sub">${ROLE[m.role]}${m.kname ? ' · ' + esc(m.kname) : ''}</span></span></span>${bound.role === 'owner' && m.role !== 'owner' ? `<button type="button" class="btn danger" data-act="kick" data-id="${esc(m.id)}">빼기</button>` : ''}</div>`).join('') || '<p class="sub">불러오는 중</p>'}</div>${inv}${bound.linked ? '' : `<p class="sub">카카오로 로그인해 두면 휴대폰을 바꿔도 같은 카카오로 이 가족 수첩에 다시 들어올 수 있어요.</p>${myTok() ? '' : `<button type="button" class="soc kakao" data-act="social" data-p="kakao">${KAKAO_MARK}카카오로 로그인</button>`}`}${bound.role !== 'owner' ? '<button type="button" class="btn danger" data-act="famleave">가족 수첩에서 나가기</button>' : ''}</form>`);
  if (!list.length) famPull().then(() => { if (dlg.open && dlg.querySelector('[data-act=kick],.list .sub')) familyDlg(); });
}

/* ── 초대 링크로 들어왔을 때 ── */
async function joinCheck() {
  const q = new URLSearchParams(location.search), saved = jget('baby-join');
  let j = Fam.parseJoin(q.get('join'));
  if (j) history.replaceState(null, '', location.pathname);
  else if (saved && Date.now() - saved.t < 30 * 60000) j = { home: saved.home, code: saved.code }; // 로그인하러 갔다 돌아왔다
  jput('baby-join', null);
  if (!j) { if (waits.length && !started && !visits.length) { join = Object.assign({}, waits[0], { wait: waits[0].ticket }); waitPoll(); return true; } return false; }
  const w = waits.find(x => x.home === j.home); if (w) { join = Object.assign({}, w, { wait: w.ticket }); waitPoll(); return true; }
  try { const r = await famCall({ id: j.home }, 'peek?c=' + j.code); join = Object.assign(j, { role: r.role, name: r.name, by: r.by }); }
  catch (e) { toast(e.message); return false; }
  return true;
}
// 초대받은 사람: 1) 카카오로 로그인 2) 별명 3) 승인 기다리기
function joinView() {
  const edit = join.role === 'editor', a = Social.account(), tok = myTok();
  if (join.wait) return `<section class="ob join"><div class="obmid"><div class="ring">${FACE}</div><h1>승인을 기다리고 있어요</h1><p>${join.by ? esc(join.by) + '에게' : '초대한 분에게'} <b>${esc(join.name)}</b>에 들어가도 되는지 물어봤어요.<br>카카오 이름과 사진을 확인하고 승인하면 바로 열려요.</p><p class="sub">이 화면을 닫아도 돼요. 앱을 다시 열면 이어서 확인해요.</p></div><div class="stack"><button type="button" class="soc kakao" data-act="waitkakao">${KAKAO_MARK}${join.by ? esc(join.by) + '에게' : '초대한 분께'} 카톡으로 알리기</button><button type="button" class="soc kakao" style="background:var(--ink);color:#fff" data-act="waitnow">지금 확인하기</button><button type="button" class="soc plain" data-act="joinno">다음에 확인할게요</button></div></section>`;
  const appTip = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator.standalone === true) ? `<div class="notice apptip"><b>홈 화면에 아기 수첩 앱이 있나요?</b><p class="sub">앱에서 보려면 링크를 복사하고, 앱의 더보기 → <b>초대 링크로 들어가기</b>에 붙여 넣어요. 여기서 들어가도 앱에서 같은 카카오로 로그인하면 보여요.</p><button type="button" class="btn" data-act="copyjoin">초대 링크 복사</button></div>` : '';
  if (!tok) return `<section class="ob join"><div class="obmid"><div class="ring">${FACE}</div><h1>${esc(join.name)}${edit ? ' 수첩에<br>함께 기록해요' : '에<br>놀러 오세요'}</h1><p>${join.by ? esc(join.by) + '가 ' : ''}초대했어요.<br>초대받은 사람이 맞는지 확인하려고 카카오로 로그인해요.</p><p class="sub">${join.by ? esc(join.by) + '가' : '초대한 분이'} 내 카카오 이름과 사진을 보고 승인하면 들어가요. 카카오 이름과 사진은 이 가족 수첩에서 함께 쓰는 가족에게만 보여요.</p></div><div class="stack"><button type="button" class="soc kakao" data-act="joinlogin" data-p="kakao">${KAKAO_MARK}카카오로 로그인하고 들어가기</button>${AUTH.naver ? `<button type="button" class="soc naver" data-act="joinlogin" data-p="naver">${NAVER_MARK}네이버로 로그인하고 들어가기</button>` : ''}<button type="button" class="soc plain" data-act="joinno">다음에 할게요</button>${appTip}</div></section>`;
  const me = `<p class="sub">${esc(a.name || Social.NAME[a.provider] + ' 계정')}(${Social.NAME[a.provider]})로 확인했어요.</p>`;
  return `<form class="ob join" data-form="join"><div class="obmid"><div class="ring">${FACE}</div><h1>${esc(join.name)}${edit ? ' 수첩에<br>함께 기록해요' : '에<br>놀러 오세요'}</h1><p>${join.by ? esc(join.by) + '가 ' : ''}${edit ? '초대했어요. 같은 기록을 같이 보고 고칠 수 있어요.' : '초대했어요. 아기 일기와 사진을 보고 댓글을 달 수 있어요.'}</p></div><div class="stack"><b>${edit ? '나는 아기의' : '가족에게 보일 별명'}</b>${edit ? nickPick(myNick()) : '<input name="nickx" maxlength="12" placeholder="예: 할머니, 이모, 삼촌" autocomplete="off" required>'}${me}${edit && started ? '<p class="sub">이 기기에 쓰던 기록 대신 초대받은 수첩을 써요. 지금 기록은 따로 보관해 둬요.</p>' : ''}<button class="soc kakao" style="background:var(--ink);color:#fff">${edit ? '함께 쓰기 요청' : '놀러 가기 요청'}</button><button type="button" class="soc plain" data-act="joinno">다음에 할게요</button></div></form>`;
}
async function doJoin(f) {
  const nick = readNick(f); if (!nick) return toast(join.role === 'editor' ? '나는 아기의 누구인지 골라 주세요' : '별명을 써 주세요');
  const tok = myTok(); if (!tok) { render(); return; }
  busy('초대한 분에게 물어보는 중');
  try {
    const r = await famCall({ id: join.home }, 'join', { body: { c: join.code, nick, tok } });
    if (r.status === 202) { // 승인을 기다린다
      const w = { home: join.home, ticket: r.ticket, role: r.role, nick, name: r.name, by: join.by, at: Date.now() };
      waits = waits.filter(x => x.home !== w.home).concat([w]); jput('baby-waits', waits);
      join = Object.assign({}, w, { wait: w.ticket }); busyOff(); render(); scrollTo(0, 0); waitPoll(); return;
    }
    busyOff(); await famEnter({ id: join.home, token: r.token, role: r.role, mid: r.id, name: r.name, linked: true }, r.nick || nick); // 이미 들어와 있던 사람
  } catch (e) {
    busyOff();
    if (e.status === 401 && e.body && e.body.error === 'login') { const a = Social.account(); if (a) { delete a.tok; localStorage.setItem('baby-acct', JSON.stringify(a)); } render(); toast('로그인이 끝났어요. 다시 로그인해 주세요.'); return; }
    if (e.status === 410 || e.status === 404) { join = null; render(); }
    toast(e.message);
  }
}
// 승인되어 들어간다. 함께 쓰기는 이 기기 수첩을 초대받은 수첩으로 바꾸고, 보기만은 놀러가기에 집을 더한다.
async function famEnter(h, nick) {
  waits = waits.filter(x => x.home !== h.id); jput('baby-waits', waits);
  if (h.role !== 'viewer') {
    if (bound && bound.id === h.id) { join = null; render(); return; }
    if (!myNick()) jput('baby-me', { nick });
    busy('수첩을 불러오는 중');
    try {
      const s = await famCall(h, 'state');
      if (started) await Local.setKV('before-home', { at: Date.now(), data: db }).catch(() => { });
      bound = h; jput('baby-home', bound); famMembers = s.members;
      if (!started) started = true; await famApply(s.data); await setBase(s.rev, s.data);
      join = null; tab = 'home'; busyOff(); render(); toast(`${h.name} 수첩을 함께 쓰기 시작했어요`); famTalk();
    } catch (e) { busyOff(); toast(e.message); }
  } else {
    visits = visits.filter(v => v.id !== h.id).concat([Object.assign(h, { nick })]); jput('baby-visits', visits);
    join = null; await openVisit(h.id);
  }
}
// 승인을 기다리는 초대를 확인한다.
let waitT = 0, waitBusy = false;
async function waitPoll(loud) {
  clearTimeout(waitT); if (!waits.length || waitBusy) return;
  waitBusy = true;
  try {
    for (const w of [...waits]) {
      const r = await famCall({ id: w.home }, 'wait', { body: { ticket: w.ticket } }).catch(() => null);
      if (!r) { if (loud) toast(famErr(0)); continue; }
      if (r.stage === 'ok') { toast(`${w.name}에 들어가요`); await famEnter({ id: w.home, token: r.token, role: r.role, mid: r.id, name: r.name, linked: true }, r.nick || w.nick); continue; }
      if (r.stage === 'wait') { if (loud) toast('아직 승인을 기다리고 있어요'); continue; }
      waits = waits.filter(x => x !== w); jput('baby-waits', waits);
      if (join && join.wait === w.ticket) { join = null; render(); }
      if (r.stage === 'none' && await famRestore()) continue; // 승인됐는데 답을 못 받았을 수도 있다: 카카오 계정으로 다시 찾아본다
      toast(r.stage === 'no' ? `${w.name}에 들어가지 못했어요. 초대한 분께 다시 물어봐 주세요.` : `${w.name} 초대가 끝났어요. 새 링크를 받아 주세요.`);
    }
  } finally { waitBusy = false; }
  if (waits.length) waitT = setTimeout(waitPoll, join && join.wait ? 5000 : 20000);
}
// 새 기기에서 로그인했을 때, 이 카카오 계정이 들어가 있던 가족 수첩에 다시 들어간다.
async function famRestore() {
  const tok = myTok(); if (!tok || join) return 0;
  let homes, got = 0; try { homes = (await famCall(null, 'mine', { body: { tok } })).homes || []; } catch { return 0; }
  for (const x of homes) {
    if (bound && bound.id === x.home || visits.some(v => v.id === x.home)) continue;
    const no = jget('baby-restore-no') || []; if (x.role !== 'viewer' && no.includes(x.home)) continue;
    if (x.role !== 'viewer' && (bound || started && !(confirm(`${x.name} 가족 수첩에 다시 들어갈까요?\n이 기기에 쓰던 기록 대신 가족 수첩을 써요. 지금 기록은 따로 보관해 둬요.`) || (jput('baby-restore-no', no.concat(x.home)), false)))) continue;
    const r = await famCall({ id: x.home }, 'back', { body: { tok } }).catch(() => null); if (!r) continue;
    const h = { id: x.home, token: r.token, role: r.role, mid: r.id, name: r.name, linked: true };
    got++;
    if (r.role === 'viewer') { visits = visits.filter(v => v.id !== h.id).concat([Object.assign(h, { nick: r.nick })]); jput('baby-visits', visits); toast(`${r.name}에 놀러 갈 수 있어요`); render(); }
    else await famEnter(h, r.nick);
  }
  return got;
}

/* ── 놀러가기 ── */
const houseKid = v => (v.kid || {});
function visitsView() {
  const bellCard = visits.length && typeof pushCard === 'function' && push.state !== 'on' ? pushCard().replace('휴대폰으로 알림 받기', '새 댓글·좋아요 알림 받기') : '';
  return `${started ? backRow('놀러가기') : `<div class="obmid" style="padding-top:24px"><h1>놀러가기</h1><p>초대받은 집에 놀러 가 보세요</p></div>`}${bellCard}<div class="houses">${visits.map(v => `<button class="house" data-act="visit" data-id="${v.id}"><span class="roof"></span><span class="hface">${houseKid(v).photo ? `<img data-vp="${v.id}:${houseKid(v).photo}:t" alt="">` : FACE}</span><b>${esc(v.name)}</b><em>${esc(v.nick)}로 놀러 가요</em></button>`).join('')}</div>${visits.length ? '' : '<p class="empty">아직 초대받은 집이 없어요.<br>가족에게 보기만 초대를 받으면 여기에 집이 생겨요.</p>'}${started ? '' : '<button class="soc plain" data-act="mynote">내 아기 수첩 만들기</button>'}`;
}
async function openVisit(id) {
  const v = visits.find(x => x.id === id); if (!v) return;
  vis = Object.assign({}, v, { data: null, talk: null, view: (vis && vis.id === id && vis.view) || 'diary' }); tab = 'visit'; render(); scrollTo(0, 0);
  try {
    const [s, t] = await Promise.all([famCall(v, 'state'), famCall(v, 'talk')]);
    if (!vis || vis.id !== id) return;
    vis.data = s.data; vis.talk = t; vis.name = s.name;
    if (s.me && !s.me.linked && myTok()) famCall(v, 'link', { body: { tok: myTok() } }).catch(() => { });
    const k = (s.data.kids || [])[0] || {}; Object.assign(v, { name: s.name, kid: { name: k.name, photo: k.photo, born: k.born, birth: k.birth } }); jput('baby-visits', visits);
    render();
  } catch (e) { if (e.status === 401) { visits = visits.filter(x => x.id !== id); jput('baby-visits', visits); vis = null; tab = started ? 'visits' : 'home'; render(); } toast(e.message); }
}
function visitView() {
  const d = vis.data, head = `<div class="backrow"><button data-act="visitback" aria-label="뒤로">${icon('left')}</button><h2>${esc(vis.name)}</h2></div>`;
  if (!d) return head + '<p class="empty">불러오는 중이에요</p>';
  const kids = d.kids || [], k = kids[0] || {};
  const age = k.born ? `태어난 지 ${S.diffDays(k.birth, today()) + 1}일` : `만나기까지 D-${S.diffDays(today(), k.birth)}`;
  const diary = [...(d.diary || [])].sort((a, b) => a.date < b.date ? 1 : -1), photos = [...(d.photos || [])].sort((a, b) => a.date < b.date ? 1 : -1);
  const vthumb = p => `<button type="button" data-act="vphoto" data-id="${p.id}"><img data-vp="${vis.id}:${p.id}:t" alt="${esc(p.caption || kd(p.date) + ' 사진')}">${p.type ? `<s>${icon('vplay', 's')}</s>` : ''}</button>`;
  return head + `<section class="vkid">${k.photo ? `<img data-vp="${vis.id}:${k.photo}:t" alt="">` : FACE}<span><b>${esc(kids.map(x => x.name).join(', '))}</b><em>${esc(age)}</em></span></section>
    <div class="albseg" role="tablist" aria-label="보기"><button role="tab" data-act="vview" data-v="diary" aria-selected="${vis.view === 'diary'}">일기</button><button role="tab" data-act="vview" data-v="album" aria-selected="${vis.view === 'album'}">앨범</button></div>`
    + (vis.view === 'diary'
      ? (diary.length ? diary.map(x => `<article class="paper"><div><h2>${kd(x.date)}</h2></div>${x.body ? `<p class="body">${esc(x.body)}</p>` : ''}${(x.photos || []).length ? `<div class="grid">${x.photos.map(id => photos.find(p => p.id === id)).filter(Boolean).map(vthumb).join('')}</div>` : ''}${talkBar(Fam.target('diary', x.id))}</article>`).join('') : '<p class="empty">아직 쓴 일기가 없어요.</p>')
      : (photos.length ? `<div class="vgrid">${photos.map(vthumb).join('')}</div>` : '<p class="empty">아직 사진이 없어요.</p>'));
}
// 놀러 간 집 사진은 그 집 열쇠로 받아 온다
if (typeof document !== 'undefined') new MutationObserver(() => document.querySelectorAll('img[data-vp]').forEach(i => {
  const [hid, id, t] = i.dataset.vp.split(':'), v = visits.find(x => x.id === hid); i.removeAttribute('data-vp'); if (!v) return;
  remotePic(v, id, t === 't').then(u => { if (u) i.src = u; });
})).observe(document.body, { childList: true, subtree: true });

/* ── 좋아요와 댓글 ── */
// 지금 화면의 가족 수첩(놀러 간 집 또는 내 가족 수첩)
const talkHome = () => tab === 'visit' || (vw && vw.kind === 'visit') ? vis : bound;
function talkBar(t) {
  const h = talkHome(); if (!h) return '';
  const c = Fam.count(h.talk, t), liked = h.talk && (h.talk.likes[t] || []).includes(h.mid);
  return `<div class="talk" data-talk="${t}"><button type="button" data-act="like" data-t="${t}" aria-pressed="${Boolean(liked)}" aria-label="좋아요 ${c.likes}">${icon('heart', liked ? 'fill' : '')}<span>${c.likes || ''}</span></button><button type="button" data-act="notes" data-t="${t}" aria-label="댓글 ${c.notes}">${icon('chat')}<span>${c.notes || ''}</span></button></div>`;
}
// 좋아요·댓글 수만 다시 그린다(입력 중인 글이 지워지지 않게)
function talkPaint() {
  document.querySelectorAll('[data-talk]').forEach(el => { el.outerHTML = talkBar(el.dataset.talk); });
  if (dlg.open && dlg.querySelector('[data-form=note]')) notesDlg(dlg.querySelector('[data-form=note]').dataset.t, true);
}
let replyTo = null;
function notesDlg(t, keep) {
  const h = talkHome(); if (!h) return;
  const was = keep && dlg.querySelector('[name=text]') ? dlg.querySelector('[name=text]').value : '';
  if (!keep) replyTo = null;
  const when = at => new Date(at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const can = n => n.who === h.mid || h.role === 'owner';
  const one = (n, reply) => `<div class="note${reply ? ' re' : ''}"><span class="nick">${esc((n.nick || '?').slice(0, 1))}</span><div><b>${esc(n.nick)}</b> <span class="sub">${when(n.at)}</span><p>${esc(n.text)}</p><div class="row">${reply ? '' : `<button type="button" class="lnk" data-act="reply" data-id="${n.id}" data-nick="${esc(n.nick)}">답글</button>`}${can(n) ? `<button type="button" class="lnk" data-act="unnote" data-id="${n.id}">지우기</button>` : ''}</div></div></div>`;
  const th = Fam.thread(h.talk ? h.talk.notes : [], t);
  openDlg(`<form data-form="note" data-t="${t}"><h2>댓글</h2><div class="notes">${th.length ? th.map(x => one(x.n) + x.replies.map(r => one(r, true)).join('')).join('') : '<p class="empty">첫 댓글을 남겨 보세요.</p>'}</div>${replyTo ? `<div class="row between replying"><span class="sub">${esc(replyTo.nick)}에게 답글</span><button type="button" class="lnk" data-act="replyno">취소</button></div>` : ''}<div class="row" style="flex-wrap:nowrap"><input name="text" maxlength="500" placeholder="${esc((h === vis ? vis.nick : myNick()) || '나')}(으)로 댓글 달기" autocomplete="off" value="${esc(was)}"><button class="btn main">올리기</button></div></form>`);
}
async function talkDo(path, body) {
  const h = talkHome(); if (!h) return;
  try { h.talk = await famCall(h, path, { body }); talkPaint(); } catch (e) { toast(e.message); }
}
async function famActs(act, b) {
  const d = b.dataset;
  if (act === 'like') { const h = talkHome(); if (!h) return true; const on = !(h.talk && (h.talk.likes[d.t] || []).includes(h.mid)); await talkDo('like', { target: d.t, on }); }
  else if (act === 'notes') notesDlg(d.t);
  else if (act === 'reply') { replyTo = { id: d.id, nick: d.nick }; notesDlg(dlg.querySelector('[data-form=note]').dataset.t, true); dlg.querySelector('[name=text]').focus(); }
  else if (act === 'replyno') { replyTo = null; notesDlg(dlg.querySelector('[data-form=note]').dataset.t, true); }
  else if (act === 'unnote') { if (confirm('이 댓글을 지울까요? 달린 답글도 함께 지워져요.')) await talkDo('unnote', { id: d.id }); }
  else if (act === 'invite') inviteDlg(d.role);
  else if (act === 'sendinvite') sendInvite(d.role, Boolean(d.other));
  else if (act === 'nick') nickDlg();
  else if (act === 'family') familyDlg();
  else if (act === 'kick') { if (confirm('이 사람을 가족 수첩에서 뺄까요? 다른 기기에서도 함께 빠져요.')) { try { famMembers = (await famCall(bound, 'kick', { body: { id: d.id } })).members; familyDlg(); } catch (e) { toast(e.message); } } }
  else if (act === 'famleave') { if (confirm('가족 수첩에서 나갈까요? 기록은 이 기기에 남지만 더는 함께 맞춰지지 않아요.')) { await famCall(bound, 'leave', { body: {} }).catch(() => { }); bound = null; jput('baby-home', null); dlg.close(); render(); toast('가족 수첩에서 나왔어요'); } }
  else if (act === 'visits') { if (dlg.open) dlg.close(); if (!started || SUB.includes(tab)) { vis = null; tab = 'visits'; render(); scrollTo(0, 0); } else { vis = null; enterSub('visits'); } }
  else if (act === 'visitback') navBack(() => { vis = null; tab = 'visits'; render(); scrollTo(0, 0); });
  else if (act === 'visit') { if (tab === 'visits') enterSub('visit', () => openVisit(d.id)); else openVisit(d.id); }
  else if (act === 'vview') { vis.view = d.v; render(); }
  else if (act === 'vphoto') { const list = () => [...(vis.data.photos || [])].sort((a, b) => a.date < b.date ? 1 : -1); viewPhoto('visit', d.id, list); }
  else if (act === 'joinno') { join = null; render(); }
  else if (act === 'copyjoin') { const u = `${Share.APP}?join=${join.home}.${join.code}`; try { await navigator.clipboard.writeText(u); toast('초대 링크를 복사했어요. 앱에서 붙여 넣어 주세요.'); } catch { prompt('이 링크를 복사해 주세요', u); } }
  else if (act === 'pastejoin') openDlg(`<form data-form="pastejoin"><h2>초대 링크로 들어가기</h2><p class="sub">카카오톡으로 받은 초대 링크를 길게 눌러 복사한 뒤 아래에 붙여 넣어요.</p><input name="u" placeholder="https://…?join=…" autocomplete="off" required><button class="btn main">들어가기</button></form>`);
  else if (act === 'joinlogin') { jput('baby-join', { home: join.home, code: join.code, t: Date.now() }); Social.begin(AUTH.url, d.p); }
  else if (act === 'waitnow') waitPoll(true);
  else if (act === 'waitkakao') { // 승인해 달라고 카톡으로 직접 보낸다(받는 사람은 내가 고른다)
    const a = Social.account() || {}, url = `${Share.APP}?talk=${join.home}`, link = { mobileWebUrl: url, webUrl: url };
    try { await loadKakao(); Kakao.Share.sendDefault({ objectType: 'feed', content: { title: `${join.name}에 들어가고 싶어요`, description: `${join.nick || '가족'}${a.name ? `(${a.name})` : ''}가 승인을 기다리고 있어요`, imageUrl: Share.APP + 'icon-512.png?v=2', imageWidth: 512, imageHeight: 512, link }, buttons: [{ title: '승인하러 가기', link }] }); }
    catch { toast('카카오톡을 열지 못했어요'); }
  }
  else if (act === 'approveask') { const p = famPending.find(x => x.rid === d.rid); if (p) approveDlg(p); }
  else if (act === 'approve') {
    if (!d.ok && !confirm('거절할까요? 그 사람은 들어오지 못하고 초대 링크도 끝나요.')) return true;
    try { famPending = (await famCall(bound, 'approve', { body: { rid: d.rid, ok: Boolean(d.ok) } })).pending; dlg.close(); toast(d.ok ? '들어오게 했어요' : '거절했어요'); famPull(); } catch (e) { toast(e.message); }
  }
  else if (act === 'uninvite') { try { famInvites = (await famCall(bound, 'uninvite', { body: { id: d.id } })).invites; familyDlg(); toast('초대를 취소했어요'); } catch (e) { toast(e.message); } }
  else if (act === 'mynote') { ob.mine = true; render(); }
  else return false;
  return true;
}
async function famForms(f) {
  const k = f.dataset.form;
  if (k === 'note') {
    const text = f.querySelector('[name=text]').value.trim(); if (!text) return true;
    f.querySelector('[name=text]').value = ''; const r = replyTo; replyTo = null;
    await talkDo('note', { target: f.dataset.t, text, parent: r ? r.id : '' });
  } else if (k === 'nick') await saveNick(f);
  else if (k === 'who') { const n = readNick(f); if (!n) { toast('나는 아기의 누구인지 골라 주세요'); return true; } jput('baby-me', { nick: n }); ob.step = 'choose'; render(); scrollTo(0, 0); }
  else if (k === 'join') await doJoin(f);
  else if (k === 'pastejoin') {
    const m = /[?&]join=([0-9a-f]{24}\.[0-9a-f]{24})/.exec(f.querySelector('[name=u]').value || ''); if (!m) { toast('초대 링크가 아니에요. 카카오톡에서 받은 링크를 그대로 붙여 넣어 주세요.'); return true; }
    dlg.close(); history.replaceState(null, '', location.pathname + '?join=' + m[1]); if (await joinCheck()) render();
  }
  else return false;
  return true;
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (!document.hidden && ready && bound && started) famPull(); if (!document.hidden && ready) waitPoll(); });
  setInterval(() => { if (!document.hidden && ready && bound && started && !dlg.open) famPull(); else if (!document.hidden && vis && tab === 'visit') famCall(vis, 'talk').then(t => { vis.talk = t; talkPaint(); }).catch(() => { }); }, 20000);
}
