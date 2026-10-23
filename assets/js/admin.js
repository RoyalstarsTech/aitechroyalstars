/* Admin dashboard. All visitor-supplied data is inserted with textContent (never innerHTML). */
(function () {
  var TK = 'rst_admin_token';
  var token = sessionStorage.getItem(TK) || '';
  var $ = function (id) { return document.getElementById(id); };
  var regs = [], certs = [], selected = new Set();

  function api(path, opts) {
    opts = opts || {};
    return fetch('/api/admin/' + path, {
      method: opts.method || 'GET',
      headers: Object.assign({ 'content-type': 'application/json' }, token ? { authorization: 'Bearer ' + token } : {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 401 && path !== 'login') { logout(); throw new Error('Session expired — please log in again.'); }
        if (!r.ok) throw new Error(d.error || ('Error ' + r.status));
        return d;
      });
    });
  }
  function flash(el, text) { var b = $(el); b.textContent = text; b.style.display = 'block'; clearTimeout(b._t); b._t = setTimeout(function () { b.style.display = 'none'; }, 6000); }
  var fail = function (e) { flash('err', e.message); };
  function el(tag, text, cls) { var n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; }
  function fmtDate(s) { if (!s) return ''; var d = new Date(s); return isNaN(d) ? s : d.toLocaleString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }); }
  function csv(rows, name) {
    var esc = function (v) { v = String(v == null ? '' : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
    var text = rows.map(function (r) { return r.map(esc).join(','); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv' })); a.download = name; a.click();
  }

  // ---- auth ----
  function showApp() { $('login').hidden = true; $('app').hidden = false; $('logout').hidden = false; loadRegs(); loadSettings(); loadCerts(); }
  function logout() { token = ''; sessionStorage.removeItem(TK); $('app').hidden = true; $('logout').hidden = true; $('login').hidden = false; }
  $('login').addEventListener('submit', function (e) {
    e.preventDefault(); $('login-err').style.display = 'none';
    api('login', { method: 'POST', body: { password: $('pw').value } }).then(function (d) { token = d.token; sessionStorage.setItem(TK, token); $('pw').value = ''; showApp(); })
      .catch(function (err) { $('login-err').textContent = err.message; $('login-err').style.display = 'block'; });
  });
  $('logout').onclick = logout;
  if (token) showApp();

  // ---- tabs ----
  document.querySelectorAll('[data-tab]').forEach(function (b) {
    b.onclick = function () {
      document.querySelectorAll('[data-tab]').forEach(function (x) { x.setAttribute('aria-selected', x === b); });
      document.querySelectorAll('[data-panel]').forEach(function (p) { p.hidden = p.dataset.panel !== b.dataset.tab; });
    };
  });

  // ---- enrollments ----
  var src = 'enrollment', joinLink = '', joinMsg = '';
  var DEFAULT_MSG = 'Hello {name}, your payment for Grow Your Sales with AI Skills has been confirmed. Welcome to Cohort 1! 🎉\n\nClass link: {link}\n\nClasses hold Tuesday 27 and Wednesday 28 October 2026, 5:00–8:00 PM (WAT). Please join 10 minutes early with your phone charged and an AI app ready (Meta AI, ChatGPT or Gemini).\n\nRoyalstars Technologies Ltd.';
  function loadRegs() {
    $('rows').replaceChildren(rowMsg('Loading…', 10));
    api('registrations?form=' + src).then(function (d) {
      regs = (d.items || []).sort(function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)); });
      var count = {}, conf = {};
      regs.forEach(function (r) {
        var k = r.cohort || '(no cohort)'; count[k] = (count[k] || 0) + 1;
        if (src === 'enrollment') { if (r.payment_status === 'confirmed') { conf[k] = (conf[k] || 0) + 1; r._early = conf[k] <= 15; } }
        else r._early = count[k] <= 15;
      });
      var fc = $('fc'), cur = fc.value; fc.replaceChildren(el('option', 'All cohorts'));
      fc.firstChild.value = '';
      Object.keys(count).forEach(function (k) { var o = el('option', k + ' (' + count[k] + ')'); o.value = k; fc.appendChild(o); });
      fc.value = cur; renderRegs(); renderStats(count);
    }).catch(function (e) { $('rows').replaceChildren(rowMsg(e.message, 10)); });
  }
  function rowMsg(t, n) { var tr = el('tr'), td = el('td', t, 'empty'); td.colSpan = n; tr.appendChild(td); return tr; }
  function naira(n) { n = Number(n) || 0; return '₦' + n.toLocaleString('en-NG'); }
  function renderStats(count) {
    var s;
    if (src === 'enrollment') {
      var c = regs.filter(function (r) { return r.payment_status === 'confirmed'; });
      var total = c.reduce(function (a, r) { return a + (Number(r.amount_paid) || 0); }, 0);
      s = [[regs.length, 'Enrollments submitted'], [regs.filter(function (r) { return r.payment_status === 'pending'; }).length, 'Waiting for confirmation'], [c.length, 'Confirmed participants'], [naira(total), 'Confirmed payments']];
    } else {
      var today = new Date().toDateString(), week = Date.now() - 7 * 864e5;
      s = [[regs.length, 'Total registrations'], [regs.filter(function (r) { return new Date(r.created_at).toDateString() === today; }).length, 'Today'], [regs.filter(function (r) { return new Date(r.created_at) > week; }).length, 'Last 7 days'], [Object.keys(count).length, 'Cohorts']];
    }
    $('stats').replaceChildren.apply($('stats'), s.map(function (x) { var d = el('div', null, 'stat'); d.appendChild(el('b', String(x[0]))); d.appendChild(el('span', x[1])); return d; }));
  }
  function filtered() {
    var q = $('q').value.toLowerCase().trim(), c = $('fc').value, st = $('fstat').value;
    return regs.slice().reverse().filter(function (r) {
      if (c && (r.cohort || '(no cohort)') !== c) return false;
      if (st && src === 'enrollment' && r.payment_status !== st) return false;
      if (!q) return true;
      return [r.full_name, r.phone, r.email, r.business_name, r.location, r.business_type, r.sender_name, r.payment_ref].join(' ').toLowerCase().indexOf(q) > -1;
    });
  }
  function intl(phone) { var d = String(phone || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '234' + d.slice(1); return d.length >= 10 ? d : ''; }
  function setStatus(r, status) {
    api('payments', { method: 'POST', body: { id: r.id, status: status, cohort: r.cohort || '' } }).then(function () { flash('ok', r.full_name + ' marked as ' + status + '.'); loadRegs(); }).catch(fail);
  }
  function sendLink(r) {
    if (!joinLink) { flash('err', 'Add the class link in Cohort settings first.'); return; }
    var first = String(r.full_name || '').split(' ')[0];
    var text = (joinMsg || DEFAULT_MSG).replace(/\{name\}/g, first).replace(/\{link\}/g, joinLink);
    var n = intl(r.phone); if (!n) { flash('err', 'This phone number looks invalid.'); return; }
    window.open('https://wa.me/' + n + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
  }
  function siteUrl() { return location.origin + '/#register'; }
  function shareToGroup(r) {
    var k = r.cohort || '(no cohort)';
    var confirmed = regs.filter(function (x) { return (x.cohort || '(no cohort)') === k && x.payment_status === 'confirmed'; }).length;
    var left = Math.max(0, 15 - confirmed);
    var first = String(r.full_name || '').trim().split(/\s+/)[0];
    var about = [r.business_type, r.location].filter(Boolean).join(', ');
    var text = '🎉 Please welcome *' + first + '*' + (about ? ' (' + about + ')' : '') + ', seat confirmed! ✅\n\n' +
      confirmed + ' participant' + (confirmed === 1 ? '' : 's') + ' confirmed for *Grow Your Sales with AI Skills*' + (r.cohort ? ' (' + r.cohort + ')' : '') + '.\n' +
      (left > 0 ? 'Only ' + left + ' early-bird spot' + (left === 1 ? '' : 's') + ' left: 6 months FREE Google Gemini AI + Google One storage. 🎁\n'
                : 'Early-bird spots are all taken, but seats are still open.\n') +
      '\nLive online: Tue 27 & Wed 28 Oct, 5–8 PM. Fee ₦15,000.\nEnrol here 👉 ' + siteUrl();
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
  }
  function renderRegs() {
    var list = filtered(), body = $('rows');
    if (!list.length) { body.replaceChildren(rowMsg(regs.length ? 'No matches.' : 'Nothing yet.', 10)); return; }
    body.replaceChildren.apply(body, list.map(function (r) {
      var tr = el('tr');
      var cb = el('input'); cb.type = 'checkbox'; cb.checked = selected.has(r.id); cb.onchange = function () { cb.checked ? selected.add(r.id) : selected.delete(r.id); updIssue(); };
      var td0 = el('td'); td0.appendChild(cb); tr.appendChild(td0);
      tr.appendChild(el('td', fmtDate(r.created_at)));
      var tdn = el('td'); tdn.appendChild(el('strong', r.full_name || '')); if (r.email) { tdn.appendChild(document.createElement('br')); tdn.appendChild(el('small', r.email)); }
      if (r._early) { tdn.appendChild(document.createElement('br')); tdn.appendChild(el('span', 'EARLY BIRD', 'tagb')); }
      if (r.announce_ok) { tdn.appendChild(document.createElement('br')); tdn.appendChild(el('small', '📣 OK to welcome in group')); } tr.appendChild(tdn);
      var tdp = el('td'); var n = intl(r.phone); if (n) { var a = el('a', r.phone); a.href = 'https://wa.me/' + n; a.target = '_blank'; a.rel = 'noopener'; tdp.appendChild(a); } else tdp.textContent = r.phone || ''; tr.appendChild(tdp);
      var tds = el('td'); if (src === 'enrollment') tds.appendChild(el('span', r.payment_status, 'st-' + r.payment_status)); else tds.textContent = '—'; tr.appendChild(tds);
      var tdpay = el('td'); if (src === 'enrollment') { tdpay.appendChild(el('div', r.sender_name || '')); tdpay.appendChild(el('small', naira(r.amount_paid) + ' · ' + (r.payment_date || '') + (r.payment_ref ? ' · ref ' + r.payment_ref : ''))); } tr.appendChild(tdpay);
      var tdr = el('td'); if (r.proof_url) { var ra = el('a', 'View'); ra.href = r.proof_url; ra.target = '_blank'; ra.rel = 'noopener'; tdr.appendChild(ra); } else tdr.appendChild(el('small', src === 'enrollment' ? 'none — check WhatsApp' : '')); tr.appendChild(tdr);
      var tda = el('td'); tda.appendChild(el('div', r.participant_type || '')); tda.appendChild(el('small', [r.business_type, r.business_name].filter(Boolean).join(' · '))); tr.appendChild(tda);
      tr.appendChild(el('td', r.location || ''));
      var tdx = el('td'), acts = el('div', null, 'acts');
      if (src === 'enrollment') {
        if (r.payment_status !== 'confirmed') { var c = el('button', 'Confirm', 'sbtn'); c.type = 'button'; c.onclick = function () { if (confirm('Have you seen ' + naira(r.amount_paid) + ' from "' + r.sender_name + '" in your bank app?')) setStatus(r, 'confirmed'); }; acts.appendChild(c); }
        if (r.payment_status === 'confirmed') { var sl = el('button', 'Send link', 'sbtn gold'); sl.type = 'button'; sl.onclick = function () { sendLink(r); }; acts.appendChild(sl); }
        if (r.payment_status === 'confirmed' && r.announce_ok) { var sg = el('button', 'Share to group', 'sbtn'); sg.type = 'button'; sg.title = 'Opens WhatsApp — choose your community group'; sg.onclick = function () { shareToGroup(r); }; acts.appendChild(sg); }
        if (r.payment_status === 'confirmed' && !r.announce_ok) acts.appendChild(el('small', 'No group shout-out'));
        if (r.payment_status !== 'rejected') { var rj = el('button', r.payment_status === 'confirmed' ? 'Undo' : 'Reject', 'sbtn light'); rj.type = 'button'; rj.onclick = function () { if (confirm('Mark as ' + (r.payment_status === 'confirmed' ? 'pending' : 'rejected') + '?')) setStatus(r, r.payment_status === 'confirmed' ? 'pending' : 'rejected'); }; acts.appendChild(rj); }
      }
      var del = el('button', 'Delete', 'sbtn danger'); del.type = 'button';
      del.onclick = function () { if (!confirm('Delete this entry permanently? Use this only for spam or duplicates.')) return; api('registrations?id=' + encodeURIComponent(r.id), { method: 'DELETE' }).then(function () { flash('ok', 'Deleted.'); loadRegs(); }).catch(fail); };
      acts.appendChild(del); tdx.appendChild(acts); tr.appendChild(tdx);
      return tr;
    }));
  }
  function updIssue() { $('issue').disabled = !selected.size; $('issue').textContent = 'Issue participation certificates (' + selected.size + ')'; }
  $('q').oninput = renderRegs; $('fc').onchange = renderRegs; $('fstat').onchange = renderRegs; $('reload').onclick = loadRegs;
  $('fsrc').onchange = function () { src = $('fsrc').value; selected.clear(); updIssue(); loadRegs(); };
  $('all').onchange = function () { filtered().forEach(function (r) { $('all').checked ? selected.add(r.id) : selected.delete(r.id); }); renderRegs(); updIssue(); };
  $('csv').onclick = function () {
    csv([['Date', 'Name', 'WhatsApp', 'Email', 'Payment status', 'Paid from', 'Amount', 'Payment date', 'Reference', 'Receipt', 'I am', 'Business/idea', 'Business name', 'City', 'Heard from', 'Cohort', 'Early bird', 'OK to welcome in group']].concat(filtered().map(function (r) {
      return [fmtDate(r.created_at), r.full_name, r.phone, r.email, r.payment_status, r.sender_name, r.amount_paid, r.payment_date, r.payment_ref, r.proof_url, r.participant_type, r.business_type, r.business_name, r.location, r.heard_from, r.cohort, r._early ? 'Yes' : '', r.announce_ok ? 'Yes' : ''];
    })), src + '.csv');
  };
  $('issue').onclick = function () {
    var items = regs.filter(function (r) { return selected.has(r.id); }).map(function (r) { return { name: r.full_name, type: 'participation', cohort: r.cohort || '' }; });
    if (!confirm('Create ' + items.length + ' Certificate(s) of Participation?')) return;
    api('certificates', { method: 'POST', body: { items: items } }).then(function (d) { flash('ok', d.items.length + ' certificate(s) created. See the Certificates tab for their numbers.'); selected.clear(); updIssue(); renderRegs(); loadCerts(); }).catch(fail);
  };

  // ---- settings ----
  function toLocalInput(iso) { if (!iso) return ''; var d = new Date(iso); if (isNaN(d)) return ''; var l = new Date(d.getTime() + 60 * 60000); return l.toISOString().slice(0, 16); }
  function loadSettings() {
    api('settings').then(function (s) { $('s-name').value = s.cohort_name || ''; $('s-start').value = toLocalInput(s.cohort_start); $('s-wa').value = s.whatsapp_group || ''; $('s-note').value = s.cohort_note || ''; joinLink = s.join_link || ''; joinMsg = s.join_message || ''; $('s-join').value = joinLink; $('s-jmsg').value = joinMsg || DEFAULT_MSG; }).catch(fail);
  }
  $('cohort-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('s-start').value; // interpreted as Lagos time (UTC+1)
    var body = { cohort_name: $('s-name').value, cohort_start: v ? v + ':00+01:00' : '', whatsapp_group: $('s-wa').value, cohort_note: $('s-note').value, join_link: $('s-join').value.trim(), join_message: $('s-jmsg').value.trim() === DEFAULT_MSG ? '' : $('s-jmsg').value.trim() };
    api('settings', { method: 'PUT', body: body }).then(function (r) { joinLink = r.join_link || ''; joinMsg = r.join_message || ''; flash('ok', 'Saved. The landing page now shows these details.'); }).catch(fail);
  });

  // ---- certificates ----
  function loadCerts() { api('certificates').then(function (d) { certs = d.items || []; renderCerts(); }).catch(fail); }
  function renderCerts() {
    var q = $('cq').value.toLowerCase().trim(), body = $('crows');
    var list = certs.filter(function (c) { return !q || (c.name + ' ' + c.number).toLowerCase().indexOf(q) > -1; });
    if (!list.length) { body.replaceChildren(rowMsg(certs.length ? 'No matches.' : 'No certificates yet.', 7)); return; }
    body.replaceChildren.apply(body, list.map(function (c) {
      var tr = el('tr');
      tr.appendChild(el('td', c.number, 'mono'));
      tr.appendChild(el('td', c.name));
      var tdt = el('td'); tdt.appendChild(el('span', c.type_key === 'practitioner' ? 'Practitioner' : 'Participation', 'tagp')); tr.appendChild(tdt);
      tr.appendChild(el('td', c.cohort || '')); tr.appendChild(el('td', c.issued || ''));
      var link = location.origin + '/verify/?no=' + encodeURIComponent(c.number);
      var tdl = el('td'), cp = el('button', 'Copy link', 'sbtn light'); cp.type = 'button';
      cp.onclick = function () { navigator.clipboard.writeText(link).then(function () { cp.textContent = 'Copied ✓'; setTimeout(function () { cp.textContent = 'Copy link'; }, 1500); }); };
      tdl.appendChild(cp); tr.appendChild(tdl);
      var tdx = el('td'), del = el('button', 'Revoke', 'sbtn danger'); del.type = 'button';
      del.onclick = function () { if (!confirm('Revoke ' + c.number + '? It will no longer verify.')) return; api('certificates?no=' + encodeURIComponent(c.number), { method: 'DELETE' }).then(function () { flash('ok', 'Certificate revoked.'); loadCerts(); }).catch(fail); };
      tdx.appendChild(del); tr.appendChild(tdx);
      return tr;
    }));
  }
  $('cq').oninput = renderCerts;
  $('ccsv').onclick = function () { csv([['Number', 'Name', 'Type', 'Cohort', 'Issued', 'Verify link']].concat(certs.map(function (c) { return [c.number, c.name, c.type, c.cohort, c.issued, location.origin + '/verify/?no=' + c.number]; })), 'certificates.csv'); };
  var today = new Date().toISOString().slice(0, 10); $('c-date').value = today;
  $('cert-one').addEventListener('submit', function (e) {
    e.preventDefault();
    api('certificates', { method: 'POST', body: { name: $('c-name').value, type: $('c-type').value, issued: $('c-date').value, cohort: $('c-cohort').value } })
      .then(function (d) { if (!d.items.length) throw new Error('Name is too short.'); flash('ok', 'Created ' + d.items[0].number + ' for ' + d.items[0].name + '.'); $('c-name').value = ''; loadCerts(); }).catch(fail);
  });
  $('cert-bulk').addEventListener('submit', function (e) {
    e.preventDefault();
    var names = $('b-names').value.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!names.length) return flash('err', 'Paste at least one name.');
    var items = names.map(function (n) { return { name: n, type: $('b-type').value, cohort: $('b-cohort').value, issued: today }; });
    api('certificates', { method: 'POST', body: { items: items } }).then(function (d) { flash('ok', d.items.length + ' certificate(s) created.'); $('b-names').value = ''; loadCerts(); }).catch(fail);
  });
})();
