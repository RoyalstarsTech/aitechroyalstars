// Admin API (password protected): registrations, cohort settings, certificates
import { json, siteStore, certStore, paymentStore, saveStats, recountStats, readSettings, DEFAULT_SETTINGS, normNo, randCode, issueToken, validToken, passwordOk } from '../lib/common.mjs';

import { ensureParticipant, listParticipants, partStore, testStore, attStore, fileStore, readClass, readMaterials, saveMaterials, getTests, normCode, TOPICS, SETS, reviewStore,
  challengeStore, upgradeStore, issueCert, daysDone, daysWithNotes, practitionerState, refId, UNLOCKS, PRACTITIONER_DAYS, getParticipant } from '../lib/training.mjs';
import crypto from 'node:crypto';

const API = 'https://api.netlify.com/api/v1';
const MAX_FILE = 18 * 1024 * 1024;
const TYPES = { participation: 'Certificate of Participation', practitioner: 'Certified AI Customer Growth Practitioner' };
const clean = (v, n = 120) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

async function netlify(path, init = {}) {
  const token = process.env.NETLIFY_API_TOKEN;
  if (!token) throw Object.assign(new Error('NETLIFY_API_TOKEN is not set in Netlify environment variables.'), { status: 501 });
  const r = await fetch(API + path, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) } });
  if (!r.ok) throw Object.assign(new Error(`Netlify API ${r.status}`), { status: 502 });
  return r.status === 204 ? null : r.json();
}

const FIELDS = ['full_name', 'phone', 'email', 'participant_type', 'business_name', 'business_type', 'location', 'heard_from', 'cohort',
  'sender_name', 'amount_paid', 'payment_date', 'payment_ref', 'announce_ok', 'referred_by'];
const fileUrl = (v) => (v && typeof v === 'object' ? v.url : (typeof v === 'string' && /^https?:\/\//.test(v) ? v : '')) || '';
async function registrations(siteId, formName) {
  const forms = await netlify(`/sites/${siteId}/forms`);
  const form = (forms || []).find((f) => f.name === formName);
  if (!form) return [];
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const batch = await netlify(`/forms/${form.id}/submissions?per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  const pay = paymentStore();
  return Promise.all(out.map(async (s) => {
    const d = s.data || {};
    const row = { id: s.id, created_at: s.created_at };
    for (const f of FIELDS) row[f] = typeof d[f] === 'string' ? d[f] : (d[f] == null ? '' : String(d[f]));
    row.proof_url = fileUrl(d.proof);
    const st = formName === 'enrollment' ? await pay.get(s.id, { type: 'json' }) : null;
    row.payment_status = st?.status || 'pending';
    row.payment_updated = st?.at || '';
    return row;
  }));
}

async function publishReviews() {
  const st = reviewStore(), { blobs } = await st.list();
  const all = (await Promise.all(blobs.map((b) => st.get(b.key, { type: 'json' })))).filter(Boolean);
  const pub = all.filter((r) => r.status === 'approved' && r.publish_ok && r.testimonial)
    .map((r) => ({ id: crypto.createHash('sha256').update('rv:' + r.code).digest('hex').slice(0, 10), first: r.first, business_type: r.business_type || '', location: r.location || '', cohort: r.cohort || '', overall: r.overall, testimonial: r.testimonial, featured: !!r.featured, at: r.at }))
    .sort((a, b) => (b.featured - a.featured) || String(b.at).localeCompare(String(a.at)));
  const rated = all.filter((r) => r.overall);
  const avg = rated.length ? Math.round((rated.reduce((a, r) => a + r.overall, 0) / rated.length) * 10) / 10 : 0;
  const rec = all.filter((r) => r.nps >= 0), promoters = rec.filter((r) => r.nps >= 9).length;
  await siteStore().setJSON('public-reviews', { items: pub, average: avg, ratings: rated.length, recommend_pct: rec.length ? Math.round(rec.filter((r) => r.nps >= 7).length / rec.length * 100) : 0, promoters, at: new Date().toISOString() });
}

async function nextNumber(year) {
  const s = siteStore();
  const key = `cert-seq-${year}`;
  const cur = Number((await s.get(key)) || 0) + 1;
  await s.set(key, String(cur));
  return `RST-AICG-${year}-${String(cur).padStart(3, '0')}-${randCode()}`;
}

export default async (req, context) => {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api\/admin\/?/, '');
  const method = req.method;
  const body = method === 'GET' || method === 'DELETE' || route === 'material-part' ? {} : await req.json().catch(() => ({}));

  // login
  if (route === 'login' && method === 'POST') {
    if (!process.env.ADMIN_PASSWORD) return json({ error: 'ADMIN_PASSWORD is not set in Netlify environment variables.' }, 501);
    if (!passwordOk(body.password)) { await new Promise((r) => setTimeout(r, 1200)); return json({ error: 'Wrong password.' }, 401); }
    return json({ token: issueToken() });
  }
  if (!validToken(req)) return json({ error: 'Please log in again.' }, 401);

  try {
    const siteId = context?.site?.id || process.env.SITE_ID;

    if (route === 'registrations' && method === 'GET') {
      const formName = url.searchParams.get('form') === 'registration' ? 'registration' : 'enrollment';
      const items = await registrations(siteId, formName);
      if (formName === 'enrollment') {
        // every confirmed participant gets a personal portal access code
        for (const r of items) if (r.payment_status === 'confirmed') r.access_code = await ensureParticipant({ enrollment_id: r.id, ...r }).catch(() => '');
        // referrals: link ?ref= codes to the participant who shared them
        const ps = partStore(), refs = {}, names = {};
        for (const r of items) {
          const rid = String(r.referred_by || '').toUpperCase().replace(/[^A-F0-9]/g, '').slice(0, 6);
          if (rid.length !== 6) continue;
          const owner = await ps.get('ref-' + rid);
          if (!owner || owner === r.access_code) continue;
          if (!names[owner]) names[owner] = (await ps.get(owner, { type: 'json' }))?.name || owner;
          r.referrer = names[owner];
          refs[owner] = refs[owner] || { confirmed: 0, pending: 0 };
          if (r.payment_status === 'confirmed') refs[owner].confirmed++; else if (r.payment_status === 'pending') refs[owner].pending++;
        }
        await siteStore().setJSON('refstats', refs).catch(() => {});
        // keep the public "participants confirmed" counter in step with the real list
        const byCohort = {};
        for (const r of items) if (r.payment_status === 'confirmed') { const k = r.cohort || ''; byCohort[k] = (byCohort[k] || 0) + 1; }
        await saveStats(byCohort).catch(() => {});
      }
      return json({ items });
    }
    if (route === 'payments' && method === 'POST') {
      const id = clean(body.id, 40);
      const status = ['pending', 'confirmed', 'rejected'].includes(body.status) ? body.status : null;
      if (!/^[a-f0-9]+$/i.test(id) || !status) return json({ error: 'Bad request' }, 400);
      const rec = { status, at: new Date().toISOString(), cohort: clean(body.cohort, 120) };
      await paymentStore().setJSON(id, rec);
      await recountStats().catch(() => {});
      if (status === 'confirmed' && body.person) {
        const q = body.person;
        rec.access_code = await ensureParticipant({ enrollment_id: id, full_name: q.full_name, phone: q.phone, cohort: body.cohort, participant_type: q.participant_type, business_type: q.business_type, location: q.location });
      }
      return json(rec);
    }
    if (route === 'registrations' && method === 'DELETE') {
      const id = clean(url.searchParams.get('id'), 40);
      if (!/^[a-f0-9]+$/i.test(id)) return json({ error: 'Bad id' }, 400);
      await netlify(`/submissions/${id}`, { method: 'DELETE' });
      await paymentStore().delete(id).catch(() => {});
      await recountStats().catch(() => {});
      return json({ ok: true });
    }

    if (route === 'settings' && method === 'GET') {
      const priv = (await siteStore().get('private', { type: 'json' })) || {};
      return json({ ...(await readSettings()), join_link: priv.join_link || '', join_message: priv.join_message || '' });
    }
    if (route === 'settings' && method === 'PUT') {
      const s = {};
      for (const k of Object.keys(DEFAULT_SETTINGS)) s[k] = clean(body[k], k === 'cohort_note' ? 300 : 200);
      if (s.whatsapp_group && !/^https:\/\/(chat\.whatsapp\.com|wa\.me|whatsapp\.com)\//i.test(s.whatsapp_group)) return json({ error: 'WhatsApp link must start with https://chat.whatsapp.com/' }, 400);
      if (s.cohort_start && isNaN(new Date(s.cohort_start))) return json({ error: 'Invalid date' }, 400);
      const priv = { join_link: clean(body.join_link, 300), join_message: String(body.join_message ?? '').replace(/\r/g, '').replace(/[\u0000-\u0009\u000b-\u001f<>]/g, '').trim().slice(0, 800) };
      if (priv.join_link && !/^https:\/\//i.test(priv.join_link)) return json({ error: 'Class link must start with https://' }, 400);
      await siteStore().setJSON('settings', s);
      await siteStore().setJSON('private', priv);
      return json({ ...s, ...priv });
    }

    if (route === 'certificates' && method === 'GET') {
      const store = certStore();
      const { blobs } = await store.list();
      const items = (await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })))).filter(Boolean);
      items.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return json({ items });
    }
    if (route === 'certificates' && method === 'POST') {
      const list = Array.isArray(body.items) ? body.items : [body];
      if (list.length > 500) return json({ error: 'Max 500 at a time.' }, 400);
      const created = [];
      for (const it of list) {
        const code = normCode(it.code);
        const name = clean(it.name, 90);
        if (name.length < 2 && !code) continue;
        const issued = /^\d{4}-\d{2}-\d{2}$/.test(it.issued || '') ? it.issued : '';
        created.push(await issueCert({ name, type: it.type, cohort: clean(it.cohort, 60), issued, code }));
      }
      return json({ items: created });
    }
    if (route === 'certificates-eligible' && method === 'POST') {
      const people = await listParticipants(), created = [], cohort = clean(body.cohort, 120);
      for (const p of people) {
        if (p.active === false || p.certs?.participation || (cohort && p.cohort !== cohort)) continue;
        const [t, att] = await Promise.all([getTests(p.code), attStore().get(p.code, { type: 'json' })]);
        if (att?.d1 && att?.d2 && t.post) created.push(await issueCert({ code: p.code, type: 'participation' }));
      }
      return json({ items: created });
    }
    if (route === 'certificates' && method === 'DELETE') {
      const no = normNo(url.searchParams.get('no'));
      if (!no) return json({ error: 'Missing number' }, 400);
      const c = await certStore().get(no, { type: 'json' });
      await certStore().delete(no);
      if (c?.code) { const ps = partStore(), p = await ps.get(c.code, { type: 'json' }); if (p?.certs?.[c.type_key] === no) { delete p.certs[c.type_key]; await ps.setJSON(p.code, p); } }
      return json({ ok: true });
    }
    // ---------- training ----------
    if (route === 'training' && method === 'GET') {
      const [cls, mats, people, refs] = await Promise.all([readClass(), readMaterials(), listParticipants(), siteStore().get('refstats', { type: 'json' }).then((x) => x || {})]);
      const rows = await Promise.all(people.map(async (p) => {
        const [t, att, ch, up] = await Promise.all([getTests(p.code), attStore().get(p.code, { type: 'json' }), challengeStore().get(p.code, { type: 'json' }), upgradeStore().get(p.code, { type: 'json' })]);
        const dl = Object.values(p.downloads || {}).reduce((a, d) => a + (d.n || 0), 0);
        return {
          code: p.code, name: p.name, phone: p.phone, cohort: p.cohort, active: p.active !== false, created_at: p.created_at,
          participant_type: p.participant_type, business_type: p.business_type, location: p.location,
          pre: t.pre ? { score: t.pre.score, total: t.pre.total, at: t.pre.at, answers: t.pre.answers, confidence: t.pre.confidence, baseline: t.pre.baseline } : null,
          post: t.post ? { score: t.post.score, total: t.post.total, at: t.post.at, answers: t.post.answers, confidence: t.post.confidence } : null,
          d1: att?.d1 || '', d2: att?.d2 || '', downloads: dl, files: p.downloads || {},
          certs: p.certs || {}, challenge_days: daysDone(ch), challenge_notes: daysWithNotes(ch), day30: ch?.day30 || null,
          upgrade: up?.status || '', practitioner: practitionerState(up, ch), referrals: refs[p.code] || { confirmed: 0, pending: 0 }, ref: refId(p.code),
        };
      }));
      const key = SETS.pre.map((x) => x.a), keyPost = SETS.post.map((x) => x.a);
      return json({ class: cls, materials: mats, participants: rows, topics: TOPICS, answer_key: { pre: key, post: keyPost } });
    }
    if (route === 'reviews' && method === 'GET') {
      const st = reviewStore(), { blobs } = await st.list();
      const items = (await Promise.all(blobs.map((b) => st.get(b.key, { type: 'json' })))).filter(Boolean);
      items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
      return json({ items });
    }
    if (route === 'reviews' && method === 'POST') {
      const code = normCode(body.code), st = reviewStore();
      const r = code && (await st.get(code, { type: 'json' }));
      if (!r) return json({ error: 'Not found' }, 404);
      if (['pending', 'approved', 'hidden'].includes(body.status)) {
        if (body.status === 'approved' && !r.publish_ok) return json({ error: 'This participant did not give permission to publish.' }, 400);
        r.status = body.status;
      }
      if (typeof body.featured === 'boolean') r.featured = body.featured && r.status === 'approved';
      if (r.status !== 'approved') r.featured = false;
      r.moderated_at = new Date().toISOString();
      await st.setJSON(code, r);
      await publishReviews();
      return json(r);
    }
    if (route === 'upgrades' && method === 'GET') {
      const st = upgradeStore(), { blobs } = await st.list();
      const items = await Promise.all(blobs.map(async (b) => {
        const u = await st.get(b.key, { type: 'json' }); if (!u) return null;
        const [p, ch, t] = await Promise.all([partStore().get(u.code, { type: 'json' }), challengeStore().get(u.code, { type: 'json' }), getTests(u.code)]);
        return { ...u, name: p?.name || '', phone: p?.phone || '', cohort: p?.cohort || '', business_type: p?.business_type || '', certs: p?.certs || {},
          days: daysDone(ch), notes: daysWithNotes(ch), day_list: ch?.days || {}, day30: ch?.day30 || null, baseline: t.pre?.baseline || null, practitioner: practitionerState(u, ch) };
      }));
      return json({ items: items.filter(Boolean).sort((a, b) => String(b.at).localeCompare(String(a.at))), need: PRACTITIONER_DAYS });
    }
    if (route === 'upgrades' && method === 'POST') {
      const code = normCode(body.code), st = upgradeStore(), u = code && (await st.get(code, { type: 'json' }));
      if (!u) return json({ error: 'Not found' }, 404);
      if (!['pending', 'confirmed', 'rejected'].includes(body.status)) return json({ error: 'Bad status' }, 400);
      u.status = body.status; u.status_at = new Date().toISOString();
      await st.setJSON(code, u);
      return json(u);
    }
    if (route === 'upgrade-receipt' && method === 'GET') {
      const code = normCode(url.searchParams.get('code'));
      const u = code && (await upgradeStore().get(code, { type: 'json' }));
      const buf = u?.receipt && (await fileStore().get('rcpt-' + code, { type: 'arrayBuffer' }));
      if (!buf) return json({ error: 'No receipt' }, 404);
      return new Response(buf, { headers: { 'content-type': u.receipt, 'cache-control': 'no-store' } });
    }
    if (route === 'practitioner' && method === 'POST') {
      const code = normCode(body.code), p = await getParticipant(code);
      if (!p) return json({ error: 'Not found' }, 404);
      const [u, ch] = await Promise.all([upgradeStore().get(p.code, { type: 'json' }), challengeStore().get(p.code, { type: 'json' })]);
      if (!body.force && practitionerState(u, ch) !== 'ready') return json({ error: 'Not yet eligible: needs a confirmed upgrade, ' + PRACTITIONER_DAYS + ' challenge days with notes and the Day 30 scorecard.' }, 400);
      return json(await issueCert({ code: p.code, type: 'practitioner' }));
    }
    if (route === 'report' && method === 'GET') {
      const cohort = clean(url.searchParams.get('cohort'), 120);
      const inC = (c) => !cohort || c === cohort;
      const regs = (await registrations(siteId, 'enrollment').catch(() => [])).filter((r) => inC(r.cohort));
      const people = (await listParticipants()).filter((p) => inC(p.cohort));
      const rows = await Promise.all(people.map(async (p) => {
        const [t, att, ch, up, rv] = await Promise.all([getTests(p.code), attStore().get(p.code, { type: 'json' }), challengeStore().get(p.code, { type: 'json' }), upgradeStore().get(p.code, { type: 'json' }), reviewStore().get(p.code, { type: 'json' })]);
        return { p, t, att, ch, up, rv };
      }));
      const certs = (await certStore().list()).blobs.length ? await Promise.all((await certStore().list()).blobs.map((b) => certStore().get(b.key, { type: 'json' }))) : [];
      const refs = (await siteStore().get('refstats', { type: 'json' })) || {};
      return json({
        cohort, generated: new Date().toISOString(), topics: TOPICS, key: { pre: SETS.pre.map((x) => x.a), post: SETS.post.map((x) => x.a) },
        enrol: { submitted: regs.length, confirmed: regs.filter((r) => r.payment_status === 'confirmed').length, pending: regs.filter((r) => r.payment_status === 'pending').length,
          revenue: regs.filter((r) => r.payment_status === 'confirmed').reduce((a, r) => a + (Number(r.amount_paid) || 0), 0),
          types: regs.reduce((a, r) => { const k = r.participant_type || 'Not stated'; a[k] = (a[k] || 0) + 1; return a; }, {}),
          sources: regs.reduce((a, r) => { const k = r.heard_from || 'Not stated'; a[k] = (a[k] || 0) + 1; return a; }, {}) },
        people: rows.map(({ p, t, att, ch, up, rv }) => ({
          name: p.name, active: p.active !== false, type: p.participant_type || '',
          pre: t.pre ? { score: t.pre.score, total: t.pre.total, answers: t.pre.answers, confidence: t.pre.confidence, baseline: t.pre.baseline } : null,
          post: t.post ? { score: t.post.score, total: t.post.total, answers: t.post.answers, confidence: t.post.confidence } : null,
          d1: !!att?.d1, d2: !!att?.d2, days: daysDone(ch), day30: ch?.day30 || null, upgrade: up?.status || '', upgrade_amount: up?.status === 'confirmed' ? up.amount || 0 : 0,
          review: rv ? { overall: rv.overall, ratings: rv.ratings, nps: rv.nps, gain: rv.gain, gaps: rv.gaps, suggestions: rv.suggestions } : null,
          certs: p.certs || {}, referrals: refs[p.code]?.confirmed || 0,
        })),
        certificates: certs.filter((c) => c && inC(c.cohort)).reduce((a, c) => { a[c.type_key || 'participation'] = (a[c.type_key || 'participation'] || 0) + 1; return a; }, {}),
      });
    }
    if (route === 'class' && method === 'PUT') {
      const w = (v) => clean(v, 30);
      const c = { pre_open: !!body.pre_open, post_open: !!body.post_open, d1: { open: !!body.d1?.open, word: w(body.d1?.word) }, d2: { open: !!body.d2?.open, word: w(body.d2?.word) },
        auto_cert: body.auto_cert !== false, upgrade_open: body.upgrade_open !== false, challenge_start: /^\d{4}-\d{2}-\d{2}$/.test(body.challenge_start || '') ? body.challenge_start : (await readClass()).challenge_start };
      if ((c.d1.open && !c.d1.word) || (c.d2.open && !c.d2.word)) return json({ error: 'Type a session code before opening check-in.' }, 400);
      await siteStore().setJSON('class', c);
      return json(c);
    }
    if (route === 'attendance' && method === 'POST') {
      const code = normCode(body.code), day = body.day === 'd2' ? 'd2' : 'd1';
      if (!code) return json({ error: 'Bad code' }, 400);
      const st = attStore(), att = (await st.get(code, { type: 'json' })) || {};
      if (body.present) att[day] = att[day] || new Date().toISOString(); else delete att[day];
      await st.setJSON(code, att);
      return json(att);
    }
    if (route === 'participant' && method === 'POST') {
      const code = normCode(body.code), ps = partStore();
      const p = code && (await ps.get(code, { type: 'json' }));
      if (!p) return json({ error: 'Not found' }, 404);
      if (typeof body.active === 'boolean') p.active = body.active;
      if (typeof body.name === 'string' && clean(body.name, 90).length >= 2) p.name = clean(body.name, 90);
      if (body.reset_test === 'pre' || body.reset_test === 'post') await testStore().delete(`${body.reset_test}-${code}`);
      await ps.setJSON(code, p);
      return json({ ok: true, active: p.active });
    }
    if (route === 'material-part' && method === 'PUT') {
      const up = clean(url.searchParams.get('upload'), 40), part = Number(url.searchParams.get('part'));
      if (!/^[a-z0-9]{8,40}$/.test(up) || !Number.isInteger(part) || part < 0 || part > 40) return json({ error: 'Bad upload' }, 400);
      const buf = await req.arrayBuffer();
      if (buf.byteLength > 4.5 * 1024 * 1024) return json({ error: 'Part too large' }, 413);
      await fileStore().set(`up-${up}-${part}`, buf);
      return json({ ok: true });
    }
    if (route === 'materials' && method === 'POST') {
      const up = clean(body.upload, 40), parts = Number(body.parts);
      if (!/^[a-z0-9]{8,40}$/.test(up) || !Number.isInteger(parts) || parts < 1 || parts > 40) return json({ error: 'Bad upload' }, 400);
      const fs = fileStore(), chunks = [];
      for (let i = 0; i < parts; i++) {
        const c = await fs.get(`up-${up}-${i}`, { type: 'arrayBuffer' });
        if (!c) return json({ error: 'Upload incomplete — please try again.' }, 400);
        chunks.push(new Uint8Array(c));
      }
      const size = chunks.reduce((a, c) => a + c.length, 0);
      if (size > MAX_FILE) return json({ error: 'File is larger than 18 MB.' }, 413);
      const all = new Uint8Array(size); let off = 0; for (const c of chunks) { all.set(c, off); off += c.length; }
      const type = clean(body.type, 100) || 'application/octet-stream';
      const isPdf = /pdf/i.test(type) || (all[0] === 0x25 && all[1] === 0x50 && all[2] === 0x44 && all[3] === 0x46);
      const id = crypto.randomBytes(6).toString('hex');
      await fs.set(id, all.buffer);
      for (let i = 0; i < parts; i++) await fs.delete(`up-${up}-${i}`).catch(() => {});
      const m = {
        id, title: clean(body.title, 90) || clean(body.filename, 90), filename: clean(body.filename, 120), type: isPdf ? 'application/pdf' : type, size,
        unlock: UNLOCKS.includes(body.unlock) ? body.unlock : 'pre', stamp: isPdf && body.stamp !== false, created_at: new Date().toISOString(),
      };
      const list = await readMaterials(); list.push(m); await saveMaterials(list);
      return json(m);
    }
    if (route === 'materials' && method === 'PUT') {
      const list = await readMaterials(), m = list.find((x) => x.id === body.id);
      if (!m) return json({ error: 'Not found' }, 404);
      if (body.title) m.title = clean(body.title, 90);
      if (UNLOCKS.includes(body.unlock)) m.unlock = body.unlock;
      if (Array.isArray(body.order)) list.sort((a, b) => body.order.indexOf(a.id) - body.order.indexOf(b.id));
      await saveMaterials(list);
      return json(m);
    }
    if (route === 'materials' && method === 'DELETE') {
      const id = clean(url.searchParams.get('id'), 40);
      const list = await readMaterials();
      await saveMaterials(list.filter((x) => x.id !== id));
      await fileStore().delete(id).catch(() => {});
      return json({ ok: true });
    }

    return json({ error: 'Not found' }, 404);
  } catch (e) {
    return json({ error: e.message || 'Server error' }, e.status || 500);
  }
};

export const config = { path: ['/api/admin', '/api/admin/*'] };
