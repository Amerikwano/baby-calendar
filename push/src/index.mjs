/* 알림 서버(Cloudflare Workers + Durable Object). 저장하는 것: 기기로 보내는 주소와 알릴 시각뿐. 열쇠는 서버가 스스로 만들어 안에만 둔다. */
import { DurableObject, WorkerEntrypoint } from 'cloudflare:workers';
import { endpointOk, timesOk, newKeys, send } from './core.mjs';
const MAX = 2000, BATCH = 40;

export class Bell extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    const q = ctx.storage.sql;
    q.exec('CREATE TABLE IF NOT EXISTS subs (e TEXT PRIMARY KEY, seen INTEGER, test INTEGER DEFAULT 0)');
    q.exec('CREATE TABLE IF NOT EXISTS times (e TEXT, t INTEGER, PRIMARY KEY (e, t))');
    q.exec('CREATE INDEX IF NOT EXISTS times_t ON times (t)');
  }
  async keys() { let k = await this.ctx.storage.get('keys'); if (!k) { k = await newKeys(); await this.ctx.storage.put('keys', k); } return k; }
  async key() { return (await this.keys()).pub; }
  async save(e, times) {
    const q = this.ctx.storage.sql, now = Date.now();
    if (!q.exec('SELECT 1 FROM subs WHERE e = ?', e).toArray().length && q.exec('SELECT COUNT(*) n FROM subs').one().n >= MAX) return false;
    q.exec('INSERT INTO subs (e, seen) VALUES (?, ?) ON CONFLICT(e) DO UPDATE SET seen = excluded.seen', e, now);
    q.exec('DELETE FROM times WHERE e = ?', e);
    for (const t of times) q.exec('INSERT OR IGNORE INTO times (e, t) VALUES (?, ?)', e, t);
    await this.next(); return true;
  }
  async drop(e) { const q = this.ctx.storage.sql; q.exec('DELETE FROM times WHERE e = ?', e); q.exec('DELETE FROM subs WHERE e = ?', e); await this.next(); }
  async test(e) {
    const q = this.ctx.storage.sql, now = Date.now(), r = q.exec('SELECT test FROM subs WHERE e = ?', e).toArray()[0];
    if (!r) return 404; if (now - r.test < 20000) return 429;
    q.exec('UPDATE subs SET test = ? WHERE e = ?', now, e); return this.push(e);
  }
  async push(e) {
    let s = 0; try { s = await send(await this.keys(), e, this.env.SUBJECT, Date.now()); } catch { }
    if (s === 404 || s === 410) await this.drop(e);
    return s;
  }
  // 가족 수첩 서버가 부탁한 알림(좋아요·댓글). 내용 없이 깨우기만 하고, 글은 휴대폰이 가족 수첩에서 받아 만든다.
  async pushMany(list) { await Promise.all(list.map(e => this.push(e))); return list.length; }
  async next() {
    const r = this.ctx.storage.sql.exec('SELECT MIN(t) t FROM times').one().t;
    if (r) await this.ctx.storage.setAlarm(Math.max(r, Date.now() + 500)); else await this.ctx.storage.deleteAlarm();
  }
  async alarm() {
    const q = this.ctx.storage.sql, now = Date.now();
    q.exec('DELETE FROM times WHERE t < ?', now - 6 * 3600000); // 너무 늦은 것은 보내지 않는다
    const due = q.exec('SELECT DISTINCT e FROM times WHERE t <= ? LIMIT ?', now, BATCH).toArray().map(x => x.e);
    for (const e of due) q.exec('DELETE FROM times WHERE e = ? AND t <= ?', e, now);
    await Promise.all(due.map(e => this.push(e)));
    q.exec('DELETE FROM subs WHERE seen < ? AND e NOT IN (SELECT e FROM times)', now - 400 * 86400000);
    await this.next();
  }
}
// 가족 수첩 서버만 부를 수 있는 입구(서비스 연결). 인터넷에서는 닿지 않는다.
export class Pinger extends WorkerEntrypoint {
  async ping(list) { const ok = [...new Set(Array.isArray(list) ? list : [])].filter(endpointOk).slice(0, 60); if (!ok.length) return 0; return this.env.BELL.get(this.env.BELL.idFromName('all')).pushMany(ok); }
}
export default {
  async fetch(req, env) {
    const origin = req.headers.get('origin'), head = { 'access-control-allow-origin': env.APP_ORIGIN, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'origin', 'cache-control': 'no-store' };
    const out = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...head, 'content-type': 'application/json' } });
    if (origin !== env.APP_ORIGIN) return out({ error: 'origin' }, 403);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: head });
    const path = new URL(req.url).pathname, bell = env.BELL.get(env.BELL.idFromName('all'));
    if (req.method === 'GET' && path === '/key') return out({ key: await bell.key() });
    if (req.method !== 'POST' || !['/save', '/drop', '/test'].includes(path)) return out({ error: 'path' }, 404);
    const raw = await req.text(); if (raw.length > 12000) return out({ error: 'size' }, 413);
    let b; try { b = JSON.parse(raw); } catch { return out({ error: 'json' }, 400); }
    if (!b || !endpointOk(b.endpoint)) return out({ error: 'endpoint' }, 400);
    if (path === '/drop') { await bell.drop(b.endpoint); return out({ ok: true }); }
    if (path === '/test') { const s = await bell.test(b.endpoint); return out({ status: s }, s === 404 ? 404 : s === 429 ? 429 : 200); }
    const t = timesOk(b.times, Date.now()); if (!t) return out({ error: 'times' }, 400);
    return (await bell.save(b.endpoint, t)) ? out({ ok: true }) : out({ error: 'full' }, 503);
  },
};
