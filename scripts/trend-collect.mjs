// 네이버 크리에이터 어드바이저 "주제별 인기유입검색어" 수집기 — API 직접 호출. 창을 띄우지 않는다.
//
// 로그인: 처음 한 번만  node scripts/trend-collect.mjs --login  (창이 뜨면 로그인 → 자동으로 닫힘, 쿠키는 scripts/.naver-profile 에 남음)
// 수집:   node scripts/trend-collect.mjs            → 어제 날짜
//         node scripts/trend-collect.mjs 2026-10-23 → 지정 날짜
// 결과:   data/trends/YYYY-MM-DD.json  { topics: { 방송: [{query, rank, rankChange, ratio}], ... } }
//
// API (실측 2026-10-24): GET https://creator-advisor.naver.com/api/v6/trend/category
//   ?categories=방송,스타·연예인,…&contentType=text&date=YYYY-MM-DD&hasRankChange=true&interval=day&limit=20&service=naver_blog
//   → { data: [ { category, queryList: [ { query, rank, rankChange, ratio } ] } ] }
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PROFILE = path.join(ROOT, 'scripts', '.naver-profile');
const LOGIN = process.argv.includes('--login');
const arg = process.argv.slice(2).find((x) => /^\d{4}-\d{2}-\d{2}$/.test(x));
const kst = new Date(Date.now() + 9 * 3600 * 1000); if (!arg) kst.setUTCDate(kst.getUTCDate() - 1);
const DATE = arg || kst.toISOString().slice(0, 10);
const OUT = path.join(ROOT, 'data', 'trends'); fs.mkdirSync(OUT, { recursive: true });

// 우리가 보는 주제. 어드바이저가 제공하는 32개 중 방송·연예 쪽.
const DEF = ['방송', '스타·연예인', '드라마', '영화', '스포츠', '게임', '공연·전시', '음악', '국내여행'];
const targ = process.argv.find((x) => x.startsWith('--topics='));
const TOPICS = targ ? targ.slice(9).split(',').map((x) => x.trim()).filter(Boolean) : DEF;
const darg = process.argv.find((x) => x.startsWith('--days='));
const DAYS = Math.min(30, Math.max(1, Number(darg ? darg.slice(7) : 1) || 1));
const dateBack = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const API = 'https://creator-advisor.naver.com/api/v6/trend/category';

process.on('unhandledRejection', (e) => { console.error('에러:', e?.message || e); process.exit(1); });
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: !LOGIN, viewport: { width: 1280, height: 900 }, locale: 'ko-KR', args: ['--disable-blink-features=AutomationControlled'] });
const page = ctx.pages()[0] || (await ctx.newPage());

if (LOGIN) {
  await page.goto('https://nid.naver.com/nidlogin.login?url=https%3A%2F%2Fcreator-advisor.naver.com%2F', { waitUntil: 'domcontentloaded' });
  console.log('네이버 로그인 창을 띄웠습니다. 로그인하면 자동으로 닫힙니다. (최대 10분)');
  for (let i = 0; i < 600; i++) { await page.waitForTimeout(1000); if (!/nid\.naver\.com/.test(page.url())) { console.log('로그인 완료. 쿠키 저장됨:', PROFILE); await page.waitForTimeout(2000); await ctx.close(); process.exit(0); } }
  console.log('10분 안에 로그인되지 않았습니다.'); await ctx.close(); process.exit(2);
}

// 세션 확인 겸 홈 한 번 열기(쿠키 갱신) → API 호출
await page.goto('https://creator-advisor.naver.com/naver_blog/stats8207/trends', { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(1500);
const merged = {};
for (let n = 0; n < DAYS; n++) {
  const D = dateBack(DATE, n);
  const qs = new URLSearchParams({ categories: TOPICS.join(','), contentType: 'text', date: D, hasRankChange: 'true', interval: 'day', limit: '20', service: 'naver_blog' });
  const res = await page.request.get(`${API}?${qs}`, { headers: { accept: 'application/json' } });
  const status = res.status(); const body = await res.text();
  let json = null; try { json = JSON.parse(body); } catch {}
  if (status !== 200 || !json?.data) {
    const loginNeeded = /nid\.naver\.com|로그인/.test(body) || status === 401 || status === 403;
    console.error(`API 실패 ${D} (HTTP ${status}). ${loginNeeded ? '로그인이 풀렸습니다 → node scripts/trend-collect.mjs --login 후 다시 실행' : body.slice(0, 200)}`);
    await ctx.close(); process.exit(loginNeeded ? 3 : 1);
  }
  const topics = {};
  for (const c of json.data) topics[c.category] = (c.queryList || []).map((q) => ({ query: q.query, rank: q.rank, rankChange: q.rankChange, ratio: q.ratio }));
  const result = { date: D, collectedAt: new Date().toISOString(), source: `${API}?${qs}`, topics };
  const fp = path.join(OUT, `${D}.json`);
  let prev = {}; try { prev = JSON.parse(fs.readFileSync(fp, 'utf8')).topics || {}; } catch {}
  result.topics = { ...prev, ...topics };
  fs.writeFileSync(fp, JSON.stringify(result, null, 2));
  console.log(`저장: data/trends/${D}.json`, Object.fromEntries(Object.entries(topics).map(([k, v]) => [k, v.length])));
  for (const [cat, list] of Object.entries(topics)) for (const q of list) { const k = cat + '|' + q.query; (merged[k] ||= { cat, query: q.query, days: 0, best: 99, ratio: 0 }); merged[k].days++; merged[k].best = Math.min(merged[k].best, q.rank); merged[k].ratio += Number(q.ratio) || 0; }
  await page.waitForTimeout(700);
}
if (DAYS > 1) {
  const top = Object.values(merged).sort((a, b) => b.days - a.days || a.best - b.best);
  const fp = path.join(OUT, `summary-${DATE}-${DAYS}d.json`);
  fs.writeFileSync(fp, JSON.stringify({ date: DATE, days: DAYS, topics: TOPICS, ranking: top }, null, 2));
  console.log(`합계 순위 저장: ${path.relative(ROOT, fp)} (${top.length}개)`);
}
await ctx.close();
