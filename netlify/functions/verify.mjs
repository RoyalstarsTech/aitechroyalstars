// Public: verify a certificate number
import { json, certStore, normNo } from '../lib/common.mjs';

export default async (req) => {
  const no = normNo(new URL(req.url).searchParams.get('no'));
  if (!no || no.length > 40 || !/^[A-Z0-9-]+$/.test(no)) return json({ valid: false, error: 'Enter a valid certificate number.' }, 400);
  const c = await certStore().get(no, { type: 'json' });
  if (!c || c.revoked) return json({ valid: false, number: no });
  return json({ valid: true, number: c.number, name: c.name, type: c.type, cohort: c.cohort || '', issued: c.issued || '' });
};

export const config = { path: '/api/verify' };
