// Public: current cohort settings for the landing page
import { json, readSettings } from '../lib/common.mjs';

export default async () => {
  try {
    const s = await readSettings();
    return json(s, 200, { 'cache-control': 'public, max-age=60' });
  } catch (e) {
    return json({}, 200);
  }
};

export const config = { path: '/api/settings' };
