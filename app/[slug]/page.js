import { getAllPrograms, getProgram, kdate, md } from '../../lib/programs';
import Tabs from '../../components/Tabs';
import AdSlot from '../../components/AdSlot';

const SITE_URL = 'https://tv.jjyu.co.kr';
const KIND = { netflix: { cls: 'btn-nf', lg: 'N', bg: 'var(--nf)' }, sbs: { cls: 'btn-sbs', lg: 'SBS', bg: 'var(--sbs)' }, tv: { cls: 'btn-ghost', lg: 'TV', bg: 'var(--bg3)' }, wavve: { cls: 'btn-ghost', lg: 'W', bg: '#1a5cff' }, tving: { cls: 'btn-ghost', lg: 'T', bg: '#ff153c' }, disney: { cls: 'btn-ghost', lg: 'D+', bg: '#0e3a8a' } };
const Html = ({ as: Tag = 'p', className, html }) => <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;

export function generateStaticParams() { return getAllPrograms().map((p) => ({ slug: p.slug })); }

export async function generateMetadata({ params }) {
  const { slug } = await params; const p = getProgram(slug); if (!p) return {};
  return { title: p.title, description: `${p.name} · ${p.channel} · ${p.airtime}. ${p.intro.replace(/<[^>]+>/g, '').slice(0, 120)}`, alternates: { canonical: `/${p.slug}/` }, openGraph: { title: p.title, description: `${p.name} · ${p.channel}`, type: 'article', images: [p.backdrop] } };
}

function CastCard({ c, color }) {
  return (
    <div className="cc" style={{ '--c': color }}>
      <div className="av">{c.initial}</div>
      <div className="n">{c.name}</div>
      {c.sub && <div className="a">{c.sub}</div>}
      {c.birth && <div className="a num">{c.birth}년생 · {c.age}세</div>}
      <div className="j">{c.job}</div>
      {(c.family || c.region) && <div className="f">{[c.family, c.region].filter(Boolean).join(' · ')}</div>}
    </div>
  );
}

export default async function ProgramPage({ params }) {
  const { slug } = await params; const p = getProgram(slug); if (!p) return null;
  const tabs = [...p.sections.map((s) => ({ id: s.id, tab: s.tab })), ...(p.faq?.length ? [{ id: 'faq', tab: '자주 묻는 질문' }] : [])];
  const primary = p.ctas[0]; const K = KIND[primary.kind] || KIND.tv;
  const all = getAllPrograms();
  const related = (p.related || []).map((r) => ({ ...r, p: all.find((x) => x.slug === r.slug) }));

  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'TVSeries', name: p.name, url: `${SITE_URL}/${p.slug}/`, image: `${SITE_URL}${p.backdrop}`, description: p.intro.replace(/<[^>]+>/g, ''), actor: (p.cast || []).map((c) => ({ '@type': 'Person', name: c.name })) },
    p.faq?.length && { '@type': 'FAQPage', mainEntity: p.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '홈', item: `${SITE_URL}/` }, { '@type': 'ListItem', position: 2, name: p.category, item: `${SITE_URL}/?cat=${encodeURIComponent(p.category)}` }, { '@type': 'ListItem', position: 3, name: p.shortName || p.name }] },
  ].filter(Boolean) };

  const renderSection = (s, i) => (
    <div key={s.id}>
      <section className="block" id={s.id}>
        <h2>{s.heading}</h2>
        <p className="lead">{s.lead}</p>
        {(s.paragraphs || []).map((t, j) => <Html key={j} html={t} />)}
        {s.castTable && (
          <div className="table-wrap"><table>
            <thead><tr><th>출연자</th><th>출생연도 · 나이</th><th>직업</th><th>가족</th><th>거주</th></tr></thead>
            <tbody>{p.cast.map((c) => <tr key={c.name}><td><span className={`tag ${c.group === 'men' ? 'm' : 'w'}`}>{c.group === 'men' ? '남' : '여'}</span><b>{c.name}</b></td><td className="num">{c.birth} · {c.age}세</td><td>{c.job}</td><td>{c.family}</td><td>{c.region || '—'}</td></tr>)}</tbody>
          </table></div>
        )}
        {s.castGrid && <div className="cast">{p.cast.filter((c) => c.group === s.castGrid).map((c) => <CastCard key={c.name} c={c} color={s.castGrid === 'men' ? 'var(--men)' : 'var(--women)'} />)}</div>}
        {s.castList && <div className="cast">{p.cast.map((c) => <CastCard key={c.name} c={c} color={c.group === 'main' ? 'var(--accent)' : 'var(--fg3)'} />)}</div>}
        {s.table && <div className="table-wrap"><table><thead><tr>{s.table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{s.table.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <Html as="td" key={k} html={c} />)}</tr>)}</tbody></table></div>}
        {s.ott && p.ott?.length > 0 && (
          <div className="ott">{p.ott.map((o) => { const k = KIND[o.kind] || KIND.tv; return (
            <a key={o.name} href={o.url} target="_blank" rel="noopener"><span className="lg" style={{ background: k.bg, color: o.kind === 'tv' ? 'var(--fg2)' : '#fff' }}>{k.lg}</span><span><div className="nm">{o.name}</div><div className="st">{o.status}</div></span><span className="arrow">›</span></a>); })}</div>
        )}
        {s.episodes && p.episodes?.length > 0 && (
          <div className="eps">{p.episodes.map((e) => (
            <div key={e.no} className={`ep ${e.soon ? 'soon' : ''}`}>
              <div className="th">{e.thumb ? <><img src={e.thumb} alt={e.no} loading="lazy" /><span>{e.no}</span></> : '방송 예정'}</div>
              <div className="in"><div className="d num">{kdate(e.date)} · {e.sub}</div><div className="t">{e.title}</div><div className="s">{e.desc}</div></div>
              <div className="ac">{e.links.map((l) => <a key={l.label} className={l.kind === 'netflix' ? 'nf' : 'sb'} href={l.url} target="_blank" rel="noopener">{l.label}</a>)}</div>
            </div>))}</div>
        )}
        {s.ott && p.ottNote && <div className="note">{p.ottNote}</div>}
        {(s.after || []).map((t, j) => <Html key={'a' + j} html={t} />)}
      </section>
      {i === 1 && <AdSlot />}
    </div>
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Tabs />
      <div className="hero">
        <div className="bg"><img src={p.backdrop} alt="" /></div>
        <div className="wrap">
          <div className="hero-main">
            <div className="badges"><span className="badge live">{p.status}</span>{p.badges.map((b, i) => <span key={b} className={`badge ${i === 0 ? 'on' : ''}`}>{b}</span>)}</div>
            <h1>{p.title}</h1>
            <div className="sub">{p.subtitle}</div>
            <Html className="intro" html={p.intro} />
            <div className="cta">
              {p.ctas.map((c) => { const k = KIND[c.kind] || KIND.tv; return <a key={c.label} className={`btn ${k.cls}`} href={c.url} target="_blank" rel="noopener">{c.kind === 'netflix' && <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>}{c.label}{c.sub && <small>{c.sub}</small>}</a>; })}
              <a className="btn btn-ghost" href={`#${p.sections[0].id}`}>{p.sections[0].tab} 보기</a>
            </div>
            <div className="mini">{p.links.map((l) => <a key={l.label} href={l.url} target="_blank" rel="noopener">{l.label}</a>)}<a href={`#${p.sections[p.sections.length - 1].id}`}>{p.sections[p.sections.length - 1].tab}</a></div>
          </div>
          <div className="hero-side">
            {p.next && <div className="next"><div className="l">다음 방송</div><div className="d num">{md(p.next.date)} <small>{p.next.label}</small></div><div className="t">{p.next.detail}</div></div>}
            <dl className="kv">{p.facts.map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd className="num">{v}</dd></div>)}</dl>
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
        {related.length > 0 && (
          <section className="related"><h2>함께 보는 프로그램</h2><div className="rgrid">{related.map((r) => (
            <a className="rc" key={r.slug} href={`/${r.slug}/`}><div className="th" style={r.p?.thumb ? { backgroundImage: `url(${r.p.thumb})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>{r.p ? '' : r.name}</div><div className="rt">{r.name}</div><div className="rd">{r.desc}</div></a>))}</div></section>
        )}
        <p className="cta-note" style={{ fontSize: 12, color: 'var(--fg3)', padding: '0 0 24px' }}>출처 {p.source} · {p.checkedAt} 확인{p.imageCredit ? ` · ${p.imageCredit}` : ''}</p>
      </main>

      <div className="stickybar">
        <a className={`btn ${K.cls}`} href={primary.url} target="_blank" rel="noopener">{primary.label}</a>
        <a className="btn btn-ghost" href={`#${p.sections[0].id}`}>{p.sections[0].tab}</a>
      </div>
    </>
  );
}
