// 카테고리 ↔ 주소. GNB·메인 칩·목록 페이지가 같이 쓴다.
export const CATS = [
  ['issue', '오늘의 이슈', (p) => p.type === 'issue'],
  ['food', '방송 맛집', (p) => p.type === 'place'],
  ['variety', '예능', (p) => p.type !== 'issue' && p.type !== 'place' && p.category === '예능'],
  ['drama', '드라마', (p) => p.type !== 'issue' && p.type !== 'place' && p.category === '드라마'],
  ['nasolo', '나는솔로', (p) => p.seriesSlug === 'nasolo'],
];
export const catHref = (slug) => `/cat/${slug}/`;
export const catOf = (slug) => CATS.find(([s]) => s === slug) || null;
