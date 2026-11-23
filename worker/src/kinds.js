/* 두 AI 기능의 입력 확인과 결과 정리. 로컬 서버와 웹 서버가 함께 쓴다. */
'use strict';
const sdk = require('@anthropic-ai/sdk');
const Anthropic = sdk.default || sdk.Anthropic || sdk;
const { findBenefits } = require('./benefits.js');
const { findTips } = require('./tips.js');

const SIDO = ['서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도'];

function validate(b) {
  if (!b || !SIDO.includes(b.sido)) return null;
  const sigungu = String(b.sigungu || '').trim();
  if (!/^[가-힣0-9 ]{0,20}$/.test(sigungu)) return null;
  if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(b.birthMonth || '')) return null;
  const order = [1, 2, 3].includes(b.order) ? b.order : 1;
  return { sido: b.sido, sigungu, birthMonth: b.birthMonth, order };
}
function explain(e) {
  if (e instanceof Anthropic.AuthenticationError) return [401, 'API 키가 올바르지 않아요. 키를 다시 확인해 주세요.'];
  if (e instanceof Anthropic.RateLimitError) return [429, '요청이 많아 잠시 막혔어요. 조금 뒤 다시 시도해 주세요.'];
  if (e instanceof Anthropic.APIConnectionError) return [503, '인터넷 연결을 확인해 주세요.'];
  if (e instanceof Anthropic.APIError) return [502, `AI 서비스에서 오류가 났어요 (${e.status || '알 수 없음'}).`];
  if (e.message === 'NO_RESULT' || e.message === 'TOO_LONG') return [502, '이번에는 결과를 정리하지 못했어요. 다시 시도해 주세요.'];
  if (e.message === 'REFUSED') return [502, 'AI가 이 요청을 처리하지 못했어요.'];
  return [500, '알 수 없는 오류가 났어요.'];
}

// 두 AI 기능의 설정: 입력 확인, 저장 이름, 실행, 결과 모양
const KINDS = {
  '/api/benefits': {
    validate,
    key: q => ['benefit', q.sido, q.sigungu, q.birthMonth, q.order].join('|'),
    run: findBenefits,
    entry: (list, old) => { const before = new Set(old ? old.items.map(i => i.title) : []); return { items: list.map(i => Object.assign({}, i, { isNew: Boolean(old) && !before.has(i.title) })) }; },
  },
  '/api/tips': {
    validate: b => (b && Number.isInteger(b.ageMonths) && b.ageMonths >= -1 && b.ageMonths <= 71 ? { ageMonths: b.ageMonths } : null),
    key: q => 'tips|' + q.ageMonths,
    run: findTips,
    entry: r => r,
  },
};

const seoulToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

module.exports = { Anthropic, KINDS, validate, explain, seoulToday };
