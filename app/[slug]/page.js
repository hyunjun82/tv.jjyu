import { getAllPrograms, getProgram, kdate, md } from '../../lib/programs';
import Tabs from '../../components/Tabs';
import AdSlot from '../../components/AdSlot';
import { Act, Acts, Btn, kindOf } from '../../components/Act';
import { goHref } from '../../lib/go';

const SITE_URL = 'https://tv.jjyu.co.kr';
const Html = ({ as: Tag = 'p', className, html }) => <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
const TILE = ['대표 메뉴', '방송 메뉴', '가격대', '영업시간', '휴무', '주차', '가까운 역'];
const strip = (s) => (s || '').replace(/<[^>]+>/g, '');

export function generateStaticParams() { return getAllPrograms().map((p) => ({ slug: p.slug })); }

export async function generateMetadata({ params }) {
  const { slug } = await params; const p = getProgram(slug); if (!p) return {};
  const desc = `${p.name} · ${p.channel}${p.airtime ? ' · ' + p.airtime : ''}. ${strip(p.intro).slice(0, 120)}`;
  return { title: p.title, description: desc, alternates: { canonical: `/${p.slug}/` }, openGraph: { title: p.title, description: desc, type: 'article', images: [p.og || p.backdrop] } };
}

function CastCard({ c, color }) {
  return (
    <div className="cc" style={{ '--c': color }}>
      <div className="top">
        {c.img ? <img className="av" src={c.img} alt={c.name} loading="lazy" /> : <div className="av">{c.initial}</div>}
        <div><div className="n">{c.name}{c.sub && <small>{c.sub}</small>}</div>{c.birth && <div className="a num">{c.birth}년생 · {c.age}세{c.ep ? ` · ${c.ep} 자기소개` : ''}</div>}</div>
      </div>
      <div className="j">{c.job}</div>
      {(c.family || c.region) && <div className="f">{[c.family, c.region].filter(Boolean).join(' · ')}</div>}
      {c.actions?.length > 0 && <div className="acts tight">{c.actions.map((a) => <Act key={a.label} a={a} />)}</div>}
    </div>
  );
}

export default async function ProgramPage({ params }) {
  const { slug } = await params; const p = getProgram(slug); if (!p) return null;
  const all = getAllPrograms();
  const isIssue = p.type === 'issue';
  const tabs = [...p.sections.map((s) => ({ id: s.id, tab: s.tab })), ...(p.faq?.length ? [{ id: 'faq', tab: '자주 묻는 질문' }] : [])];
  const related = (p.related || []).map((r) => ({ ...r, p: all.find((x) => x.slug === r.slug) }));
  const prog = isIssue && p.program ? all.find((x) => x.slug === p.program) : null;
  const primary = p.ctas[0]; const second = p.ctas[1];

  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    isIssue
      ? { '@type': 'NewsArticle', headline: p.name, datePublished: p.updatedAt, dateModified: p.updatedAt, image: [`${SITE_URL}${p.og || p.backdrop}`], author: { '@type': 'Organization', name: 'TVDAY' }, publisher: { '@type': 'Organization', name: 'TVDAY' }, description: strip(p.intro), citation: (p.sources || []).map((x) => x.url) }
      : { '@type': 'TVSeries', name: p.name, url: `${SITE_URL}/${p.slug}/`, image: `${SITE_URL}${p.og || p.backdrop}`, description: strip(p.intro), actor: (p.cast || []).map((c) => ({ '@type': 'Person', name: c.name })) },
    p.faq?.length && { '@type': 'FAQPage', mainEntity: p.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '홈', item: `${SITE_URL}/` }, { '@type': 'ListItem', position: 2, name: p.category, item: `${SITE_URL}/#${p.category === '예능' ? 'variety' : 'drama'}` }, { '@type': 'ListItem', position: 3, name: p.shortName || p.name }] },
  ].filter(Boolean) };

  const renderSection = (s, i) => (
    <div key={s.id}>
      <section className="block" id={s.id}>
        <h2>{s.heading}</h2>
        <p className="lead">{s.lead}</p>
        {(s.paragraphs || []).map((t, j) => <Html key={j} html={t} />)}
        {s.images?.length > 0 && (
          <div className={`figs ${s.images.length === 1 ? 'one' : ''}`}>{s.images.map((im) => (
            <figure key={im.src} className={im.wide ? 'wide' : ''}>
              <a href={goHref(im.url)}><img src={im.src} alt={im.cap} loading="lazy" /><span className={`play ${kindOf(im.kind).cls}`}><span className="lg">{kindOf(im.kind).lg}</span>{im.label}</span></a>
              <figcaption>{im.cap}</figcaption>
            </figure>))}</div>
        )}
        {s.castTable && (
          <div className="table-wrap"><table>
            <thead><tr><th>출연자</th><th>출생연도 · 나이</th><th>직업</th><th>가족</th><th>거주</th><th>바로 보기</th></tr></thead>
            <tbody>{p.cast.map((c) => <tr key={c.name}><td><span className={`tag ${c.group === 'men' ? 'm' : 'w'}`}>{c.group === 'men' ? '남' : '여'}</span><b>{c.name}</b></td><td className="num">{c.birth} · {c.age}세</td><td>{c.job}</td><td>{c.family}</td><td>{c.region || '—'}</td><td>{c.actions?.[0] && <Act a={{ ...c.actions[0], label: '자기소개 클립' }} />}</td></tr>)}</tbody>
          </table></div>
        )}
        {s.castGrid && <div className="cast">{p.cast.filter((c) => c.group === s.castGrid).map((c) => <CastCard key={c.name} c={c} color={s.castGrid === 'men' ? 'var(--men)' : 'var(--women)'} />)}</div>}
        {s.castList && <div className="cast">{p.cast.map((c) => <CastCard key={c.name} c={c} color={c.group === 'main' ? 'var(--accent)' : 'var(--fg3)'} />)}</div>}
        {s.table && <div className="table-wrap"><table className={`${s.table.head.length <= 2 ? 'c2' : ''} ${s.table.cls || ''}`}><thead><tr>{s.table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{s.table.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <Html as="td" key={k} html={c} />)}</tr>)}</tbody></table></div>}
        {s.ott && p.ott?.length > 0 && (
          <div className="ott">{p.ott.map((o) => { const k = kindOf(o.kind); return (
            <a key={o.name} href={goHref(o.url)}><span className="lg" style={{ background: k.bg }}>{k.lg}</span><span><div className="nm">{o.name}</div><div className="st">{o.status}</div></span><span className="arrow">›</span></a>); })}</div>
        )}
        {s.episodes && p.episodes?.length > 0 && (
          <div className="eps">{p.episodes.map((e) => (
            <div key={e.no} className={`ep ${e.soon ? 'soon' : ''}`}>
              <div className="th">{e.thumb ? <><img src={e.thumb} alt={e.no} loading="lazy" /><span>{e.no}</span></> : e.no}</div>
              <div className="in"><div className="d num">{e.date ? `${kdate(e.date)} · ${e.sub}` : e.sub}</div><div className="t">{e.title}</div><div className="s">{e.desc}</div></div>
              <div className="ac">{e.links.map((l) => <Act key={l.label} a={l} />)}</div>
            </div>))}</div>
        )}
        {s.timeline && p.timeline?.length > 0 && (
          <ul className="tl">{p.timeline.map((t, j) => <li key={j} className={t.hot ? 'hot' : ''}><div className="d">{t.date}</div><div className="t">{t.text}</div>{t.source && <div className="s">출처 · {t.url ? <a href={goHref(t.url)}>{t.source}</a> : t.source}</div>}{t.btn && <div className="b"><Act a={t.btn} /></div>}</li>)}</ul>
        )}
        {s.program && prog && (
          <div className="progcard"><div className="th"><img src={prog.thumb || prog.backdrop} alt="" loading="lazy" /></div><div><div className="t">{prog.name}</div><div className="s">{prog.channel} · {prog.airtime}</div></div><a className="act link" href={`/${prog.slug}/`}>출연진 · 다시보기</a></div>
        )}
        {s.ott && p.ottNote && <div className="note">{p.ottNote}</div>}
        {(s.after || []).map((t, j) => <Html key={'a' + j} html={t} />)}
        {s.related && related.length > 0 && <div className="rgrid" style={{ marginTop: 14 }}>{related.map((r) => <a className="rc" key={r.slug} href={`/${r.slug}/`}><div className="th" style={r.p?.thumb ? { backgroundImage: `url(${r.p.thumb})` } : {}} /><div className="rt">{r.name}</div><div className="rd">{r.desc}</div></a>)}</div>}
        <Acts list={s.actions} />
        {s.castGrid && p.snsNote && <div className="note">{p.snsNote}</div>}
      </section>
      {i === 1 && <AdSlot />}
    </div>
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Tabs />
      <div className="wrap">
        <div className="crumb"><a href="/">홈</a><span>›</span><a href={p.type === 'place' ? (p.program ? `/food/${p.program}/` : '/food/') : p.type === 'issue' ? '/cat/issue/' : p.category === '예능' ? '/cat/variety/' : '/cat/drama/'}>{p.type === 'place' ? '방송 맛집' : p.type === 'issue' ? '오늘의 이슈' : p.category}</a>{p.series && <><span>›</span><span>{p.series}</span></>}<span>›</span><span>{p.shortName || p.name}</span></div>
        <div className="hero">
          <div className="info">
            {isIssue
              ? <div className="kicker"><i />{p.kicker}</div>
              : <div className="badges"><span className="badge live">{p.status}</span>{p.badges.map((b, i) => <span key={b} className={`badge ${i === 0 ? 'ac' : ''}`}>{b}</span>)}</div>}
            <h1>{p.title}</h1>
            <div className="sub">{isIssue ? <><b>{p.dateLabel}</b><span>·</span><span>{p.channel}</span>{p.firstReport && <><span>·</span><span>최초 보도 {p.firstReport}</span></>}</> : <><b>{p.channel}</b><span>·</span><span>{p.airtime}</span></>}</div>
            <Html className="intro" html={p.intro} />
            {p.store && <div className="pcard">{p.facts.filter(([k]) => TILE.includes(k)).map(([k, v]) => <div key={k} className={`t ${k === '대표 메뉴' || k === '방송 메뉴' ? 'wide' : ''}`}><span>{k}</span><b>{v}</b></div>)}</div>}
            <div className={`cta-row ${p.store ? 'grid2' : ''}`}>
              {p.ctas.map((c) => <Btn key={c.label} a={c} />)}
            </div>
            <div className="cta-note">버튼은 각 공식 서비스로 이동합니다 · 다시보기 요금은 각 서비스 기준</div>
            {p.facts?.length > 0 && <dl className="meta">{p.facts.filter(([k]) => !p.store || !TILE.includes(k)).map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd className="num">{v}</dd></div>)}</dl>}
          </div>
          <div className="side">
            <div className="pic"><img src={p.backdrop} alt={p.name} />{!isIssue && !String(p.backdrop || '').includes('/img/auto/') && p.episodes?.length > 0 && <span className="ep">{p.episodes.filter((e) => !e.soon).slice(-1)[0]?.no} 장면</span>}{p.imageCredit && <span className="cred">{p.imageCredit}</span>}</div>
            {p.next && <div className="panel"><div className="next"><div><div className="l">{p.next.head || '다음 방송'}</div><div className="d num">{md(p.next.date)}<small>{p.next.label}</small></div></div>{p.next.action ? <Act a={p.next.action} /> : p.next.head ? null : <Act a={{ kind: 'sbs2', label: '예고 보기', url: (p.ctas.find((c) => /예고/.test(c.label)) || p.ctas[0]).url }} />}<div className="t">{p.next.detail}</div></div></div>}
            {p.quick?.length > 0 && <div className="panel"><h3>바로가기 <small>공식 페이지로 이동</small></h3><div className="quick">{p.quick.map((q) => { const k = kindOf(q.kind); return <a key={q.label} href={goHref(q.url)}><span className="lg" style={{ background: k.bg }}>{k.lg}</span><span>{q.label}</span></a>; })}</div></div>}
            {isIssue && p.sources?.length > 0 && <div className="panel"><h3>보도 출처 <small>{p.sources.length}곳</small></h3><div className="srcs">{p.sources.map((x, i) => <a key={x.url} href={goHref(x.url)}><b>{x.media}{i === 0 && <em>최초</em>}</b><span>{x.date}</span></a>)}</div></div>}
          </div>
        </div>
      </div>

      <main className="wrap">
        <nav className="tabs" id="tabs">{tabs.map((t, i) => <a key={t.id} href={`#${t.id}`} className={i === 0 ? 'on' : ''}>{t.tab}</a>)}</nav>
        {p.sections.map(renderSection)}
        {p.faq?.length > 0 && (
          <section className="block" id="faq" style={{ borderBottom: 0 }}><h2>자주 묻는 질문</h2><div className="faq">{p.faq.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div></section>
        )}
        <AdSlot />
        {related.length > 0 && !p.sections.some((s) => s.related) && (
          <section className="related"><h2>함께 보는 페이지</h2><div className="rgrid">{related.map((r) => (
            <a className="rc" key={r.slug} href={`/${r.slug}/`}><div className="th" style={r.p?.thumb ? { backgroundImage: `url(${r.p.thumb})` } : {}} /><div className="rt">{r.name}</div><div className="rd">{r.desc}</div></a>))}</div></section>
        )}
        <p className="cta-note" style={{ padding: '0 0 24px' }}>출처 {p.source} · {p.checkedAt} 확인{p.imageCredit ? ` · ${p.imageCredit}` : ''}</p>
      </main>

      <div className="stickybar">
        <Btn a={primary} />
        {second && <Btn a={second} />}
      </div>
    </>
  );
}
