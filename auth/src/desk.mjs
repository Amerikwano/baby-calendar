import { DurableObject } from 'cloudflare:workers';
import { Box } from './box.mjs';
export class Desk extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.box = new Box(ctx.storage); }
  start(p, c) { return this.box.start(p, c); } finish(p, r) { return this.box.finish(p, r); } peek(p) { return this.box.peek(p); } take(c) { return this.box.take(c); }
  alarm() { return this.box.clear(); }
}
