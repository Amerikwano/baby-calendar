/* 카카오톡 공유. 보낼 글만 카카오로 가고 사진은 보내지 않는다. */
(function (root) {
  'use strict';
  const APP = 'https://amerikwano.github.io/baby-calendar/';
  // n: 오늘이 태어난 지(또는 예정일까지) 며칠인지. 태어났으면 1일부터, 아니면 남은 날
  function text(k, n) {
    if (!k) return { title: '우리 수첩', description: '아기와 반려동물의 일정, 기록, 사진첩을 한곳에' };
    if (!k.born) return { title: n > 0 ? `${k.name} 만나기까지 D-${n}` : n === 0 ? `${k.name} 만나는 날이에요` : `${k.name} 예정일 D+${-n}`, description: '설레는 마음으로 함께 기다려요' };
    const special = { 100: '오늘은 백일이에요', 200: '오늘은 200일이에요' }[n];
    return { title: `${k.name} 태어난 지 ${n}일`, description: special || '오늘도 한 뼘 자랐어요' };
  }
  const message = t => { const link = { mobileWebUrl: APP, webUrl: APP }; return { objectType: 'feed', content: { title: t.title, description: t.description, imageUrl: APP + 'icon-512.png?v=3', imageWidth: 512, imageHeight: 512, link }, buttons: [{ title: '수첩 열기', link }] }; };
  const out = { APP, text, message };
  if (typeof module !== 'undefined' && module.exports) module.exports = out; else root.Share = out;
})(typeof window !== 'undefined' ? window : globalThis);

const KAKAO_JS = '0c91dbcc1595afcfdf5428503c850d75'; // 공개 키. 등록한 주소에서만 쓸 수 있다.
let kakaoSdk = null;
function loadKakao() {
  return kakaoSdk || (kakaoSdk = new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.5/kakao.min.js'; s.integrity = 'sha384-v6JKY3z4FUkWq21oZDHZe74YvuPk/WUrVLrDHTBojHXClOSa3iXy7sCXPY1jkFbj'; s.crossOrigin = 'anonymous';
    s.onload = () => { try { if (!Kakao.isInitialized()) Kakao.init(KAKAO_JS); ok(); } catch (e) { no(e); } }; s.onerror = no; document.head.append(s);
  }).catch(e => { kakaoSdk = null; throw e; }));
}
const shareOf = id => { const k = db.kids.find(x => x.id === id); return Share.text(k, k ? (k.born ? S.diffDays(k.birth, today()) + 1 : S.diffDays(today(), k.birth)) : 0); };
async function shareDlg() {
  const cur = K().id;
  openDlg(`<form data-form="none"><h2>카카오톡으로 공유하기</h2><div class="opts" id="shopts">${db.kids.map(k => `<label><input type="radio" name="sh" value="${k.id}" ${k.id === cur ? 'checked' : ''}><span>${esc(k.name)} ${k.born ? '며칠째' : '디데이'}</span></label>`).join('')}<label><input type="radio" name="sh" value=""><span>앱 소개만</span></label></div>
  <div class="shcard"><img src="icon-192.png?v=2" alt=""><b id="sht"></b><span id="shd"></span><em>수첩 열기</em></div><button type="button" class="soc kakao" data-act="sendkakao" disabled>${KAKAO_MARK}카카오톡으로 보내기</button><button type="button" class="btn" data-act="sharelink">다른 앱으로 보내기</button><p class="sub">위에 보이는 글과 앱 주소만 카카오로 가요. 사진과 기록은 보내지 않아요. 받은 사람이 앱을 열어도 내 수첩은 보이지 않아요.</p></form>`);
  const show = () => { const t = shareOf(dlg.querySelector('[name=sh]:checked').value); $('#sht').textContent = t.title; $('#shd').textContent = t.description; };
  $('#shopts').addEventListener('change', show); show();
  try { await loadKakao(); const b = dlg.querySelector('[data-act=sendkakao]'); if (b) b.disabled = false; } catch { toast('카카오톡을 불러오지 못했어요. 다른 앱으로 보내기를 눌러 주세요.'); }
}
const shareNow = () => shareOf(dlg.querySelector('[name=sh]:checked').value);
function sendKakao() { try { Kakao.Share.sendDefault(Share.message(shareNow())); } catch (e) { console.error(e); toast('카카오톡으로 보내지 못했어요. 다른 앱으로 보내기를 눌러 주세요.'); } }
async function shareLink() {
  const t = shareNow(), s = `${t.title}\n${t.description}`;
  if (navigator.share) return navigator.share({ title: '우리 수첩', text: s, url: Share.APP }).catch(e => { if (e.name !== 'AbortError') toast('공유 창을 열지 못했어요.'); });
  try { await navigator.clipboard.writeText(`${s}\n${Share.APP}`); toast('글과 주소를 복사했어요'); } catch { toast('복사하지 못했어요.'); }
}
