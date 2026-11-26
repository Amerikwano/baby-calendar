import { DurableObject } from 'cloudflare:workers';
import { handle, HomeCore, PersonCore } from './index.mjs';

export class Home extends DurableObject {
  // 한 집의 요청은 여기서 하나씩 처리한다.
  async run(req, path) {
    const core = new HomeCore(this.ctx.storage, Date.now(), this.env.FAMILY_KEY), r = await core.route(req, path);
    if (core.wantAlarm && !await this.ctx.storage.getAlarm()) await this.ctx.storage.setAlarm(Date.now() + 10000); // 10초 모아서 보낸다
    return r;
  }
  async alarm() { const to = await new HomeCore(this.ctx.storage).takePings(); if (to.length && this.env.PUSH) await this.env.PUSH.ping(to).catch(() => { }); }
  // 사람(카카오 계정)마다 따로 둔 곳: 들어가 있는 집 목록
  plist() { return new PersonCore(this.ctx.storage).list(); }
  padd(home, role, name) { return new PersonCore(this.ctx.storage).add(home, role, name); }
  pdel(home) { return new PersonCore(this.ctx.storage).del(home); }
}
export default { fetch: (req, env) => handle(req, env, id => env.HOME.get(env.HOME.idFromName(id))) };
