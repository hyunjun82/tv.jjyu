import { getAllPrograms, md } from '../lib/programs';
import AdSlot from '../components/AdSlot';

export const metadata = { alternates: { canonical: '/' } };
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const KIND = { netflix: 'btn-nf', sbs: 'btn-sbs' };

function Card({ p }) {
  return (
    <a className="pc" href={`/${p.slug}/`}>
      <div className="th"><img src={p.thumb || p.backdrop} alt={p.name} loading="lazy" /><span className="st">{p.status}</span><span className="ch">{p.channel}</span></div>
      <div className="t">{p.shortName || p.name}</div>
      <div className="s">{p.airtime}{p.next ? ` · 다음 ${md(p.next.date)}` : ''}</div>
    </a>
  );
}

export default function Home() {
  const all = getAllPrograms();
  const issues = all.filter((p) => p.type === 'issue');
  const programs = all.filter((p) => p.type !== 'issue');
  const hero = programs[0];
  const variety = programs.filter((p) => p.category === '예능');
  const drama = programs.filter((p) => p.category === '드라마');
  // 편성 띠: 요일별로 airtime 에 요일이 적힌 프로그램을 배치 (수집기가 편성표를 넣으면 그 데이터로 바뀐다)
  const byDay = DAYS.map((d) => programs.filter((p) => (p.airtime || '').includes(d + '요일')));
  const todayIdx = (new Date(Date.now() + 9 * 3600 * 1000).getUTCDay() + 6) % 7;

  return (
    <main className="wrap">
      <div className="hbar"><a className="on" href="/">전체</a><a href="/?cat=예능">예능</a><a href="/?cat=드라마">드라마</a><a href="/#today">오늘 방송</a><a href="/?series=nasolo">나는솔로 기수별</a><a href="/#new">OTT 신작</a></div>

      {hero && (
        <div className="hhero">
          <img src={hero.backdrop} alt="" />
          <div className="in">
            <div className="badges"><span className="badge live">{hero.status}</span><span className="badge on">{hero.badges[0]}</span><span className="badge">{hero.channel}</span></div>
            <h2>{hero.name}</h2>
            <div className="d">{hero.airtime}{hero.next ? ` · 다음 방송 ${md(hero.next.date)}` : ''}</div>
            <div className="cta">
              <a className={`btn ${KIND[hero.ctas[0].kind] || 'btn-ghost'}`} href={hero.ctas[0].url} target="_blank" rel="noopener">{hero.ctas[0].label}</a>
              <a className="btn btn-ghost" href={`/${hero.slug}/`}>출연진 · 회차 보기</a>
            </div>
          </div>
        </div>
      )}

      {issues.length > 0 && (
        <section className="sec" id="issue">
          <h2>오늘의 방송 이슈 <small>보도 기준 · 출처 표기</small></h2>
          <div className="issues">
            <a className="ibig" href={`/${issues[0].slug}/`}><img src={issues[0].backdrop} alt="" /><div className="in"><div className="kicker"><i />{issues[0].kicker}</div><h3>{issues[0].name}</h3><div className="m">{issues[0].dateLabel} · {issues[0].channel}</div></div></a>
            <div className="ilist">{issues.slice(1, 6).map((x, i) => <a key={x.slug} href={`/${x.slug}/`}><div className="n num">{i + 2}</div><div><div className="t">{x.name}</div><div className="s">{x.kicker} · {x.dateLabel}</div></div></a>)}
              {issues.length === 1 && <div className="note">이슈가 쌓이면 여기에 순서대로 올라옵니다</div>}</div>
          </div>
        </section>
      )}

      <section className="sec" id="today">
        <h2>이번 주 편성 <small>방송사 공식 편성 기준</small></h2>
        <div className="sched">{DAYS.map((d, i) => (
          <div key={d} className={`day ${i === todayIdx ? 'today' : ''}`}>
            <div className="dn">{d}{i === todayIdx ? ' · 오늘' : ''}</div>
            {byDay[i].map((p) => <a key={p.slug} className="it" href={`/${p.slug}/`}><b>{p.shortName || p.name}</b><span>{p.channel} · {(p.airtime || '').replace(/매주 .요일 /, '')}</span></a>)}
            {byDay[i].length === 0 && <div className="it"><span>편성 수집 전</span></div>}
          </div>))}</div>
      </section>

      <section className="sec">
        <h2>지금 많이 찾는 프로그램 <small>네이버 검색 유입 기준</small></h2>
        <div className="row">{programs.map((p) => <Card key={p.slug} p={p} />)}</div>
      </section>

      <AdSlot />

      <section className="sec" id="variety">
        <h2>예능 · 기수별 출연진 <small>직업 · 나이 · 러브라인</small></h2>
        {variety.length ? <div className="row">{variety.map((p) => <Card key={p.slug} p={p} />)}</div> : <div className="note">수집되는 예능이 늘어나면 여기에 채워집니다</div>}
      </section>

      <section className="sec" id="new">
        <h2>드라마 · OTT 신작 <small>몇부작 · 공개일 · 다시보기</small></h2>
        {drama.length ? <div className="row">{drama.map((p) => <Card key={p.slug} p={p} />)}</div> : <div className="note">수집되는 드라마가 늘어나면 여기에 채워집니다</div>}
      </section>
    </main>
  );
}
