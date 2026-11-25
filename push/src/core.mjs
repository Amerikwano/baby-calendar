/* 알림 서버의 계산 부분. 내용 없는 알림만 보내므로 아기 정보는 다루지 않는다. */
const b64 = u => btoa(String.fromCharCode(...new Uint8Array(u))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const text = s => new TextEncoder().encode(s);
// 브라우저 회사의 알림 서버 주소만 받는다.
export function endpointOk(e) {
  if (typeof e !== 'string' || e.length > 800) return false;
  let u; try { u = new URL(e); } catch { return false; }
  return u.protocol === 'https:' && !u.port && !u.username && (['fcm.googleapis.com', 'updates.push.services.mozilla.com'].includes(u.hostname) || /^[a-z0-9-]+\.push\.apple\.com$/.test(u.hostname) || /^[a-z0-9.-]+\.notify\.windows\.com$/.test(u.hostname));
}
export function timesOk(a, now) {
  if (!Array.isArray(a) || a.length > 300) return null;
  const t = [...new Set(a)]; return t.every(x => Number.isInteger(x) && x > now - 86400000 && x < now + 401 * 86400000) ? t.filter(x => x > now) : null;
}
export const newKeys = async () => { const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']); return { priv: await crypto.subtle.exportKey('jwk', k.privateKey), pub: b64(await crypto.subtle.exportKey('raw', k.publicKey)) }; };
export async function vapid(keys, endpoint, subject, now) {
  const head = b64(text(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))), body = b64(text(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey('jwk', keys.priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, text(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64(sig)}, k=${keys.pub}`;
}
export async function send(keys, endpoint, subject, now, post = fetch) {
  const r = await post(endpoint, { method: 'POST', headers: { authorization: await vapid(keys, endpoint, subject, now), ttl: '21600', urgency: 'high', 'content-length': '0' } });
  return r.status;
}
