'use client';
import { useMemo, useState } from 'react';
// 지역·상호·메뉴 검색 + 음식점/장소 구분. 정적 목록을 그 자리에서 거른다.
export default function FoodFilter({ shops }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const list = useMemo(() => {
    const t = q.trim().replace(/\s+/g, '');
    return shops.filter((s) => (kind === 'all' || (kind === 'food' ? s.kind === '방송 맛집' : s.kind !== '방송 맛집'))
      && (!t || (s.name + s.menu + s.city + s.progName).replace(/\s+/g, '').includes(t)));
  }, [q, kind, shops]);
  return (
    <>
      <div className="fsearch">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="지역, 상호, 메뉴로 검색 (예: 안동 찜닭)" aria-label="방송 맛집 검색" />
        <div className="fk">{[['all', '전체'], ['food', '음식점'], ['place', '체험·장소']].map(([k, n]) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{n}</button>)}</div>
      </div>
      <div className="fcount">{list.length}곳</div>
      <div className="fgrid">{list.map((s) => (
        <a key={s.slug} className="fc" href={`/${s.slug}/`}>
          <div className="th"><img src={s.thumb} alt="" loading="lazy" /><span className="pg">{s.progName}</span></div>
          <div className="bd">
            <div className="nm">{s.name}</div>
            {s.menu && <div className="mn">{s.menu}</div>}
            <div className="mt">{[s.city, s.date && s.date.slice(5).replace('-', '.') + ' 방송'].filter(Boolean).join(' · ')}</div>
            {(s.hours || s.park) && <div className="tg">{s.hours && <span>⏰ {s.hours}</span>}{s.park && <span>🅿 {s.park}</span>}</div>}
          </div>
        </a>))}</div>
      {!list.length && <div className="note">검색 결과가 없습니다.</div>}
    </>
  );
}
