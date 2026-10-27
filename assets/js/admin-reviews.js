/* Admin: Reviews tab. All participant text is inserted with textContent. */
(function () {
  var R = window.RA; if (!R) return;
  var $ = function (id) { return document.getElementById(id); }, el = R.el, api = R.api, items = null;
  var LBL = { content: 'Content', facilitator: 'Facilitator', practical: 'Practical value', platform: 'Platform' };
  var prevLogin = R.onLogin;
  R.onLogin = function () { if (prevLogin) prevLogin(); load(); };
  if (!$('app').hidden) load();
  $('rv-reload').onclick = load; $('rv-f').onchange = render; $('rv-c').onchange = render;
  document.querySelector('[data-tab=reviews]').addEventListener('click', function () { load(); });
  function load() { return api('reviews').then(function (d) { items = d.items || []; cohorts(); render(); }).catch(R.fail); }
  function starsText(n) { n = Number(n) || 0; return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); }
  function cohorts() {
    var c = $('rv-c'), cur = c.value, seen = {}; c.replaceChildren(el('option', 'All cohorts')); c.firstChild.value = '';
    items.forEach(function (r) { if (r.cohort && !seen[r.cohort]) { seen[r.cohort] = 1; var o = el('option', r.cohort); o.value = r.cohort; c.appendChild(o); } });
    c.value = cur;
  }
  function list() {
    var f = $('rv-f').value, c = $('rv-c').value;
    return items.filter(function (r) { if (c && r.cohort !== c) return false; if (f === 'private') return !r.publish_ok; return !f || r.status === f; });
  }
  function avg(a) { return a.length ? (a.reduce(function (x, y) { return x + y; }, 0) / a.length) : 0; }
  function stats(rows) {
    var nps = rows.filter(function (r) { return r.nps >= 0; }), pro = nps.filter(function (r) { return r.nps >= 9; }).length, det = nps.filter(function (r) { return r.nps <= 6; }).length;
    var s = [[rows.length, 'Reviews'], [rows.length ? avg(rows.map(function (r) { return r.overall; })).toFixed(1) + ' ★' : '—', 'Average overall rating'],
      [nps.length ? Math.round((pro - det) / nps.length * 100) : '—', 'Net Promoter Score (−100 to 100)'],
      [rows.filter(function (r) { return r.status === 'pending' && r.publish_ok; }).length, 'Waiting for approval'],
      [rows.filter(function (r) { return r.status === 'approved'; }).length, 'Published']];
    Object.keys(LBL).forEach(function (k) { s.push([rows.length ? avg(rows.map(function (r) { return r.ratings[k] || 0; })).toFixed(1) : '—', LBL[k] + ' (avg)']); });
    var st = $('rv-stats'); st.replaceChildren.apply(st, s.map(function (x) { var d = el('div', null, 'stat'); d.appendChild(el('b', String(x[0]))); d.appendChild(el('span', x[1])); return d; }));
    var waiting = items.filter(function (r) { return r.status === 'pending' && r.publish_ok; }).length;
    $('rv-badge').textContent = waiting; $('rv-badge').style.display = waiting ? '' : 'none';
  }
  function act(r, body, okText) { api('reviews', { method: 'POST', body: Object.assign({ code: r.code }, body) }).then(function (u) { Object.assign(r, u); R.flash('ok', okText); render(); }).catch(R.fail); }
  function render() {
    var rows = list(), box = $('rv-list'); stats(rows.length || $('rv-f').value ? rows : items);
    if (!rows.length) { box.replaceChildren(el('p', items.length ? 'No reviews match this filter.' : 'No reviews yet. Participants can review after the post-test.', 'empty')); return; }
    box.replaceChildren.apply(box, rows.map(function (r) {
      var c = el('div', null, 'rv' + (r.status === 'approved' ? ' st-a' : r.status === 'hidden' ? ' st-h' : ''));
      var top = el('div', null, 'rv-top'); var who = el('div'); who.appendChild(el('b', r.name)); who.appendChild(el('div', [r.business_type, r.location, r.cohort, R.fmtDate(r.updated || r.at)].filter(Boolean).join(' · '), 'rv-meta'));
      top.appendChild(who);
      var right = el('div'); right.appendChild(el('span', starsText(r.overall), 'rv-stars')); right.appendChild(document.createTextNode(' '));
      var stLab = { pending: 'Waiting', approved: r.featured ? 'Approved · Featured' : 'Approved', hidden: 'Hidden' }[r.status];
      right.appendChild(el('span', r.publish_ok ? stLab : 'Private feedback', r.status === 'approved' ? 'st-confirmed' : r.status === 'hidden' || !r.publish_ok ? 'st-rejected' : 'st-pending'));
      top.appendChild(right); c.appendChild(top);
      var g = el('div', null, 'rv-grid');
      Object.keys(LBL).forEach(function (k) { var d = el('div'); d.appendChild(el('b', (r.ratings[k] || 0) + ' / 5')); d.appendChild(document.createTextNode(LBL[k])); g.appendChild(d); });
      var nd = el('div'); nd.appendChild(el('b', r.nps + ' / 10')); nd.appendChild(document.createTextNode('Would recommend')); g.appendChild(nd);
      c.appendChild(g);
      var dl = el('dl', null, 'rv-t');
      [['What they gained', r.gain], ['Gaps', r.gaps], ['Suggestions', r.suggestions]].forEach(function (x) { if (!x[1]) return; dl.appendChild(el('dt', x[0])); dl.appendChild(el('dd', x[1])); });
      c.appendChild(dl);
      c.appendChild(el('div', r.publish_ok ? '“' + r.testimonial + '” — ' + r.first + (r.business_type ? ', ' + r.business_type : '') + (r.location ? ', ' + r.location : '') : 'Did not give permission to publish — private feedback only.', 'rv-pub' + (r.publish_ok ? '' : ' none')));
      var acts = el('div', null, 'acts');
      function b(t, cls, fn) { var x = el('button', t, 'sbtn ' + cls); x.type = 'button'; x.onclick = fn; acts.appendChild(x); }
      if (r.publish_ok && r.status !== 'approved') b('Approve', '', function () { act(r, { status: 'approved' }, 'Approved — now on the reviews page.'); });
      if (r.status === 'approved') b(r.featured ? 'Unfeature' : 'Feature on home page', 'gold', function () { act(r, { featured: !r.featured }, r.featured ? 'Removed from home page.' : 'Featured on the home page.'); });
      if (r.status !== 'hidden') b('Hide', 'light', function () { act(r, { status: 'hidden' }, 'Hidden from the public.'); });
      if (r.status === 'hidden') b('Move back to waiting', 'light', function () { act(r, { status: 'pending' }, 'Moved back.'); });
      c.appendChild(acts);
      return c;
    }));
  }
  $('rv-csv').onclick = function () {
    R.csv([['Date', 'Name', 'Cohort', 'Business', 'City', 'Overall', 'Content', 'Facilitator', 'Practical', 'Platform', 'Recommend (0-10)', 'Gained', 'Gaps', 'Suggestions', 'Public review', 'May publish', 'Status', 'Featured']].concat(list().map(function (r) {
      return [R.fmtDate(r.at), r.name, r.cohort, r.business_type, r.location, r.overall, r.ratings.content, r.ratings.facilitator, r.ratings.practical, r.ratings.platform, r.nps, r.gain, r.gaps, r.suggestions, r.testimonial, r.publish_ok ? 'Yes' : 'No', r.status, r.featured ? 'Yes' : ''];
    })), 'reviews.csv');
  };
})();
