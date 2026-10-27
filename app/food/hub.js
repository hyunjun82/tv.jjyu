import { FOOD_PROGS, foodData } from '../../lib/food';
import FoodFilter from '../../components/FoodFilter';
import AdSlot from '../../components/AdSlot';
export default function FoodHub({ prog }) {
  const g = FOOD_PROGS.find((x) => x.key === prog);
  const { shops, eps } = foodData(prog);
  return (
    <main className="wrap">
      <div className="crumb"><a href="/">홈</a><span>›</span>{g ? <><a href="/food/">방송 맛집</a><span>›</span><span>{g.name}</span></> : <span>방송 맛집</span>}</div>
      <nav className="ptabs"><a href="/food/" className={!g ? 'on' : ''}>전체</a>{FOOD_PROGS.map((x) => <a key={x.key} href={`/food/${x.key}/`} className={g?.key === x.key ? 'on' : ''}>{x.name}</a>)}</nav>
      <header className="fhead">
        <h1>{g ? `${g.name} 맛집` : 'TV 방송 맛집'}</h1>
        <p>{g ? `${g.ch} · ${g.air} 방송 · 방송사 공식 방송정보 기준으로 매일 자동 업데이트` : '6개 프로그램 방송 맛집을 한곳에서 · 방송사 공식 방송정보 기준으로 매일 자동 업데이트'}</p>
      </header>
      {eps.length > 0 && (
        <section className="sec" style={{ paddingTop: 8 }}>
          <h2>회차별 총정리 <small>최신순</small></h2>
          <div className="eprow">{eps.slice(0, 12).map((e) => (
            <a key={e.slug} className="epc" href={`/${e.slug}/`}><div className="th"><img src={e.thumb} alt="" loading="lazy" /></div><div className="t">{e.title}</div><div className="m">{e.date.replace(/-/g, '.')} {e.count && '· ' + e.count}</div></a>))}</div>
        </section>
      )}
      <section className="sec">
        <h2>{g ? `${g.name}에 나온 곳` : '방송에 나온 곳'} <small>지역·상호·메뉴로 찾기</small></h2>
        {shops.length ? <FoodFilter shops={shops} /> : <div className="note">{g?.name} 방송정보가 아직 수집되지 않았습니다. 방송사 공식 방송정보에 가게가 올라오면 자동으로 추가됩니다.</div>}
      </section>
      <AdSlot />
    </main>
  );
}
