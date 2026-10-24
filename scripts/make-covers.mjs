// 이미지 없는 이슈 페이지용 커버(1200x630 JPG) 생성 — 로컬/클라우드 세션에서 실행 후 커밋
// node scripts/make-covers.mjs [--force]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const DIR = path.join(process.cwd(), 'data', 'programs');
const OUT = path.join(process.cwd(), 'public', 'img', 'auto');
const force = process.argv.includes('--force');
fs.mkdirSync(OUT, { recursive: true });

const PAL = {
  연예: ['#6a3df5', '#ff3b8d'],
  예능: ['#6a3df5', '#ff3b5c'],
  드라마: ['#3b2fd1', '#9a3df5'],
  영화: ['#1f1b4d', '#7a2ff0'],
  스포츠: ['#0b5bd3', '#11b38a'],
  사회: ['#16244f', '#e0782b'],
};
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const html = (p) => {
  const [a, b] = PAL[p.category] || PAL['연예'];
  const head = p.shortName || p.name;
  const size = head.length > 16 ? 76 : head.length > 11 ? 92 : 108;
  return `<!doctype html><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;font-family:'Noto Sans CJK KR','Noto Sans KR',sans-serif;color:#fff;
background:radial-gradient(900px 600px at 85% 10%,${b}cc,transparent 60%),linear-gradient(135deg,${a},#0d0b1f 78%);position:relative;overflow:hidden}
.ring{position:absolute;border-radius:50%;border:2px solid rgba(255,255,255,.12)}
.r1{width:620px;height:620px;right:-160px;top:-180px}.r2{width:420px;height:420px;right:-60px;top:-80px;border-color:rgba(255,255,255,.18)}
.r3{width:240px;height:240px;right:40px;top:20px;background:rgba(255,255,255,.06)}
.wrap{position:absolute;left:84px;right:84px;bottom:86px}
.k{display:inline-block;font-size:30px;font-weight:700;padding:10px 22px;border-radius:999px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28);margin-bottom:30px}
h1{font-size:${size}px;font-weight:900;line-height:1.12;letter-spacing:-2px;word-break:keep-all;text-shadow:0 6px 30px rgba(0,0,0,.25)}
.d{margin-top:28px;font-size:28px;font-weight:500;opacity:.82}
.brand{position:absolute;left:84px;top:70px;display:flex;align-items:center;gap:14px;font-size:34px;font-weight:900;letter-spacing:-.5px}
.logo{width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#7c4dff,#ff3b8d);display:grid;place-items:center}
.cat{position:absolute;right:84px;top:76px;font-size:26px;font-weight:700;opacity:.9}
</style><body>
<div class="ring r1"></div><div class="ring r2"></div><div class="ring r3"></div>
<div class="brand"><div class="logo"><svg width="22" height="24" viewBox="0 0 22 24"><path d="M2 2l18 10L2 22z" fill="#fff"/></svg></div>TVDAY</div>
<div class="cat">오늘의 이슈 · ${esc(p.category)}</div>
<div class="wrap"><div class="k">${esc(p.kicker)}</div><h1>${esc(head)}</h1><div class="d">${esc(p.dateLabel)}</div></div>
</body>`;
};

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'));
const todo = [];
for (const f of files) {
  const fp = path.join(DIR, f);
  const p = JSON.parse(fs.readFileSync(fp, 'utf8'));
  if (p.type !== 'issue') continue;
  const auto = `/img/auto/${p.slug}.jpg`;
  if (p.backdrop && p.backdrop !== auto && !force) continue;
  if (p.backdrop === auto && fs.existsSync(path.join(OUT, `${p.slug}.jpg`)) && !force) continue;
  todo.push({ fp, p, auto });
}
if (!todo.length) { console.log('covers: nothing to do'); process.exit(0); }
const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const { fp, p, auto } of todo) {
  await page.setContent(html(p), { waitUntil: 'load' });
  await page.screenshot({ path: path.join(OUT, `${p.slug}.jpg`), type: 'jpeg', quality: 86 });
  p.backdrop = auto; p.thumb = p.thumb && p.thumb !== '' ? p.thumb : auto;
  if (!p.imageCredit) p.imageCredit = '';
  fs.writeFileSync(fp, JSON.stringify(p, null, 2) + '\n');
  console.log('cover', p.slug);
}
await browser.close();
