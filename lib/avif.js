import fs from 'node:fs';
import path from 'node:path';
// 데이터 안의 /img·/posters JPG·PNG 경로를 같은 이름의 .avif가 있으면 그것으로 바꾼다(화면 표시용).
const PUB = path.join(process.cwd(), 'public');
const RE = /^\/(img|posters)\/.+\.(jpe?g|png)$/i;
const cache = new Map();
export function av(src) {
  if (typeof src !== 'string' || !RE.test(src)) return src;
  if (cache.has(src)) return cache.get(src);
  const a = src.replace(/\.(jpe?g|png)$/i, '.avif');
  const out = fs.existsSync(path.join(PUB, a)) ? a : src;
  cache.set(src, out);
  return out;
}
export function avifify(o) {
  if (typeof o === 'string') return av(o);
  if (Array.isArray(o)) return o.map(avifify);
  if (o && typeof o === 'object') { const r = {}; for (const k in o) r[k] = avifify(o[k]); return r; }
  return o;
}
