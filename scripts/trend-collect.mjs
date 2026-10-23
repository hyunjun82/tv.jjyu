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
const arg = process.argv.slice(2).find((x) => /^\d{4}-\d{2}-\d{2}$/.test(x));
const kst = new Date(Date.now() + 9 * 3600 * 1000);
if (!arg) kst.setUTCDate(kst.getUTCDate() - 1);
const DATE = arg || kst.toISOString().slice(0, 10);
const OUT = path.join(ROOT, 'data', 'trends');
const RAW = path.join(OUT, 'raw', DATE);
fs.mkdirSync(RAW, { recursive: true });

// 우리가 보는 주제. 화면의 카드 제목과 같아야 한다.
const TOPICS = ['방송', '스타·연예인', '드라마', '영화', '스포츠', '게임'];

process.on('unhandledRejection', (e) => { console.error('에러:', e?.message || e); process.exit(1); });
const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false, // 로그인·캡차는 사람이 해야 하므로 창을 띄운다. 자동 실행 때도 창이 잠깐 떴다 닫힌다.
  viewport: { width: 1400, height: 1000 },
  locale: 'ko-KR',
  args: ['--disable-blink-features=AutomationControlled'],
});
const page = ctx.pages()[0] || (await ctx.newPage());

// `node scripts/trend-collect.mjs --login` : 로그인 창만 띄운다. QR 등으로 로그인하면 쿠키가 프로필에 남고 창이 닫힌다.
if (process.argv.includes('--login')) {
  await page.goto('https://nid.naver.com/nidlogin.login?url=https%3A%2F%2Fcreator-advisor.naver.com%2F', { waitUntil: 'domcontentloaded' });
  console.log('네이버 로그인 창을 띄웠습니다. 로그인(QR 가능)하면 자동으로 닫힙니다. 최대 10분.');
  for (let i = 0; i < 600; i++) {
    await page.waitForTimeout(1000);
    if (!/nid\.naver\.com/.test(page.url())) { console.log('로그인 완료. 쿠키 저장됨:', PROFILE); await page.waitForTimeout(2000); await ctx.close(); process.exit(0); }
  }
  console.log('10분 안에 로그인되지 않았습니다.'); await ctx.close(); process.exit(2);
}

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

// 로그인 안 된 상태면 안내 화면("'로그인'하고 서비스 이용하기")이 뜬다. 로그인 버튼을 눌러 주고 사람이 로그인할 때까지 기다린다(최대 5분).
// 화면 읽기 — 페이지가 바뀌는 중이면 실패하므로 빈 문자열로 처리
const textOf = async (pg) => { try { return await pg.evaluate(() => document.body.innerText); } catch { return ''; } };
const LOGIN_RE = /로그인.{0,3}하고 서비스 이용하기/;
const hasTopics = (t) => TOPICS.some((x) => t.includes(x));

// 화면 글자가 뜰 때까지(로그인 안내 또는 주제 카드) 최대 20초
for (let i = 0; i < 40; i++) { const t = await textOf(page); if (LOGIN_RE.test(t) || hasTopics(t)) break; await page.waitForTimeout(500); }

if (LOGIN_RE.test(await textOf(page))) {
  console.log('네이버 로그인이 필요합니다. 뜬 창에서 로그인해 주세요. (최대 5분 기다립니다)');
  try { const btn = page.getByText(LOGIN_RE).first(); if (await btn.count()) await btn.click({ timeout: 5000 }); } catch {}
  // 로그인 창이 새 탭으로 열릴 수도 있어 컨텍스트의 모든 탭을 본다
  let ok = false;
  for (let i = 0; i < 300 && !ok; i++) {
    await page.waitForTimeout(1000);
    for (const pg of ctx.pages()) {
      const u = pg.url(); if (!/creator-advisor\.naver\.com/.test(u)) continue;
      const t = await textOf(pg); if (t && !LOGIN_RE.test(t)) { ok = true; break; }
    }
    if (i % 30 === 29) console.log(`로그인 기다리는 중… ${(i + 1)}초`);
  }
  if (!ok) { console.log('5분 안에 로그인되지 않아 종료합니다. 다시 실행해 주세요.'); await ctx.close(); process.exit(2); }
  console.log('로그인 확인. 트렌드 페이지를 엽니다.');
  await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
  for (let i = 0; i < 40; i++) { if (hasTopics(await textOf(page))) break; await page.waitForTimeout(500); }
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
