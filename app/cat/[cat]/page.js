import { getAllPrograms, md } from '../../../lib/programs';
import { CATS, catOf, catHref } from '../../../lib/cats';
import { Act } from '../../../components/Act';
import AdSlot from '../../../components/AdSlot';
export function generateStaticParams() { return CATS.map(([cat]) => ({ cat })); }
export async function generateMetadata({ params }) { const { cat } = await params; const c = catOf(cat); if (!c) return {}; return { title: `${c[1]} 모음 — 회차별 다시보기·출연진·이슈`, description: `${c[1]} 페이지를 최신순으로 모았습니다. 회차 다시보기와 공식 영상으로 바로 이동합니다.`, alternates: { canonical: catHref(cat) } }; }
export default async function CatPage({ params }) {
  const { cat } = await params; const c = catOf(cat); if (!c) return null;
  const list = getAllPrograms().filter(c[2]);
  return (
    <main className="wrap">
      <div className="crumb"><a href="/">홈</a><span>›</span><span>{c[1]}</span></div>
      <div className="hbar">{CATS.map(([s, n]) => <a key={s} href={catHref(s)} className={s === cat ? 'on' : ''}>{n}</a>)}</div>
      <section className="sec" style={{ paddingTop: 16 }}>
        <h2>{c[1]} <small>{list.length}건 · 최신순</small></h2>
        {list.length ? (
          <div className="ilist">{list.map((x) => (
            <div className="it" key={x.slug}>
              <div>
                <div className="k">{x.type === 'issue' ? x.kicker : x.type === 'place' ? x.airtime : `${x.category} · ${x.status}`}</div>
                <a className="t" href={`/${x.slug}/`} style={{ display: 'block' }}>{x.type === 'issue' ? x.name : x.title}</a>
                <div className="m">{x.type === 'issue' ? `${x.dateLabel} · ${x.channel}` : `${x.channel}${x.airtime ? ' · ' + x.airtime : ''}${x.next ? ` · 다음 ${md(x.next.date)}` : ''}`}</div>
                <div className="acts">{x.ctas.slice(0, 3).map((a) => <Act key={a.label} a={a} />)}</div>
              </div>
              <a className="th" href={`/${x.slug}/`}><img src={x.thumb || x.backdrop} alt="" loading="lazy" /></a>
            </div>))}</div>
        ) : <div className="note">{c[1]} 페이지가 아직 없습니다. 수집되는 대로 채워집니다.</div>}
      </section>
      <AdSlot />
    </main>
  );
}
