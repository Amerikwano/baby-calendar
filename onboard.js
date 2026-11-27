/* 처음 켰을 때: 로그인 → 아이가 있는지·출산 예정인지 → 날짜 등록 → 홈 */
'use strict';
const ob = { step: '', born: false, rows: [0], photo: {} };
const FACE = document.querySelector('#babyFace').innerHTML, APPFACE = document.querySelector('#splashFace').innerHTML; // 아기 얼굴(기본 프로필), 앱 아이콘
const OB_T0 = Date.now();
// 시작 화면은 잠깐 보여 준 뒤 사라진다. 너무 빨리 깜빡이지 않게 최소 시간을 둔다.
function hideSplash(min) { const s = $('#splash'); setTimeout(() => { s.classList.add('off'); setTimeout(() => { s.hidden = true; }, 400); }, Math.max(0, (min == null ? 1300 : min) - (Date.now() - OB_T0))); }
async function showSplash(text, photoId) {
  const s = $('#splash'); $('#splashText').textContent = text;
  if (photoId) { const u = local ? await Local.photoUrl(photoId, true) : `photos/${photoId}/thumb`; if (u) $('#splashFace').innerHTML = `<img src="${u}" alt="">`; }
  s.hidden = false; s.classList.remove('off');
  await new Promise(r => setTimeout(r, 1200));
  s.classList.add('off'); setTimeout(() => { s.hidden = true; }, 400);
}
function onboard() {
  if (!ob.step) ob.step = canLogin() && !account() ? 'login' : myNick() ? 'choose' : 'who';
  const back = to => `<button type="button" class="obback" data-act="obstep" data-s="${to}" aria-label="뒤로">${icon('left')}</button>`;
  if (ob.step === 'login') return `<section class="ob">${inAppCard()}<div class="obmid"><div class="ring">${APPFACE}</div><h1>우리 수첩</h1><p>예방접종부터 오늘의 기록까지<br>아기와 반려동물의 하루를 한곳에 모아요</p></div><div class="socs">${socialBtns()}<button class="soc plain" data-act="obstep" data-s="${myNick() ? 'choose' : 'who'}">로그인 없이 시작하기</button></div><p class="sub mid">로그인하지 않아도 모든 기록을 쓸 수 있어요.<br><a href="privacy.html">개인정보 안내</a></p></section>`;
  if (ob.step === 'who') return `<form class="ob" data-form="who">${canLogin() && !account() ? back('login') : ''}<div class="obmid"><h1>가족 안에서 나는<br>누구인가요?</h1><p>가족과 수첩을 나눌 때 이 이름으로 보여요</p></div><div class="stack">${nickPick(myNick())}<button class="btn main big">다음</button></div></form>`;
  if (ob.step === 'choose') return `<section class="ob">${back('who')}${canLogin() && !account() ? '' : inAppCard()}<div class="obmid"><h1>어떤 수첩을<br>만들까요?</h1><p>고른 것에 맞춰 수첩을 준비할게요</p></div><div class="picks four"><button data-act="obstep" data-s="babykind">${icon('baby', 'xl')}<b>아기 수첩</b><span>육아·예방접종</span></button><button data-act="obpick" data-b="pet">${icon('paw', 'xl')}<b>반려동물 수첩</b><span>강아지·고양이</span></button><button data-act="obpick" data-b="couple">${icon('heart', 'xl')}<b>연애 수첩</b><span>기념일·데이트</span></button><button data-act="obpick" data-b="me">${icon('user', 'xl')}<b>개인 수첩</b><span>건강·재테크·여행</span></button></div><p class="sub mid">수첩은 나중에 더 만들고 위에서 바꿔 볼 수 있어요.</p></section>`;
  if (ob.step === 'babykind') return `<section class="ob">${back('choose')}<div class="obmid"><h1>아기와 어떤 시간을<br>보내고 있나요?</h1><p>고른 것에 맞춰 수첩을 준비할게요</p></div><div class="picks four"><button data-act="obpick" data-b="1">${icon('baby', 'xl')}<b>아이가 있어요</b><span>생일 등록</span></button><button data-act="obpick" data-b="">${icon('belly', 'xl')}<b>출산 예정이에요</b><span>예정일 등록</span></button></div></section>`;
  if (ob.step === 'me') return `<form class="ob" data-form="mestart">${back('choose')}<div><h1>나를 알려 주세요</h1><p>나이와 성별에 맞춰 챙길 것을 골라 드려요</p></div><div class="stack" style="gap:18px">${meFields({})}</div><button class="btn main big">시작하기</button></form>`;
  if (ob.step === 'couple') return `<form class="ob" data-form="couplestart">${back('choose')}<div><h1>우리 둘의 수첩을 만들어요</h1><p>함께 쓰기 초대로 연인과 같이 기록할 수 있어요</p></div><div class="stack" style="gap:18px">${coupleFields({})}</div><button class="btn main big">시작하기</button></form>`;
  if (ob.step === 'pet') return `<form class="ob" data-form="petstart">${back('choose')}<div><h1>반려동물을 알려 주세요</h1><p>이름과 사진은 나중에 언제든 바꿀 수 있어요</p></div><div class="stack" style="gap:18px">${petFields({}, true)}</div><button class="btn main big">등록하고 시작하기</button>${local ? '<p class="sub mid">입력한 내용은 이 기기에만 저장돼요.</p>' : ''}</form>`;
  return `<form class="ob" data-form="start">${back('babykind')}<div><h1>${ob.born ? '아이의 생일을 알려 주세요' : '출산 예정일을 알려 주세요'}</h1><p>이름과 사진은 나중에 언제든 바꿀 수 있어요</p></div><div id="kidrows" class="stack" style="gap:18px">${kidFields(0, { born: ob.born }, true, true)}</div>
  <button type="button" class="btn" data-act="morekid">쌍둥이·형제 더하기</button><button class="btn main big">${ob.born ? '등록하고 시작하기' : '등록하고 시작하기'}</button>${local ? '<p class="sub mid">입력한 내용은 이 기기에만 저장돼요.</p>' : ''}</form>`;
}

/* ── 프로필 사진 ── */
// 네모로 자른 사진을 만든다. done(blob)으로 돌려준다.
function pickAvatar(done) {
  pickFiles({}, async ([file]) => {
    let bmp; try { bmp = await createImageBitmap(file); } catch { return toast('열 수 없는 사진이에요'); }
    openDlg(`<form data-form="avatar"><h2>프로필 사진</h2><div class="crop round"><canvas id="cropc" width="720" height="720" aria-label="사진을 끌어서 옮기기"></canvas><i></i></div><label class="f">크기<input type="range" id="cropz" min="1" max="5" step="0.01" value="1"></label>${acts()}</form>`);
    crop = { bmp, z: 1, x: bmp.width / 2, y: bmp.height / 2, done }; bindCrop(720);
  });
}
async function saveAvatarBlob(b) {
  const r = await api('/api/photos', { method: 'POST', body: b }), bmp = await createImageBitmap(b), s = document.createElement('canvas'); s.width = s.height = 240; s.getContext('2d').drawImage(bmp, 0, 0, 240, 240);
  const t = await new Promise(x => s.toBlob(x, 'image/jpeg', .86)); if (t) await api(`/photos/${r.id}/thumb`, { method: 'PUT', body: t }).catch(() => { });
  return r.id;
}
async function setAvatar(kidId, blob) {
  let id; try { id = await saveAvatarBlob(blob); } catch (e) { return toast(e.message); }
  const old = kidOf(kidId).photo;
  if (await save(d => { const k = d.kids.find(x => x.id === kidId); if (k) k.photo = id; })) { if (old) api('/api/photos/' + old, { method: 'DELETE' }).catch(() => { }); toast('프로필 사진을 바꿨어요'); } else api('/api/photos/' + id, { method: 'DELETE' }).catch(() => { });
}
