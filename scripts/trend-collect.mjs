// 네이버 크리에이터 어드바이저 트렌드 수집기 — 사장님 PC에서 실행 (로그인은 처음 한 번만).
//
// 왜 PC인가: creator-advisor.naver.com 은 네이버 로그인이 필요하고, 클라우드 세션·크롬 확장에서는 열 수 없다.
// 이 스크립트는 자기만의 크롬 프로필 폴더(scripts/.naver-profile)를 쓴다. 처음 실행 때 창이 뜨면 거기서 한 번 로그인하면
// 쿠키가 그 폴더에 남아 다음부터는 로그인 없이 돈다. (네이버 로그인 유지가 풀리면 다시 한 번 로그인)
//
// 사용:  node scripts/trend-collect.mjs            → 어제 날짜
//        node scripts/trend-collect.mjs 2026-10-22 → 지정 날짜
// 결과:  data/trends/YYYY-MM-DD.json  (주제별 키워드 목록 + 순위변동·new 표시)
//        data/trends/raw/YYYY-MM-DD/  (페이지 본문 텍스트·응답 JSON 원본 — 파싱이 어긋나면 이걸로 고친다)
//
// 필요: npm i -D playwright  → npx playwright install chromium (한 번)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PROFILE = path.join(ROOT, 'scripts', '.naver-profile');
const arg = process.argv[2];
const kst = new Date(Date.now() + 9 * 3600 * 1000);
if (!arg) kst.setUTCDate(kst.getUTCDate() - 1);
const DATE = arg || kst.toISOString().slice(0, 10);
const OUT = path.join(ROOT, 'data', 'trends');
const RAW = path.join(OUT, 'raw', DATE);
fs.mkdirSync(RAW, { recursive: true });

// 우리가 보는 주제. 화면의 카드 제목과 같아야 한다.
const TOPICS = ['방송', '스타·연예인', '드라마', '영화', '스포츠', '게임'];

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false, // 로그인·캡차는 사람이 해야 하므로 창을 띄운다. 자동 실행 때도 창이 잠깐 떴다 닫힌다.
  viewport: { width: 1400, height: 1000 },
  locale: 'ko-KR',
  args: ['--disable-blink-features=AutomationControlled'],
});
const page = ctx.pages()[0] || (await ctx.newPage());

// 응답 JSON 원본 저장 — 화면 파싱이 틀려도 원본으로 복구할 수 있게
let n = 0;
page.on('response', async (res) => {
  try {
    const ct = res.headers()['content-type'] || '';
    if (!/json/.test(ct) || !/creator-advisor\.naver\.com/.test(res.url())) return;
    const body = await res.text();
    fs.writeFileSync(path.join(RAW, `res-${String(++n).padStart(3, '0')}.json`), `// ${res.url()}\n${body}`);
  } catch {}
});

const url = `https://creator-advisor.naver.com/naver_blog/trend/search?date=${DATE}`;
await page.goto(url, { waitUntil: 'domcontentloaded' });

// 로그인 화면이면 사람이 로그인할 때까지 기다린다(최대 5분)
for (let i = 0; i < 300; i++) {
  if (/creator-advisor\.naver\.com/.test(page.url()) && !/nid\.naver\.com/.test(page.url())) break;
  if (i === 0) console.log('네이버 로그인이 필요합니다. 뜬 창에서 로그인하면 이어서 진행합니다.');
  await page.waitForTimeout(1000);
}
await page.waitForTimeout(4000);

// 화면 전체 텍스트 저장 + 주제 카드 파싱
const text = await page.evaluate(() => document.body.innerText);
fs.writeFileSync(path.join(RAW, 'page.txt'), text);

const parsed = await page.evaluate((TOPICS) => {
  const out = {};
  // 카드 제목 요소를 찾고, 그 카드(가장 가까운 상위 박스) 안의 줄을 키워드로 읽는다.
  const all = [...document.querySelectorAll('h2,h3,h4,strong,div,span')];
  for (const t of TOPICS) {
    const titleEl = all.find((e) => e.childElementCount === 0 && e.innerText.trim() === t);
    if (!titleEl) continue;
    let box = titleEl; for (let i = 0; i < 6 && box.parentElement; i++) { box = box.parentElement; if (box.innerText.split('\n').length > 12) break; }
    const lines = box.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
    const items = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]; if (l === t) continue;
      if (/^(new|▲|▼|[-–]|\d+)$/i.test(l)) { if (items.length) items[items.length - 1].change = l; continue; }
      items.push({ keyword: l, change: '' });
    }
    out[t] = items;
  }
  return out;
}, TOPICS);

const result = { date: DATE, collectedAt: new Date().toISOString(), source: url, topics: parsed };
fs.writeFileSync(path.join(OUT, `${DATE}.json`), JSON.stringify(result, null, 2));
console.log(`저장: data/trends/${DATE}.json`, Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, v.length])));
await ctx.close();
