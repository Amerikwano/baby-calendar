/* 일기·일정·사진을 이 컴퓨터의 data 폴더에 저장한다. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DIR = process.env.BABY_DATA_DIR || path.join(__dirname, 'data');
const p = (...a) => path.join(DIR, ...a);
const STATE = p('state.json');
const EXT = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

function read() {
  if (!fs.existsSync(STATE)) return { rev: 0, data: null };
  return JSON.parse(fs.readFileSync(STATE, 'utf8')); // 손상됐으면 빈 값으로 덮지 않고 오류를 낸다
}
// 다른 창에서 먼저 저장했다면(rev 불일치) 덮어쓰지 않는다.
function write(rev, data) {
  const cur = read();
  if (cur.rev !== rev) return null;
  fs.mkdirSync(p('backup'), { recursive: true });
  if (cur.data) {
    const b = p('backup', new Date().toISOString().slice(0, 10) + '.json');
    if (!fs.existsSync(b)) fs.copyFileSync(STATE, b); // 하루 한 번 백업
  }
  const tmp = STATE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ rev: rev + 1, data }));
  fs.renameSync(tmp, STATE);
  return rev + 1;
}

function sniff(b) {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  if (/^GIF8[79]a$/.test(b.toString('latin1', 0, 6))) return 'gif';
  return null;
}
const ID = /^[0-9a-f]{24}$/;
function savePhoto(buf) {
  const ext = sniff(buf);
  if (!ext) return null;
  const id = crypto.randomBytes(12).toString('hex');
  fs.mkdirSync(p('photos'), { recursive: true });
  fs.writeFileSync(p('photos', `${id}.${ext}`), buf);
  return { id, ext };
}
function saveThumb(id, buf) {
  if (!ID.test(id) || sniff(buf) !== 'jpg' || !photoFile(id)) return false;
  fs.writeFileSync(p('photos', id + '.thumb.jpg'), buf);
  return true;
}
function photoFile(id, thumb) {
  if (!ID.test(id)) return null;
  if (thumb && fs.existsSync(p('photos', id + '.thumb.jpg'))) return { file: p('photos', id + '.thumb.jpg'), type: 'image/jpeg' };
  for (const e of Object.keys(EXT)) if (fs.existsSync(p('photos', `${id}.${e}`))) return { file: p('photos', `${id}.${e}`), type: EXT[e] };
  return null;
}
// 바로 지우지 않고 data/trash로 옮긴다.
function trashPhoto(id) {
  const f = photoFile(id);
  if (!f) return false;
  fs.mkdirSync(p('trash'), { recursive: true });
  fs.renameSync(f.file, p('trash', path.basename(f.file)));
  fs.rmSync(p('photos', id + '.thumb.jpg'), { force: true });
  return true;
}
module.exports = { DIR, read, write, savePhoto, saveThumb, photoFile, trashPhoto };
