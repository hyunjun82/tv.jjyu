import FoodHub from '../hub';
import { FOOD_PROGS } from '../../../lib/food';
export function generateStaticParams() { return FOOD_PROGS.map((x) => ({ prog: x.key })); }
export async function generateMetadata({ params }) {
  const { prog } = await params; const g = FOOD_PROGS.find((x) => x.key === prog); if (!g) return {};
  return { title: `${g.name} 맛집 오늘 방송 위치 전화번호 메뉴 가격`, description: `${g.ch} ${g.name}(${g.air}) 방송 맛집의 위치·전화번호·메뉴 가격·영업시간·주차를 회차별로 정리합니다. 방송사 공식 방송정보 기준.`, alternates: { canonical: `/food/${prog}/` } };
}
export default async function Page({ params }) { const { prog } = await params; return <FoodHub prog={prog} />; }
