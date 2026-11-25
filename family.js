/* 아이 여러 명: 예전 저장 내용 옮기기, 아이 추가·정리. 화면과 무관한 순수 함수만 둔다. */
(function (root) {
  'use strict';
  const KID = ['name', 'birth', 'time', 'born', 'order', 'options', 'records'];
  const newKid = (id, v) => Object.assign({ id, name: '아기', birth: '', time: '', born: false, photo: '', order: 1, options: {}, records: {} }, v);
  // 한 명만 있던 때의 내용(name, birth가 바깥에 있음)을 아이 목록으로 바꾼다.
  function migrate(data) {
    if (!data) return data;
    const d = Object.assign({}, data);
    if (!Array.isArray(d.kids) || !d.kids.length) {
      const v = {}; KID.forEach(k => { if (d[k] !== undefined) v[k] = d[k]; });
      d.kids = [newKid('k1', v)];
    } else d.kids = d.kids.map(k => newKid(k.id, k));
    KID.forEach(k => delete d[k]);
    if (!d.kids.some(k => k.id === d.cur)) d.cur = d.kids[0].id;
    const first = d.kids[0].id;
    ['events', 'diary', 'photos', 'faces', 'logs'].forEach(n => { d[n] = (d[n] || []).map(x => x.kid === undefined ? Object.assign({}, x, { kid: first }) : x); });
    return d;
  }
  // 생일이 빠른 순서로 몇째인지 다시 매긴다(쌍둥이는 넣은 순서).
  function rank(kids) { kids.map((k, i) => [k, i]).sort((a, b) => a[0].birth < b[0].birth ? -1 : a[0].birth > b[0].birth ? 1 : a[1] - b[1]).forEach(([k], i) => { k.order = Math.min(3, i + 1); }); }
  // 아이를 빼도 일기와 사진은 남겨 '모두의 기록'으로 바꾼다. 얼굴 사진은 다른 아이 영상에 섞이지 않게 사진첩으로 옮긴다.
  function removeKid(d, id) {
    if (d.kids.length < 2) return false;
    d.kids = d.kids.filter(k => k.id !== id);
    if (d.cur === id) d.cur = d.kids[0].id;
    ['events', 'diary', 'photos'].forEach(n => d[n].forEach(x => { if (x.kid === id) x.kid = ''; }));
    d.faces.filter(f => f.kid === id).forEach(f => d.photos.push(Object.assign({}, f, { kid: '', caption: '' })));
    d.faces = d.faces.filter(f => f.kid !== id);
    d.logs = d.logs.filter(l => l.kid !== id);
    return true;
  }
  const forKid = (list, id) => list.filter(x => !x.kid || x.kid === id);
  const timeText = t => { if (!/^\d\d:\d\d$/.test(t || '')) return ''; const [h, m] = t.split(':').map(Number); return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시${m ? ' ' + m + '분' : ''}`; };
  const out = { newKid, migrate, rank, removeKid, forKid, timeText };
  if (typeof module !== 'undefined' && module.exports) module.exports = out; else root.Family = out;
})(this);
