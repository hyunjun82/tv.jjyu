// 방송 맛집 프로그램의 공식 편성표(scripts/collect_schedule.py → data/schedule.json)를 페이지 섹션으로 만든다.
// 파일이 없거나 해당 프로그램 편성이 없으면 null (섹션을 그리지 않는다).
import fs from 'fs';
import path from 'path';

const NAMES = { sixhour: '6시 내고향', reallive: '2TV 생생정보', town: '동네 한 바퀴', table: '한국인의 밥상', today3: '생방송 투데이', lifemaster: '생활의 달인' };
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
let cache;
function load() {
  if (cache !== undefined) return cache;
  try { cache = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'schedule.json'), 'utf8')); } catch { cache = null; }
  return cache;
}
const day = (iso) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일(${DOW[new Date(iso + 'T12:00:00+09:00').getUTCDay()]})`;

export function scheduleSection(p) {
  const name = NAMES[p.program]; const data = load();
  if (!name || !data) return null;
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const rows = (data.items[p.program] || []).filter((r) => r.date >= today);
  if (!rows.length) return null;
  const kbs = rows[0].ch.startsWith('KBS');
  const rerun = rows.find((r) => r.kind === '재방');
  const lead = kbs
    ? (rerun ? `${name} 다음 재방송은 ${day(rerun.date)} ${rerun.start} ${rerun.ch}입니다(KBS 공식 편성표 기준).` : `KBS 공식 편성표에 앞으로 7일 안에 '재방'으로 표시된 ${name} 편성은 없습니다.`)
    : `SBS 공식 편성표에 올라온 ${name} 편성입니다. SBS 편성표는 재방송 여부를 따로 표시하지 않아 편성표 제목을 그대로 옮겼습니다.`;
  return {
    id: 'sched', tab: '편성표', heading: `${name} 재방송 시간과 이번 주 편성표는?`, lead,
    table: { cls: 'c2 sched', head: ['날짜', '시간', kbs ? '채널 · 구분' : '채널 · 편성표 제목'], rows: rows.map((r) => [`${Number(r.date.slice(5, 7))}.${Number(r.date.slice(8, 10))}(${DOW[new Date(r.date + 'T12:00:00+09:00').getUTCDay()]})`, `${r.start}~${r.end}${r.late ? ' (심야)' : ''}`, kbs ? `${r.ch} · ${r.kind || '—'}${r.label && r.label !== name ? ` (${r.label})` : ''}` : `${r.ch} · ${r.label}`]) },
    after: [`'(심야)'는 전날 밤 편성이 자정을 넘긴 시간입니다. 편성표에는 재방송 회차가 표시되지 않습니다. 편성은 방송사 사정으로 바뀔 수 있습니다. ${data.checkedAt} 방송사 공식 편성표 확인.`],
  };
}
