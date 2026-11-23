/* 개월 수별 기본 육아 팁. 질병관리청·지자체 보건소·미국 CDC/소아과학회 안내를 짧게 정리(2026-11-23 확인).
   from 이상 to 미만 개월에 보인다. */
(function (root) {
  const S = {
    sleepKR: ['질병관리청 국가건강정보포털', 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5467'],
    sleepUS: ['미국소아과학회', 'https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/a-parents-guide-to-safe-sleep.aspx'],
    solidKR: ['영등포구보건소', 'https://www.ydp.go.kr/health/contents.do?key=3622&'],
    solidUS: ['미국 CDC', 'https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/when-what-and-how-to-introduce-solid-foods.html'],
    avoid: ['미국 CDC', 'https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/foods-and-drinks-to-avoid-or-limit.html'],
    vitd: ['미국 CDC', 'https://www.cdc.gov/infant-toddler-nutrition/vitamins-minerals/vitamin-d.html'],
    m: p => ['미국 CDC', 'https://www.cdc.gov/act-early/milestones/' + p + '.html'],
  };
  const t = (id, topic, from, to, title, body, src) => ({ id, topic, from, to, title, body, source: src[0], url: src[1] });
  const list = [
    t('sleep0', '수면', 0, 12, '등을 대고 똑바로, 따로 된 잠자리에', '돌 전에는 옆이나 엎드려 재우지 않아요. 단단하고 평평한 잠자리에 베개, 이불, 인형을 두지 않고, 어른 침대에서 함께 재우지 않아요.', S.sleepKR),
    t('room0', '수면', 0, 6, '분리수면: 침대는 따로, 방은 같이', '처음부터 아기 침대나 요는 따로 써요. 방은 적어도 6개월, 가능하면 돌까지 같은 방이 좋아요.', S.sleepKR),
    t('room6', '수면', 6, 12, '분리수면: 방을 나눌지는 천천히', '6개월이 지나면 방을 나누는 것을 생각해 볼 수 있지만, 가능하면 돌까지 같은 방을 권해요. 침대는 계속 따로 써요.', S.sleepKR),
    t('room12', '수면', 12, 24, '방 분리를 시작해도 되는 때', '같은 방에서 재우기를 권하는 돌이 지났어요. 아이 성향에 맞춰 시작하고, 매일 같은 순서로 재우면 도움이 돼요.', S.sleepKR),
    t('swaddle', '수면', 0, 5, '뒤집으려 하면 속싸개를 그만', '보통 3~4개월, 더 빠르기도 해요. 뒤집으려는 기미가 보이면 바로 그만둬요.', S.sleepUS),
    t('temp', '수면', 0, 12, '방 온도 22~24도', '이불 대신 수면조끼나 슬립색을 권해요.', S.sleepKR),
    t('hours', '수면', 4, 13, '하루 12~16시간 자요', '낮잠을 합한 시간이에요. 자는 시간과 순서를 일정하게 해 주세요.', S.m('9-months')),
    t('tummy', '놀이', 0, 4, '터미타임', '깨어 있고 어른이 지켜볼 때만 엎드려 놀아요. 짧게 시작해 생후 7주쯤 하루 15~30분까지 늘려요.', S.sleepUS),
    t('vitd', '먹기', 0, 12, '비타민 D 하루 400IU', '모유를 먹거나 섞어 먹는 아기는 태어난 직후부터 보충을 권해요. 분유를 충분히 먹으면 필요 없을 수 있으니 소아과에 물어보세요.', S.vitd),
    t('milk', '먹기', 0, 4, '모유나 분유만', '4개월 전에는 이유식을 시작하지 않아요. 배고픔과 배부름 신호를 보고 먹여요.', S.solidUS),
    t('solid4', '먹기', 4, 6, '이유식 준비 신호 보기', '보통 6개월 무렵 시작해요. 고개를 가누고, 받쳐 주면 앉고, 음식에 입을 벌리고, 밀어내지 않고 삼키면 준비된 거예요.', S.solidUS),
    t('solid6', '먹기', 6, 8, '이유식 시작과 중기', '철분 강화 곡류부터 한 가지씩, 새 재료는 3~5일 간격으로 늘려요. 채소와 과일은 갈고 고기와 생선은 곱게 다져요. 간은 하지 않아요.', S.solidKR),
    t('allergy', '먹기', 6, 12, '달걀·밀·견과류 버터도 함께 시작', '알레르기가 걱정되는 재료도 다른 음식과 함께 시작해요. 심한 습진이나 달걀 알레르기가 있으면 땅콩은 먼저 의사와 상의하세요.', S.solidUS),
    t('solid9', '먹기', 9, 12, '작게 썬 음식과 손가락 음식', '갈아 주는 양을 줄이고 작게 썰어 줘요. 가족 음식은 양념하기 전에 덜어내요.', S.solidKR),
    t('honey', '안전', 4, 12, '돌 전에는 꿀·생우유·주스 금지', '꿀은 보툴리누스 중독 위험이 있어요. 요리나 물에 섞는 것도 안 돼요.', S.avoid),
    t('milk12', '먹기', 12, 24, '생우유를 시작할 수 있어요', '돌이 지나면 마실 수 있어요. 설탕을 넣은 음식과 음료는 두 돌까지 주지 않아요.', S.avoid),
    t('shake', '안전', 0, 12, '절대 흔들지 않기', '울음에 지치면 안전한 곳에 눕히고 잠시 자리를 떠나요. 5~10분마다 확인하세요.', S.m('2-months')),
    t('proof', '안전', 7, 24, '집 안 안전 점검', '깨지거나 날카로운 물건은 치우고, 약과 세제는 잠가 둬요. 보행기는 권하지 않아요.', S.m('1-year')),
    t('screen', '놀이', 0, 24, '영상은 두 돌 이후에', '가족 영상통화는 괜찮아요. 말 걸기, 책 읽기, 노래가 더 좋아요.', S.m('18-months')),
    t('dev2', '발달', 1, 3, '2개월 무렵 모습', '엎드려 고개를 들고, 말을 걸면 웃고, 움직이는 사람을 눈으로 따라가요.', S.m('2-months')),
    t('dev4', '발달', 3, 5, '4개월 무렵 모습', '고개를 가누고, 옹알이를 하고, 소리 나는 쪽으로 고개를 돌려요.', S.m('4-months')),
    t('dev6', '발달', 5, 8, '6개월 무렵 모습', '엎드렸다 뒤집고, 손을 짚고 앉고, 소리 내어 웃어요.', S.m('6-months')),
    t('dev9', '발달', 8, 11, '9개월 무렵 모습', '혼자 앉고, 이름을 부르면 보고, 낯을 가려요.', S.m('9-months')),
    t('dev12', '발달', 11, 15, '돌 무렵 모습', '잡고 서고 잡고 걸어요. 손을 흔들고, 엄지와 검지로 작은 것을 집어요.', S.m('1-year')),
    t('dev18', '발달', 15, 24, '18개월 무렵 모습', '혼자 걷고, 세 단어 이상 말하려 하고, 관심 있는 것을 가리켜요.', S.m('18-months')),
    t('toilet', '생활', 18, 37, '배변 훈련은 서두르지 않기', '대부분 2~3세에 성공해요. 너무 이르면 오히려 힘들어질 수 있어요.', S.m('18-months')),
  ];
  const forMonth = m => list.filter(x => m >= x.from && m < x.to);
  const coming = (m, ahead) => list.filter(x => x.from > m && x.from <= m + ahead);
  const api = { checkedAt: '2026-11-23', list, forMonth, coming };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BaseTips = api;
})(this);
