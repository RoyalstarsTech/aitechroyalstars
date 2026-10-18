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

  // ---- registrations ----
  function loadRegs() {
    $('rows').replaceChildren(rowMsg('Loading…', 11));
    api('registrations').then(function (d) {
      regs = (d.items || []).sort(function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)); });
      var count = {};
      regs.forEach(function (r) { var k = r.cohort || '(no cohort)'; count[k] = (count[k] || 0) + 1; r._early = count[k] <= 15; });
      var fc = $('fc'), cur = fc.value; fc.replaceChildren(el('option', 'All cohorts'));
      fc.firstChild.value = '';
      Object.keys(count).forEach(function (k) { var o = el('option', k + ' (' + count[k] + ')'); o.value = k; fc.appendChild(o); });
      fc.value = cur; renderRegs(); renderStats(count);
    }).catch(function (e) { $('rows').replaceChildren(rowMsg(e.message, 11)); });
  }
  function rowMsg(t, n) { var tr = el('tr'), td = el('td', t, 'empty'); td.colSpan = n; tr.appendChild(td); return tr; }
  function renderStats(count) {
    var today = new Date().toDateString(), week = Date.now() - 7 * 864e5;
    var s = [[regs.length, 'Total registrations'], [regs.filter(function (r) { return new Date(r.created_at).toDateString() === today; }).length, 'Today'],
      [regs.filter(function (r) { return new Date(r.created_at) > week; }).length, 'Last 7 days'], [Object.keys(count).length, 'Cohorts']];
    $('stats').replaceChildren.apply($('stats'), s.map(function (x) { var d = el('div', null, 'stat'); d.appendChild(el('b', String(x[0]))); d.appendChild(el('span', x[1])); return d; }));
  }
  function filtered() {
    var q = $('q').value.toLowerCase().trim(), c = $('fc').value;
    return regs.slice().reverse().filter(function (r) {
      if (c && (r.cohort || '(no cohort)') !== c) return false;
      if (!q) return true;
      return [r.full_name, r.phone, r.email, r.business_name, r.location, r.business_type].join(' ').toLowerCase().indexOf(q) > -1;
    });
  }
  function waLink(phone) { var d = String(phone || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '234' + d.slice(1); return d.length >= 10 ? 'https://wa.me/' + d : null; }
  function renderRegs() {
    var list = filtered(), body = $('rows');
    if (!list.length) { body.replaceChildren(rowMsg(regs.length ? 'No matches.' : 'No registrations yet.', 11)); return; }
    body.replaceChildren.apply(body, list.map(function (r) {
      var tr = el('tr');
      var cb = el('input'); cb.type = 'checkbox'; cb.checked = selected.has(r.id); cb.onchange = function () { cb.checked ? selected.add(r.id) : selected.delete(r.id); updIssue(); };
      var td0 = el('td'); td0.appendChild(cb); tr.appendChild(td0);
      tr.appendChild(el('td', fmtDate(r.created_at)));
      var tdn = el('td'); tdn.appendChild(el('strong', r.full_name || '')); if (r._early) { tdn.appendChild(document.createElement('br')); tdn.appendChild(el('span', 'EARLY BIRD', 'tagb')); } tr.appendChild(tdn);
      var tdp = el('td'); var w = waLink(r.phone); if (w) { var a = el('a', r.phone); a.href = w; a.target = '_blank'; a.rel = 'noopener'; tdp.appendChild(a); } else tdp.textContent = r.phone || ''; tr.appendChild(tdp);
      [r.email, r.business_name, r.business_type, r.location, r.heard_from, r.cohort].forEach(function (v) { tr.appendChild(el('td', v || '')); });
      var tdx = el('td'), del = el('button', 'Delete', 'sbtn danger'); del.type = 'button';
      del.onclick = function () { if (!confirm('Delete this registration permanently? Use this only for spam or duplicates.')) return; api('registrations?id=' + encodeURIComponent(r.id), { method: 'DELETE' }).then(function () { flash('ok', 'Registration deleted.'); loadRegs(); }).catch(fail); };
      tdx.appendChild(del); tr.appendChild(tdx);
      return tr;
    }));
  }
  function updIssue() { $('issue').disabled = !selected.size; $('issue').textContent = 'Issue participation certificates (' + selected.size + ')'; }
  $('q').oninput = renderRegs; $('fc').onchange = renderRegs; $('reload').onclick = loadRegs;
  $('all').onchange = function () { filtered().forEach(function (r) { $('all').checked ? selected.add(r.id) : selected.delete(r.id); }); renderRegs(); updIssue(); };
  $('csv').onclick = function () {
    csv([['Date', 'Name', 'WhatsApp', 'Email', 'Business', 'Type', 'City', 'Heard from', 'Cohort', 'Early bird']].concat(filtered().map(function (r) {
      return [fmtDate(r.created_at), r.full_name, r.phone, r.email, r.business_name, r.business_type, r.location, r.heard_from, r.cohort, r._early ? 'Yes' : ''];
    })), 'registrations.csv');
  };
  $('issue').onclick = function () {
    var items = regs.filter(function (r) { return selected.has(r.id); }).map(function (r) { return { name: r.full_name, type: 'participation', cohort: r.cohort || '' }; });
    if (!confirm('Create ' + items.length + ' Certificate(s) of Participation?')) return;
    api('certificates', { method: 'POST', body: { items: items } }).then(function (d) { flash('ok', d.items.length + ' certificate(s) created. See the Certificates tab for their numbers.'); selected.clear(); updIssue(); renderRegs(); loadCerts(); }).catch(fail);
  };

  // ---- settings ----
  function toLocalInput(iso) { if (!iso) return ''; var d = new Date(iso); if (isNaN(d)) return ''; var l = new Date(d.getTime() + 60 * 60000); return l.toISOString().slice(0, 16); }
  function loadSettings() {
    api('settings').then(function (s) { $('s-name').value = s.cohort_name || ''; $('s-start').value = toLocalInput(s.cohort_start); $('s-wa').value = s.whatsapp_group || ''; $('s-note').value = s.cohort_note || ''; }).catch(fail);
  }
  $('cohort-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('s-start').value; // interpreted as Lagos time (UTC+1)
    var body = { cohort_name: $('s-name').value, cohort_start: v ? v + ':00+01:00' : '', whatsapp_group: $('s-wa').value, cohort_note: $('s-note').value };
    api('settings', { method: 'PUT', body: body }).then(function () { flash('ok', 'Saved. The landing page now shows these details.'); }).catch(fail);
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
