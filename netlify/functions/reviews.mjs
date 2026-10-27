// Public: approved reviews only (first name, business type, city, stars, testimonial).
import { json, siteStore } from '../lib/common.mjs';

export default async () => {
  try {
    const d = (await siteStore().get('public-reviews', { type: 'json' })) || { items: [], average: 0, ratings: 0 };
    return json(d, 200, { 'cache-control': 'public, max-age=60' });
  } catch (e) {
    return json({ items: [], average: 0, ratings: 0 }, 200);
  }
};

export const config = { path: '/api/reviews' };
