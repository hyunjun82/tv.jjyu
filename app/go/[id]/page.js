import { getAllGo, getGo, hostLabel } from '../../../lib/go';
import { getProgram } from '../../../lib/programs';
import { kindOf } from '../../../components/Act';
import Go from '../../../components/Go';
import AdSlot from '../../../components/AdSlot';

export function generateStaticParams() { return getAllGo().map((g) => ({ id: g.id })); }
export async function generateMetadata({ params }) {
  const { id } = await params; const g = getGo(id); if (!g) return {};
  return { title: `${g.label} · ${hostLabel(g.url)}로 이동`, robots: { index: false, follow: false } };
}

export default async function GoPage({ params }) {
  const { id } = await params; const g = getGo(id); if (!g) return null;
  const p = getProgram(g.from); const k = kindOf(g.kind);
  const others = getAllGo().filter((x) => x.from === g.from && x.id !== g.id).slice(0, 6);
  return (
    <main className="wrap gopage">
      <div className="gocard">
        <div className="lg" style={{ background: k.bg }}>{k.lg}</div>
        <div className="l">{hostLabel(g.url)} 공식 페이지로 이동합니다</div>
        <h1>{g.label}</h1>
        {g.sub && <div className="s">{g.sub}</div>}
        <div className="s">{g.fromName}{g.where && g.where !== '대표' ? ` · ${g.where}` : ''}</div>
        <a className={`btn ${k.btn}`} href={g.url} rel="noopener"><span className="lg">{k.lg}</span>지금 바로 이동</a>
        <div className="cnt"><Go url={g.url} /> · <a href={`/${g.from}/`}>{g.fromName} 페이지로 돌아가기</a></div>
        <div className="u">{g.url}</div>
      </div>
      <AdSlot />
      {others.length > 0 && (
        <div className="goothers">
          <div className="l">{g.fromName}의 다른 바로가기</div>
          <div className="acts">{others.map((o) => { const kk = kindOf(o.kind); return <a key={o.id} className={`act ${kk.cls}`} href={`/go/${o.id}/`}><span className="lg">{kk.lg}</span>{o.label}</a>; })}</div>
        </div>
      )}
      {p && <p className="cta-note" style={{ marginTop: 24 }}>TVDAY는 공식 서비스의 주소를 안내할 뿐이며 영상 시청·결제는 {hostLabel(g.url)}에서 이루어집니다.</p>}
    </main>
  );
}
