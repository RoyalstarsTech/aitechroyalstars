/* Admin: evaluation & impact report (totals and averages only). */
(function () {
  var R = window.RA; if (!R) return;
  var $ = function (id) { return document.getElementById(id); }, el = R.el;
  function avg(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
  function f1(v, suf) { return v === null || isNaN(v) ? '—' : (Math.round(v * 10) / 10) + (suf || ''); }
  function pct(n, d) { return d ? Math.round(n / d * 100) + '%' : '—'; }
  function kpis(list) { var g = el('div', null, 'rp-kpis'); list.forEach(function (k) { var d = el('div'); d.appendChild(el('b', String(k[0]))); d.appendChild(el('span', k[1])); g.appendChild(d); }); return g; }
  function table(head, rows) { var w = el('div', null, 'tbl'), t = el('table'), th = el('thead'), tr = el('tr'); head.forEach(function (h) { tr.appendChild(el('th', h)); }); th.appendChild(tr); t.appendChild(th); var tb = el('tbody'); rows.forEach(function (r) { var x = el('tr'); r.forEach(function (c) { x.appendChild(el('td', String(c))); }); tb.appendChild(x); }); t.appendChild(tb); w.appendChild(t); return w; }
  function quotes(title, arr) { var d = el('div'); d.appendChild(el('b', title)); var ul = el('ul'); arr.slice(0, 8).forEach(function (q) { ul.appendChild(el('li', q)); }); if (!arr.length) ul.appendChild(el('li', 'None yet.')); d.appendChild(ul); return d; }
  function cohorts() { R.api('training').then(function (d) { var c = $('rp-c'), seen = {}; (d.participants || []).forEach(function (p) { if (p.cohort && !seen[p.cohort]) { seen[p.cohort] = 1; var o = el('option', p.cohort); o.value = p.cohort; c.appendChild(o); } }); }).catch(function () {}); }
  document.querySelector('[data-tab=report]').addEventListener('click', function () { if ($('rp-c').options.length === 1) cohorts(); if (!$('rp').children.length) build(); });
  $('rp-go').onclick = build; $('rp-print').onclick = function () { window.print(); };
  function build() {
    var box = $('rp'); box.replaceChildren(el('p', 'Building report…', 'sub'));
    R.api('report' + ($('rp-c').value ? '?cohort=' + encodeURIComponent($('rp-c').value) : '')).then(function (d) {
      var P = d.people, out = [];
      out.push(el('h1', 'Grow Your Sales with AI Skills — Evaluation Report'));
      out.push(el('p', (d.cohort || 'All cohorts') + ' · Royalstars Technologies Ltd. · Generated ' + R.fmtDate(d.generated), 'rp-sub'));
      // enrolment
      out.push(el('h3', '1. Enrollment'));
      var E = d.enrol;
      out.push(kpis([[E.submitted, 'Enrollment forms'], [E.confirmed, 'Paid & confirmed'], ['₦' + E.revenue.toLocaleString('en-NG'), 'Training fees confirmed'], [Object.keys(E.types).map(function (k) { return E.types[k] + ' ' + k.toLowerCase(); }).join(' · ') || '—', 'Participant mix']]));
      var src = Object.keys(E.sources).sort(function (a, b) { return E.sources[b] - E.sources[a]; });
      if (src.length) out.push(table(['How they heard about us', 'People'], src.map(function (k) { return [k, E.sources[k]]; })));
      // participation
      out.push(el('h3', '2. Participation'));
      var n = P.length, pre = P.filter(function (p) { return p.pre; }), post = P.filter(function (p) { return p.post; }), both = P.filter(function (p) { return p.pre && p.post; });
      out.push(kpis([[n, 'Participants with portal access'], [pct(P.filter(function (p) { return p.d1; }).length, n), 'Attended Day 1'], [pct(P.filter(function (p) { return p.d2; }).length, n), 'Attended Day 2'], [pre.length + ' / ' + post.length, 'Took pre-test / post-test'], [d.certificates.participation || 0, 'Certificates of Participation'], [d.certificates.practitioner || 0, 'Certified Practitioners']]));
      // learning
      out.push(el('h3', '3. Learning gain'));
      var preA = avg(pre.map(function (p) { return p.pre.score / p.pre.total * 100; })), postA = avg(post.map(function (p) { return p.post.score / p.post.total * 100; }));
      var gain = avg(both.map(function (p) { return (p.post.score - p.pre.score) / p.post.total * 100; }));
      out.push(kpis([[f1(preA, '%'), 'Average pre-test score'], [f1(postA, '%'), 'Average post-test score'], [gain === null ? '—' : '+' + f1(gain) + ' pts', 'Average improvement (same people)'], [pct(both.filter(function (p) { return p.post.score > p.pre.score; }).length, both.length), 'Improved their score']]));
      var conf = ['Writing sales messages with AI', 'Replying to "How much?" and closing', 'Keeping records'];
      out.push(table(['Confidence (1–5)', 'Before', 'After'], conf.map(function (c, i) { return [c, f1(avg(pre.filter(function (p) { return p.pre.confidence; }).map(function (p) { return p.pre.confidence[i]; }))), f1(avg(post.filter(function (p) { return p.post.confidence; }).map(function (p) { return p.post.confidence[i]; })))]; })));
      out.push(table(['Topic', '% correct before', '% correct after'], d.topics.map(function (t, i) {
        return [(i + 1) + '. ' + t, pct(pre.filter(function (p) { return p.pre.answers && p.pre.answers[i] === d.key.pre[i]; }).length, pre.length), pct(post.filter(function (p) { return p.post.answers && p.post.answers[i] === d.key.post[i]; }).length, post.length)];
      })));
      // satisfaction
      out.push(el('h3', '4. Satisfaction'));
      var rv = P.filter(function (p) { return p.review; }).map(function (p) { return p.review; });
      var np = rv.filter(function (r) { return r.nps >= 0; }), nps = np.length ? Math.round((np.filter(function (r) { return r.nps >= 9; }).length - np.filter(function (r) { return r.nps <= 6; }).length) / np.length * 100) : null;
      out.push(kpis([[rv.length, 'Reviews'], [f1(avg(rv.map(function (r) { return r.overall; })), ' / 5'), 'Overall rating'], [nps === null ? '—' : nps, 'Net Promoter Score'], [f1(avg(rv.map(function (r) { return r.ratings.content; }))), 'Content'], [f1(avg(rv.map(function (r) { return r.ratings.facilitator; }))), 'Facilitator'], [f1(avg(rv.map(function (r) { return r.ratings.practical; }))), 'Practical value'], [f1(avg(rv.map(function (r) { return r.ratings.platform; }))), 'Platform & organisation']]));
      var two = el('div', null, 'two');
      two.appendChild(quotes('What participants gained', rv.map(function (r) { return r.gain; }).filter(Boolean)));
      two.appendChild(quotes('Gaps and suggestions', rv.map(function (r) { return [r.gaps, r.suggestions].filter(Boolean).join(' — '); }).filter(Boolean)));
      out.push(two);
      // impact
      out.push(el('h3', '5. Business impact (Day 1 → Day 30)'));
      var im = P.filter(function (p) { return p.pre && p.pre.baseline && p.day30; });
      var row = function (label, f, fmt) { return [label, fmt(avg(im.map(function (p) { return f(p.pre.baseline); }))), fmt(avg(im.map(function (p) { return f(p.day30); })))]; };
      var yes = function (k) { return function (b) { return b[k] === 'yes' ? 100 : 0; }; };
      if (im.length) out.push(table(['Measure (' + im.length + ' participants with both scorecards)', 'Day 1', 'Day 30'], [
        row('New enquiries per week', function (b) { return b.enquiries; }, f1), row('Sales per week', function (b) { return b.sales; }, f1),
        row('Know last month\'s profit', yes('profit_known'), function (v) { return f1(v, '%'); }), row('Write down every sale', yes('records'), function (v) { return f1(v, '%'); }),
        row('Use AI often', function (b) { return b.ai_use === 'often' ? 100 : 0; }, function (v) { return f1(v, '%'); })]));
      else out.push(el('p', 'Day 30 scorecards appear here once participants finish the 30-day challenge.', 'sub'));
      var act = P.filter(function (p) { return p.days > 0; });
      out.push(kpis([[act.length, 'Started the 30-day challenge'], [f1(avg(act.map(function (p) { return p.days; }))), 'Average days completed'], [P.filter(function (p) { return p.days >= 25; }).length, 'Completed 25+ days']]));
      // growth
      out.push(el('h3', '6. Upgrades & referrals'));
      var up = P.filter(function (p) { return p.upgrade; }), upc = P.filter(function (p) { return p.upgrade === 'confirmed'; });
      out.push(kpis([[up.length, 'Practitioner upgrade requests'], [upc.length, 'Upgrades confirmed'], ['₦' + upc.reduce(function (a, p) { return a + (Number(p.upgrade_amount) || 0); }, 0).toLocaleString('en-NG'), 'Upgrade fees confirmed'], [P.reduce(function (a, p) { return a + (p.referrals || 0); }, 0), 'Paid referrals from participants']]));
      box.replaceChildren.apply(box, out);
    }).catch(function (e) { box.replaceChildren(el('p', e.message, 'sub')); });
  }
})();
