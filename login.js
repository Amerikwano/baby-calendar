/* 카카오·네이버 로그인. 비밀 값이 필요한 확인은 로그인 서버(auth/)가 하고, 여기서는 시작과 결과 확인만 한다. */
(function (root) {
  'use strict';
  const NAME = { kakao: '카카오', naver: '네이버', google: '구글' };
  const get = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
  const put = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { } };
  // 내가 시작한 로그인(state)의 결과만 받는다.
  function readReturn(hash, saved, now) {
    const q = new URLSearchParams(String(hash).replace(/^#/, '')), p = q.get('social');
    if (!p) return null;
    if (NAME[p] && !saved && q.get('id')) return { error: '로그인이 끝났어요. 처음 누른 앱으로 돌아가면 이어져요.', handoff: true };
    if (!NAME[p] || !saved || saved.p !== p || saved.state !== q.get('state') || now - saved.t > 15 * 60000) return { error: '로그인을 확인하지 못했어요. 다시 시도해 주세요.' };
    if (q.get('error')) return { error: q.get('error') === 'cancel' ? '로그인을 취소했어요. 로그인하지 않아도 계속 쓸 수 있어요.' : `${NAME[p]} 로그인에 실패했어요. 다시 시도해 주세요.` };
    const id = q.get('id') || ''; if (!/^[\w-]{1,80}$/.test(id)) return { error: '로그인을 확인하지 못했어요. 다시 시도해 주세요.' };
    return { acct: { provider: p, id, name: (q.get('name') || '').slice(0, 40) } };
  }
  const hex = u => Array.from(new Uint8Array(u), b => b.toString(16).padStart(2, '0')).join('');
  async function begin(base, p) {
    const state = hex(crypto.getRandomValues(new Uint8Array(16))), v = hex(crypto.getRandomValues(new Uint8Array(32))), c = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
    put('baby-soc', { p, state, v, t: Date.now() }); location.assign(`${base}/login/${p}?state=${state}&c=${c}`);
  }
  const ask = (base, s) => fetch(base + '/result', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ state: s.state, v: s.v }), signal: AbortSignal.timeout(8000) }).then(r => r.json());
  // 로그인이 다른 창에서 끝났을 때 서버에 맡겨진 결과를 가져온다.
  function readResult(j, saved) {
    if (j.stage === 'done' && j.provider === saved.p && /^[\w-]{1,80}$/.test(j.id || '')) return { acct: { provider: j.provider, id: j.id, name: String(j.name || '').slice(0, 40) } };
    if (j.stage === 'fail') return { error: j.error === 'cancel' ? '로그인을 취소했어요. 로그인하지 않아도 계속 쓸 수 있어요.' : `${NAME[saved.p]} 로그인에 실패했어요. 다시 시도해 주세요.` };
    return null;
  }
  let asking = false;
  async function resume(base) {
    const s = get('baby-soc'); if (asking || !s || !s.v || Date.now() - s.t > 10 * 60000) return null;
    asking = true;
    try {
      for (let i = 0; i < 5; i++) {
        const j = await ask(base, s).catch(() => ({})), now = get('baby-soc'); if (!now || now.state !== s.state) return null;
        const r = readResult(j, s); if (r) { put('baby-soc', null); if (r.acct) put('baby-acct', r.acct); return r; }
        if (j.stage === 'none') return null;
        await new Promise(x => setTimeout(x, 1500));
      }
    } finally { asking = false; }
    return null;
  }
  function finish() {
    const s = get('baby-soc'), r = readReturn(location.hash, s, Date.now()); if (!r) return null;
    history.replaceState(null, '', location.pathname + location.search); put('baby-soc', null);
    if (r.acct) { put('baby-acct', r.acct); if (s && s.v && typeof AUTH !== 'undefined') ask(AUTH.url, s).catch(() => { }); } // 맡겨 둔 결과를 지운다
    return r;
  }
  // 카카오톡 같은 앱 안에서 열린 창. 기록이 그 앱 안에만 남고, 로그인하다 다른 브라우저로 넘어가기도 한다.
  const inApp = ua => /KAKAOTALK/i.test(ua) ? 'kakao' : /NAVER\(inapp|Instagram|FBAN|FBAV|\bLine\/|DaumApps|BAND\/|everytimeApp|; wv\)/i.test(ua) ? 'other' : '';
  const out = { NAME, inApp, readReturn, readResult, begin, finish, resume, account: () => get('baby-acct'), logout: () => put('baby-acct', null) };
  if (typeof module !== 'undefined' && module.exports) module.exports = out; else root.Social = out;
})(typeof window !== 'undefined' ? window : globalThis);

// 로그인 서버 주소
const AUTH = { url: 'https://baby-notebook-auth.baby-calendar.workers.dev', kakao: false, naver: false };
try { Object.assign(AUTH, JSON.parse(localStorage.getItem('baby-auth') || '{}')); } catch { }
// 로그인 서버에 준비된 로그인만 단추로 보인다.
async function checkAuth() {
  try { const j = await (await fetch(AUTH.url + '/ready', { signal: AbortSignal.timeout(8000) })).json(), n = { kakao: j.kakao === true, naver: j.naver === true }, same = n.kakao === AUTH.kakao && n.naver === AUTH.naver; Object.assign(AUTH, n); localStorage.setItem('baby-auth', JSON.stringify(n)); if (!same && ready && !dlg.open && (tab === 'more' || !started && ob.step === 'login')) render(); } catch { }
}
const KAKAO_MARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#191600" d="M12 4C6.8 4 2.6 7.3 2.6 11.4c0 2.6 1.7 4.9 4.3 6.2l-.9 3.4c-.1.3.2.5.5.3l4-2.6c.5.1 1 .1 1.5.100 5.2 0 9.4-3.3 9.4-7.4S17.2 4 12 4z"/></svg>';
const NAVER_MARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M15.2 12.7L8.6 3.5H3.5v17h5.3v-9.2l6.6 9.2h5.1v-17h-5.3z"/></svg>';
// 지금 로그인한 계정(카카오·네이버 또는 구글)
function account() { const s = Social.account(), g = Drive.account(); return s ? { p: s.provider, name: s.name || Social.NAME[s.provider] + ' 계정' } : g ? { p: 'google', name: g.email || g.name } : null; }
const socialBtns = () => `${AUTH.url && AUTH.kakao ? `<button type="button" class="soc kakao" data-act="social" data-p="kakao">${KAKAO_MARK}카카오로 시작하기</button>` : ''}${AUTH.url && AUTH.naver ? `<button type="button" class="soc naver" data-act="social" data-p="naver">${NAVER_MARK}네이버로 시작하기</button>` : ''}${GOOGLE_ID ? `<button type="button" class="soc google" data-act="login">${G_LOGO}Google로 시작하기</button>` : ''}`;
const canLogin = () => Boolean(local && (GOOGLE_ID || AUTH.url && (AUTH.kakao || AUTH.naver)));
// 로그인하러 갔다가 앱으로 돌아왔을 때 결과를 이어받는다.
async function resumeSocial() {
  const r = await Social.resume(AUTH.url); if (!r) return false;
  toast(r.error || `${Social.NAME[r.acct.provider]}로 로그인했어요`); if (!started) ob.step = ''; if (!dlg.open) render(); return true;
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (!document.hidden && ready) resumeSocial(); });
  window.addEventListener('pageshow', e => { if (e.persisted && ready) resumeSocial(); });
}
function accountCard() {
  if (!canLogin()) return '';
  const a = account(), g = Drive.account();
  if (!a) return `<section class="acct"><div><b>로그인하고 시작해 보세요</b><p class="sub">구글로 로그인하면 기록과 사진을 내 구글 드라이브에 보관해서, 다른 브라우저나 새 휴대폰에서도 이어서 쓸 수 있어요.</p></div><div class="socs">${socialBtns()}</div></section>`;
  return `<section class="acct"><div class="row between"><div><b>${esc(a.name)}</b><p class="sub">${Social.NAME[a.p]}로 로그인했어요</p></div><button class="btn" data-act="logout">로그아웃</button></div>${canDrive() ? `<div class="row between"><span class="sub">구글 드라이브 ${g ? `연결됨 (${esc(g.email || g.name)})` : '연결 안 됨'}</span><button class="btn" data-act="${g ? 'drive' : 'login'}">${g ? '사진 관리' : '연결하기'}</button></div>${syncRow()}` : ''}</section>`;
}
// 앱 안 브라우저에서 열었을 때 알림. 카카오톡은 바깥 브라우저로 바로 열 수 있다.
const IN_APP = typeof Social !== 'undefined' && typeof navigator !== 'undefined' ? Social.inApp(navigator.userAgent) : '';
function inAppCard() {
  if (!IN_APP) return '';
  return `<section class="notice hot inapp"><b>${IN_APP === 'kakao' ? '카카오톡' : '다른 앱'} 안에서 열었어요</b><p class="sub">여기서 쓴 기록은 이 창에만 남아서, 크롬이나 사파리에서는 보이지 않아요. 로그인도 중간에 다른 창으로 넘어가 끊길 수 있어요. ${IN_APP === 'kakao' ? '아래 단추로 열고, 홈 화면에 추가해서 쓰는 걸 권해요.' : '오른쪽 위 메뉴에서 ‘다른 브라우저로 열기’를 눌러 주세요.'}</p>${IN_APP === 'kakao' ? '<button type="button" class="btn main" data-act="external">크롬·사파리로 열기</button>' : ''}</section>`;
}
// 로그인이 시작한 창이 아닌 곳으로 돌아왔을 때 (예: 카카오톡에서 시작했는데 크롬으로 돌아옴)
function handoffView(google) {
  return `<section class="ob"><div class="obmid"><div class="ring">${FACE}</div><h1>${google ? '다른 창으로 돌아왔어요' : '로그인을 마쳤어요'}</h1><p>${google ? '로그인을 처음 누른 창(카카오톡 등)으로 돌아가서 다시 시도해 주세요.' : '이 창은 닫고, 로그인을 처음 누른 창(카카오톡 등)으로 돌아가면 이어져요.'}<br>기록은 처음 쓰던 창에 그대로 있어요.</p></div><div class="socs"><button class="soc plain" data-act="handoffnew">이 창에서 새로 시작하기</button></div></section>`;
}
