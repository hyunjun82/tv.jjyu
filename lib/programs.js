import fs from 'node:fs';
import path from 'node:path';
import { avifify } from './avif';
const DIR = path.join(process.cwd(), 'data', 'programs');
export function getAllPrograms() {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')))
    .filter((p) => p.slug && p.title)
    .map((p) => ({ ...avifify(p), og: p.backdrop }))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}
export const getProgram = (slug) => getAllPrograms().find((p) => p.slug === slug) || null;
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
export function kdate(iso) { const d = new Date(iso + 'T00:00:00+09:00'); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} (${DOW[d.getDay()]})`; }
export function md(iso) { const d = new Date(iso + 'T00:00:00+09:00'); return `${d.getMonth() + 1}.${d.getDate()}`; }
export function dow(iso) { return DOW[new Date(iso + 'T00:00:00+09:00').getDay()] + '요일'; }
