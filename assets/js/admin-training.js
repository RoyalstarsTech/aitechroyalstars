/* Admin: Training tab (class control, materials, participants, question analysis). textContent only. */
(function () {
  var R = window.RA; if (!R) return;
  var $ = function (id) { return document.getElementById(id); };
  var el = R.el, api = R.api, D = null;

  function load() {
    $('t-rows').replaceChildren(rowMsg('Loading…', 11));
    loadUpgrades();
    return api('training').then(function (d) { D = d; renderClass(); renderMats(); renderCohorts(); renderRows(); renderStats(); renderAnalysis(); })
      .catch(function (e) { $('t-rows').replaceChildren(rowMsg(e.message, 10)); });
  }
  R.onLogin = load;
  if (!$('app').hidden) load();
  document.querySelector('[data-tab=training]').addEventListener('click', function () { load(); });
  $('t-reload').onclick = load;
  function rowMsg(t, n) { var tr = el('tr'), td = el('td', t, 'empty'); td.colSpan = n; tr.appendChild(td); return tr; }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function list() {
    var q = $('t-q').value.toLowerCase().trim(), c = $('t-fc').value;
    return (D ? D.participants : []).filter(function (p) {
      if (c && p.cohort !== c) return false;
      return !q || [p.name, p.phone, p.code, p.business_type, p.location].join(' ').toLowerCase().indexOf(q) > -1;
    }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
  }

  // ---- class control ----
  function renderClass() {
    var c = D.class;
    $('t-pre').checked = !!c.pre_open; $('t-post').checked = !!c.post_open;
    $('t-d1w').value = c.d1.word || ''; $('t-d1o').checked = !!c.d1.open;
    $('t-d2w').value = c.d2.word || ''; $('t-d2o').checked = !!c.d2.open;
    $('t-auto').checked = c.auto_cert !== false; $('t-upg').checked = c.upgrade_open !== false; $('t-chs').value = c.challenge_start || '';
  }
  $('t-class').addEventListener('submit', function (e) {
    e.preventDefault();
    var body = { pre_open: $('t-pre').checked, post_open: $('t-post').checked, d1: { open: $('t-d1o').checked, word: $('t-d1w').value.trim() }, d2: { open: $('t-d2o').checked, word: $('t-d2w').value.trim() }, auto_cert: $('t-auto').checked, upgrade_open: $('t-upg').checked, challenge_start: $('t-chs').value };
    api('class', { method: 'PUT', body: body }).then(function (c) { D.class = c; R.flash('ok', 'Class control saved.'); }).catch(R.fail);
  });

  // ---- materials ----
  var UL = { pre: 'After pre-test', always: 'Straight away', post: 'After post-test', referral: 'Referral reward', practitioner: 'Practitioners only' };
  function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
  function renderMats() {
    var body = $('t-mrows');
    if (!D.materials.length) { body.replaceChildren(rowMsg('No files yet. Upload the Participant Manual and the 200 Street Prompts below.', 5)); return; }
    var dl = {}; D.participants.forEach(function (p) { Object.keys(p.files || {}).forEach(function (k) { dl[k] = (dl[k] || 0) + 1; }); });
    body.replaceChildren.apply(body, D.materials.map(function (m) {
      var tr = el('tr');
      var t = el('td'); t.appendChild(el('strong', m.title)); if (m.stamp) { t.appendChild(document.createElement('br')); t.appendChild(el('small', '🔏 Name-stamped PDF')); } tr.appendChild(t);
      var td = el('td'), sel = el('select'); Object.keys(UL).forEach(function (k) { var o = el('option', UL[k]); o.value = k; sel.appendChild(o); }); sel.value = m.unlock;
      sel.onchange = function () { api('materials', { method: 'PUT', body: { id: m.id, unlock: sel.value } }).then(function () { m.unlock = sel.value; R.flash('ok', 'Updated.'); }).catch(R.fail); };
      td.appendChild(sel); tr.appendChild(td);
      tr.appendChild(el('td', fmtSize(m.size)));
      tr.appendChild(el('td', (dl[m.id] || 0) + ((dl[m.id] || 0) === 1 ? ' person' : ' people')));
      var x = el('td'), del = el('button', 'Delete', 'sbtn danger'); del.type = 'button';
      del.onclick = function () { if (!confirm('Delete "' + m.title + '"? Participants will no longer see it.')) return; api('materials?id=' + encodeURIComponent(m.id), { method: 'DELETE' }).then(function () { R.flash('ok', 'Deleted.'); load(); }).catch(R.fail); };
      x.appendChild(del); tr.appendChild(x);
      return tr;
    }));
  }
  $('t-file').onchange = function () { var f = $('t-file').files[0]; if (f && !$('t-mtitle').value) $('t-mtitle').value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '); };
  $('t-up').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = $('t-file').files[0]; if (!f) return;
    if (f.size > 18 * 1024 * 1024) { R.flash('err', 'That file is larger than 18 MB. Please compress it first.'); return; }
    var PART = 3 * 1024 * 1024, parts = Math.max(1, Math.ceil(f.size / PART));
    var up = Array.from(crypto.getRandomValues(new Uint8Array(10))).map(function (b) { return (b % 36).toString(36); }).join('');
    var b = $('t-upbtn'), m = $('t-upmsg'); b.disabled = true;
    var i = 0;
    function next() {
      if (i >= parts) return Promise.resolve();
      m.textContent = 'Uploading ' + Math.round(i / parts * 100) + '%…';
      return fetch('/api/admin/material-part?upload=' + up + '&part=' + i, { method: 'PUT', headers: { authorization: 'Bearer ' + R.token(), 'content-type': 'application/octet-stream' }, body: f.slice(i * PART, (i + 1) * PART) })
        .then(function (r) { if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || 'Upload failed (' + r.status + ')'); }); i++; return next(); });
    }
    next().then(function () {
      m.textContent = 'Finishing…';
      return api('materials', { method: 'POST', body: { upload: up, parts: parts, title: $('t-mtitle').value.trim(), filename: f.name, type: f.type, unlock: $('t-munlock').value } });
    }).then(function (mat) { R.flash('ok', '"' + mat.title + '" uploaded' + (mat.stamp ? ' — it will be name-stamped for each participant.' : '.')); $('t-up').reset(); load(); })
      .catch(R.fail).then(function () { b.disabled = false; m.textContent = ''; });
  });

  // ---- participants ----
  function renderCohorts() {
    var fc = $('t-fc'), cur = fc.value, seen = {};
    fc.replaceChildren(el('option', 'All cohorts')); fc.firstChild.value = '';
    D.participants.forEach(function (p) { if (p.cohort && !seen[p.cohort]) { seen[p.cohort] = 1; var o = el('option', p.cohort); o.value = p.cohort; fc.appendChild(o); } });
    fc.value = cur;
  }
  $('t-q').oninput = function () { renderRows(); renderStats(); renderAnalysis(); };
  $('t-fc').onchange = $('t-q').oninput;
  function sendCode(p) {
    var n = R.intl(p.phone); if (!n) { R.flash('err', 'This phone number looks invalid.'); return; }
    var first = String(p.name || '').trim().split(/\s+/)[0];
    var text = 'Hello ' + first + ', here is your personal access code for *Grow Your Sales with AI Skills*:\n\n*' + p.code + '*\n\nOpen your training portal: ' + location.origin + '/portal/?c=' + p.code +
      '\n\nThere you will find the pre-test, your training materials and attendance check-in. Please keep your code private.\n\nRoyalstars Technologies Ltd.';
    window.open('https://wa.me/' + n + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
  }
  function renderRows() {
    var rows = list(), body = $('t-rows');
    if (!rows.length) { body.replaceChildren(rowMsg(D.participants.length ? 'No matches.' : 'No participants yet. Codes are created when you confirm payments in the Enrollments tab.', 11)); return; }
    body.replaceChildren.apply(body, rows.map(function (p) {
      var tr = el('tr'); if (!p.active) tr.style.opacity = '.55';
      var n = el('td'); n.appendChild(el('strong', p.name)); n.appendChild(document.createElement('br')); n.appendChild(el('small', [p.business_type, p.location].filter(Boolean).join(' · '))); if (!p.active) { n.appendChild(document.createElement('br')); n.appendChild(el('span', 'switched off', 'st-rejected')); } tr.appendChild(n);
      var c = el('td'); var cb = el('button', p.code, 'tagp mono'); cb.type = 'button'; cb.style.border = '0'; cb.style.cursor = 'pointer'; cb.title = 'Copy';
      cb.onclick = function () { (navigator.clipboard ? navigator.clipboard.writeText(p.code) : Promise.reject()).then(function () { R.flash('ok', 'Copied ' + p.code); }).catch(function () { window.prompt('Copy the code:', p.code); }); };
      c.appendChild(cb); tr.appendChild(c);
      var w = el('td'), num = R.intl(p.phone); if (num) { var a = el('a', p.phone); a.href = 'https://wa.me/' + num; a.target = '_blank'; a.rel = 'noopener'; w.appendChild(a); } else w.textContent = p.phone || ''; tr.appendChild(w);
      tr.appendChild(el('td', p.pre ? p.pre.score + '/' + p.pre.total : '—'));
      tr.appendChild(el('td', p.post ? p.post.score + '/' + p.post.total : '—'));
      var g = p.pre && p.post ? p.post.score - p.pre.score : null;
      tr.appendChild(el('td', g === null ? '—' : (g > 0 ? '+' : '') + g));
      ['d1', 'd2'].forEach(function (d) {
        var td = el('td'), x = el('input'); x.type = 'checkbox'; x.checked = !!p[d]; x.title = p[d] ? 'Checked in ' + R.fmtDate(p[d]) : 'Not checked in';
        x.onchange = function () { api('attendance', { method: 'POST', body: { code: p.code, day: d, present: x.checked } }).then(function (att) { p[d] = att[d] || ''; renderStats(); }).catch(function (e) { x.checked = !x.checked; R.fail(e); }); };
        td.appendChild(x); tr.appendChild(td);
      });
      tr.appendChild(el('td', String(p.downloads || 0)));
      var pg = el('td'), bits = [];
      if (p.certs && p.certs.participation) bits.push('🎓 Certificate');
      if (p.certs && p.certs.practitioner) bits.push('⭐ Practitioner');
      if (p.challenge_days) bits.push(p.challenge_days + '/30 days');
      if (p.upgrade) bits.push('Upgrade: ' + ({ pending: 'pending', confirmed: p.practitioner === 'ready' ? 'READY' : 'active', rejected: 'rejected' }[p.upgrade] || p.upgrade));
      if (p.referrals && p.referrals.confirmed) bits.push('🎁 ' + p.referrals.confirmed + ' referral' + (p.referrals.confirmed > 1 ? 's' : ''));
      bits.forEach(function (b) { pg.appendChild(el('div', b, 'pg')); }); if (!bits.length) pg.textContent = '—';
      tr.appendChild(pg);
      var ac = el('td'), acts = el('div', null, 'acts');
      var s = el('button', 'Send code', 'sbtn gold'); s.type = 'button'; s.onclick = function () { sendCode(p); }; acts.appendChild(s);
      var t = el('button', p.active ? 'Switch off' : 'Switch on', 'sbtn light'); t.type = 'button';
      t.onclick = function () { if (p.active && !confirm('Switch off ' + p.code + '? ' + p.name + ' will no longer be able to open the portal.')) return; api('participant', { method: 'POST', body: { code: p.code, active: !p.active } }).then(function () { R.flash('ok', 'Updated.'); load(); }).catch(R.fail); };
      acts.appendChild(t);
      var en = el('button', 'Edit name', 'sbtn light'); en.type = 'button';
      en.onclick = function () { var n = window.prompt('Correct the name (used on certificates):', p.name); if (!n || n.trim() === p.name) return; api('participant', { method: 'POST', body: { code: p.code, name: n.trim() } }).then(function () { R.flash('ok', 'Name updated. Certificates issued from now use the new name.'); load(); }).catch(R.fail); };
      acts.appendChild(en);
      ['pre', 'post'].forEach(function (k) {
        if (!p[k]) return;
        var r = el('button', 'Reset ' + k, 'sbtn danger'); r.type = 'button';
        r.onclick = function () { if (!confirm('Delete ' + p.name + '\'s ' + k + '-test so they can take it again? Their score will be lost.')) return; api('participant', { method: 'POST', body: { code: p.code, reset_test: k } }).then(function () { R.flash('ok', 'Reset.'); load(); }).catch(R.fail); };
        acts.appendChild(r);
      });
      ac.appendChild(acts); tr.appendChild(ac);
      return tr;
    }));
  }
  function avg(arr) { return arr.length ? arr.reduce(function (a, b) { return a + b; }, 0) / arr.length : 0; }
  function renderStats() {
    var rows = list();
    var pre = rows.filter(function (p) { return p.pre; }), post = rows.filter(function (p) { return p.post; }), both = rows.filter(function (p) { return p.pre && p.post; });
    var s = [
      [rows.length, 'Participants'],
      [pre.length ? pct(avg(pre.map(function (p) { return p.pre.score / p.pre.total; })), 1) + '%' : '—', 'Pre-test average (' + pre.length + ' done)'],
      [post.length ? pct(avg(post.map(function (p) { return p.post.score / p.post.total; })), 1) + '%' : '—', 'Post-test average (' + post.length + ' done)'],
      [both.length ? '+' + (avg(both.map(function (p) { return (p.post.score - p.pre.score) / p.post.total; })) * 100).toFixed(0) + ' pts' : '—', 'Average improvement'],
      [rows.filter(function (p) { return p.d1; }).length + ' / ' + rows.filter(function (p) { return p.d2; }).length, 'Attended Day 1 / Day 2'],
    ];
    var st = $('t-stats'); st.replaceChildren.apply(st, s.map(function (x) { var d = el('div', null, 'stat'); d.appendChild(el('b', String(x[0]))); d.appendChild(el('span', x[1])); return d; }));
  }
  function renderAnalysis() {
    var rows = list(), box = $('t-analysis'), T = D.topics, K = D.answer_key;
    var pre = rows.filter(function (p) { return p.pre && p.pre.answers; }), post = rows.filter(function (p) { return p.post && p.post.answers; });
    if (!pre.length && !post.length) { box.replaceChildren(el('p', 'Results appear here once participants take the tests.', 'sub')); return; }
    var lg = el('div', null, 'legend'); lg.appendChild(el('span', 'Before (pre-test, ' + pre.length + ')')); lg.appendChild(el('span', 'After (post-test, ' + post.length + ')'));
    var out = [lg];
    T.forEach(function (topic, i) {
      var a = pre.length ? pct(pre.filter(function (p) { return p.pre.answers[i] === K.pre[i]; }).length, pre.length) : null;
      var b = post.length ? pct(post.filter(function (p) { return p.post.answers[i] === K.post[i]; }).length, post.length) : null;
      var row = el('div', null, 'bar'); row.appendChild(el('b', (i + 1) + '. ' + topic));
      var tr = el('div', null, 'tr');
      [[a, 'b1'], [b, 'b2']].forEach(function (x) { var w = el('div', null, x[1]); w.style.display = 'grid'; w.style.gridTemplateColumns = '1fr 44px'; w.style.gap = '8px'; w.style.alignItems = 'center'; var bar = el('i'); bar.style.width = (x[0] || 0) + '%'; var holder = el('div'); holder.appendChild(bar); w.appendChild(holder); w.appendChild(el('small', x[0] === null ? '—' : x[0] + '%')); tr.appendChild(w); });
      row.appendChild(tr); out.push(row);
    });
    box.replaceChildren.apply(box, out);
  }
  // ---- practitioner upgrades ----
  function loadUpgrades() {
    api('upgrades').then(function (d) { renderUpgrades(d.items || [], d.need); }).catch(function (e) { $('t-urows').replaceChildren(rowMsg(e.message, 7)); });
  }
  function viewReceipt(u) {
    fetch('/api/admin/upgrade-receipt?code=' + encodeURIComponent(u.code), { headers: { authorization: 'Bearer ' + R.token() } })
      .then(function (r) { if (!r.ok) throw new Error('No receipt uploaded.'); return r.blob(); })
      .then(function (b) { var w = window.open(URL.createObjectURL(b), '_blank'); if (!w) R.flash('err', 'Allow pop-ups to view the receipt.'); }).catch(R.fail);
  }
  function renderUpgrades(items, need) {
    var body = $('t-urows');
    if (!items.length) { body.replaceChildren(rowMsg('No upgrade requests yet. The offer appears in the portal after a participant finishes the post-test and review.', 7)); return; }
    body.replaceChildren.apply(body, items.map(function (u) {
      var tr = el('tr');
      var n = el('td'); n.appendChild(el('strong', u.name)); n.appendChild(document.createElement('br')); n.appendChild(el('small', u.phone)); tr.appendChild(n);
      var st = el('td'); st.appendChild(el('span', u.status, 'st-' + u.status)); if (u.practitioner === 'ready') { st.appendChild(document.createElement('br')); st.appendChild(el('span', 'READY', 'tagb')); } if (u.certs && u.certs.practitioner) { st.appendChild(document.createElement('br')); st.appendChild(el('small', '⭐ ' + u.certs.practitioner)); } tr.appendChild(st);
      var pd = el('td'); pd.appendChild(el('div', u.sender_name)); pd.appendChild(el('small', '₦' + (Number(u.amount) || 0).toLocaleString('en-NG') + ' · ' + u.payment_date + (u.payment_ref ? ' · ref ' + u.payment_ref : ''))); tr.appendChild(pd);
      var rc = el('td'); if (u.receipt) { var v = el('button', 'View', 'sbtn light'); v.type = 'button'; v.onclick = function () { viewReceipt(u); }; rc.appendChild(v); } else rc.appendChild(el('small', 'none')); tr.appendChild(rc);
      var chl = el('td'); chl.appendChild(el('div', u.days + '/30 days')); chl.appendChild(el('small', u.notes + ' with notes · need ' + need)); if (u.day30) { chl.appendChild(document.createElement('br')); chl.appendChild(el('small', '✓ Day 30 scorecard')); } tr.appendChild(chl);
      var cmp = el('td'), b0 = u.baseline || {}, b1 = u.day30;
      if (b1) { cmp.appendChild(el('div', 'Enquiries/wk: ' + (b0.enquiries ?? '?') + ' → ' + b1.enquiries)); cmp.appendChild(el('div', 'Sales/wk: ' + (b0.sales ?? '?') + ' → ' + b1.sales)); if (b1.result) cmp.appendChild(el('small', '“' + b1.result + '”')); }
      else cmp.textContent = '—';
      tr.appendChild(cmp);
      var ac = el('td'), acts = el('div', null, 'acts');
      function b(t, cls, fn) { var x = el('button', t, 'sbtn ' + cls); x.type = 'button'; x.onclick = fn; acts.appendChild(x); }
      if (u.status !== 'confirmed') b('Confirm payment', '', function () { if (confirm('Have you seen ₦' + u.amount + ' from "' + u.sender_name + '" in your bank app?')) api('upgrades', { method: 'POST', body: { code: u.code, status: 'confirmed' } }).then(function () { R.flash('ok', 'Upgrade confirmed for ' + u.name + '.'); load(); }).catch(R.fail); });
      if (u.status === 'pending') b('Reject', 'light', function () { if (confirm('Mark this payment as not received?')) api('upgrades', { method: 'POST', body: { code: u.code, status: 'rejected' } }).then(function () { load(); }).catch(R.fail); });
      if (u.status === 'confirmed' && !(u.certs && u.certs.practitioner)) b(u.practitioner === 'ready' ? 'Issue Practitioner certificate' : 'Issue anyway', u.practitioner === 'ready' ? 'gold' : 'light', function () {
        var force = u.practitioner !== 'ready';
        if (!confirm(force ? u.name + ' has not met all requirements yet. Issue the Practitioner certificate anyway?' : 'Issue the Practitioner certificate to ' + u.name + '?')) return;
        api('practitioner', { method: 'POST', body: { code: u.code, force: force } }).then(function (c) { R.flash('ok', 'Issued ' + c.number + '. It is now in ' + u.name + '\'s portal.'); load(); R.loadCerts && R.loadCerts(); }).catch(R.fail);
      });
      var num = R.intl(u.phone); if (num) b('WhatsApp', 'light', function () { window.open('https://wa.me/' + num, '_blank', 'noopener'); });
      ac.appendChild(acts); tr.appendChild(ac);
      return tr;
    }));
  }

  $('t-csv').onclick = function () {
    var head = ['Name', 'WhatsApp', 'Access code', 'Cohort', 'Business/idea', 'City', 'Pre score', 'Post score', 'Gain', 'Pre confidence (msg/close/records)', 'Post confidence', 'Enquiries/week', 'Sales/week', 'Knows profit', 'Writes every sale', 'Uses AI', 'Day 1', 'Day 2', 'Downloads', 'Active'];
    R.csv([head].concat(list().map(function (p) {
      var b = (p.pre && p.pre.baseline) || {};
      return [p.name, p.phone, p.code, p.cohort, p.business_type, p.location, p.pre ? p.pre.score : '', p.post ? p.post.score : '', p.pre && p.post ? p.post.score - p.pre.score : '',
        p.pre ? (p.pre.confidence || []).join('/') : '', p.post ? (p.post.confidence || []).join('/') : '', b.enquiries, b.sales, b.profit_known, b.records, b.ai_use,
        p.d1 ? R.fmtDate(p.d1) : '', p.d2 ? R.fmtDate(p.d2) : '', p.downloads, p.active ? 'Yes' : 'No'];
    })), 'training-results.csv');
  };
})();
