// 외부 링크 → 내부 이동 페이지(/go/{id}/) 매핑.
// 버튼은 전부 사이트 안의 /go/ 페이지로 먼저 가고(같은 사이트 안 이동이라 애드센스 전면광고가 뜰 수 있음), 거기서 공식 서비스로 넘어간다.
import crypto from 'node:crypto';
import { getAllPrograms } from './programs';

export const goId = (url) => crypto.createHash('sha1').update(url).digest('hex').slice(0, 10);
export const goHref = (url) => `/go/${goId(url)}/`;

let cache = null;
export function getAllGo() {
  if (cache) return cache;
  const map = new Map();
  const add = (p, a, where) => {
    if (!a || !/^https?:\/\//.test(a.url || '')) return;
    const id = goId(a.url);
    if (!map.has(id)) map.set(id, { id, url: a.url, label: a.label || a.name || a.media || '공식 페이지', kind: a.kind || (a.media ? 'news' : 'link'), sub: a.sub || a.status || '', from: p.slug, fromName: p.shortName || p.name, where });
  };
  for (const p of getAllPrograms()) {
    (p.ctas || []).forEach((a) => add(p, a, '대표'));
    (p.quick || []).forEach((a) => add(p, a, '바로가기'));
    (p.links || []).forEach((a) => add(p, a, '공식'));
    (p.ott || []).forEach((a) => add(p, a, 'OTT'));
    (p.sources || []).forEach((a) => add(p, a, '보도'));
    (p.cast || []).forEach((c) => (c.actions || []).forEach((a) => add(p, a, c.name)));
    (p.episodes || []).forEach((e) => (e.links || []).forEach((a) => add(p, a, e.no)));
    (p.sections || []).forEach((s) => { (s.actions || []).forEach((a) => add(p, a, s.tab)); (s.images || []).forEach((a) => add(p, { ...a, label: a.cap }, s.tab)); });
    (p.timeline || []).forEach((t) => { t.btn && add(p, t.btn, t.date); t.url && add(p, { url: t.url, label: `${t.source} 기사`, kind: 'news' }, t.date); });
  }
  cache = [...map.values()];
  return cache;
}
export const getGo = (id) => getAllGo().find((g) => g.id === id) || null;
export function hostLabel(url) {
  const h = new URL(url).hostname;
  if (/netflix/.test(h)) return '넷플릭스';
  if (/sbs\.co\.kr/.test(h)) return 'SBS';
  if (/youtube|youtu\.be/.test(h)) return '유튜브';
  if (/instagram/.test(h)) return '인스타그램';
  if (/map\.naver/.test(h)) return '네이버 지도';
  if (/map\.kakao/.test(h)) return '카카오맵';
  return h.replace(/^www\./, '');
}
