/* Admin: certificate designer (live preview, issue, download, send link). */
(function () {
  var R = window.RA; if (!R || !window.RST_CERT) return;
  var $ = function (id) { return document.getElementById(id); }, el = R.el, api = R.api, people = [], t;
  var today = new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
  $('d-date').value = today;
  function opts() { return { name: $('d-name').value.trim() || 'Participant Name', type_key: $('d-type').value, issued: $('d-date').value, number: 'RST-AICG-' + $('d-date').value.slice(0, 4) + '-000-PREVIEW', verifyUrl: location.origin + '/verify/' }; }
  function preview() { clearTimeout(t); t = setTimeout(function () { RST_CERT.render($('d-canvas'), opts()).catch(function () {}); }, 150); }
  ['d-name', 'd-type', 'd-date'].forEach(function (id) { $(id).addEventListener('input', preview); $(id).addEventListener('change', preview); });
  function loadPeople() {
    return api('training').then(function (d) {
      people = (d.participants || []).filter(function (p) { return p.active; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
      var s = $('d-who'), cur = s.value; s.replaceChildren(el('option', '— Type a name instead —')); s.firstChild.value = '';
      people.forEach(function (p) { var has = p.certs || {}; var o = el('option', p.name + (has.participation ? ' ✓' : '') + ' · ' + p.code); o.value = p.code; s.appendChild(o); });
      s.value = cur;
    }).catch(function () {});
  }
  $('d-who').onchange = function () {
    var p = people.filter(function (x) { return x.code === $('d-who').value; })[0];
    if (p) { $('d-name').value = p.name; $('d-cohort').value = p.cohort || ''; }
    preview();
  };
  document.querySelector('[data-tab=certs]').addEventListener('click', function () { loadPeople(); preview(); });
  var prev = R.onLogin; R.onLogin = function () { if (prev) prev(); loadPeople(); };
  if (!$('app').hidden) loadPeople();
  preview();

  function showResult(c) {
    var box = $('d-result'); box.replaceChildren(); box.hidden = false;
    box.appendChild(el('b', 'Issued ' + c.number + ' to ' + c.name));
    var link = location.origin + '/certificate/?no=' + encodeURIComponent(c.number);
    var acts = el('div', null, 'acts');
    function b(txt, cls, fn) { var x = el('button', txt, 'sbtn ' + cls); x.type = 'button'; x.onclick = fn; acts.appendChild(x); return x; }
    var o = { name: c.name, number: c.number, type_key: c.type_key, issued: c.issued, verifyUrl: location.origin + '/verify/?no=' + encodeURIComponent(c.number) };
    var cv = document.createElement('canvas');
    var ready = RST_CERT.render(cv, o);
    b('Download PDF', '', function () { ready.then(function () { RST_CERT.download(cv, o, 'pdf'); }); });
    b('Download JPG', 'light', function () { ready.then(function () { RST_CERT.download(cv, o, 'jpg'); }); });
    b('Copy link', 'light', function (e) { var x = e.currentTarget; (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { x.textContent = 'Copied ✓'; }).catch(function () { window.prompt('Copy:', link); }); });
    var p = people.filter(function (x) { return x.code === c.code; })[0], num = p && R.intl(p.phone);
    b(num ? 'Send on WhatsApp' : 'Share on WhatsApp', 'gold', function () {
      var first = String(c.name).split(/\s+/)[0];
      var text = 'Congratulations ' + first + '! 🎓 Your ' + c.type + ' for *Grow Your Sales with AI Skills* is ready.\n\nView and download it here: ' + link + '\n\nAnyone can verify it with the QR code on the certificate.\n\nRoyalstars Technologies Ltd.';
      window.open('https://wa.me/' + (num || '') + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
    });
    box.appendChild(acts);
  }
  $('d-issue').onclick = function () {
    var name = $('d-name').value.trim(), code = $('d-who').value;
    if (name.length < 2) { R.flash('err', 'Type the participant\'s name first.'); $('d-name').focus(); return; }
    var p = people.filter(function (x) { return x.code === code; })[0];
    if (p && p.name !== name && !confirm('The name differs from the registered name (' + p.name + '). Issue with "' + name + '"?')) return;
    $('d-issue').disabled = true;
    api('certificates', { method: 'POST', body: { name: name, type: $('d-type').value, issued: $('d-date').value, cohort: $('d-cohort').value, code: code } })
      .then(function (d) { var c = d.items[0]; if (!c) throw new Error('Could not issue.'); if (c.name !== name) R.flash('ok', 'This participant already had this certificate: ' + c.number); else R.flash('ok', 'Certificate ' + c.number + ' issued.'); showResult(c); R.loadCerts && R.loadCerts(); loadPeople(); })
      .catch(R.fail).then(function () { $('d-issue').disabled = false; });
  };
  $('d-elig').onclick = function () {
    if (!confirm('Issue a Certificate of Participation to every participant who attended both days and took the post-test?')) return;
    api('certificates-eligible', { method: 'POST', body: {} }).then(function (d) { R.flash('ok', d.items.length ? d.items.length + ' certificate(s) issued: ' + d.items.map(function (c) { return c.name; }).join(', ') : 'Nobody new qualifies right now.'); R.loadCerts && R.loadCerts(); loadPeople(); }).catch(R.fail);
  };
})();
