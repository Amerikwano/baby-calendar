import { DurableObject } from 'cloudflare:workers';
import { handle, HomeCore } from './index.mjs';

export class Home extends DurableObject {
  // 한 집의 요청은 여기서 하나씩 처리한다.
  async run(req, path) { return new HomeCore(this.ctx.storage).route(req, path); }
}
export default { fetch: (req, env) => handle(req, env, id => env.HOME.get(env.HOME.idFromName(id))) };
