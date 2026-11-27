/* 알림 만들기: 등록한 날부터 오늘 날짜에 맞는 알림만 고른다. 앱과 서비스 워커(알림)에서 같이 쓴다. 화면과 무관하다. */
(function (root) {
  'use strict';
  const REM = ['d1', 'd0', 'h1']; // 일정 알림의 기본값: 하루 전, 당일 아침, 1시간 전
  const pad = n => String(n).padStart(2, '0');
  // S: schedule.js. 시기가 지난 것과 마친 것은 만들지 않는다.
  function build(db, S, today) {
    const out = [], hour = pad(db.hour == null ? 9 : db.hour) + ':00', leads = [...new Set(db.leads || [])].filter(n => n > 0), many = db.kids.length > 1;
    const add = (k, subject, kind, date, time, title, body, limit, ref) => out.push({ id: `${subject}:${kind}:${date}`, subject, kid: k ? k.id : '', date, time, title: many && k ? `${k.name} ${title}` : title, body, limit, ref });
    db.kids.forEach(k => {
      const since = k.since || today, put = (subject, kind, date, title, body, limit, ref) => { if (date >= since && date <= limit) add(k, subject, kind, date, hour, title, body, limit, ref); };
      if (!k.born) {
        // 예정일은 정해진 날이 아니므로 접종 대신 만나는 날만 알린다.
        [[7, '일주일 남았어요'], [1, '하루 남았어요'], [0, '오늘이 예정일이에요']].forEach(([n, t]) => put(`${k.id}:due`, 'due' + n, S.addDays(k.birth, -n), n ? `예정일까지 ${t}` : t, '아기를 만날 준비를 확인해 보세요', S.addDays(k.birth, 30), { type: 'due' }));
        return;
      }
      const P = root.Pet || (typeof require !== 'undefined' ? require('./pet.js') : null);
      const CP = root.Couple || (typeof require !== 'undefined' ? require('./couple.js') : null);
      (CP && CP.is(k) ? CP.build(k.birth, k.records, { since: k.since }) : P && P.isPet(k) ? P.build(k.kind, k.birth, k.records, { since: k.since, today }) : S.build(k.birth, k.options, k.records)).forEach(it => {
        if (it.done) return;
        if (it.type === 'anniv') { [[7, '일주일 남았어요'], [1, '내일이에요'], [0, '오늘이에요']].forEach(([n, t]) => put(`${k.id}:${it.id}`, 'an' + n, S.addDays(it.end, -n), `${it.title} ${t}`, '', it.end, { type: 'item', id: it.id })); return; }
        const limit = it.hard && it.hard > it.end ? it.hard : it.end, sub = `${k.id}:${it.id}`, ref = { type: 'item', id: it.id };
        if (today > limit && !(it.appt && it.appt >= today)) return; // 시기가 지난 것
        if (it.appt) {
          leads.forEach(n => put(sub, 'appt' + n, S.addDays(it.appt, -n), `${it.title} 예약 ${n}일 전`, `${it.appt.slice(5).replace('-', '/')} 예약`, it.appt, ref));
          put(sub, 'appt0', it.appt, `오늘 ${it.title} 예약이 있어요`, '', it.appt, ref); return;
        }
        leads.forEach(n => put(sub, 'lead' + n, S.addDays(it.start, -n), `${it.title}, ${n}일 뒤부터예요`, `권장 시기 ${it.age}`, limit, ref));
        // 등록했을 때 이미 받을 시기였다면 등록한 날 알린다.
        const start = it.start < since ? since : it.start;
        put(sub, 'start', start, `${it.title} 받을 시기예요`, `${limit.slice(5).replace('-', '/')}까지, 권장 시기 ${it.age}`, limit, ref);
        [7, 1].forEach(n => { const d = S.addDays(limit, -n); if (d > start) put(sub, 'last' + n, d, `${it.title} ${n}일 남았어요`, `${limit.slice(5).replace('-', '/')}까지 받아 주세요`, limit, ref); });
      });
    });
    const kid = id => db.kids.find(k => k.id === id) || null;
    // 내 일정: 고른 때마다 알린다. 시각이 없으면 하루 전과 당일 아침만.
    (db.events || []).forEach(e => {
      if (e.done || e.date < today) return;
      const k = kid(e.kid), rem = e.rem || REM, day = `${e.date.slice(5).replace('-', '/')}${e.time ? ' ' + e.time : ''}`;
      const put = (kind, date, time, title, body) => add(k, 'e:' + e.id, kind, date, time, title, body, e.date, { type: 'event', id: e.id });
      if (rem.includes('d1')) put('e1', S.addDays(e.date, -1), hour, `내일 ${e.title}`, day);
      if (rem.includes('d0')) { const t = !e.time || e.time > hour ? hour : e.time > '07:00' ? '07:00' : ''; if (t) put('e0', e.date, t, `오늘 ${e.title}`, e.time || e.memo || ''); }
      if (e.time) [['h1', 60, '1시간 뒤'], ['m10', 10, '10분 뒤'], ['m0', 0, '지금']].forEach(([r, m, w]) => {
        if (!rem.includes(r)) return;
        const [h, n] = e.time.split(':').map(Number), x = h * 60 + n - m, y = (x + 1440) % 1440;
        put(r, x < 0 ? S.addDays(e.date, -1) : e.date, `${pad(Math.floor(y / 60))}:${pad(y % 60)}`, `${w} ${e.title}`, e.time);
      });
    });
    (db.logs || []).forEach(l => { if (!l.done && l.date >= today) add(kid(l.kid), 'l:' + l.id, 'l', l.date, l.time || hour, 'LOG', l.memo || '', l.date, { type: 'log', id: l.id, log: l.type }); });
    return out.sort((a, b) => at(a) < at(b) ? -1 : at(a) > at(b) ? 1 : a.id < b.id ? -1 : 1);
  }
  const at = n => n.date + 'T' + n.time;
  // 지금 보여 줄 알림: 이미 울렸고 아직 시기가 남은 것. 같은 일은 가장 최근 것 하나만, 최근 순서로.
  function active(list, now) {
    const m = new Map(), min = s => Date.UTC(+s.slice(0, 4), s.slice(5, 7) - 1, +s.slice(8, 10), +s.slice(11, 13), +s.slice(14, 16)) / 60000;
    list.forEach(n => { if (at(n) > now || now.slice(0, 10) > n.limit) return; if (n.ref.type === 'log' && min(now) - min(at(n)) > 60) return; m.set(n.subject, n); });
    return [...m.values()].reverse();
  }
  // 서버에 맡길 알림 시각(분 단위, 내용 없음)
  const wakes = (list, nowMs, toMs) => [...new Set(list.map(n => toMs(at(n))))].filter(t => t > nowMs + 30000 && t < nowMs + 400 * 86400000).sort((a, b) => a - b).slice(0, 300);
  // 휴대폰에 띄울 글. 방금(여섯 시간 안에) 울릴 것 중 아직 띄우지 않은 것만 하나로 묶는다.
  function message(list, now, shown, logName) {
    const ms = s => Date.parse(s + ':00Z'), name = n => n.ref.type === 'log' ? `${logName(n.ref.log)} 시간이에요` : n.title;
    const due = list.filter(n => at(n) <= now && now.slice(0, 10) <= n.limit && ms(now) - ms(at(n)) < 6 * 3600000 && !shown.includes(n.id));
    if (!due.length) return null;
    return { ids: due.map(n => n.id), title: due.length === 1 ? name(due[0]) : `알림 ${due.length}개가 있어요`, body: due.length === 1 ? due[0].body : due.slice(0, 4).map(name).join('\n') + (due.length > 4 ? `\n외 ${due.length - 4}개` : '') };
  }
  const LOG = { diaper: '기저귀', bottle: '젖병수유', breast: '모유수유', sleep: '수면', food: '이유식', hospital: '병원', bath: '목욕', play: '놀이', med: '약', temp: '체온', kick: '태동', meal: '밥', walk: '산책', potty: '배변', groom: '미용·손질', dateout: '데이트', gift: '선물', trip: '여행', weight: '체중', memo: '메모' };
  const logName = t => LOG[t] || '기록';
  const title = n => n.ref.type === 'log' ? n.title.replace('LOG', `${logName(n.ref.log)} 시간이에요`) : n.title;
  const out = { REM, build, active, wakes, message, logName, title, at };
  if (typeof module !== 'undefined' && module.exports) module.exports = out; else root.Notice = out;
})(this);
