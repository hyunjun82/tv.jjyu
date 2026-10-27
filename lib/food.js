// 방송 맛집: 프로그램 6개 + 가게/회차 구분. /food/ 와 /food/<prog>/ 가 같이 쓴다.
import { getAllPrograms } from './programs';
export const FOOD_PROGS = [
  { key: 'sixhour', name: '6시 내고향', ch: 'KBS 1TV', air: '평일 오후 6시' },
  { key: 'town', name: '동네 한바퀴', ch: 'KBS 1TV', air: '토요일 오후 7시 10분' },
  { key: 'today3', name: '생방송투데이', ch: 'SBS', air: '평일 오후 6시' },
  { key: 'reallive', name: '생생정보', ch: 'KBS 2TV', air: '평일 오후 6시 35분' },
  { key: 'lifemaster', name: '생활의 달인', ch: 'SBS', air: '월요일 오후 9시' },
  { key: 'table', name: '한국인의 밥상', ch: 'KBS 1TV', air: '목요일 오후 7시 40분' },
];
const KEYS = FOOD_PROGS.map((x) => x.key);
const isEp = (p) => /^[a-z0-9]+-\d+$/.test(p.slug);
const dateOf = (p) => (String(p.airtime || '').match(/(\d{4})\.(\d{2})\.(\d{2})/) || []).slice(1).join('-');
export function foodData(prog) {
  const all = getAllPrograms().filter((p) => p.type === 'place' && KEYS.includes(p.program) && (!prog || p.program === prog));
  const by = (a, b) => dateOf(b).localeCompare(dateOf(a)) || a.slug.localeCompare(b.slug, 'en', { numeric: true });
  const shops = all.filter((p) => !isEp(p)).sort(by).map((p) => {
    const f = Object.fromEntries(p.facts || []);
    const addr = f['주소'] || '';
    const SH = { 서울특별시: '서울', 인천광역시: '인천', 부산광역시: '부산', 대구광역시: '대구', 대전광역시: '대전', 울산광역시: '울산', 광주광역시: '광주', 경기도: '경기', 강원특별자치도: '강원', 충청북도: '충북', 충청남도: '충남', 전북특별자치도: '전북', 전라남도: '전남', 경상북도: '경북', 경상남도: '경남', 제주특별자치도: '제주', 전남광주통합특별시: '전남광주' };
    const [a0, a1] = addr.split(' ');
    const city = p.store?.city || (a0 ? `${SH[a0] || a0} ${a1 || ''}`.trim() : '');
    return { slug: p.slug, name: p.name, prog: p.program, progName: (FOOD_PROGS.find((x) => x.key === p.program) || {}).name,
      menu: f['대표 메뉴'] || f['방송 메뉴'] || '', hours: f['영업시간'] || '', park: f['주차'] ? '주차 정보 있음' : '',
      city, date: dateOf(p), kind: p.status, thumb: p.thumb || p.backdrop, rich: !!p.store };
  });
  const eps = all.filter(isEp).sort(by).map((p) => ({ slug: p.slug, title: p.title, prog: p.program, date: dateOf(p), count: (p.badges || [])[1] || '', thumb: p.thumb || p.backdrop }));
  return { shops, eps };
}
