// Public: confirmed participants and early-bird seats left for a cohort (numbers only, no names)
import { json, siteStore, readSettings, EARLY_BIRD_SEATS } from '../lib/common.mjs';

export default async (req) => {
  try {
    const url = new URL(req.url);
    const cohort = String(url.searchParams.get('cohort') || (await readSettings()).cohort_name || '').slice(0, 120);
    const st = (await siteStore().get('stats', { type: 'json' })) || {};
    const confirmed = Number(st.byCohort?.[cohort] || 0);
    return json({ cohort, confirmed, early_total: EARLY_BIRD_SEATS, early_left: Math.max(0, EARLY_BIRD_SEATS - confirmed) }, 200, { 'cache-control': 'public, max-age=60' });
  } catch (e) {
    return json({ error: 'unavailable' }, 200);
  }
};

export const config = { path: '/api/stats' };
