// Admin API (password protected): registrations, cohort settings, certificates
import { json, siteStore, certStore, readSettings, DEFAULT_SETTINGS, normNo, randCode, issueToken, validToken, passwordOk } from '../lib/common.mjs';

const API = 'https://api.netlify.com/api/v1';
const TYPES = { participation: 'Certificate of Participation', practitioner: 'Certified AI Customer Growth Practitioner' };
const clean = (v, n = 120) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

async function netlify(path, init = {}) {
  const token = process.env.NETLIFY_API_TOKEN;
  if (!token) throw Object.assign(new Error('NETLIFY_API_TOKEN is not set in Netlify environment variables.'), { status: 501 });
  const r = await fetch(API + path, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) } });
  if (!r.ok) throw Object.assign(new Error(`Netlify API ${r.status}`), { status: 502 });
  return r.status === 204 ? null : r.json();
}

async function registrations(siteId) {
  const forms = await netlify(`/sites/${siteId}/forms`);
  const form = (forms || []).find((f) => f.name === 'registration');
  if (!form) return [];
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const batch = await netlify(`/forms/${form.id}/submissions?per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out.map((s) => ({ id: s.id, created_at: s.created_at, ...(s.data || {}) }))
    .map(({ id, created_at, full_name, phone, email, business_name, business_type, location, heard_from, cohort }) =>
      ({ id, created_at, full_name, phone, email, business_name, business_type, location, heard_from, cohort }));
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
  const body = method === 'GET' || method === 'DELETE' ? {} : await req.json().catch(() => ({}));

  // login
  if (route === 'login' && method === 'POST') {
    if (!process.env.ADMIN_PASSWORD) return json({ error: 'ADMIN_PASSWORD is not set in Netlify environment variables.' }, 501);
    if (!passwordOk(body.password)) { await new Promise((r) => setTimeout(r, 1200)); return json({ error: 'Wrong password.' }, 401); }
    return json({ token: issueToken() });
  }
  if (!validToken(req)) return json({ error: 'Please log in again.' }, 401);

  try {
    const siteId = context?.site?.id || process.env.SITE_ID;

    if (route === 'registrations' && method === 'GET') return json({ items: await registrations(siteId) });
    if (route === 'registrations' && method === 'DELETE') {
      const id = clean(url.searchParams.get('id'), 40);
      if (!/^[a-f0-9]+$/i.test(id)) return json({ error: 'Bad id' }, 400);
      await netlify(`/submissions/${id}`, { method: 'DELETE' });
      return json({ ok: true });
    }

    if (route === 'settings' && method === 'GET') return json(await readSettings());
    if (route === 'settings' && method === 'PUT') {
      const s = {};
      for (const k of Object.keys(DEFAULT_SETTINGS)) s[k] = clean(body[k], k === 'cohort_note' ? 300 : 200);
      if (s.whatsapp_group && !/^https:\/\/(chat\.whatsapp\.com|wa\.me|whatsapp\.com)\//i.test(s.whatsapp_group)) return json({ error: 'WhatsApp link must start with https://chat.whatsapp.com/' }, 400);
      if (s.cohort_start && isNaN(new Date(s.cohort_start))) return json({ error: 'Invalid date' }, 400);
      await siteStore().setJSON('settings', s);
      return json(s);
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
      const store = certStore(), created = [];
      for (const it of list) {
        const name = clean(it.name, 90);
        const type = it.type === 'practitioner' ? 'practitioner' : 'participation';
        if (name.length < 2) continue;
        const issued = clean(it.issued, 10) || new Date().toISOString().slice(0, 10);
        const number = it.number ? normNo(it.number) : await nextNumber(issued.slice(0, 4));
        if (!/^[A-Z0-9-]{6,40}$/.test(number)) continue;
        const rec = { number, name, type: TYPES[type], type_key: type, cohort: clean(it.cohort, 60), issued, created_at: new Date().toISOString() };
        await store.setJSON(number, rec);
        created.push(rec);
      }
      return json({ items: created });
    }
    if (route === 'certificates' && method === 'DELETE') {
      const no = normNo(url.searchParams.get('no'));
      if (!no) return json({ error: 'Missing number' }, 400);
      await certStore().delete(no);
      return json({ ok: true });
    }
    return json({ error: 'Not found' }, 404);
  } catch (e) {
    return json({ error: e.message || 'Server error' }, e.status || 500);
  }
};

export const config = { path: ['/api/admin', '/api/admin/*'] };
