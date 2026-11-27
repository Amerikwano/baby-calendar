/* 연애 수첩: 기념일 계산, 연애 팁, 데이트 코스, 전국 데이트 명소. 화면과 무관한 순수 함수와 자료만 둔다. 2026-11-27 정리. */
(function (root) {
  'use strict';
  const S = root.Schedule || require('./schedule.js');
  const is = k => Boolean(k && k.kind === 'couple');
  const LOGS = ['dateout', 'gift', 'trip', 'memo'];
  // 사귄 날이 1일. 100일 단위(1000일까지)와 해마다 돌아오는 주년. 2주 전부터 챙길 것으로 보인다.
  function build(start, records, o) {
    o = o || {}; const rec = records || {}, out = [];
    const add = (id, title, date, note) => out.push({ id, type: 'anniv', title, start: S.addDays(date, -14), end: date, age: date, note });
    for (let n = 100; n <= 1000; n += 100) add('cpd' + n, n + '일', S.addDays(start, n - 1), n === 100 ? '처음 맞는 큰 기념일이에요. 편지 한 장이면 충분히 특별해요.' : n === 1000 ? '천 일이에요. 처음 만난 곳에 다시 가 보는 건 어때요?' : '작은 선물이나 함께 찍은 사진을 정리해 보세요.');
    for (let y = 1; y <= 30; y++) add('cpy' + y, y + '주년', S.addMonths(start, 12 * y), y === 1 ? '첫 해를 돌아보며 서로에게 편지를 써 보세요.' : '한 해 동안 찍은 사진을 앨범에서 함께 넘겨 보세요.');
    const since = o.since || '';
    return out.map(it => Object.assign(it, { done: (rec[it.id] && rec[it.id].done) || null, appt: (rec[it.id] && rec[it.id].appt) || null }))
      .filter(it => it.done || !since || it.end >= since)
      .sort((a, b) => (a.end < b.end ? -1 : 1));
  }
  const t = (topic, title, body) => ({ topic, title, body });
  const TIPS = [
    t('대화', '"왜"보다 "어땠어?"', '서운한 일이 있으면 따지기보다 그때 기분을 먼저 물어보세요. 대화가 훨씬 부드러워져요.'),
    t('다툼', '싸워도 그날 안에 한마디', '바로 풀지 못해도 "조금 있다가 다시 얘기하자"는 말만 해 두면 서로 덜 불안해요.'),
    t('표현', '고마움은 작은 것부터', '커피를 사 준 것, 데리러 와 준 것처럼 작은 일에 고맙다고 말하는 습관이 오래가는 힘이 돼요.'),
    t('기념일', '기념일은 미리 같이 정해요', '서로 기대하는 정도가 다를 수 있어요. 선물 금액이나 하고 싶은 것을 미리 이야기하면 서운할 일이 줄어요.'),
    t('혼자 시간', '각자의 시간도 지켜 주세요', '친구, 취미, 쉬는 시간을 존중하면 함께하는 시간이 더 즐거워져요.'),
    t('기록', '오늘 있었던 일을 남겨요', '데이트한 날 사진 한 장과 한 줄 일기를 남기면 기념일에 꺼내 보는 재미가 커요.'),
    t('돈', '데이트 비용은 편하게 정해요', '번갈아 내기, 모임 통장 등 둘에게 맞는 방법을 정해 두면 마음이 편해요.'),
    t('안전', '밤늦게 헤어질 땐 도착 연락', '집에 잘 들어갔는지 한마디 주고받는 것만으로도 서로 마음이 놓여요.'),
  ];
  // 계절: 0 봄(3~5월) 1 여름 2 가을 3 겨울. all이면 언제나.
  const c = (seasons, tag, title, body) => ({ seasons, tag, title, body });
  const COURSES = [
    c([0], '야외', '꽃길 산책과 피크닉', '벚꽃이나 유채꽃 명소를 걷고, 도시락을 싸서 공원에서 쉬어요.'),
    c([0, 2], '야외', '자전거 타고 강변 한 바퀴', '공공자전거를 빌려 강변을 달리고 노을 질 때 편의점 라면으로 마무리해요.'),
    c([1], '야외', '해 질 녘 바다와 야시장', '해변에서 노을을 보고 근처 야시장이나 포차에서 저녁을 먹어요.'),
    c([1], '실내', '더위 피하는 전시와 카페', '미술관이나 팝업 전시를 보고 빙수 맛집에 들러요.'),
    c([2], '야외', '단풍 드라이브와 한옥 카페', '단풍길을 달리다 한옥 카페에서 따뜻한 차를 마셔요.'),
    c([3], '실내', '공방 체험 데이트', '반지, 향수, 도자기 공방에서 서로에게 줄 것을 만들어요.'),
    c([3], '야외', '빛축제와 따뜻한 음식', '겨울 빛축제를 걷고 어묵이나 국밥으로 몸을 녹여요.'),
    c([0, 1, 2, 3], '실내', '비 오는 날 영화와 보드게임', '영화 한 편을 보고 보드게임 카페에서 내기를 걸어 보세요.'),
    c([0, 1, 2, 3], '집', '집에서 요리하는 날', '장 보기부터 같이 하고, 처음 만들어 보는 요리에 도전해요.'),
    c([0, 1, 2, 3], '야외', '처음 만난 곳 다시 가기', '처음 데이트한 곳에 다시 가서 그때 사진과 같은 자리에서 찍어 보세요.'),
  ];
  const season = d => { const m = Number(d.slice(5, 7)); return m >= 3 && m <= 5 ? 0 : m <= 8 && m >= 6 ? 1 : m >= 9 && m <= 11 ? 2 : 3; };
  const SEASON = ['봄', '여름', '가을', '겨울'];
  const courses = today => COURSES.filter(x => x.seasons.includes(season(today)));
  const p = (sido, name, desc) => ({ sido, name, desc });
  const SPOTS = [
    p('서울특별시', '남산서울타워', '케이블카를 타고 올라가 야경을 봐요.'), p('서울특별시', '북촌한옥마을', '한옥 골목을 걷고 한복을 빌려 입어도 좋아요.'), p('서울특별시', '성수동 카페거리', '공장을 고친 카페와 팝업 가게가 많아요.'), p('서울특별시', '반포한강공원 달빛무지개분수', '봄부터 가을 저녁까지 분수 쇼를 해요.'),
    p('부산광역시', '해운대 블루라인파크', '바닷가를 달리는 작은 캡슐 열차를 타요.'), p('부산광역시', '광안리해수욕장', '광안대교 야경이 아름다워요.'), p('부산광역시', '감천문화마을', '알록달록한 골목에서 사진 찍기 좋아요.'),
    p('인천광역시', '송도 센트럴파크', '수상택시와 야경 산책.'), p('인천광역시', '월미도', '바다를 보며 놀이기구와 해물을 즐겨요.'),
    p('대구광역시', '83타워', '대구 시내를 한눈에 보는 전망대예요.'), p('대구광역시', '김광석 다시그리기길', '노래가 흐르는 벽화 골목이에요.'),
    p('대전광역시', '엑스포과학공원 한빛탑', '밤에 한빛탑 조명과 음악분수를 봐요.'),
    p('전남광주통합특별시', '양림동 펭귄마을', '오래된 물건으로 꾸민 골목과 카페가 있어요.'),
    p('울산광역시', '대왕암공원', '바다 위 출렁다리와 해안 산책길이 있어요.'),
    p('세종특별자치시', '세종호수공원', '호수를 따라 걷는 넓은 산책길이에요.'),
    p('경기도', '수원 화성 행궁동', '성곽길을 걷고 행리단길 카페에 들러요.'), p('경기도', '파주 헤이리 예술마을', '갤러리, 공방, 카페가 모여 있어요.'), p('경기도', '가평 쁘띠프랑스', '유럽풍 마을에서 사진 찍기 좋아요.'),
    p('강원특별자치도', '강릉 안목해변 커피거리', '바다를 보며 커피 한 잔.'), p('강원특별자치도', '남이섬', '메타세쿼이아길과 계절마다 다른 풍경.'), p('강원특별자치도', '속초 영금정', '바다 위 정자에서 일출을 봐요.'),
    p('충청북도', '단양 도담삼봉', '강 위의 세 봉우리, 근처 패러글라이딩도 유명해요.'), p('충청북도', '청남대', '대통령 별장이었던 곳으로 호숫가 산책이 좋아요.'),
    p('충청남도', '꽃지해수욕장', '할미·할아비 바위 사이로 지는 노을이 유명해요.'), p('충청남도', '공주 공산성', '성곽길 산책과 금강 야경.'),
    p('전북특별자치도', '전주 한옥마을', '한복 입고 골목 산책, 길거리 음식.'), p('전북특별자치도', '군산 근대문화거리', '오래된 건물과 빵집 투어.'),
    p('전남광주통합특별시', '여수 낭만포차거리', '밤바다를 보며 해산물을 먹어요.'), p('전남광주통합특별시', '순천만국가정원', '넓은 정원과 순천만 갈대밭.'),
    p('경상북도', '경주 동궁과 월지', '연못에 비친 야경이 아름다워요.'), p('경상북도', '경주 황리단길', '한옥 카페와 소품 가게가 많아요.'),
    p('경상남도', '통영 동피랑 벽화마을', '언덕 위 벽화 골목과 항구 풍경.'), p('경상남도', '남해 독일마을', '바다가 보이는 이국적인 마을이에요.'),
    p('제주특별자치도', '협재해수욕장', '에메랄드빛 바다와 비양도 풍경.'), p('제주특별자치도', '우도', '자전거나 전기차로 섬 한 바퀴.'), p('제주특별자치도', '성산일출봉', '이른 아침 일출 데이트.'),
  ];
  // 해외(나라 이름은 c)
  const o = (c, name, desc) => ({ sido: '해외', c, name, desc });
  SPOTS.push(
    o('일본', '도쿄 시부야 스카이', '도쿄 야경을 360도로 보는 옥상 전망대예요.'), o('일본', '오사카 도톤보리', '강을 따라 걷고 길거리 음식을 먹어요.'), o('일본', '후쿠오카 나카스 포장마차', '강가 포장마차에서 저녁을 먹어요.'), o('일본', '오타루 운하', '겨울 눈 덮인 운하와 유리 공방.'), o('일본', '오키나와 츄라우미 수족관', '거대한 고래상어 수조가 유명해요.'),
    o('대만', '지우펀 옛거리', '홍등이 켜진 밤 골목과 찻집.'), o('베트남', '다낭 미케 해변', '긴 해변과 저녁 야시장.'), o('베트남', '나트랑 해변', '바다와 리조트, 머드 스파.'), o('태국', '방콕 짜오프라야강 디너 크루즈', '강 위에서 야경과 저녁을 즐겨요.'), o('태국', '푸켓 프롬텝 곶', '푸켓에서 가장 유명한 일몰 명소예요.'),
    o('괌', '괌 투몬 비치', '맑은 바다에서 스노클링과 일몰.'), o('싱가포르', '마리나 베이 샌즈', '스카이파크 야경과 레이저 쇼.'), o('홍콩', '빅토리아 피크', '피크 트램을 타고 올라가 야경을 봐요.'), o('프랑스', '파리 에펠탑', '샹드마르스 공원에서 반짝이는 탑을 봐요.'), o('이탈리아', '베네치아 곤돌라', '운하를 따라 곤돌라를 타요.'),
  );
  // 명소 대표 사진: 위키미디어 공용의 자유 이용 사진 [파일 이름, 미리보기 주소]. 2026-11-27 위키백과 문서 대표 사진에서 골랐다.
  const IMG = {
    "남산서울타워": ["Seoul_Tower_(4394893276).jpg", "https://upload.wikimedia.org/wikipedia/commons/b/ba/Seoul_Tower_%284394893276%29.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled"],
    "북촌한옥마을": ["Bukchon_Hanok_Village_북촌_한옥마을_October_1_2020_15.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a4/Bukchon_Hanok_Village_%EB%B6%81%EC%B4%8C_%ED%95%9C%EC%98%A5%EB%A7%88%EC%9D%84_October_1_2020_15.jpg/960px-Bukchon_Hanok_Village_%EB%B6%81%EC%B4%8C_%ED%95%9C%EC%98%A5%EB%A7%88%EC%9D%84_October_1_2020_15.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "반포한강공원 달빛무지개분수": ["2011년_11월_대한민국_서울특별시_명소_(Seoul_best_attractions)_달빛무지개분수1.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/76/2011%EB%85%84_11%EC%9B%94_%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD_%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C_%EB%AA%85%EC%86%8C_%28Seoul_best_attractions%29_%EB%8B%AC%EB%B9%9B%EB%AC%B4%EC%A7%80%EA%B0%9C%EB%B6%84%EC%88%981.jpg/960px-2011%EB%85%84_11%EC%9B%94_%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD_%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C_%EB%AA%85%EC%86%8C_%28Seoul_best_attractions%29_%EB%8B%AC%EB%B9%9B%EB%AC%B4%EC%A7%80%EA%B0%9C%EB%B6%84%EC%88%981.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "해운대 블루라인파크": ["Haeundae_Beach_in_Busan.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Haeundae_Beach_in_Busan.jpg/960px-Haeundae_Beach_in_Busan.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "광안리해수욕장": ["P080713002.jpg", "https://thumb.wikimedia.org/wikipedia/ko/thumb/b/b9/P080713002.jpg/960px-P080713002.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "감천문화마을": ["Gamcheon_Colored_Houses,_Busan,_Korea.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/49/Gamcheon_Colored_Houses%2C_Busan%2C_Korea.jpg/960px-Gamcheon_Colored_Houses%2C_Busan%2C_Korea.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "송도 센트럴파크": ["Songdo_Central_Park_in_2021.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/Songdo_Central_Park_in_2021.jpg/960px-Songdo_Central_Park_in_2021.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "월미도": ["Walmido_promenade.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fc/Walmido_promenade.jpg/960px-Walmido_promenade.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "83타워": ["11경_83타워.jpg", "https://upload.wikimedia.org/wikipedia/commons/4/4d/11%EA%B2%BD_83%ED%83%80%EC%9B%8C.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled"],
    "엑스포과학공원 한빛탑": ["Gate,_bridge,_and_tower_at_Daejeon_Expo_Science_Park.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6c/Gate%2C_bridge%2C_and_tower_at_Daejeon_Expo_Science_Park.jpg/960px-Gate%2C_bridge%2C_and_tower_at_Daejeon_Expo_Science_Park.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "대왕암공원": ["KU-Dwa2.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/74/KU-Dwa2.jpg/960px-KU-Dwa2.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "세종호수공원": ["Sejong_lake_park_190609_17.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/57/Sejong_lake_park_190609_17.jpg/960px-Sejong_lake_park_190609_17.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "수원 화성 행궁동": ["Bifyu_8.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fb/Bifyu_8.jpg/960px-Bifyu_8.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "파주 헤이리 예술마을": ["Art-Service_Studio,_Heyri.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d4/Art-Service_Studio%2C_Heyri.jpg/960px-Art-Service_Studio%2C_Heyri.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "가평 쁘띠프랑스": ["Petite_France_Gapyeong_2016-11-15_19_27_58_30883764212.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/14/Petite_France_Gapyeong_2016-11-15_19_27_58_30883764212.jpg/960px-Petite_France_Gapyeong_2016-11-15_19_27_58_30883764212.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "강릉 안목해변 커피거리": ["안목해변,_AM_루프탑에서_본_풍경.jpg", "https://upload.wikimedia.org/wikipedia/commons/0/0b/%EC%95%88%EB%AA%A9%ED%95%B4%EB%B3%80%2C_AM_%EB%A3%A8%ED%94%84%ED%83%91%EC%97%90%EC%84%9C_%EB%B3%B8_%ED%92%8D%EA%B2%BD.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled"],
    "남이섬": ["Nami_island_winter.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ed/Nami_island_winter.jpg/960px-Nami_island_winter.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "속초 영금정": ["Geumgang_Bridge,_Sokcho_02.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2c/Geumgang_Bridge%2C_Sokcho_02.jpg/960px-Geumgang_Bridge%2C_Sokcho_02.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "단양 도담삼봉": ["Korea-Danyang-Dodamsambong_3087-07.JPG", "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/ff/Korea-Danyang-Dodamsambong_3087-07.JPG/960px-Korea-Danyang-Dodamsambong_3087-07.JPG?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "청남대": ["청남대_본관_(2).JPG", "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/31/%EC%B2%AD%EB%82%A8%EB%8C%80_%EB%B3%B8%EA%B4%80_%282%29.JPG/960px-%EC%B2%AD%EB%82%A8%EB%8C%80_%EB%B3%B8%EA%B4%80_%282%29.JPG?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "공주 공산성": ["공산성_금서루.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/55/%EA%B3%B5%EC%82%B0%EC%84%B1_%EA%B8%88%EC%84%9C%EB%A3%A8.jpg/960px-%EA%B3%B5%EC%82%B0%EC%84%B1_%EA%B8%88%EC%84%9C%EB%A3%A8.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "전주 한옥마을": ["전주한옥마을_전경.JPG", "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f2/%EC%A0%84%EC%A3%BC%ED%95%9C%EC%98%A5%EB%A7%88%EC%9D%84_%EC%A0%84%EA%B2%BD.JPG/960px-%EC%A0%84%EC%A3%BC%ED%95%9C%EC%98%A5%EB%A7%88%EC%9D%84_%EC%A0%84%EA%B2%BD.JPG?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "순천만국가정원": ["Panorama_of_International_Garden_Exposition_Suncheon_Bay_Korea_2013.jpg", "https://upload.wikimedia.org/wikipedia/commons/4/43/Panorama_of_International_Garden_Exposition_Suncheon_Bay_Korea_2013.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail_unscaled"],
    "경주 동궁과 월지": ["동궁과_월지.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3f/%EB%8F%99%EA%B6%81%EA%B3%BC_%EC%9B%94%EC%A7%80.jpg/960px-%EB%8F%99%EA%B6%81%EA%B3%BC_%EC%9B%94%EC%A7%80.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "경주 황리단길": ["Hwanglidangil_Flea_Market.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Hwanglidangil_Flea_Market.jpg/960px-Hwanglidangil_Flea_Market.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "남해 독일마을": ["German_Village_in_South_Korea_03.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ea/German_Village_in_South_Korea_03.jpg/960px-German_Village_in_South_Korea_03.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "협재해수욕장": ["Hyeopjae.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/Hyeopjae.jpg/960px-Hyeopjae.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "성산일출봉": ["성산일출봉_천연보호구역_2019년_촬영(출처_문화재청_대변인실).jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e3/%EC%84%B1%EC%82%B0%EC%9D%BC%EC%B6%9C%EB%B4%89_%EC%B2%9C%EC%97%B0%EB%B3%B4%ED%98%B8%EA%B5%AC%EC%97%AD_2019%EB%85%84_%EC%B4%AC%EC%98%81%28%EC%B6%9C%EC%B2%98_%EB%AC%B8%ED%99%94%EC%9E%AC%EC%B2%AD_%EB%8C%80%EB%B3%80%EC%9D%B8%EC%8B%A4%29.jpg/960px-%EC%84%B1%EC%82%B0%EC%9D%BC%EC%B6%9C%EB%B4%89_%EC%B2%9C%EC%97%B0%EB%B3%B4%ED%98%B8%EA%B5%AC%EC%97%AD_2019%EB%85%84_%EC%B4%AC%EC%98%81%28%EC%B6%9C%EC%B2%98_%EB%AC%B8%ED%99%94%EC%9E%AC%EC%B2%AD_%EB%8C%80%EB%B3%80%EC%9D%B8%EC%8B%A4%29.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "여수 낭만포차거리": ["Dolsan_Bridge_20230501.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/05/Dolsan_Bridge_20230501.jpg/960px-Dolsan_Bridge_20230501.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "도쿄 시부야 스카이": ["SHIBUYA_SCRAMBLE_SQUARE_East_Tower.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/45/SHIBUYA_SCRAMBLE_SQUARE_East_Tower.jpg/960px-SHIBUYA_SCRAMBLE_SQUARE_East_Tower.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "오사카 도톤보리": ["Osaka_Dotonbori_Ebisu_Bridge.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f4/Osaka_Dotonbori_Ebisu_Bridge.jpg/960px-Osaka_Dotonbori_Ebisu_Bridge.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "후쿠오카 나카스 포장마차": ["Yomise(Yatai).JPG", "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Yomise%28Yatai%29.JPG/960px-Yomise%28Yatai%29.JPG?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "오타루 운하": ["Otaru_Montage.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/08/Otaru_Montage.jpg/960px-Otaru_Montage.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "지우펀 옛거리": ["A-mei_Tea_House.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a5/A-mei_Tea_House.jpg/960px-A-mei_Tea_House.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "다낭 미케 해변": ["Dragon_Bridge,_Da_Nang_during_day_-_20230819_(cropped).jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2a/Dragon_Bridge%2C_Da_Nang_during_day_-_20230819_%28cropped%29.jpg/960px-Dragon_Bridge%2C_Da_Nang_during_day_-_20230819_%28cropped%29.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "나트랑 해변": ["Nha_Trang_,_Vietnam_-_panoramio_(35).jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9c/Nha_Trang_%2C_Vietnam_-_panoramio_%2835%29.jpg/960px-Nha_Trang_%2C_Vietnam_-_panoramio_%2835%29.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "방콕 짜오프라야강 디너 크루즈": ["Chao_Phraya_River_-_Bangkok_-_northwards_-_from_King_Taksin_Bridge_-_2021.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a5/Chao_Phraya_River_-_Bangkok_-_northwards_-_from_King_Taksin_Bridge_-_2021.jpg/960px-Chao_Phraya_River_-_Bangkok_-_northwards_-_from_King_Taksin_Bridge_-_2021.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "푸켓 프롬텝 곶": ["Phuket_Aerial.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/Phuket_Aerial.jpg/960px-Phuket_Aerial.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "괌 투몬 비치": ["Tumon_Bay_-_panoramio_-_Scott_Cameron.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/Tumon_Bay_-_panoramio_-_Scott_Cameron.jpg/960px-Tumon_Bay_-_panoramio_-_Scott_Cameron.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "마리나 베이 샌즈": ["Marina_Bay_Sands_(I).jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c7/Marina_Bay_Sands_%28I%29.jpg/960px-Marina_Bay_Sands_%28I%29.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "빅토리아 피크": ["High_West_and_Victoria_Peak_from_Victoria_Gap_(crop1).jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7d/High_West_and_Victoria_Peak_from_Victoria_Gap_%28crop1%29.jpg/960px-High_West_and_Victoria_Peak_from_Victoria_Gap_%28crop1%29.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "파리 에펠탑": ["Tour_Eiffel_Wikimedia_Commons_(cropped).jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/85/Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg/960px-Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "베네치아 곤돌라": ["Gondola_Ride.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c8/Gondola_Ride.jpg/960px-Gondola_Ride.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "강릉": ["경포해변.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a9/%EA%B2%BD%ED%8F%AC%ED%95%B4%EB%B3%80.jpg/960px-%EA%B2%BD%ED%8F%AC%ED%95%B4%EB%B3%80.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "경주": ["Lotus_Flower_Bridge_and_Seven_Treasure_Bridge_at_Bulguksa_in_Gyeongju,_Korea.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/eb/Lotus_Flower_Bridge_and_Seven_Treasure_Bridge_at_Bulguksa_in_Gyeongju%2C_Korea.jpg/960px-Lotus_Flower_Bridge_and_Seven_Treasure_Bridge_at_Bulguksa_in_Gyeongju%2C_Korea.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "통영": ["Korea-Tongyeong-Collage-01.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7f/Korea-Tongyeong-Collage-01.jpg/960px-Korea-Tongyeong-Collage-01.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "부산 영도": ["Huinnyeoul_culture_village,_Busan_on_October_25th,_2019.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/03/Huinnyeoul_culture_village%2C_Busan_on_October_25th%2C_2019.jpg/960px-Huinnyeoul_culture_village%2C_Busan_on_October_25th%2C_2019.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "여수": ["Yeosu_Odongdo_20180929_002.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2a/Yeosu_Odongdo_20180929_002.jpg/960px-Yeosu_Odongdo_20180929_002.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"],
    "속초": ["Korea_Seoraksan.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/32/Korea_Seoraksan.jpg/960px-Korea_Seoraksan.jpg?utm_source=ko.wikipedia.org&utm_campaign=api&utm_content=thumbnail"]
  };
  // 명소 데이트 코스: 장소 성격(야경·바다·골목·해외)에 맞춰 시간표를 만든다. AI 없이 규칙으로.
  function plan(x) {
    const t = x.name + ' ' + x.desc, n = x.name, abroad = x.sido === '해외';
    const kind = abroad ? 'abroad' : /야경|빛|분수|타워|전망|밤/.test(t) ? 'night' : /해변|해수욕장|바다|노을|일몰|일출|곶|해안/.test(t) ? 'sea' : /한옥|골목|마을|거리|길|카페/.test(t) ? 'street' : 'day';
    const S = {
      abroad: [['10:00', '숙소에서 여유롭게 출발'], ['11:00', `${n} 둘러보기`], ['13:00', '근처 현지 맛집에서 점심'], ['15:00', '주변 골목 산책과 카페'], ['18:00', '해 질 녘 풍경 보며 사진 찍기'], ['19:30', '분위기 좋은 곳에서 저녁']],
      night: [['16:00', '근처 카페에서 만나기'], ['17:30', '주변 산책'], ['18:30', '근처 맛집에서 저녁'], ['20:00', `${n}에서 야경 보기`], ['21:30', '디저트 먹고 천천히 귀가']],
      sea: [['13:00', '출발'], ['14:30', `${n} 산책`], ['16:00', '바다가 보이는 카페'], ['17:30', '노을 보며 사진 찍기'], ['19:00', '근처에서 해산물 저녁']],
      street: [['12:00', '근처 맛집에서 점심'], ['13:30', `${n} 골목 산책하며 사진 찍기`], ['15:30', '분위기 좋은 카페에서 쉬기'], ['17:00', '소품 가게·공방 구경'], ['18:30', '저녁 먹고 마무리']],
      day: [['11:00', '출발'], ['12:30', '근처에서 점심'], ['14:00', `${n} 둘러보기`], ['16:00', '근처 카페에서 쉬기'], ['18:00', '저녁 먹고 마무리']],
    };
    const tip = { abroad: '현지 교통 앱과 환전·유심을 미리 챙기세요.', night: '해 지는 시간을 확인하고 30분 먼저 도착하면 노을과 야경을 같이 볼 수 있어요.', sea: '바닷바람이 차니 겉옷을 챙기고, 일몰 시간을 미리 확인하세요.', street: '주말 오후엔 붐비니 점심 전에 가면 사진 찍기 좋아요.', day: '운영 시간과 휴무일을 가기 전에 확인하세요.' }[kind];
    return { title: `${n} 데이트 코스`, about: x.desc, steps: S[kind], tip };
  }
  const planText = (x, p) => `[우리 수첩] ${p.title}\n${x.desc}\n\n${p.steps.map(([a, b]) => `${a}  ${b}`).join('\n')}\n\n팁: ${p.tip}`;
  // ── 랜덤 데이트 코스: 날짜·시간대 안에서 고르고, 비가 오면 실내만.
  const ACT = [
    // [이름, 실내?, 분, 저녁 이후에 어울림?]
    ['영화 보기', 1, 150], ['보드게임 카페', 1, 90], ['방탈출 카페', 1, 90], ['전시·팝업 구경', 1, 90], ['공방 체험(반지·향수·도자기)', 1, 120],
    ['볼링이나 포켓볼', 1, 90, 1], ['코인 노래방', 1, 60, 1], ['실내 쇼핑몰 구경', 1, 90], ['아쿠아리움', 1, 120], ['서점 데이트', 1, 60], ['찜질방·스파', 1, 120],
    ['공원 산책', 0, 60], ['자전거 타기', 0, 90], ['강변·호숫가 피크닉', 0, 120], ['시장 구경과 길거리 음식', 0, 90], ['근교 드라이브', 0, 120], ['야경 보러 가기', 0, 60, 1], ['사진 찍기 좋은 골목 걷기', 0, 60],
  ];
  const mins = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; }, hhmm = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  // o: { from:'11:00', to:'20:00', rain:bool, hot:bool, cold:bool, spots:[명소] }, rnd: 0~1 난수 함수
  function randomCourse(o, rnd) {
    rnd = rnd || Math.random; const pick = l => l[Math.floor(rnd() * l.length)];
    const end = mins(o.to), out = [], used = new Set(); let t = mins(o.from), lunch = false, dinner = false, cafe = false, spot = false;
    const outdoorOk = !o.rain, s0 = o.spots && o.spots.length ? pick(o.spots) : null, nightSpot = s0 && /야경|빛|분수|타워|전망|밤/.test(s0.name + s0.desc); // 야경 명소는 저녁 뒤에
    while (t < end - 30) {
      const left = end - t;
      if (!lunch && t >= 660 && t < 840) { out.push([hhmm(t), '근처 맛집에서 점심']); lunch = true; t += 60; continue; }
      if (!dinner && t >= 1020 && t < 1200) { out.push([hhmm(t), '분위기 좋은 곳에서 저녁']); dinner = true; t += 90; continue; }
      // 식사 시간을 건너뛰지 않게 그 전까지만 쓸 수 있는 시간
      let room = left; if (!lunch && t < 660 && end > 720) room = Math.min(room, 780 - t); if (!dinner && t < 1020 && end > 1080) room = Math.min(room, 1140 - t);
      if (!spot && outdoorOk && s0 && (nightSpot ? t >= 1110 && left >= 60 : t < 1080 && room >= 120)) { out.push([hhmm(t), nightSpot ? `${s0.name}에서 야경 보기` : `${s0.name} 가기`, s0.name]); spot = true; if (nightSpot) used.add('야경 보러 가기'); t += nightSpot ? 90 : 120; continue; }
      if (!cafe && t >= 840 && t < 1050) { out.push([hhmm(t), o.hot ? '시원한 디저트 카페' : '분위기 좋은 카페에서 쉬기']); cafe = true; t += 60; continue; }
      const night = t >= 1140;
      const ok = ACT.filter(a => !used.has(a[0]) && (outdoorOk || a[1]) && a[2] <= room && (!night || a[3] || a[1]) && !(o.cold && !a[1] && rnd() < .5) && !(a[0] === '야경 보러 가기' && t < 1080));
      if (!ok.length) { if (room < left) { out.push([hhmm(t), '근처 산책하며 쉬기']); t += Math.max(30, room - 60 > 0 ? Math.min(60, room) : 30); continue; } break; }
      const a = pick(ok); used.add(a[0]); out.push([hhmm(t), a[0]]); t += a[2];
    }
    if (!out.length) out.push([o.from, '근처 카페에서 만나기']);
    return out;
  }
  const mapUrl = name => 'https://map.naver.com/p/search/' + encodeURIComponent(name);
  const searchUrl = q => 'https://search.naver.com/search.naver?query=' + encodeURIComponent(q);
  const out = { randomCourse, mins, plan, planText, IMG, is, LOGS, build, TIPS, COURSES, courses, season, SEASON, SPOTS, mapUrl, searchUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = out; else root.Couple = out;
})(typeof window !== 'undefined' ? window : globalThis);
