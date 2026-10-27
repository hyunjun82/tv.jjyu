export const dynamic = 'force-static';
import { getAllPrograms } from '../lib/programs';
import { CATS } from '../lib/cats';
import { FOOD_PROGS } from '../lib/food';
const SITE_URL = 'https://tv.jjyu.co.kr';
export default function sitemap() {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    ...CATS.map(([c]) => ({ url: `${SITE_URL}/cat/${c}/`, lastModified: now, changeFrequency: 'daily', priority: 0.7 })),
    { url: `${SITE_URL}/food/`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    ...FOOD_PROGS.map((x) => ({ url: `${SITE_URL}/food/${x.key}/`, lastModified: now, changeFrequency: 'daily', priority: 0.85 })),
    ...getAllPrograms().map((e) => ({
      url: `${SITE_URL}/${e.slug}/`,
      lastModified: e.updatedAt ? new Date(e.updatedAt) : now,
      changeFrequency: 'daily',
      priority: 0.8,
    })),
  ];
}
