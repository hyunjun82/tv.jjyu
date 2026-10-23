import { getAllPrograms, md } from '../lib/programs';
import AdSlot from '../components/AdSlot';
import { Act, Btn } from '../components/Act';

export const metadata = { alternates: { canonical: '/' } };
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

function Card({ p }) {
  return (
    <div className="pc">
      <a className="th" href={`/${p.slug}/`}><img src={p.thumb || p.backdrop} alt={p.name} loading="lazy" /><span className="st">{p.status}</span><span className="ch">{p.channel}</span></a>
      <a className="t" href={`/${p.slug}/`}>{p.shortName || p.name}</a>
      <div className="s">{p.airtime}{p.next ? ` · 다음 ${md(p.next.date)}` : ''}</div>
      <div className="acts">{p.ctas.slice(0, 2).map((c) => <Act key={c.label} a={c} />)}</div>
    </div>
  );
}

export default function Home() {
  const all = getAllPrograms();
  const issues = all.filter((p) => p.type === 'issue');
  const programs = all.filter((p) => p.type !== 'issue');
  const feat = issues[0] || programs[0];
  const list = [...issues.slice(1), ...programs].slice(0, 4);
  const variety = programs.filter((p) => p.category === '예능');
  const drama = programs.filter((p) => p.category === '드라마');
  const byDay = DAYS.map((d) => programs.filter((p) => (p.airtime || '').includes(d + '요일')));
  const todayIdx = (new Date(Date.now() + 9 * 3600 * 1000).getUTCDay() + 6) % 7;

  return (
    <main className="wrap">
      <div className="hbar"><a className="on" href="/">전체</a><a href="/#issue">오늘의 이슈</a><a href="/#variety">예능</a><a href="/#drama">드라마</a><a href="/#today">이번 주 편성</a><a href="/#variety">나는솔로 기수별</a></div>

      <div className="top" id="issue">
        {feat && (
          <div className="feat">
            <img src={feat.backdrop} alt="" />
            <div className="in">
              <div className="badges">{feat.type === 'issue' ? <span className="badge live" style={{ background: 'var(--hot)' }}>{feat.kicker}</span> : <span className="badge live">{feat.status}</span>}<span className="badge" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.4)' }}>{feat.type === 'issue' ? feat.dateLabel : feat.channel}</span></div>
              <a href={`/${feat.slug}/`}><h2>{feat.name}</h2></a>
              <div className="d">{feat.type === 'issue' ? `${feat.channel} · 보도 ${feat.sources?.length || 0}곳 확인` : `${feat.airtime}${feat.next ? ` · 다음 방송 ${md(feat.next.date)}` : ''}`}</div>
              <div className="cta">
                {feat.ctas.slice(0, 2).map((c) => <Btn key={c.label} a={c} />)}
                <a className="btn btn-ghost" href={`/${feat.slug}/`}>자세히 보기</a>
              </div>
            </div>
          </div>
        )}
        <div className="ilist">
          {list.map((x) => (
            <div className="it" key={x.slug}>
              <div>
                <div className="k">{x.type === 'issue' ? x.kicker : `${x.category} · ${x.status}`}</div>
                <a className="t" href={`/${x.slug}/`} style={{ display: 'block' }}>{x.type === 'issue' ? x.name : x.title}</a>
                <div className="m">{x.type === 'issue' ? `${x.dateLabel} · ${x.channel}` : `${x.channel} · ${x.airtime}`}</div>
                <div className="acts">{x.ctas.slice(0, 2).map((c) => <Act key={c.label} a={c} />)}</div>
              </div>
              <a className="th" href={`/${x.slug}/`}><img src={x.thumb || x.backdrop} alt="" loading="lazy" /></a>
            </div>
          ))}
        </div>
      </div>

      <section className="sec" id="variety">
        <h2>예능 · 기수별 출연진 <small>직업 · 나이 · 회차별 다시보기</small></h2>
        {variety.length ? <div className="row">{variety.map((p) => <Card key={p.slug} p={p} />)}</div> : <div className="note">수집되는 예능이 늘어나면 여기에 채워집니다</div>}
      </section>

      <AdSlot />

      <section className="sec" id="drama">
        <h2>드라마 · OTT 신작 <small>몇부작 · 공개일 · 보러 가기</small></h2>
        {drama.length ? <div className="row">{drama.map((p) => <Card key={p.slug} p={p} />)}</div> : <div className="note">수집되는 드라마가 늘어나면 여기에 채워집니다</div>}
      </section>

      <section className="sec" id="today">
        <h2>이번 주 편성 <small>방송사 공식 편성 기준</small></h2>
        <div className="sched">{DAYS.map((d, i) => (
          <div key={d} className={`day ${i === todayIdx ? 'today' : ''}`}>
            <div className="dn">{d}{i === todayIdx ? ' · 오늘' : ''}</div>
            {byDay[i].map((p) => <a key={p.slug} className="it" href={`/${p.slug}/`}><b>{p.shortName || p.name}</b><span>{p.channel} · {(p.airtime || '').replace(/매주 .요일 /, '')}</span></a>)}
            {byDay[i].length === 0 && <div className="it"><span>편성 없음</span></div>}
          </div>))}</div>
      </section>
    </main>
  );
}
