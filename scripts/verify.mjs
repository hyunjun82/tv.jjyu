// 발행 점검 — 필수 항목·slug·공식 링크·이미지 존재 확인. 지어낸 값이 섞이면 사람이 잡는다.
import fs from 'node:fs'; import path from 'node:path';
const dir = path.join(process.cwd(), 'data', 'programs');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
let bad = 0;
const need = ['slug','type','category','title','name','channel','status','backdrop','intro','ctas','sections','source','checkedAt'];
for (const f of files) {
  const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const miss = need.filter((k) => p[k] === undefined || p[k] === '');
  if (miss.length) { console.error(`${f}: 필수 항목 없음 → ${miss.join(', ')}`); bad++; }
  if (p.slug !== f.replace('.json', '')) { console.error(`${f}: slug 와 파일명이 다름`); bad++; }
  if (!(p.ctas || []).some((c) => /^https?:\/\//.test(c.url || ''))) { console.error(`${f}: 공식 링크 버튼 없음`); bad++; }
  if (p.title && p.title.length > 40) console.warn(`${f}: 타이틀 ${p.title.length}자 — 40자 넘음`);
  if ((p.sections || []).length < 3) { console.error(`${f}: 소제목 3개 미만`); bad++; }
  if (p.backdrop && !fs.existsSync(path.join(process.cwd(), 'public', p.backdrop))) { console.error(`${f}: 대표 이미지 파일 없음 ${p.backdrop}`); bad++; }
}
console.log(`PROGRAMS=${files.length} BAD=${bad}`); if (bad) process.exit(1);
