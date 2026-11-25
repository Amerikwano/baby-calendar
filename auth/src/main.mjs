import { handle } from './index.mjs';
export { Desk } from './desk.mjs';
export default { fetch: (req, env) => handle(req, env) };
