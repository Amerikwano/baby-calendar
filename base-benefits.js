/* 전국 공통 혜택. 2026-11-23에 확인한 내용이며 AI 없이도 보인다.
   deadlineDays: 출생일을 0으로 센 마지막 신청일. months: 출생일 기준 개월 수. */
(function (root) {
  const list = [
    { id: 'reg', title: '출생신고', provider: '주민센터', amount: '혜택 신청의 출발점', deadlineMonths: 1, deadlineText: '출생 후 1개월 이내',
      how: '주민센터 방문. 행복출산 원스톱 서비스로 부모급여·아동수당·첫만남이용권을 함께 신청할 수 있어요.', note: '정당한 이유 없이 늦으면 5만원 이하 과태료가 나와요.',
      url: 'https://geumcheon.go.kr/portal/contents.do?key=208' },
    { id: 'mom', title: '산모·신생아 건강관리 지원', provider: '보건소', amount: '산후도우미 이용료 지원', startDays: -40, deadlineDays: 59, deadlineText: '예정일 40일 전부터 출산 후 60일까지',
      how: '보건소 또는 복지로. 태어나기 전에도 신청할 수 있어요.', note: '소득 기준(중위소득 150% 이하)이 있지만 예외 대상과 지자체 추가 지원이 많으니 보건소에 물어보세요. 마감일은 하루 여유를 두었어요.',
      url: 'https://glasswallet.com/calculate/postpartum-doula-cost/how-to-apply' },
    { id: 'parent', title: '부모급여', provider: '보건복지부', amount: '0세 월 100만원, 1세 월 50만원', deadlineDays: 59, deadlineText: '출생일 포함 60일 이내',
      how: '주민센터, 복지로', note: '60일을 넘기면 지난 달 치를 받을 수 없어요. 어린이집을 이용하면 보육료를 뺀 금액을 받아요.',
      url: 'https://jiwonzip.kr/grant/bumogeup-yeo/sincheong/' },
    { id: 'child', title: '아동수당', provider: '보건복지부', amount: '월 10만~12만원 (지역별)', deadlineDays: 59, deadlineText: '출생일 포함 60일 이내',
      how: '주민센터, 복지로', note: '60일을 넘기면 지난 달 치를 받을 수 없어요. 2027년 개편안이 국회 심의 중이라 바뀔 수 있어요.',
      url: 'https://www.ibabynews.com/contents/guide-child-allowance' },
    { id: 'first', title: '첫만남이용권', provider: '보건복지부', amount: '첫째 200만원, 둘째부터 300만원', deadlineMonths: 24, deadlineText: '출생일부터 2년 안에 사용',
      how: '주민센터, 복지로, 정부24. 국민행복카드 포인트로 받아요.', note: '2년 안에 쓰지 않은 금액은 사라져요.',
      url: 'https://www.mohw.go.kr/menu.es?mid=a10711020100' },
    { id: 'test', title: '선천성 대사이상·난청 검사비 지원', provider: '보건소', amount: '선별검사 본인부담금 등', deadlineMonths: 12, deadlineText: '출생일부터 1년 이내 신청',
      how: '주소지 보건소, e보건소, 아이마중 앱', note: '검사는 28일 안에 받아야 해요. 소득 조건 안내가 지자체마다 달라 보건소 확인이 필요해요.',
      url: 'https://www.guri.go.kr/health/contents.do?key=7876' },
    { id: 'power', title: '출산가구 전기요금 할인', provider: '한국전력', amount: '30% 할인 (월 최대 16,000원)', deadlineText: '출생일부터 3년간 할인. 빨리 신청할수록 유리',
      how: '한전 123, 한전ON, 관리사무소', note: '아기가 실제로 사는 집 기준이에요. 다른 전기요금 할인과 겹치면 큰 쪽이 적용돼요.',
      url: 'https://mediahub.seoul.go.kr/archives/1206572' },
  ];
  const api = { checkedAt: '2026-11-23', list };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BaseBenefits = api;
})(this);
