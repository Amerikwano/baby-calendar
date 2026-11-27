/* 반려동물 수첩: 나이별 접종·건강 일정, 팁, 혜택과 행사. 화면과 무관한 순수 함수와 자료만 둔다.
   일정은 국내 동물병원에서 흔히 쓰는 순서를 따랐고(WSAVA 접종 지침 참고), 병원마다 조금씩 다르다. 2026-11-27 확인. */
(function (root) {
  'use strict';
  const S = root.Schedule || require('./schedule.js');
  const KINDS = { dog: '강아지', cat: '고양이' };
  const SEX = { boy: '수컷', girl: '암컷' };
  const isPet = k => Boolean(k && KINDS[k.kind]);
  // 기록 종류(care.js의 TYPES 이름)
  const LOGS = { dog: ['meal', 'walk', 'potty', 'play', 'bath', 'groom', 'hospital', 'med', 'weight', 'memo'], cat: ['meal', 'potty', 'play', 'groom', 'bath', 'hospital', 'med', 'weight', 'memo'] };

  const VAXNOTE = '동물병원마다 순서와 간격이 조금 달라요. 병원에서 정한 날을 따르고, 맞은 날을 적어 두세요.';
  // o.since: 수첩을 만든 날. 그 전에 이미 끝난 일정은 빼서, 다 큰 아이를 데려와도 지난 일정이 쌓이지 않게 한다.
  // o.today: 매달 먹이는 예방약을 지난달~다음 달만 보여 주는 데 쓴다.
  function build(kind, birth, records, o) {
    o = o || {}; const rec = records || {}, out = [];
    const M = n => S.addMonths(birth, n), W = n => S.addDays(birth, n * 7), end = s => S.addDays(s, -1);
    const add = (id, type, title, start, stop, extra) => out.push(Object.assign({ id, type, title, start, end: stop }, extra));
    if (kind === 'dog') {
      [[6, '종합백신·코로나장염'], [8, '종합백신·코로나장염'], [10, '종합백신·켄넬코프'], [12, '종합백신·켄넬코프'], [14, '종합백신·인플루엔자'], [16, '광견병·인플루엔자']].forEach(([w, what], i) =>
        add('pv' + (i + 1), 'vaccine', `${i + 1}차 접종 (${what})`, W(w), end(W(w + 2)), { age: `생후 ${w}주`, note: VAXNOTE + (i === 5 ? ' 접종을 다 마치고 1~2주 지나면 산책을 시작해도 좋아요.' : i === 0 ? ' 접종이 끝나기 전에는 다른 개가 많은 곳에 내려놓지 마세요.' : '') }));
      add('preg', 'care', '동물등록', M(2), end(M(12)), { age: '생후 2개월', note: '집에서 기르는 2개월 이상 개는 2개월이 된 날부터 30일 안에 등록해야 해요(동물보호법). 시·군·구청이나 등록 대행 동물병원에서 할 수 있고, 하지 않으면 과태료가 나올 수 있어요.' });
      add('pab', 'check', '항체가 검사 (선택)', W(18), end(W(22)), { age: '생후 18~22주', note: '기초 접종으로 항체가 잘 생겼는지 피검사로 확인해요. 병원과 상의해서 정하세요.' });
      add('pneu', 'care', '중성화 상담', M(5), end(M(8)), { age: '생후 5~7개월', note: '알맞은 시기는 몸집과 성별에 따라 달라요. 동물병원과 상의하세요.' });
    } else {
      [[8, '종합백신'], [11, '종합백신'], [14, '종합백신']].forEach(([w, what], i) =>
        add('pv' + (i + 1), 'vaccine', `${i + 1}차 접종 (${what})`, W(w), end(W(w + 3)), { age: `생후 ${w}주`, note: VAXNOTE + ' 종합백신은 범백혈구감소증·허피스·칼리시 바이러스를 막아요.' }));
      add('pv4', 'vaccine', '광견병 접종 (선택)', M(3), end(M(5)), { age: '생후 3개월 이후', note: '실내에서만 지내도 맞히길 권하는 병원이 많아요. 병원과 정하세요.' });
      add('preg', 'care', '동물등록 (선택)', M(2), end(M(3)), { age: '생후 2개월', note: '고양이는 원하면 등록할 수 있어요. 잃어버렸을 때 찾는 데 도움이 돼요.' });
      add('pneu', 'care', '중성화 상담', M(4), end(M(7)), { age: '생후 4~6개월', note: '첫 발정 전에 하는 경우가 많아요. 동물병원과 상의하세요.' });
    }
    // 해마다: 추가접종과 건강검진. 7살부터는 반년마다 검진.
    for (let n = 1; n <= 20; n++) {
      add('pbo' + n, 'vaccine', `${n}살 추가접종 (${kind === 'dog' ? '종합백신·광견병 등' : '종합백신'})`, M(12 * n), end(M(12 * n + 1)), { age: `${n}살`, note: '해마다 맞는 백신과 몇 년마다 맞는 백신이 있어요. 병원에서 이번에 맞을 것을 정해 줘요.' });
      add('pck' + n, 'check', `${n}살 건강검진`, M(12 * n), end(M(12 * n + 2)), { age: `${n}살`, note: n >= 7 ? '7살부터는 6개월마다 검진을 받는 게 좋아요. 피검사와 신장·심장 검사를 챙기세요.' : '한 해에 한 번 몸무게, 이빨, 피검사를 확인해요.' });
      if (n >= 7) add('pch' + n, 'check', `${n}살 반 건강검진`, M(12 * n + 6), end(M(12 * n + 8)), { age: `${n}살 반`, note: '나이가 들면 6개월마다 검진을 받는 게 좋아요.' });
    }
    // 매달: 심장사상충·기생충 예방약. 지난달부터 다음 달까지만 둔다.
    if (o.today) for (let n = 2; n < 12 * 25; n++) {
      const d = M(n); if (d > S.addDays(o.today, 40)) break;
      if (d < S.addDays(o.today, -31)) continue;
      add('phw' + n, 'prev', '심장사상충·기생충 예방약', d, S.addDays(d, 6), { age: '매달', note: '한 달에 한 번 먹이거나 바르는 약이에요. 심장사상충은 모기로 옮아요. 약 종류는 동물병원에서 정하세요.' });
    }
    const since = o.since || '';
    return out.map(it => Object.assign(it, { done: (rec[it.id] && rec[it.id].done) || null, appt: (rec[it.id] && rec[it.id].appt) || null }))
      .filter(it => it.done || !since || it.end >= S.addDays(since, -60) || /^phw/.test(it.id))
      .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.end < b.end ? -1 : 1));
  }

  // 나이 단계: 0 아기(6개월 전), 1 청소년(~1살), 2 어른(~7살), 3 노령
  const stage = m => m < 6 ? 0 : m < 12 ? 1 : m < 84 ? 2 : 3;
  const STAGE = ['아기', '어린', '어른', '나이 든'];
  const SRC = {
    wsava: ['WSAVA 접종 지침', 'https://wsava.org/global-guidelines/vaccination-guidelines/'],
    food: ['ASPCA 동물 중독 안내', 'https://www.aspca.org/pet-care/animal-poison-control/people-foods-avoid-feeding-your-pets'],
    reg: ['국가동물보호정보시스템', 'https://www.animal.go.kr'],
    cat: ['International Cat Care', 'https://icatcare.org'],
    avma: ['미국수의사회', 'https://www.avma.org'],
  };
  const t = (kinds, stages, topic, title, body, src) => ({ kinds, stages, topic, title, body, source: src[0], url: src[1] });
  const TIPS = [
    t('dc', [0, 1, 2, 3], '먹이', '사람 음식은 조심하세요', '포도·건포도, 초콜릿, 양파·마늘, 자일리톨이 든 껌은 적은 양으로도 위험해요. 먹었으면 바로 동물병원에 전화하세요.', SRC.food),
    t('d', [0], '사회화', '생후 3~14주는 세상을 배우는 시기예요', '여러 사람, 소리, 바닥을 조금씩 겪게 해 주세요. 접종 전이면 안고 나가 바깥 소리를 들려주는 것만으로도 좋아요.', SRC.avma),
    t('d', [0], '배변', '배변 교육은 칭찬으로', '자고 일어난 뒤, 먹은 뒤, 논 뒤에 배변 자리로 데려가요. 잘하면 바로 칭찬하고, 실수는 혼내지 말고 조용히 치워 냄새를 없애요.', SRC.avma),
    t('dc', [0], '접종', '기초 접종을 끝까지 마쳐요', '아기 때 맞는 접종은 몇 주 간격으로 여러 번 맞아야 효과가 있어요. 수첩의 일정에 맞은 날을 적어 두세요.', SRC.wsava),
    t('dc', [0, 1], '이갈이', '4~6개월에는 이가 바뀌어요', '씹을 수 있는 장난감을 주고 손이나 가구를 물면 장난감으로 바꿔 줘요. 유치가 안 빠지고 남으면 병원에 보여 주세요.', SRC.avma),
    t('d', [0, 1, 2], '등록', '동물등록을 꼭 해요', '2개월 이상 개는 등록이 의무예요. 이름표와 함께 하면 잃어버렸을 때 훨씬 빨리 찾을 수 있어요.', SRC.reg),
    t('d', [1, 2], '산책', '산책은 하루 두 번', '냄새 맡을 시간을 충분히 주면 짧은 산책도 만족도가 높아요. 배변 봉투와 목줄은 꼭 챙기세요.', SRC.reg),
    t('dc', [1], '중성화', '중성화 시기를 정해요', '알맞은 시기는 몸집과 성별에 따라 달라요. 이 무렵 동물병원과 상의해 두세요.', SRC.avma),
    t('dc', [1, 2, 3], '이빨', '양치는 매일 조금씩', '반려동물 치약으로 하루 한 번 닦아 주면 치석과 잇몸병을 막아요. 처음엔 손가락으로 잇몸을 만지는 것부터 익숙하게 해요.', SRC.avma),
    t('dc', [2], '체중', '갈비뼈가 손에 만져지면 알맞아요', '눌렀을 때 갈비뼈가 느껴지고 위에서 볼 때 허리가 들어가면 좋은 몸이에요. 간식은 하루 먹는 양의 10% 안으로 줄여요.', SRC.avma),
    t('dc', [3], '노령', '나이가 들면 6개월마다 검진', '물 마시는 양, 소변 양, 몸무게가 바뀌면 병의 신호일 수 있어요. 수첩에 기록해 두면 병원에서 도움이 돼요.', SRC.avma),
    t('d', [3], '관절', '미끄러운 바닥을 막아 주세요', '매트를 깔고 계단 대신 경사로를 두면 관절에 무리가 덜 가요. 일어나기 힘들어하면 병원에 보여 주세요.', SRC.avma),
    t('c', [0], '화장실', '화장실은 조용한 곳에', '밥그릇과 떨어진 조용한 곳에 두고, 여러 마리면 고양이 수보다 하나 더 두는 게 좋아요. 매일 치워 주세요.', SRC.cat),
    t('c', [0, 1], '사회화', '생후 2~7주가 가장 중요한 시기예요', '부드럽게 만져 주고 여러 소리에 익숙하게 해 주세요. 이후에도 천천히 하면 충분히 친해질 수 있어요.', SRC.cat),
    t('c', [0, 1, 2, 3], '집', '백합은 집에 두지 마세요', '백합은 꽃가루나 꽃병 물만으로도 고양이 신장을 크게 다치게 해요. 먹은 것 같으면 바로 병원에 가세요.', SRC.food),
    t('c', [1, 2], '놀이', '하루 두 번 사냥 놀이', '낚싯대 장난감으로 10~15분씩 놀아 주면 살이 덜 찌고 스트레스가 줄어요. 스크래처도 꼭 두세요.', SRC.cat),
    t('c', [2, 3], '물', '물을 많이 마시게 해요', '물그릇을 여러 곳에 두거나 흐르는 물, 습식 사료를 함께 주면 좋아요. 고양이는 신장 병이 흔해요.', SRC.cat),
  ];
  const tips = (kind, months) => { const s = stage(Math.max(0, months)), c = kind === 'dog' ? 'd' : 'c'; return TIPS.filter(x => x.kinds.includes(c) && x.stages.includes(s)); };
  const WARN = {
    dog: ['하루 넘게 먹지 않거나 구토·설사가 반복될 때', '숨을 가쁘게 쉬거나 잇몸이 하얗거나 파랄 때', '배가 갑자기 부풀고 토하려는데 나오지 않을 때', '먹으면 안 되는 것을 먹었을 때'],
    cat: ['하루 넘게 먹지 않을 때(고양이는 굶으면 간이 상해요)', '화장실에 자주 가는데 소변이 안 나올 때(특히 수컷은 응급이에요)', '입을 벌리고 숨을 쉴 때', '백합이나 사람 약을 먹었을 때'],
  };

  const naver = q => 'https://search.naver.com/search.naver?query=' + encodeURIComponent(q);
  // 혜택: 나라와 지자체에서 흔히 하는 것. 금액과 기간은 시·군·구마다 달라 공고를 확인하게 한다.
  const BENEFITS = [
    { kinds: 'dc', title: '광견병 예방접종 지원', provider: '시·군·구', amount: '보호자는 5천~1만 원 정도만 내요', eligibility: '동물등록을 마친 생후 3개월 이상 개가 대상인 곳이 많고, 고양이도 맞혀 주는 곳이 있어요.', how: '봄(4월)과 가을(9~10월)에 지정 동물병원에서 접종해요. 물량이 끝나면 일찍 마감돼요.', url: 'https://news.seoul.go.kr/env/archives/tag/%EA%B4%91%EA%B2%AC%EB%B3%91-%EC%98%88%EB%B0%A9%EC%A0%91%EC%A2%85', src: '서울시 안내 보기' },
    { kinds: 'dc', title: '동물등록', provider: '나라', amount: '개는 의무, 고양이는 선택', eligibility: '집에서 기르는 2개월 이상 개는 등록해야 해요.', how: '시·군·구청 또는 등록 대행 동물병원. 내장형 칩 등록비를 지원하는 시·군·구도 있어요.', url: 'https://www.animal.go.kr', src: '국가동물보호정보시스템' },
    { kinds: 'dc', title: '취약계층 반려동물 의료비 지원', provider: '시·군·구', amount: '진료·중성화 수술비 일부', eligibility: '기초생활수급자·차상위계층 등. 지역마다 달라요.', how: '사는 시·군·구 동물보호 담당 부서나 누리집 공고를 확인하세요.', url: naver('취약계층 반려동물 의료비 지원'), src: '공고 찾아보기' },
    { kinds: 'd', title: '반려견 놀이터와 교육', provider: '시·군·구', amount: '대부분 무료', eligibility: '동물등록을 한 개만 들어갈 수 있는 곳이 많아요.', how: '공원 안 반려견 놀이터, 펫티켓·행동 교육 강좌를 지자체가 열어요.', url: naver('반려견 놀이터'), src: '가까운 곳 찾아보기' },
  ];
  const EVENTS = [
    { title: '케이펫페어', when: '서울·부산·대전·수원 등에서 한 해 여러 번 열려요. 2026년에는 4월 부산, 7월 서울 코엑스 등에서 열렸어요.', what: '사료·용품 할인, 건강 상담, 체험 공간', url: naver('케이펫페어 일정') },
    { title: '메가주', when: '일산 킨텍스에서 보통 봄(5월)과 가을(11월)에 열려요.', what: '국내에서 가장 큰 반려동물 박람회 중 하나예요. 할인과 무료 상담이 많아요.', url: naver('메가주 일정') },
    { title: '지역 반려동물 축제', when: '봄과 가을에 시·구마다 문화축제를 열어요.', what: '무료 건강 검진, 펫티켓 교육, 반려견 운동회 등', url: naver('반려동물 축제') },
  ];
  const checkedAt = '2026-11-27';
  const out = { KINDS, SEX, LOGS, isPet, build, stage, STAGE, tips, WARN, BENEFITS, EVENTS, checkedAt };
  if (typeof module !== 'undefined' && module.exports) module.exports = out; else root.Pet = out;
})(typeof window !== 'undefined' ? window : globalThis);
