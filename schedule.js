/* 접종·검진 일정 데이터와 날짜 계산. 화면과 무관한 순수 함수만 둔다.
   근거: 질병관리청 「표준예방접종일정표(2026)」, 국가건강정보포털 영유아 건강검진 */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const pad = n => String(n).padStart(2, '0');
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const fmt = t => { const d = new Date(t); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
  const addDays = (s, n) => fmt(parse(s) + n * DAY);
  const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / DAY);
  // 31일생 등 해당 월에 날짜가 없으면 말일로 맞춘다.
  function addMonths(s, n) {
    const [y, m, d] = s.split('-').map(Number);
    const total = y * 12 + (m - 1) + n, ny = Math.floor(total / 12), nm = total % 12;
    const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
    return `${ny}-${pad(nm + 1)}-${pad(Math.min(d, last))}`;
  }
  const max = (a, b) => (a > b ? a : b);

  const DEFAULT_OPTIONS = { combo: '5', rota: 'RV5', je: 'dead' };

  function build(birth, options, records) {
    const o = Object.assign({}, DEFAULT_OPTIONS, options);
    const rec = records || {};
    const out = [];
    const M = n => addMonths(birth, n);
    const D = n => addDays(birth, n);
    // 만 a~b개월: a개월 되는 날부터 (b+1)개월 되는 날의 전날까지
    const span = (a, b) => ({ start: M(a), end: addDays(M(b + 1), -1) });
    const add = (id, type, title, win, extra) => out.push(Object.assign({ id, type, title }, win, extra));

    // ── 출생 직후
    add('hepb1', 'vaccine', 'B형간염 1차', { start: birth, end: birth },
      { age: '출생 시', note: '보통 태어난 병원에서 맞습니다. 퇴원 전에 맞았는지 확인하세요.' });
    add('metab', 'screen', '선천성 대사이상 검사', { start: birth, end: D(28) },
      { age: '생후 28일 이내', hard: D(28), note: '28일 이내에 받은 건강보험 적용 선별검사가 지원 대상입니다. 퇴원 전에 병원에 확인하세요.' });
    add('hearing', 'screen', '신생아 난청 선별검사', { start: birth, end: D(28) },
      { age: '생후 28일 이내', hard: D(28), note: '28일 이내에 받은 건강보험 적용 선별검사가 지원 대상입니다. 퇴원 전에 병원에 확인하세요.' });
    add('bcg', 'vaccine', 'BCG(결핵)', { start: birth, end: D(28) },
      { age: '생후 4주 이내', hard: D(28), remind: D(14), note: '피내용만 무료이고 경피용은 유료입니다. 접종 요일이 정해진 곳이 많아 미리 전화해 보세요.' });

    // ── 1~6개월
    if (o.combo === '5') {
      add('hepb2', 'vaccine', 'B형간염 2차', span(1, 1),
        { age: '1개월', note: '2개월부터 6가 혼합백신을 맞을 계획이면 1개월 접종을 하지 않습니다. 맞기 전에 병원과 먼저 정하세요.' });
    }
    [2, 4, 6].forEach((m, i) => {
      const n = i + 1;
      add('combo' + n, 'vaccine', (o.combo === '6' ? '6가 혼합(DTaP·폴리오·Hib·B형간염) ' : 'DTaP·폴리오·Hib ') + n + '차', span(m, m),
        { age: m + '개월', note: o.combo === '6'
          ? '1개월에 B형간염 2차를 이미 맞았거나 B형간염 주산기감염 예방사업 대상이면 6가 백신을 쓸 수 없습니다.'
          : '혼합백신(4가·5가) 종류는 병원마다 다릅니다.' + (n === 3 ? ' 폴리오 3차는 6~18개월 사이에 맞아도 됩니다.' : '') });
      add('pcv' + n, 'vaccine', '폐렴구균 ' + n + '차', span(m, m), { age: m + '개월', note: '' });
      if (n < 3 || o.rota === 'RV5') {
        add('rota' + n, 'vaccine', '로타바이러스 ' + n + '차', span(m, m),
          { age: m + '개월', hard: n === 1 ? D(104) : M(8),
            note: n === 1 ? '먹는 백신입니다. 1차는 생후 14주 6일까지만 지원됩니다.' : '먹는 백신입니다. 생후 8개월 0일까지 마쳐야 합니다.' });
      }
    });
    if (o.combo === '5') add('hepb3', 'vaccine', 'B형간염 3차', span(6, 6), { age: '6개월', note: '' });

    // ── 돌 이후
    add('hib4', 'vaccine', 'Hib 4차', span(12, 15), { age: '12~15개월', note: '' });
    add('pcv4', 'vaccine', '폐렴구균 4차', span(12, 15), { age: '12~15개월', note: '' });
    add('mmr1', 'vaccine', 'MMR(홍역·볼거리·풍진) 1차', span(12, 15), { age: '12~15개월', note: '' });
    add('var', 'vaccine', '수두', span(12, 15), { age: '12~15개월', note: '' });
    const doneOf = id => rec[id] && rec[id].done;
    add('hepa1', 'vaccine', 'A형간염 1차', span(12, 35), { age: '12~35개월', note: '' });
    add('hepa2', 'vaccine', 'A형간염 2차', { start: doneOf('hepa1') ? addMonths(doneOf('hepa1'), 6) : M(18), end: span(12, 35).end },
      { age: '12~35개월', note: '1차를 맞고 6개월 이상 지난 뒤에 맞습니다. 1차를 완료 표시하면 날짜를 다시 계산합니다.' });
    if (o.je === 'dead') {
      add('je1', 'vaccine', '일본뇌염(불활성화) 1차', span(12, 23), { age: '12~23개월', note: '' });
      add('je2', 'vaccine', '일본뇌염(불활성화) 2차', { start: doneOf('je1') ? addMonths(doneOf('je1'), 1) : M(13), end: span(12, 23).end },
        { age: '12~23개월', note: '1차 약 1개월 뒤로 잡아 둔 날짜입니다. 정확한 간격은 병원 안내를 따르세요.' });
      add('je3', 'vaccine', '일본뇌염(불활성화) 3차', span(24, 35), { age: '24~35개월', note: '' });
      add('je4', 'vaccine', '일본뇌염(불활성화) 4차', span(72, 83), { age: '6세', note: '' });
      add('je5', 'vaccine', '일본뇌염(불활성화) 5차', span(144, 155), { age: '12세', note: '' });
    } else {
      add('jl1', 'vaccine', '일본뇌염(생백신) 1차', span(12, 23), { age: '12~23개월', note: '생백신은 제품에 따라 유료일 수 있으니(예: 이모젭) 병원에 확인하세요.' });
      add('jl2', 'vaccine', '일본뇌염(생백신) 2차', span(24, 35), { age: '24~35개월', note: '' });
    }
    add('dtap4', 'vaccine', 'DTaP 4차', span(15, 18), { age: '15~18개월', note: '' });
    add('dtap5', 'vaccine', 'DTaP 5차', span(48, 83), { age: '4~6세', note: '' });
    add('ipv4', 'vaccine', '폴리오 4차', span(48, 83), { age: '4~6세', note: '' });
    add('mmr2', 'vaccine', 'MMR 2차', span(48, 83), { age: '4~6세', note: '' });
    add('tdap6', 'vaccine', 'Tdap/Td 6차', span(132, 155), { age: '11~12세', note: '' });
    add('hpv', 'vaccine', 'HPV(사람유두종바이러스) 1~2차', span(132, 155), { age: '11~12세', note: '1·2차 간격은 병원 안내를 따르세요.' });

    // ── 독감: 만 6개월 이후 첫 절기부터 매년. 첫 절기는 2회.
    const m6 = M(6), y12 = M(156);
    let first = true;
    for (let y = Number(m6.slice(0, 4)) - 1; y <= Number(y12.slice(0, 4)); y++) {
      const end = `${y + 1}-04-30`;
      if (end < m6) continue;
      const start = max(`${y}-09-20`, m6);
      if (start >= y12) break;
      const label = `${y}~${y + 1}절기`;
      const note = '시작일(9월 20일)은 어림한 날짜입니다. 매년 질병관리청 공고로 정해집니다.';
      if (first) {
        add('flu1', 'vaccine', '독감 첫 접종 1차', { start, end }, { age: label, note: '처음 맞는 해에는 4주 간격으로 두 번 맞습니다. ' + note });
        const s2 = addDays(doneOf('flu1') || start, 28);
        add('flu2', 'vaccine', '독감 첫 접종 2차', { start: s2, end: max(end, s2) }, { age: label, note: '1차 4주 뒤에 맞습니다.' });
        first = false;
      } else add('fluY' + y, 'vaccine', `독감 (${label})`, { start, end }, { age: label, note });
    }

    // ── 영유아 건강검진 8회
    const ckNote = '기간을 놓치면 무료로 받을 수 없습니다. 예약이 밀리니 미리 잡으세요. 정확한 기간은 국민건강보험공단(1577-1000)에서 확인하세요.';
    add('ck1', 'check', '영유아 건강검진 1차', { start: D(14), end: D(35) }, { age: '생후 14~35일', hard: D(35), note: ckNote });
    [[4, 6], [9, 12], [18, 24], [30, 36], [42, 48], [54, 60], [66, 71]].forEach(([a, b], i) => {
      const w = span(a, b);
      add('ck' + (i + 2), 'check', `영유아 건강검진 ${i + 2}차`, w, { age: `${a}~${b}개월`, hard: w.end, note: ckNote });
    });
    [[18, 29], [30, 41], [42, 53], [54, 65]].forEach(([a, b], i) => {
      const w = span(a, b);
      add('or' + (i + 1), 'oral', `구강검진 ${i + 1}차`, w, { age: `${a}~${b}개월`, hard: w.end, note: ckNote });
    });

    return out.map(it => Object.assign(it, { done: doneOf(it.id) || null, appt: (rec[it.id] && rec[it.id].appt) || null }))
      .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.end < b.end ? -1 : a.end > b.end ? 1 : 0));
  }

  function status(it, today) {
    if (it.done) return 'done';
    const limit = it.hard ? max(it.hard, it.end) : it.end;
    if (today > limit) return 'late';
    if (today >= it.start) return 'open';
    return 'next';
  }
  // 출생일 당일로 끝나는 항목도 있어, 알림일이 이미 지났으면 내일로 당겨 실제로 울리게 한다.
  function alertDate(it, today) {
    if (it.appt) return it.appt;
    const want = it.remind || it.start;
    return want > today ? want : addDays(today, 1);
  }
  function lastChance(it) {
    if (!it.hard) return null;
    return addDays(it.hard, diffDays(it.start, it.hard) > 40 ? -14 : -7);
  }

  // 만 개월 수. 태어나기 전이면 -1
  function ageMonths(birth, today) {
    if (today < birth) return -1;
    let n = 0;
    while (addMonths(birth, n + 1) <= today) n++;
    return n;
  }

  // ── 캘린더 파일(.ics)
  const esc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const bytes = c => { const p = c.codePointAt(0); return p < 0x80 ? 1 : p < 0x800 ? 2 : p < 0x10000 ? 3 : 4; };
  function fold(line) {
    let out = '', n = 0;
    for (const c of line) { const b = bytes(c); if (n + b > 73) { out += '\r\n '; n = 1; } out += c; n += b; }
    return out;
  }
  const compact = s => s.replace(/-/g, '');
  function trigger(daysBefore, hour) {
    const h = hour - daysBefore * 24;
    return (h < 0 ? '-PT' + -h : 'PT' + h) + 'H';
  }
  function toICS(items, cfg) {
    const { name, today, leads, hour, stamp } = cfg;
    const days = Array.from(new Set([0].concat(leads || []))).sort((a, b) => b - a);
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//baby-calendar//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + esc(name + ' 접종·검진')];
    let count = 0;
    const event = (uid, date, title, desc, ds) => {
      count++;
      L.push('BEGIN:VEVENT', `UID:${uid}@baby-calendar`, 'DTSTAMP:' + stamp, 'SEQUENCE:' + (cfg.sequence || 0),
        'DTSTART;VALUE=DATE:' + compact(date), 'DTEND;VALUE=DATE:' + compact(addDays(date, 1)),
        'SUMMARY:' + esc(title), 'DESCRIPTION:' + esc(desc), 'TRANSP:TRANSPARENT');
      ds.forEach(d => L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(title), 'TRIGGER:' + trigger(d, hour), 'END:VALARM'));
      L.push('END:VEVENT');
    };
    items.filter(it => !it.done).forEach(it => {
      const desc = `권장 시기: ${it.age} (${it.start} ~ ${it.end})\n${it.note || ''}`.trim();
      const date = alertDate(it, today);
      event(it.uid || it.id, date, `${it.who || name} ${it.title}${it.appt ? ' (예약)' : ''}`, desc, days);
      const lc = lastChance(it);
      if (lc && lc > date && lc > today && !it.appt) event((it.uid || it.id) + '-last', lc, `${it.who || name} ${it.title} 마감 임박 (${it.hard}까지)`, desc, [0]);
    });
    (cfg.events || []).forEach(e => {
      count++;
      const title = e.title, t = e.time ? e.time.replace(':', '') + '00' : '';
      L.push('BEGIN:VEVENT', `UID:my-${e.id}@baby-calendar`, 'DTSTAMP:' + stamp, 'SEQUENCE:' + (cfg.sequence || 0));
      if (t) L.push('DTSTART:' + compact(e.date) + 'T' + t, 'DURATION:PT1H');
      else L.push('DTSTART;VALUE=DATE:' + compact(e.date), 'DTEND;VALUE=DATE:' + compact(addDays(e.date, 1)), 'TRANSP:TRANSPARENT');
      L.push('SUMMARY:' + esc(title), 'DESCRIPTION:' + esc(e.memo || ''));
      (t ? ['-P1D', '-PT1H'] : [trigger(1, hour), trigger(0, hour)]).forEach(x => L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(title), 'TRIGGER:' + x, 'END:VALARM'));
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return { text: L.map(fold).join('\r\n') + '\r\n', count };
  }

  const api = { ageMonths, addDays, addMonths, diffDays, build, status, alertDate, lastChance, toICS, trigger, DEFAULT_OPTIONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Schedule = api;
})(this);
