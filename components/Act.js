import { goHref } from '../lib/go';
// 행동 버튼 — 글 속의 회차·출연자·발표마다 붙는다. kind 로 서비스별 색과 로고를 정한다.
export const KIND = {
  netflix: { cls: 'netflix', btn: 'btn-nf', lg: 'N', bg: 'var(--nf)' },
  sbs: { cls: 'sbs', btn: 'btn-sbs', lg: 'SBS', bg: 'var(--sbs)' },
  sbs2: { cls: 'sbs2', btn: 'btn-sbs2', lg: 'SBS', bg: 'var(--sbs)' },
  youtube: { cls: 'youtube', btn: 'btn-yt', lg: '▶', bg: 'var(--yt)' },
  insta: { cls: 'insta', btn: 'btn-ig', lg: '◎', bg: 'var(--ig2)' },
  news: { cls: 'news', btn: 'btn-news', lg: '記', bg: 'var(--fg3)' },
  link: { cls: 'link', btn: 'btn-link', lg: '↗', bg: 'var(--fg3)' },
  tv: { cls: 'link', btn: 'btn-ghost', lg: 'TV', bg: 'var(--fg3)' },
  wavve: { cls: 'link', btn: 'btn-ghost', lg: 'W', bg: '#1a5cff' },
  tving: { cls: 'link', btn: 'btn-ghost', lg: 'T', bg: '#ff153c' },
  disney: { cls: 'link', btn: 'btn-ghost', lg: 'D+', bg: '#0e3a8a' },
};
export const kindOf = (k) => KIND[k] || KIND.link;

/** 작은 버튼(본문·카드·표 안) */
export function Act({ a, className = '' }) {
  const k = kindOf(a.kind);
  return <a className={`act ${k.cls} ${className}`} href={goHref(a.url)}><span className="lg">{k.lg}</span>{a.label}</a>;
}
/** 큰 버튼(히어로·하단 바) */
export function Btn({ a, className = '' }) {
  const k = kindOf(a.kind);
  return <a className={`btn ${k.btn} ${className}`} href={goHref(a.url)}><span className="lg">{k.lg}</span>{a.label}{a.sub && <small>{a.sub}</small>}</a>;
}
export function Acts({ list, tight }) {
  if (!list?.length) return null;
  return <div className={`acts ${tight ? 'tight' : ''}`}>{list.map((a) => <Act key={a.label + a.url} a={a} />)}</div>;
}
