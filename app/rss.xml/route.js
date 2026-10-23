import { getAllPrograms } from '../../lib/programs';
export const dynamic = 'force-static';
const SITE_URL = 'https://tv.jjyu.co.kr';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 새 공연 페이지가 생기면 RSS <item> 으로 바로 잡힌다 — 사이트맵과 별개로 "방금 새 글" 신호 (quiz.jjyu 와 동일) */
export function GET() {
  const items = getAllPrograms().slice(0, 50).map((e) => `
    <item>
      <title>${esc(e.title)}</title>
      <link>${SITE_URL}/${e.slug}/</link>
      <guid isPermaLink="true">${SITE_URL}/${e.slug}/</guid>
      <pubDate>${new Date(e.updatedAt || Date.now()).toUTCString()}</pubDate>
      <description>${esc(`${e.name} · ${e.channel} · ${e.airtime}`)}</description>
    </item>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>TVDAY — 드라마·예능 편성·출연진</title>
  <link>${SITE_URL}/</link>
  <description>편성 시간, 몇부작, 출연진, 다시보기 OTT</description>
  <language>ko-KR</language>${items}
</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
