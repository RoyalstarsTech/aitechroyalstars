// Training portal: participants (access codes), tests, attendance, materials.
import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { siteStore, certStore, randCode } from './common.mjs';
import { SETS, TOPICS, CONFIDENCE } from './questions.mjs';

export const partStore = () => getStore({ name: 'participants', consistency: 'strong' });
export const testStore = () => getStore({ name: 'tests', consistency: 'strong' });
export const attStore = () => getStore({ name: 'attendance', consistency: 'strong' });
export const fileStore = () => getStore({ name: 'files', consistency: 'strong' });
export const reviewStore = () => getStore({ name: 'reviews', consistency: 'strong' });
export const challengeStore = () => getStore({ name: 'challenge', consistency: 'strong' });
export const upgradeStore = () => getStore({ name: 'upgrades', consistency: 'strong' });
export const RATING_KEYS = ['content', 'facilitator', 'practical', 'platform'];
const txt = (v, n) => String(v ?? '').replace(/\r/g, '').replace(/[\u0000-\u0009\u000b-\u001f<>]/g, '').trim().slice(0, n);
export function cleanReview(b) {
  const r5 = (v) => { const n = Math.round(Number(v)); return n >= 1 && n <= 5 ? n : 0; };
  const nps = Math.round(Number(b.nps));
  const ratings = {}; for (const k of RATING_KEYS) ratings[k] = r5(b.ratings?.[k]);
  const out = { overall: r5(b.overall), ratings, nps: nps >= 0 && nps <= 10 && b.nps !== '' && b.nps != null ? nps : -1,
    gain: txt(b.gain, 800), gaps: txt(b.gaps, 800), suggestions: txt(b.suggestions, 800), testimonial: txt(b.testimonial, 400), publish_ok: !!b.publish_ok };
  const err = !out.overall || RATING_KEYS.some((k) => !ratings[k]) ? 'Please give a star rating for every line.'
    : out.nps < 0 ? 'Please choose how likely you are to recommend the training (0–10).'
    : out.gain.length < 3 ? 'Please tell us what you gained.' : (out.publish_ok && out.testimonial.length < 10 ? 'Please write a short sentence for your public review, or untick the box.' : '');
  return { review: out, error: err };
}

export const clean = (v, n = 120) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

// ---- access codes: RST-7K3Q-92XM ----
export function normCode(v) {
  let s = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.startsWith('RST')) s = s.slice(3);
  return s.length === 8 ? `RST-${s.slice(0, 4)}-${s.slice(4)}` : '';
}
export const refId = (code) => crypto.createHash('sha256').update('ref:' + code).digest('hex').slice(0, 6).toUpperCase();
export const licenceId = (code) => crypto.createHash('sha256').update('lic:' + code).digest('hex').slice(0, 6).toUpperCase();

export async function ensureParticipant(e) {
  const store = partStore();
  const idx = await store.get('e-' + e.enrollment_id);
  if (idx) return idx;
  let code;
  for (let i = 0; i < 5; i++) { code = `RST-${randCode(4)}-${randCode(4)}`; if (!(await store.get(code))) break; }
  const p = {
    code, enrollment_id: e.enrollment_id, name: clean(e.full_name, 90), phone: clean(e.phone, 30), cohort: clean(e.cohort, 120),
    participant_type: clean(e.participant_type, 60), business_type: clean(e.business_type, 80), location: clean(e.location, 80),
    active: true, created_at: new Date().toISOString(), downloads: {},
  };
  await store.setJSON(code, p);
  await store.set('e-' + e.enrollment_id, code);
  await store.set('ref-' + refId(code), code);
  return code;
}
export async function getParticipant(code) {
  code = normCode(code);
  if (!code) return null;
  const p = await partStore().get(code, { type: 'json' });
  return p && p.code ? p : null;
}
export async function listParticipants() {
  const store = partStore();
  const { blobs } = await store.list({ prefix: 'RST-' });
  return (await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })))).filter((p) => p && p.code);
}

// ---- class control ----
export const DEFAULT_CLASS = { pre_open: true, post_open: false, d1: { open: false, word: '' }, d2: { open: false, word: '' }, auto_cert: true, upgrade_open: true, challenge_start: '2026-10-29' };
export async function readClass() {
  const c = (await siteStore().get('class', { type: 'json' })) || {};
  return { ...DEFAULT_CLASS, ...c, d1: { ...DEFAULT_CLASS.d1, ...(c.d1 || {}) }, d2: { ...DEFAULT_CLASS.d2, ...(c.d2 || {}) } };
}

// ---- materials ----
export async function readMaterials() { return (await siteStore().get('materials', { type: 'json' })) || []; }
export const saveMaterials = (list) => siteStore().setJSON('materials', list);
export const UNLOCK_LABEL = { always: 'Available now', pre: 'Unlocks after your pre-test', post: 'Unlocks after your post-test', referral: 'Unlocks when a friend you refer enrols and pays', practitioner: 'For Practitioner upgrade members' };
export const UNLOCKS = Object.keys(UNLOCK_LABEL);
export function unlocked(m, state) {
  if (m.unlock === 'pre') return !!state.pre;
  if (m.unlock === 'post') return !!state.post;
  if (m.unlock === 'referral') return (state.referrals || 0) > 0;
  if (m.unlock === 'practitioner') return !!state.upgraded;
  return true;
}

// ---- tests ----
function rng(seed) { // mulberry32
  let a = crypto.createHash('md5').update(seed).digest().readUInt32LE(0);
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function questionsFor(which, code) {
  const r = rng(which + ':' + code);
  return SETS[which].map((x, i) => {
    const opts = x.o.map((t, k) => ({ k, t }));
    for (let j = opts.length - 1; j > 0; j--) { const m = Math.floor(r() * (j + 1)); [opts[j], opts[m]] = [opts[m], opts[j]]; }
    return { n: i + 1, topic: TOPICS[i], q: x.q, o: opts };
  });
}
export function scoreTest(which, answers) {
  const set = SETS[which];
  const items = set.map((x, i) => ({ n: i + 1, topic: TOPICS[i], q: x.q, your: x.o[answers[i]] ?? '', correct: x.o[x.a], ok: answers[i] === x.a }));
  return { score: items.filter((i) => i.ok).length, total: set.length, items };
}
export { CONFIDENCE, SETS, TOPICS };
export async function getTests(code) {
  const s = testStore();
  const [pre, post] = await Promise.all([s.get('pre-' + code, { type: 'json' }), s.get('post-' + code, { type: 'json' })]);
  return { pre, post };
}

// ---- PDF stamping ----
const winAnsi = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '?');
export async function stampPdf(bytes, p) {
  const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const name = winAnsi(p.name), lic = licenceId(p.code);
  const foot = `Licensed to ${name} - Licence ${lic} - Royalstars Technologies Ltd. - Personal copy, please do not share`;
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const fs = Math.min(7.5, (width - 40) / font.widthOfTextAtSize(foot, 1));
    const w = font.widthOfTextAtSize(foot, fs);
    page.drawText(foot, { x: (width - w) / 2, y: 9, size: fs, font, color: rgb(0.35, 0.4, 0.55) });
    const ws = Math.min(46, (Math.hypot(width, height) * 0.6) / bold.widthOfTextAtSize(name, 1));
    const ww = bold.widthOfTextAtSize(name, ws), ang = Math.atan2(height, width);
    page.drawText(name, {
      x: width / 2 - (ww / 2) * Math.cos(ang) + (ws / 3) * Math.sin(ang), y: height / 2 - (ww / 2) * Math.sin(ang) - (ws / 3) * Math.cos(ang),
      size: ws, font: bold, color: rgb(0.08, 0.2, 0.6), opacity: 0.07, rotate: degrees((ang * 180) / Math.PI),
    });
  }
  doc.setAuthor('Royalstars Technologies Ltd.');
  doc.setSubject(`Licensed to ${name} (Licence ${lic})`);
  doc.setKeywords([`licence:${lic}`]);
  return doc.save();
}

// ---- certificates ----
export const CERT_TYPES = { participation: 'Certificate of Participation', practitioner: 'Certified AI Customer Growth Practitioner' };
export async function nextCertNumber(year) {
  const s = siteStore(), key = `cert-seq-${year}`;
  const cur = Number((await s.get(key)) || 0) + 1;
  await s.set(key, String(cur));
  return `RST-AICG-${year}-${String(cur).padStart(3, '0')}-${randCode()}`;
}
export async function issueCert({ name, type = 'participation', cohort = '', issued = '', code = '' }) {
  type = type === 'practitioner' ? 'practitioner' : 'participation';
  const ps = partStore(), p = code ? await ps.get(code, { type: 'json' }) : null;
  if (p?.certs?.[type]) {
    const ex = await certStore().get(p.certs[type], { type: 'json' });
    if (ex) return ex;
  }
  issued = issued || new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
  const number = await nextCertNumber(issued.slice(0, 4));
  const rec = { number, name: clean(name || p?.name, 90), type: CERT_TYPES[type], type_key: type, cohort: clean(cohort || p?.cohort, 60), issued, code: p ? p.code : '', created_at: new Date().toISOString() };
  await certStore().setJSON(number, rec);
  if (p) { p.certs = { ...(p.certs || {}), [type]: number }; await ps.setJSON(p.code, p); }
  return rec;
}
export async function participantCerts(p) {
  const out = [];
  for (const [type, number] of Object.entries(p.certs || {})) {
    const c = number && (await certStore().get(number, { type: 'json' }));
    if (c) out.push({ type_key: type, type: c.type, number: c.number, issued: c.issued, name: c.name });
  }
  return out;
}

// ---- 30-day challenge (from the Participant Manual) ----
export const CHALLENGE = [
  ['Post 3 statuses (Status Market Day)', 'Post "coming soon" for your idea'],
  ['Ask AI about your business; fix your details', 'Ask 20 people the survey (Prompt 177)'],
  ['Snap & Sell 3 products', 'Write your one-page plan (Prompt 181)'],
  ['Post in 2 WhatsApp groups (Prompt 004)', 'Take your first pre-orders'],
  ['Write your Business Notebook (Prompt 074)', 'Pick your business name (Prompt 133)'],
  ['Ask 3 customers for reviews (Prompt 088)', 'Make your price (Prompt 059)'],
  ['Plan your salary-week offer (Prompt 013)', 'Get your first 3 customers'],
  ['Save 5 Price Talk replies', 'Save 5 Price Talk replies'],
  ['Follow up 5 silent buyers (Prompt 045)', 'Follow up everyone who asked'],
  ['Create small/medium/big (Prompt 047)', 'Create your service packages'],
  ['Practise with the tough buyer (Prompt 063)', 'Practise with the tough buyer (Prompt 063)'],
  ['Set your daily sales target (Prompt 062)', 'Set your daily sales target (Prompt 062)'],
  ['Run a weekend offer (Prompt 065)', 'Run a launch offer (Prompt 028)'],
  ['Do a 15-minute live video (Prompt 051)', 'Post a "meet the owner" post (Prompt 099)'],
  ['Send receipts for every sale (Prompt 106)', 'Send receipts for every sale (Prompt 106)'],
  ['Daily profit check (Prompt 111)', 'Daily profit check (Prompt 111)'],
  ['Start your stock list (Prompt 113)', 'Start your expense list (Prompt 117)'],
  ['Start your "Who owe me" list (Prompt 115)', 'Track every naira spent'],
  ['Collect one debt (Prompt 116)', 'Open a separate business account'],
  ['Send a quotation or proposal (Prompts 108/125)', 'Pitch to a sponsor or grant (Prompts 186/187)'],
  ['Write staff rules (Prompt 129)', 'Plan school + business time (Prompt 191)'],
  ['Thank your last 10 customers (Prompt 141)', 'Thank your first customers (Prompt 141)'],
  ['Send "we miss you" messages (Prompt 144)', 'Ask for feedback (Prompt 169)'],
  ['Launch your referral code (Prompt 148)', 'Launch your referral code (Prompt 148)'],
  ['Make a loyalty card (Prompt 146)', 'Find a mentor (Prompt 193)'],
  ['Teach staff the fake-alert rule (Prompt 160)', 'Learn the grant-scam signs (Prompt 194)'],
  ['Check for fake pages (Prompt 101)', 'Check CAC registration steps (Prompt 196)'],
  ['Business health check (Prompt 166)', '"Am I ready?" check (Prompt 200)'],
  ['Ask AI about your business again', 'Ask AI about your business again'],
  ['Fill your Day 30 Scorecard', 'Fill your Day 30 Scorecard'],
];
export const PRACTITIONER_DAYS = 25;
export function challengeDay(start) {
  const s = new Date(String(start || DEFAULT_CLASS.challenge_start) + 'T00:00:00+01:00');
  const now = new Date();
  return Math.floor((now - s) / 864e5) + 1; // 1 on the start day (Lagos time)
}
export const daysDone = (ch) => Object.values(ch?.days || {}).filter((d) => d && d.at).length;
export const daysWithNotes = (ch) => Object.values(ch?.days || {}).filter((d) => d && d.at && String(d.note || '').trim().length >= 5).length;
export function practitionerState(up, ch) {
  if (!up || up.status !== 'confirmed') return up ? up.status : 'none';
  return daysWithNotes(ch) >= PRACTITIONER_DAYS && ch?.day30 ? 'ready' : 'active';
}
export async function refStats() { return (await siteStore().get('refstats', { type: 'json' })) || {}; }
