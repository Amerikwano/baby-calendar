/* 로그인 하나의 결과를 맡아 두는 규칙. 저장소만 받아서 쓰므로 따로 시험할 수 있다. */
export const KEEP = 10 * 60000;
export class Box {
  constructor(store) { this.s = store; }
  async start(p, c) { if (await this.s.get('c')) return; await this.s.put('c', c); await this.s.put('p', p); await this.s.setAlarm(Date.now() + KEEP); }
  async live(p) { return Boolean(await this.s.get('c')) && (await this.s.get('p')) === p; }
  // 성공한 결과는 나중에 온 실패로 덮지 않는다.
  async finish(p, r) { if (!await this.live(p)) return; const old = await this.s.get('r'); if (old && old.id) return; await this.s.put('r', r); }
  async peek(p) { if (!await this.live(p)) return null; const r = await this.s.get('r'); return r && r.id ? r : null; }
  async take(c) {
    const own = await this.s.get('c'); if (!own || own !== c) return { stage: 'none' };
    const r = await this.s.get('r'); if (!r) return { stage: 'wait' };
    const p = await this.s.get('p'); if (r.id) { await this.s.deleteAll(); return { stage: 'done', provider: p, id: r.id, name: r.name, tok: r.tok }; }
    return { stage: 'fail', error: r.error };
  }
  clear() { return this.s.deleteAll(); }
}
