import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';

export const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });

export const siteStore = () => getStore({ name: 'site', consistency: 'strong' });
export const certStore = () => getStore({ name: 'certificates', consistency: 'strong' });
export const paymentStore = () => getStore({ name: 'payments', consistency: 'strong' });
export const EARLY_BIRD_SEATS = 15;

// Confirmed-participant counts per cohort, saved for the public counter.
export async function saveStats(byCohort) {
  await siteStore().setJSON('stats', { byCohort, at: new Date().toISOString() });
}
export async function recountStats() {
  const store = paymentStore();
  const { blobs } = await store.list();
  const byCohort = {};
  for (const b of blobs) {
    const r = await store.get(b.key, { type: 'json' });
    if (r && r.status === 'confirmed' && r.cohort) byCohort[r.cohort] = (byCohort[r.cohort] || 0) + 1;
  }
  await saveStats(byCohort);
  return byCohort;
}

export const DEFAULT_SETTINGS = { cohort_name: '', cohort_start: '', whatsapp_group: '', cohort_note: '' };
export async function readSettings() {
  const s = await siteStore().get('settings', { type: 'json' });
  return { ...DEFAULT_SETTINGS, ...(s || {}) };
}

// Certificate numbers: RST-AICG-2026-001-7K3Q (random suffix stops people guessing others' numbers)
export const normNo = (no) => String(no || '').trim().toUpperCase().replace(/\s+/g, '');
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const randCode = (n = 4) => Array.from(crypto.randomBytes(n), (b) => ALPH[b % ALPH.length]).join('');

// ---- admin auth: password -> signed token (12 h) ----
const secret = () => process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || '';
const sign = (payload) => crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
export function issueToken() {
  const exp = String(Date.now() + 12 * 3600 * 1000);
  return Buffer.from(exp).toString('base64url') + '.' + sign(exp);
}
export function validToken(req) {
  const h = req.headers.get('authorization') || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  const [p, sig] = t.split('.');
  if (!p || !sig || !secret()) return false;
  let exp; try { exp = Buffer.from(p, 'base64url').toString(); } catch { return false; }
  const good = sign(exp);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  return Number(exp) > Date.now();
}
export function passwordOk(pw) {
  const real = process.env.ADMIN_PASSWORD || '';
  if (!real || typeof pw !== 'string') return false;
  const a = crypto.createHash('sha256').update(pw).digest(), b = crypto.createHash('sha256').update(real).digest();
  return crypto.timingSafeEqual(a, b);
}
