// Participant portal API. Every call needs the participant's access code (header x-access-code).
import { json, siteStore, readSettings } from '../lib/common.mjs';
import {
  getParticipant, partStore, testStore, attStore, fileStore, readClass, readMaterials, unlocked, UNLOCK_LABEL,
  questionsFor, scoreTest, getTests, stampPdf, CONFIDENCE, SETS, clean, reviewStore, cleanReview,
  challengeStore, upgradeStore, CHALLENGE, PRACTITIONER_DAYS, challengeDay, daysDone, daysWithNotes, practitionerState,
  issueCert, participantCerts, refId, refStats,
} from '../lib/training.mjs';

const UPGRADE_FEE = 10000;
const BANK = { account_name: 'Christopher Ohirein', bank: 'Opay Digital MFB', account_number: '7039106808' };
async function accessState(p, tests) {
  const [rs, up] = await Promise.all([refStats(), upgradeStore().get(p.code, { type: 'json' })]);
  return { pre: !!tests.pre, post: !!tests.post, referrals: rs[p.code]?.confirmed || 0, upgraded: up?.status === 'confirmed' };
}

const first = (n) => String(n || '').trim().split(/\s+/)[0];
const summary = (t) => (t ? { done: true, score: t.score, total: t.total, at: t.at } : { done: false });

async function me(p) {
  const [cls, mats, tests, att, s, priv, rev, ch, up, rs] = await Promise.all([
    readClass(), readMaterials(), getTests(p.code), attStore().get(p.code, { type: 'json' }), readSettings(),
    siteStore().get('private', { type: 'json' }), reviewStore().get(p.code, { type: 'json' }),
    challengeStore().get(p.code, { type: 'json' }), upgradeStore().get(p.code, { type: 'json' }), refStats(),
  ]);
  const ps = partStore();
  if (!(await ps.get('ref-' + refId(p.code)))) await ps.set('ref-' + refId(p.code), p.code);
  const eligible = { d1: !!att?.d1, d2: !!att?.d2, post: !!tests.post };
  // automatic Certificate of Participation once the rules are met
  if (cls.auto_cert !== false && eligible.d1 && eligible.d2 && eligible.post && !p.certs?.participation) {
    await issueCert({ code: p.code, type: 'participation' }).catch(() => {});
    Object.assign(p, (await ps.get(p.code, { type: 'json' })) || {});
  }
  const state = { pre: !!tests.pre, post: !!tests.post, referrals: rs[p.code]?.confirmed || 0, upgraded: up?.status === 'confirmed' };
  const today = challengeDay(cls.challenge_start);
  return {
    name: p.name, first: first(p.name), cohort: p.cohort, participant_type: p.participant_type || '',
    join_link: priv?.join_link || '', whatsapp_group: s.whatsapp_group || '',
    class: { pre_open: !!cls.pre_open, post_open: !!cls.post_open, checkin: ['d1', 'd2'].filter((d) => cls[d].open && cls[d].word), upgrade_open: cls.upgrade_open !== false },
    pre: summary(tests.pre), post: summary(tests.post),
    attendance: { d1: att?.d1 || '', d2: att?.d2 || '' },
    review: rev ? { done: true, status: rev.publish_ok ? rev.status : 'hidden', at: rev.at } : { done: false, open: !!tests.post },
    materials: mats.map((m) => ({ id: m.id, title: m.title, size: m.size, type: m.type, unlock: m.unlock, locked: !unlocked(m, state), note: UNLOCK_LABEL[m.unlock] || '' })),
    certificates: await participantCerts(p), eligible,
    challenge: { start: cls.challenge_start, today, done: daysDone(ch), with_notes: daysWithNotes(ch), day30: !!ch?.day30 },
    upgrade: { fee: UPGRADE_FEE, bank: BANK, status: up?.status || 'none', practitioner: practitionerState(up, ch), need_days: PRACTITIONER_DAYS, submitted_at: up?.at || '' },
    referral: { id: refId(p.code), confirmed: rs[p.code]?.confirmed || 0, pending: rs[p.code]?.pending || 0 },
  };
}

export default async (req) => {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api\/portal\/?/, '');
  const method = req.method;
  const body = method === 'POST' ? await req.json().catch(() => ({})) : {};
  try {
    const code = route === 'login' ? body.code : req.headers.get('x-access-code');
    const p = await getParticipant(code);
    if (!p || p.active === false) {
      await new Promise((r) => setTimeout(r, 600));
      return json({ error: p ? 'This access code has been switched off. Please contact Royalstars on 07039106808.' : 'That access code was not found. Check it and try again.' }, 401);
    }

    if ((route === 'login' && method === 'POST') || (route === 'me' && method === 'GET')) return json(await me(p));

    if (route === 'test') {
      const which = (method === 'GET' ? url.searchParams.get('which') : body.which) === 'post' ? 'post' : 'pre';
      const store = testStore(), key = `${which}-${p.code}`;
      const done = await store.get(key, { type: 'json' });
      if (done) return json({ done: true, which, ...scoreTest(which, done.answers) });
      const cls = await readClass();
      if (!cls[which + '_open']) return json({ open: false, which, error: which === 'pre' ? 'The pre-test is closed.' : 'The post-test opens at the end of Day 2.' }, method === 'GET' ? 200 : 403);
      if (method === 'GET') return json({ open: true, which, questions: questionsFor(which, p.code), confidence: CONFIDENCE, baseline: which === 'pre' });

      const n = SETS[which].length;
      const answers = Array.isArray(body.answers) ? body.answers.map((x) => Number(x)) : [];
      if (answers.length !== n || answers.some((x) => !Number.isInteger(x) || x < 0 || x > 3)) return json({ error: 'Please answer every question.' }, 400);
      const confidence = (Array.isArray(body.confidence) ? body.confidence : []).slice(0, CONFIDENCE.length).map((x) => Math.min(5, Math.max(1, Number(x) || 0)));
      if (confidence.length !== CONFIDENCE.length || confidence.some((x) => !x)) return json({ error: 'Please answer the confidence questions.' }, 400);
      const b = body.baseline || {}, num = (v) => Math.max(0, Math.min(100000, Math.round(Number(v) || 0)));
      const baseline = which === 'pre' ? {
        enquiries: num(b.enquiries), sales: num(b.sales),
        profit_known: b.profit_known === 'yes' ? 'yes' : 'no', records: b.records === 'yes' ? 'yes' : 'no',
        ai_use: ['never', 'sometimes', 'often'].includes(b.ai_use) ? b.ai_use : 'never',
      } : undefined;
      const res = scoreTest(which, answers);
      await store.setJSON(key, { answers, score: res.score, total: res.total, confidence, baseline, at: new Date().toISOString(), cohort: p.cohort });
      return json({ done: true, which, ...res });
    }

    if (route === 'review') {
      const store = reviewStore(), cur = await store.get(p.code, { type: 'json' });
      if (method === 'GET') return json({ review: cur || null });
      if (method === 'POST') {
        if (!(await testStore().get('post-' + p.code))) return json({ error: 'Please take the post-test first — the review opens right after it.' }, 403);
        if (cur && cur.status === 'approved') return json({ error: 'Your review has already been approved. Thank you!' }, 409);
        const { review, error } = cleanReview(body);
        if (error) return json({ error }, 400);
        const rec = { ...review, code: p.code, name: p.name, first: first(p.name), business_type: p.business_type, location: p.location, cohort: p.cohort,
          status: 'pending', featured: false, at: cur?.at || new Date().toISOString(), updated: new Date().toISOString() };
        await store.setJSON(p.code, rec);
        return json({ ok: true, review: rec });
      }
    }

    if (route === 'challenge') {
      const cls = await readClass(), store = challengeStore(), ch = (await store.get(p.code, { type: 'json' })) || { days: {} };
      const today = challengeDay(cls.challenge_start);
      const lane = /start/i.test(p.participant_type || '') ? 1 : 0;
      if (method === 'GET') return json({ start: cls.challenge_start, today, lane, tasks: CHALLENGE.map((t) => t[lane]), alt: CHALLENGE.map((t) => t[1 - lane]), days: ch.days || {}, day30: ch.day30 || null, need: PRACTITIONER_DAYS });
      if (method === 'POST' && body.kind === 'day') {
        const day = Math.round(Number(body.day));
        if (!(day >= 1 && day <= 30)) return json({ error: 'Bad day' }, 400);
        if (day > today) return json({ error: `Day ${day} opens on ${new Date(new Date(cls.challenge_start + 'T00:00:00+01:00').getTime() + (day - 1) * 864e5).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.` }, 403);
        ch.days = ch.days || {};
        if (body.done === false) delete ch.days[day];
        else ch.days[day] = { at: ch.days[day]?.at || new Date().toISOString(), note: String(body.note ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, 280) };
        await store.setJSON(p.code, ch);
        return json({ ok: true, days: ch.days });
      }
      if (method === 'POST' && body.kind === 'day30') {
        if (today < 28 && daysDone(ch) < PRACTITIONER_DAYS) return json({ error: 'The Day 30 scorecard opens on day 28 of the challenge.' }, 403);
        const n = (v) => Math.max(0, Math.min(100000, Math.round(Number(v) || 0)));
        const yn = (v) => (v === 'yes' ? 'yes' : 'no');
        ch.day30 = { enquiries: n(body.enquiries), sales: n(body.sales), profit_known: yn(body.profit_known), records: yn(body.records),
          ai_use: ['never', 'sometimes', 'often'].includes(body.ai_use) ? body.ai_use : 'never', repeat_customers: n(body.repeat_customers),
          google_reviews: n(body.google_reviews), ai_score: Math.min(10, n(body.ai_score)), result: String(body.result ?? '').replace(/[\u0000-\u0009\u000b-\u001f<>]/g, ' ').trim().slice(0, 800), at: new Date().toISOString() };
        await store.setJSON(p.code, ch);
        return json({ ok: true, day30: ch.day30 });
      }
    }

    if (route === 'upgrade' && method === 'POST') {
      const cls = await readClass();
      if (cls.upgrade_open === false) return json({ error: 'The Practitioner upgrade is not open right now.' }, 403);
      const [t, rev] = await Promise.all([getTests(p.code), reviewStore().get(p.code, { type: 'json' })]);
      if (!t.post || !rev) return json({ error: 'Please finish the post-test and your review first.' }, 403);
      const store = upgradeStore(), cur = await store.get(p.code, { type: 'json' });
      if (cur && cur.status === 'confirmed') return json({ error: 'Your upgrade is already confirmed.' }, 409);
      const rec = { code: p.code, status: 'pending', sender_name: clean(body.sender_name, 90), amount: Math.round(Number(body.amount) || 0), payment_date: clean(body.payment_date, 10), payment_ref: clean(body.payment_ref, 60), receipt: false, at: new Date().toISOString() };
      if (rec.sender_name.length < 2 || rec.amount <= 0 || !rec.payment_date) return json({ error: 'Please fill in the name on the account, amount and date of your transfer.' }, 400);
      const m = /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.receipt || ''));
      if (m) {
        const bytes = Buffer.from(m[2], 'base64');
        if (bytes.length > 3 * 1024 * 1024) return json({ error: 'Receipt file is too large (max 3 MB).' }, 413);
        await fileStore().set('rcpt-' + p.code, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
        rec.receipt = m[1];
      } else if (cur?.receipt) rec.receipt = cur.receipt;
      await store.setJSON(p.code, rec);
      return json({ ok: true, status: rec.status });
    }

    if (route === 'checkin' && method === 'POST') {
      const day = body.day === 'd2' ? 'd2' : 'd1';
      const cls = await readClass();
      if (!cls[day].open || !cls[day].word) return json({ error: 'Check-in for this session is not open.' }, 403);
      const word = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (word(body.word) !== word(cls[day].word)) { await new Promise((r) => setTimeout(r, 500)); return json({ error: 'That session code is not correct. Check the screen and try again.' }, 400); }
      const store = attStore(), att = (await store.get(p.code, { type: 'json' })) || {};
      if (!att[day]) { att[day] = new Date().toISOString(); await store.setJSON(p.code, att); }
      return json({ ok: true, attendance: att });
    }

    if (route === 'material' && method === 'GET') {
      const id = clean(url.searchParams.get('id'), 40);
      const m = (await readMaterials()).find((x) => x.id === id);
      if (!m) return json({ error: 'File not found.' }, 404);
      const t = await getTests(p.code);
      if (!unlocked(m, await accessState(p, t))) return json({ error: UNLOCK_LABEL[m.unlock] || 'Locked' }, 403);
      let bytes = await fileStore().get(m.id, { type: 'arrayBuffer' });
      if (!bytes) return json({ error: 'File not found.' }, 404);
      if (m.stamp && /pdf/i.test(m.type)) bytes = await stampPdf(new Uint8Array(bytes), p);
      // log the download
      const ps = partStore(), cur = (await ps.get(p.code, { type: 'json' })) || p;
      cur.downloads = cur.downloads || {}; cur.downloads[m.id] = { n: (cur.downloads[m.id]?.n || 0) + 1, last: new Date().toISOString() };
      await ps.setJSON(p.code, cur);
      const data = new Uint8Array(bytes);
      const stream = new ReadableStream({ start(c) { for (let i = 0; i < data.length; i += 1 << 20) c.enqueue(data.subarray(i, i + (1 << 20))); c.close(); } });
      const fname = (m.filename || m.title || 'file').replace(/[^\w.\- ]/g, '_');
      return new Response(stream, { headers: { 'content-type': m.type || 'application/octet-stream', 'content-disposition': `attachment; filename="${fname}"`, 'cache-control': 'no-store' } });
    }

    return json({ error: 'Not found' }, 404);
  } catch (e) {
    return json({ error: e.message || 'Server error' }, 500);
  }
};

export const config = { path: ['/api/portal', '/api/portal/*'] };
