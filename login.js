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
    if (!NAME[p] || !saved || saved.p !== p || saved.state !== q.get('state') || now - saved.t > 15 * 60000) return { error: '로그인을 확인하지 못했어요. 다시 시도해 주세요.' };
    if (q.get('error')) return { error: q.get('error') === 'cancel' ? '로그인을 취소했어요. 로그인하지 않아도 계속 쓸 수 있어요.' : `${NAME[p]} 로그인에 실패했어요. 다시 시도해 주세요.` };
    const id = q.get('id') || ''; if (!/^[\w-]{1,80}$/.test(id)) return { error: '로그인을 확인하지 못했어요. 다시 시도해 주세요.' };
    return { acct: { provider: p, id, name: (q.get('name') || '').slice(0, 40) } };
  }
  function begin(base, p) {
    const state = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    put('baby-soc', { p, state, t: Date.now() }); location.assign(`${base}/login/${p}?state=${state}`);
  }
  function finish() {
    const r = readReturn(location.hash, get('baby-soc'), Date.now()); if (!r) return null;
    history.replaceState(null, '', location.pathname + location.search); put('baby-soc', null);
    if (r.acct) put('baby-acct', r.acct);
    return r;
  }
  const out = { NAME, readReturn, begin, finish, account: () => get('baby-acct'), logout: () => put('baby-acct', null) };
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
function accountCard() {
  if (!canLogin()) return '';
  const a = account(), g = Drive.account();
  if (!a) return `<section class="acct"><div><b>로그인하고 시작해 보세요</b><p class="sub">구글로 로그인하면 사진을 내 구글 드라이브에 올리고 관리할 수 있어요. 로그인하지 않아도 다른 기능은 모두 쓸 수 있어요.</p></div><div class="socs">${socialBtns()}</div></section>`;
  return `<section class="acct"><div class="row between"><div><b>${esc(a.name)}</b><p class="sub">${Social.NAME[a.p]}로 로그인했어요</p></div><button class="btn" data-act="logout">로그아웃</button></div>${canDrive() ? `<div class="row between"><span class="sub">구글 드라이브 ${g ? `연결됨 (${esc(g.email || g.name)})` : '연결 안 됨'}</span><button class="btn" data-act="${g ? 'drive' : 'login'}">${g ? '사진 관리' : '연결하기'}</button></div>` : ''}</section>`;
}
