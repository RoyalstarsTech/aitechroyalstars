/* Participant portal. All data from the server is inserted with textContent. */
(function () {
  var KEY = 'rst_code', code = '';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, text, cls) { var n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; }
  function icon(id) { var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('aria-hidden', 'true'); var u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#' + id); s.appendChild(u); return s; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function norm(v) { var s = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (s.indexOf('RST') === 0) s = s.slice(3); return s.length === 8 ? 'RST-' + s.slice(0, 4) + '-' + s.slice(4) : ''; }
  function msg(text, ok) { var m = $('pt-msg'); if (!text) { m.hidden = true; return; } m.textContent = text; m.className = 'pt-msg' + (ok ? ' ok' : ''); m.hidden = false; m.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  function api(path, opts) {
    opts = opts || {};
    return fetch('/api/portal/' + path, { method: opts.method || 'GET', headers: { 'content-type': 'application/json', 'x-access-code': code }, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (r.status === 401 && path !== 'login') { logout(d.error); throw new Error(d.error || 'Please enter your access code again.'); } if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.'); return d; }); });
  }
  function show(view) { ['pt-login', 'pt-dash', 'pt-test', 'pt-result'].forEach(function (v) { $(v).hidden = v !== view; }); $('pt-out').hidden = view === 'pt-login'; window.scrollTo(0, 0); }
  function logout(reason) { code = ''; store(KEY, null); $('pt-title').textContent = 'Welcome'; $('pt-sub').textContent = 'Your personal page for tests, training materials, attendance and certificates.'; show('pt-login'); if (reason) msg(reason); }
  $('pt-out').onclick = function () { logout(); };

  // ---- login ----
  $('pt-login').addEventListener('submit', function (e) {
    e.preventDefault(); msg('');
    var c = norm($('pt-code').value);
    if (!c) { msg('Please type the full code, e.g. RST-7K3Q-92XM.'); return; }
    code = c;
    api('login', { method: 'POST', body: { code: c } }).then(function (d) { store(KEY, c); render(d); }).catch(function (err) { code = ''; msg(err.message); });
  });

  // ---- dashboard ----
  var ME = null;
  function load(stay) { return api('me').then(function (d) { render(d, stay); }).catch(function (e) { if (code) msg(e.message); }); }
  function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
  function step(n, title, status, statusCls) {
    var c = el('div', null, 'pt-step'); var h = el('div', null, 'pt-step-h');
    h.appendChild(el('span', String(n), 'pt-num')); h.appendChild(el('h3', title));
    if (status) h.appendChild(el('span', status, 'pt-chip ' + (statusCls || '')));
    c.appendChild(h); return c;
  }
  function btn(text, cls, onclick, ic) { var b = el('button', null, 'btn ' + cls); b.type = 'button'; if (ic) b.appendChild(icon(ic)); b.appendChild(document.createTextNode(text)); b.onclick = onclick; return b; }
  function render(d, stay) {
    ME = d; if (!stay) msg('');
    $('pt-title').textContent = 'Welcome, ' + (d.first || 'friend') + ' 👋';
    $('pt-sub').textContent = (d.cohort ? d.cohort + ' · ' : '') + 'Live online · Tue 27 & Wed 28 October, 5:00–8:00 PM (WAT).';
    // class card
    var cc = $('pt-class'); cc.replaceChildren();
    var t = el('div'); t.appendChild(el('b', 'Live class')); t.appendChild(el('span', 'Join 10 minutes early with your phone charged and an AI app ready.'));
    cc.appendChild(t);
    var acts = el('div', null, 'pt-acts');
    if (d.join_link) { var a = el('a', null, 'btn btn-gold'); a.href = d.join_link; a.target = '_blank'; a.rel = 'noopener'; a.appendChild(icon('i-video')); a.appendChild(document.createTextNode('Join the class')); acts.appendChild(a); }
    if (d.whatsapp_group) { var w = el('a', null, 'btn btn-ghost'); w.href = d.whatsapp_group; w.target = '_blank'; w.rel = 'noopener'; w.appendChild(icon('i-wa')); w.appendChild(document.createTextNode('Community group')); acts.appendChild(w); }
    cc.appendChild(acts);

    var S = $('pt-steps'); S.replaceChildren();
    // 1 pre-test
    var s1 = step(1, 'Pre-test', d.pre.done ? 'Done · ' + d.pre.score + '/' + d.pre.total : (d.class.pre_open ? 'To do' : 'Closed'), d.pre.done ? 'ok' : (d.class.pre_open ? 'todo' : ''));
    s1.appendChild(el('p', d.pre.done ? 'Thank you! You can look at your answers again any time.' : 'Fifteen quick questions (about 10 minutes) so we know where to help you. It is okay not to know the answers. Your training materials unlock when you finish.'));
    if (d.pre.done) s1.appendChild(btn('See my answers', 'btn-plain', function () { openTest('pre'); }));
    else if (d.class.pre_open) s1.appendChild(btn('Start the pre-test', 'btn-navy', function () { openTest('pre'); }));
    S.appendChild(s1);
    // 2 materials
    var s2 = step(2, 'Training materials', d.materials.length ? d.materials.filter(function (m) { return !m.locked; }).length + ' of ' + d.materials.length + ' open' : '', '');
    if (!d.materials.length) s2.appendChild(el('p', 'Your materials will appear here soon.'));
    else {
      s2.appendChild(el('p', 'Each file is your personal copy with your name on it. Please do not forward it.', 'pt-small'));
      var ul = el('ul', null, 'pt-files');
      d.materials.forEach(function (m) {
        var li = el('li', null, m.locked ? 'locked' : '');
        var info = el('div'); info.appendChild(el('b', m.title)); info.appendChild(el('span', m.locked ? m.note : (/pdf/i.test(m.type) ? 'PDF · ' : '') + fmtSize(m.size)));
        li.appendChild(info);
        if (m.locked) { var lk = el('span', null, 'pt-lock'); lk.appendChild(icon('i-lock')); li.appendChild(lk); }
        else li.appendChild(btn('Download', 'btn-navy pt-dl', function (ev) { download(m, ev.currentTarget); }, 'i-down'));
        ul.appendChild(li);
      });
      s2.appendChild(ul);
    }
    S.appendChild(s2);
    // 3 attendance
    var both = d.attendance.d1 && d.attendance.d2;
    var s3 = step(3, 'Attendance', both ? 'Complete' : '', both ? 'ok' : '');
    var days = el('div', null, 'pt-days');
    [['d1', 'Day 1 · Tue 27 Oct'], ['d2', 'Day 2 · Wed 28 Oct']].forEach(function (x) {
      var box = el('div', null, 'pt-day' + (d.attendance[x[0]] ? ' ok' : ''));
      box.appendChild(el('b', x[1]));
      if (d.attendance[x[0]]) box.appendChild(el('span', '✓ Checked in'));
      else if (d.class.checkin.indexOf(x[0]) > -1) {
        var f = el('form', null, 'pt-checkin'); var inp = el('input'); inp.placeholder = 'Session code on screen'; inp.maxLength = 30; inp.autocomplete = 'off';
        var b = el('button', 'Check in', 'btn btn-gold'); b.type = 'submit';
        f.appendChild(inp); f.appendChild(b);
        f.onsubmit = function (e) { e.preventDefault(); if (!inp.value.trim()) { inp.focus(); return; } b.disabled = true; api('checkin', { method: 'POST', body: { day: x[0], word: inp.value } }).then(function () { msg('You are checked in. Enjoy the class!', true); return load(); }).catch(function (err) { b.disabled = false; msg(err.message); }); };
        box.appendChild(f);
      } else box.appendChild(el('span', 'Check-in opens during the class'));
      days.appendChild(box);
    });
    s3.appendChild(el('p', 'During each class, type the session code shown on screen. Attendance on both days is needed for your certificate.'));
    s3.appendChild(days); S.appendChild(s3);
    // 4 post-test
    var s4 = step(4, 'Post-test', d.post.done ? 'Done · ' + d.post.score + '/' + d.post.total : (d.class.post_open ? 'To do' : 'After Day 2'), d.post.done ? 'ok' : (d.class.post_open ? 'todo' : ''));
    if (d.post.done) {
      var gain = d.pre.done ? d.post.score - d.pre.score : null;
      s4.appendChild(el('p', gain === null ? 'Well done for finishing the class!' : (gain > 0 ? 'You improved by ' + gain + ' point' + (gain === 1 ? '' : 's') + ' since the pre-test. Well done! 🎉' : 'Well done for finishing the class!')));
      s4.appendChild(btn('See my answers', 'btn-plain', function () { openTest('post'); }));
    } else if (d.class.post_open) { s4.appendChild(el('p', 'Fifteen questions to show how much you learned.')); s4.appendChild(btn('Start the post-test', 'btn-navy', function () { openTest('post'); })); }
    else s4.appendChild(el('p', 'Opens at the end of Day 2.'));
    S.appendChild(s4);
    // 5 & 6 coming
    var rv = d.review || {};
    var RVS = { pending: 'Received · waiting for approval', approved: 'Published — thank you!', hidden: 'Received — thank you!' };
    var s5 = step(5, 'Your review', rv.done ? 'Done' : (rv.open ? 'To do' : 'After post-test'), rv.done ? 'ok' : (rv.open ? 'todo' : ''));
    if (rv.done) {
      s5.appendChild(el('p', 'Thank you for your feedback. ' + (RVS[rv.status] || '')));
      if (rv.status !== 'approved') s5.appendChild(btn('Edit my review', 'btn-plain', function () { openReview(); }));
    } else if (rv.open) { s5.appendChild(el('p', 'Tell us about your experience, what you gained, what was missing and how we can improve. It takes about 3 minutes.')); s5.appendChild(btn('Write my review', 'btn-navy', function () { openReview(); })); }
    else s5.appendChild(el('p', 'Tell us about your experience after the class. Opens once you finish the post-test.'));
    S.appendChild(s5);
    // 6 certificate(s)
    var certs = d.certificates || [], e = d.eligible || {};
    var s6 = step(6, 'Certificate', certs.length ? 'Ready 🎓' : '', certs.length ? 'ok' : '');
    if (certs.length) {
      s6.appendChild(el('p', 'Congratulations! View, download (PDF or image) and share your certificate. Anyone can verify it with the QR code.'));
      certs.forEach(function (c) {
        var a = el('a', null, 'btn btn-gold pt-cert'); a.href = '/certificate/?no=' + encodeURIComponent(c.number);
        a.appendChild(icon('i-award')); a.appendChild(document.createTextNode(c.type)); s6.appendChild(a);
      });
    } else {
      s6.appendChild(el('p', 'Your Certificate of Participation appears here automatically when you complete:'));
      var ul = el('ul', null, 'pt-check');
      [['Day 1 attendance', e.d1], ['Day 2 attendance', e.d2], ['Post-test', e.post]].forEach(function (x) { ul.appendChild(el('li', (x[1] ? '✓ ' : '○ ') + x[0], x[1] ? 'ok' : '')); });
      s6.appendChild(ul);
    }
    S.appendChild(s6);
    // 7 30-day challenge
    var ch = d.challenge || {}, U = d.upgrade || {};
    var s7 = step(7, '30-Day Smart Sales Challenge', ch.done ? ch.done + ' / 30 days' : (ch.today >= 1 ? 'Started' : 'Starts ' + niceDate(ch.start)), ch.done >= 25 ? 'ok' : (ch.today >= 1 ? 'todo' : ''));
    s7.appendChild(el('p', 'One small action every day for 30 days, taken from your manual. Tick each day and write one line about what you did.'));
    var bar = el('div', null, 'pt-prog'); var bi = el('i'); bi.style.width = Math.min(100, (ch.done || 0) / 30 * 100) + '%'; bar.appendChild(bi); s7.appendChild(bar);
    s7.appendChild(btn(ch.today >= 1 ? 'Open my challenge' : 'See the 30 tasks', 'btn-navy', function () { openChallenge(); }));
    S.appendChild(s7);
    // 8 practitioner upgrade
    if (d.post.done && d.review.done && (d.class.upgrade_open || U.status !== 'none')) {
      var labels = { none: '₦' + U.fee.toLocaleString(), pending: 'Payment being checked', confirmed: 'Upgrade active', rejected: 'Payment not confirmed' };
      var s8 = step(8, 'Upgrade: Certified Practitioner', labels[U.status], U.status === 'confirmed' ? 'ok' : (U.status === 'pending' ? 'todo' : ''));
      if (U.status === 'confirmed') {
        var pr = { active: 'Complete at least ' + U.need_days + ' challenge days (each with a short note) and your Day 30 Scorecard. We then review your results and issue your Practitioner certificate.', ready: 'Well done! Your results have been sent for review. Your Practitioner certificate will appear above once approved.' }[U.practitioner] || '';
        s8.appendChild(el('p', pr));
      } else if (U.status === 'pending') s8.appendChild(el('p', 'Thank you! We are confirming your payment. Your upgrade becomes active once confirmed.'));
      else {
        s8.appendChild(el('p', (U.status === 'rejected' ? 'We could not confirm your last payment. Please check the details and send again, or message us on WhatsApp. ' : '') + 'Become a Certified AI Customer Growth Practitioner: complete the 30-day challenge with our guidance, show your before-and-after results, and earn a second, higher certificate you can show customers and on LinkedIn.'));
        s8.appendChild(btn('Upgrade for ₦' + U.fee.toLocaleString(), 'btn-gold', function () { openUpgrade(); }));
      }
      S.appendChild(s8);
    }
    // referral card
    var R = d.referral || {};
    var rf = el('div', null, 'pt-step pt-ref');
    var rh = el('div', null, 'pt-step-h'); rh.appendChild(el('span', '🎁', 'pt-num')); rh.appendChild(el('h3', 'Invite a friend, earn a reward')); if (R.confirmed) rh.appendChild(el('span', R.confirmed + ' joined', 'pt-chip ok')); rf.appendChild(rh);
    rf.appendChild(el('p', 'For every friend who enrols and pays with your link, you get 1 extra week of FREE consulting on putting AI to work in your business, plus our Automation Guide.'));
    var link = location.origin + '/?ref=' + R.id + '#register';
    var lk = el('div', null, 'pt-link'); lk.appendChild(el('code', link)); rf.appendChild(lk);
    var ra = el('div', null, 'pt-acts');
    var wa = el('a', null, 'btn btn-wa'); wa.href = 'https://wa.me/?text=' + encodeURIComponent('I am learning to grow my sales with AI at Royalstars Technologies 🚀 Practical, simple and very Nigerian. Next class: ₦15,000 (normally ₦50,000). Enrol with my link 👉 ' + link); wa.target = '_blank'; wa.rel = 'noopener'; wa.appendChild(icon('i-wa')); wa.appendChild(document.createTextNode('Share my link')); ra.appendChild(wa);
    ra.appendChild(btn('Copy link', 'btn-plain', function (ev) { var b = ev.currentTarget; (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { b.lastChild.textContent = 'Copied ✓'; }).catch(function () { window.prompt('Copy your link:', link); }); }));
    rf.appendChild(ra);
    if (R.pending) rf.appendChild(el('p', R.pending + ' friend' + (R.pending > 1 ? 's are' : ' is') + ' waiting for payment confirmation.', 'pt-small'));
    S.appendChild(rf);
    if (!stay) show('pt-dash');
  }

  function download(m, b) {
    var old = b.lastChild.textContent; b.disabled = true; b.lastChild.textContent = 'Preparing your copy…';
    fetch('/api/portal/material?id=' + encodeURIComponent(m.id), { headers: { 'x-access-code': code } })
      .then(function (r) { if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || 'Download failed'); }); return r.blob(); })
      .then(function (blob) {
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        var ext = /pdf/i.test(m.type) ? '.pdf' : ''; a.download = (m.title || 'file').replace(/[^\w\- ]+/g, '').trim() + ext;
        document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
        b.lastChild.textContent = 'Downloaded ✓';
      })
      .catch(function (e) { msg(e.message); b.lastChild.textContent = old; })
      .then(function () { setTimeout(function () { b.disabled = false; b.lastChild.textContent = old; }, 3000); });
  }

  // ---- tests ----
  var CUR = null;
  function openTest(which) {
    msg('');
    api('test?which=' + which).then(function (d) {
      if (d.done) return showResult(d);
      if (!d.open) { msg(d.error || 'This test is not open.'); return; }
      buildTest(d);
    }).catch(function (e) { msg(e.message); });
  }
  function draftKey(which) { return 'rst_draft_' + which + '_' + code; }
  function buildTest(d) {
    CUR = d; var f = $('pt-test'); f.replaceChildren();
    var draft = {}; try { draft = JSON.parse(store(draftKey(d.which)) || '{}'); } catch (e) { draft = {}; }
    var head = el('div', null, 'pt-test-h');
    head.appendChild(el('h2', d.which === 'pre' ? 'Pre-test' : 'Post-test'));
    head.appendChild(el('p', d.which === 'pre' ? 'Choose the best answer for each question. It is okay not to know — this shows us where to help you. You will see the correct answers at the end.' : 'Choose the best answer for each question. You will see your score and the correct answers at the end.'));
    var prog = el('div', null, 'pt-prog'); var bar = el('i'); prog.appendChild(bar); var pt = el('span'); head.appendChild(prog); head.appendChild(pt);
    f.appendChild(head);
    function update() {
      var n = f.querySelectorAll('.pt-q[data-q] input:checked').length; bar.style.width = (n / d.questions.length * 100) + '%'; pt.textContent = n + ' of ' + d.questions.length + ' answered';
      var save = { a: {}, c: {}, b: {} };
      f.querySelectorAll('input:checked').forEach(function (i) { save[i.name.charAt(0)][i.name.slice(2)] = i.value; });
      f.querySelectorAll('[data-b]').forEach(function (i) { if (i.tagName !== 'INPUT' || i.type === 'number') save.b[i.dataset.b] = i.value; });
      store(draftKey(d.which), JSON.stringify(save));
    }
    d.questions.forEach(function (q, i) {
      var fs = el('fieldset', null, 'pt-q'); fs.dataset.q = i;
      var lg = el('legend'); lg.appendChild(el('span', 'Question ' + q.n + ' of ' + d.questions.length, 'pt-qn')); lg.appendChild(el('b', q.q)); fs.appendChild(lg);
      q.o.forEach(function (o) {
        var lab = el('label', null, 'pt-opt'); var r = el('input'); r.type = 'radio'; r.name = 'a_' + i; r.value = o.k;
        if (draft.a && String(draft.a[i]) === String(o.k)) r.checked = true;
        lab.appendChild(r); lab.appendChild(el('span', o.t)); fs.appendChild(lab);
      });
      f.appendChild(fs);
    });
    var cf = el('fieldset', null, 'pt-q pt-conf'); var cl = el('legend'); cl.appendChild(el('b', 'How confident do you feel? (1 = not at all, 5 = very confident)')); cf.appendChild(cl);
    d.confidence.forEach(function (c, i) {
      var row = el('div', null, 'pt-scale'); row.dataset.c = i; row.appendChild(el('span', c));
      var g = el('div', null, 'pt-scale-btns');
      [1, 2, 3, 4, 5].forEach(function (v) { var lab = el('label'); var r = el('input'); r.type = 'radio'; r.name = 'c_' + i; r.value = v; if (draft.c && String(draft.c[i]) === String(v)) r.checked = true; lab.appendChild(r); lab.appendChild(el('span', String(v))); g.appendChild(lab); });
      row.appendChild(g); cf.appendChild(row);
    });
    f.appendChild(cf);
    if (d.baseline) {
      var bf = el('fieldset', null, 'pt-q pt-base'); var bl = el('legend'); bl.appendChild(el('b', 'About your business today')); bl.appendChild(el('span', 'We ask again after 30 days to see your growth. If you are just starting out, put 0.', 'pt-small')); bf.appendChild(bl);
      function num(label, k) { var w = el('label', null, 'pt-in'); w.appendChild(el('span', label)); var i = el('input'); i.type = 'number'; i.min = 0; i.max = 100000; i.inputMode = 'numeric'; i.dataset.b = k; i.value = (draft.b && draft.b[k]) || ''; w.appendChild(i); bf.appendChild(w); }
      function choice(label, k, opts) { var w = el('div', null, 'pt-in'); w.appendChild(el('span', label)); var g = el('div', null, 'pt-pills'); opts.forEach(function (o) { var lab = el('label'); var r = el('input'); r.type = 'radio'; r.name = 'b_' + k; r.value = o[0]; if (draft.b && draft.b[k] === o[0]) r.checked = true; lab.appendChild(r); lab.appendChild(el('span', o[1])); g.appendChild(lab); }); w.appendChild(g); bf.appendChild(w); }
      num('New enquiries per week (people who ask about your product)', 'enquiries');
      num('Sales per week', 'sales');
      choice('Do you know your profit for last month?', 'profit_known', [['yes', 'Yes'], ['no', 'No']]);
      choice('Do you write down every sale?', 'records', [['yes', 'Yes'], ['no', 'No']]);
      choice('How often do you use AI in your business now?', 'ai_use', [['never', 'Never'], ['sometimes', 'Sometimes'], ['often', 'Often']]);
      f.appendChild(bf);
    }
    var sb = el('button', 'Submit my answers', 'btn btn-gold pt-submit'); sb.type = 'submit'; f.appendChild(sb);
    var back = btn('Back to my training', 'btn-plain', function () { show('pt-dash'); }); f.appendChild(back);
    f.onchange = update; f.oninput = update; update();
    f.onsubmit = function (e) {
      e.preventDefault(); msg('');
      f.querySelectorAll('.missing').forEach(function (x) { x.classList.remove('missing'); });
      var answers = [], miss = null;
      d.questions.forEach(function (q, i) { var c = f.querySelector('input[name="a_' + i + '"]:checked'); if (!c) { var fs = f.querySelector('[data-q="' + i + '"]'); fs.classList.add('missing'); miss = miss || fs; } answers.push(c ? Number(c.value) : -1); });
      var conf = d.confidence.map(function (c, i) { var x = f.querySelector('input[name="c_' + i + '"]:checked'); if (!x) { var r = f.querySelector('[data-c="' + i + '"]'); r.classList.add('missing'); miss = miss || r; } return x ? Number(x.value) : 0; });
      var base;
      if (d.baseline) {
        base = {}; f.querySelectorAll('[data-b]').forEach(function (i) { base[i.dataset.b] = i.value; });
        ['profit_known', 'records', 'ai_use'].forEach(function (k) { var x = f.querySelector('input[name="b_' + k + '"]:checked'); base[k] = x ? x.value : ''; if (!x) { var p = f.querySelector('input[name="b_' + k + '"]').closest('.pt-in'); p.classList.add('missing'); miss = miss || p; } });
        ['enquiries', 'sales'].forEach(function (k) { var i = f.querySelector('[data-b="' + k + '"]'); if (i.value === '') { i.closest('.pt-in').classList.add('missing'); miss = miss || i.closest('.pt-in'); } });
      }
      if (miss) { msg('Please answer the questions marked in red.'); miss.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      sb.disabled = true; sb.textContent = 'Submitting…';
      api('test', { method: 'POST', body: { which: d.which, answers: answers, confidence: conf, baseline: base } })
        .then(function (r) { store(draftKey(d.which), null); showResult(r); load(true); })
        .catch(function (err) { sb.disabled = false; sb.textContent = 'Submit my answers'; msg(err.message); });
    };
    show('pt-test');
  }
  function showResult(d) {
    var R = $('pt-result'); R.replaceChildren();
    var top = el('div', null, 'pt-score');
    top.appendChild(el('span', d.which === 'pre' ? 'Pre-test result' : 'Post-test result', 'pt-qn'));
    top.appendChild(el('b', d.score + ' / ' + d.total));
    var pct = d.score / d.total;
    top.appendChild(el('p', d.which === 'pre' ? 'Thank you! This is your starting point — the class will cover every topic below. Your training materials are now open.' : (pct >= 0.7 ? 'Excellent work! You have learned a lot. 🎉' : 'Well done for finishing! Read the correct answers below and look at your manual again.')));
    R.appendChild(top);
    var ul = el('ol', null, 'pt-review');
    d.items.forEach(function (it) {
      var li = el('li', null, it.ok ? 'ok' : 'no');
      var h = el('div', null, 'pt-rh'); h.appendChild(icon(it.ok ? 'i-check' : 'i-x')); h.appendChild(el('b', it.q)); li.appendChild(h);
      if (!it.ok) li.appendChild(el('p', 'Your answer: ' + it.your, 'pt-your'));
      li.appendChild(el('p', 'Correct answer: ' + it.correct, 'pt-correct'));
      ul.appendChild(li);
    });
    R.appendChild(ul);
    R.appendChild(btn('Back to my training', 'btn-navy', function () { load(); }));
    show('pt-result');
  }

  // ---- review ----
  function openReview() {
    msg('');
    api('review').then(function (d) { buildReview(d.review || {}); }).catch(function (e) { msg(e.message); });
  }
  function stars(name, label, val) {
    var row = el('div', null, 'pt-scale'); row.dataset.r = name; row.appendChild(el('span', label));
    var g = el('div', null, 'pt-stars');
    function paint() { var v = Number((g.querySelector('input:checked') || {}).value || 0); g.querySelectorAll('label').forEach(function (l, i) { l.classList.toggle('on', i < v); }); }
    for (var v = 1; v <= 5; v++) { var lab = el('label'); lab.title = v + ' star' + (v > 1 ? 's' : ''); var r = el('input'); r.type = 'radio'; r.name = 'r_' + name; r.value = v; if (Number(val) === v) r.checked = true; r.setAttribute('aria-label', v + ' of 5'); lab.appendChild(r); lab.appendChild(el('span', '★')); g.appendChild(lab); }
    g.onchange = paint; row.appendChild(g); paint(); return row;
  }
  function area(name, label, val, hint, max) {
    var w = el('label', null, 'pt-in pt-area'); w.dataset.t = name; w.appendChild(el('span', label)); if (hint) w.appendChild(el('small', hint, 'pt-small'));
    var t = el('textarea'); t.name = name; t.maxLength = max || 800; t.rows = 3; t.value = val || ''; w.appendChild(t); return w;
  }
  function buildReview(r) {
    var f = $('pt-test'); f.replaceChildren(); f.onchange = null; f.oninput = null;
    var head = el('div', null, 'pt-test-h'); head.appendChild(el('h2', 'Your review'));
    head.appendChild(el('p', 'Your honest feedback helps us make the next class better. Only the public part (if you allow it) is ever shown on the website.'));
    f.appendChild(head);
    var a = el('fieldset', null, 'pt-q'); var lg = el('legend'); lg.appendChild(el('b', 'Your ratings (1 = poor, 5 = excellent)')); a.appendChild(lg);
    var R5 = r.ratings || {};
    a.appendChild(stars('overall', 'Overall experience', r.overall));
    a.appendChild(stars('content', 'Content and materials', R5.content));
    a.appendChild(stars('facilitator', 'The facilitator', R5.facilitator));
    a.appendChild(stars('practical', 'How practical it is for my business', R5.practical));
    a.appendChild(stars('platform', 'Online class and organisation', R5.platform));
    f.appendChild(a);
    var n = el('fieldset', null, 'pt-q'); n.dataset.r = 'nps'; var nl = el('legend'); nl.appendChild(el('b', 'How likely are you to recommend this training to a friend?')); nl.appendChild(el('span', '0 = not at all likely, 10 = very likely', 'pt-small')); n.appendChild(nl);
    var ng = el('div', null, 'pt-scale-btns pt-nps');
    for (var i = 0; i <= 10; i++) { var lab = el('label'); var x = el('input'); x.type = 'radio'; x.name = 'nps'; x.value = i; if (r.nps === i) x.checked = true; lab.appendChild(x); lab.appendChild(el('span', String(i))); ng.appendChild(lab); }
    n.appendChild(ng); f.appendChild(n);
    var t = el('fieldset', null, 'pt-q'); var tl = el('legend'); tl.appendChild(el('b', 'Tell us more')); t.appendChild(tl);
    t.appendChild(area('gain', 'What did you gain? What will you do differently in your business?', r.gain, 'Required'));
    t.appendChild(area('gaps', 'What was missing, unclear or too fast?', r.gaps, 'Optional'));
    t.appendChild(area('suggestions', 'Your suggestions for the next class', r.suggestions, 'Optional'));
    f.appendChild(t);
    var pb = el('fieldset', null, 'pt-q'); var pl = el('legend'); pl.appendChild(el('b', 'Public review (optional)')); pb.appendChild(pl);
    var ck = el('label', null, 'pt-opt'); var cb = el('input'); cb.type = 'checkbox'; cb.name = 'publish_ok'; cb.checked = !!r.publish_ok; ck.appendChild(cb);
    ck.appendChild(el('span', 'You may publish my review on the Royalstars website with my first name, business type and city. (We check every review before it appears.)')); pb.appendChild(ck);
    var tw = area('testimonial', 'Your public review — one or two sentences', r.testimonial, 'e.g. "I used the Price Talk replies the same night and closed two orders."', 400);
    tw.hidden = !cb.checked; cb.onchange = function () { tw.hidden = !cb.checked; }; pb.appendChild(tw);
    f.appendChild(pb);
    var sb = el('button', 'Submit my review', 'btn btn-gold pt-submit'); sb.type = 'submit'; f.appendChild(sb);
    f.appendChild(btn('Back to my training', 'btn-plain', function () { show('pt-dash'); }));
    f.onsubmit = function (e) {
      e.preventDefault(); msg('');
      f.querySelectorAll('.missing').forEach(function (x) { x.classList.remove('missing'); });
      var val = function (nm) { var c = f.querySelector('input[name="' + nm + '"]:checked'); return c ? Number(c.value) : null; };
      var body = { overall: val('r_overall'), ratings: {}, nps: val('nps'), gain: f.elements.gain.value, gaps: f.elements.gaps.value, suggestions: f.elements.suggestions.value, publish_ok: cb.checked, testimonial: f.elements.testimonial.value };
      var miss = null;
      ['overall', 'content', 'facilitator', 'practical', 'platform'].forEach(function (k) { var v = val('r_' + k); if (k !== 'overall') body.ratings[k] = v; if (!v) { var row = f.querySelector('[data-r="' + k + '"]'); row.classList.add('missing'); miss = miss || row; } });
      if (body.nps === null) { n.classList.add('missing'); miss = miss || n; }
      if (body.gain.trim().length < 3) { var g = f.querySelector('[data-t=gain]'); g.classList.add('missing'); miss = miss || g; }
      if (cb.checked && body.testimonial.trim().length < 10) { tw.classList.add('missing'); miss = miss || tw; }
      if (miss) { msg('Please complete the parts marked in red.'); miss.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      sb.disabled = true; sb.textContent = 'Sending…';
      api('review', { method: 'POST', body: body }).then(function () { msg('Thank you! Your review has been received.', true); return load(); })
        .catch(function (err) { sb.disabled = false; sb.textContent = 'Submit my review'; msg(err.message); });
    };
    show('pt-test');
  }

  function niceDate(iso, add) { var d = new Date((iso || '2026-10-29') + 'T12:00:00+01:00'); d.setDate(d.getDate() + (add || 0)); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }

  // ---- 30-day challenge ----
  function openChallenge() { msg(''); api('challenge').then(buildChallenge).catch(function (e) { msg(e.message); }); }
  function buildChallenge(c) {
    var f = $('pt-test'); f.replaceChildren(); f.onsubmit = function (e) { e.preventDefault(); }; f.onchange = null; f.oninput = null;
    var done = Object.keys(c.days || {}).length;
    var head = el('div', null, 'pt-test-h'); head.appendChild(el('h2', '30-Day Smart Sales Challenge'));
    head.appendChild(el('p', c.today >= 1 ? 'Today is day ' + Math.min(c.today, 30) + '. Tick each task when you do it and write one line about what you did. You can catch up on missed days.' : 'The challenge starts on ' + niceDate(c.start) + '. Here are your 30 tasks.'));
    var prog = el('div', null, 'pt-prog'); var bi = el('i'); bi.style.width = (done / 30 * 100) + '%'; prog.appendChild(bi); head.appendChild(prog); head.appendChild(el('span', done + ' of 30 days done · Practitioner needs ' + c.need));
    f.appendChild(head);
    var grid = el('div', null, 'pt-days30');
    c.tasks.forEach(function (t, i) {
      var day = i + 1, rec = (c.days || {})[day], open = day <= c.today;
      var card = el('div', null, 'pt-d' + (rec ? ' ok' : '') + (open ? '' : ' future') + (day === c.today ? ' today' : ''));
      var h = el('div', null, 'pt-dh'); h.appendChild(el('b', 'Day ' + day)); h.appendChild(el('span', niceDate(c.start, i))); card.appendChild(h);
      card.appendChild(el('p', t));
      if (rec) {
        card.appendChild(el('small', '✓ ' + (rec.note || 'Done'), 'pt-note'));
        var u = el('button', 'Edit', 'pt-mini'); u.type = 'button'; u.onclick = function () { edit(); }; card.appendChild(u);
      } else if (open) { var b = el('button', 'Mark as done', 'btn btn-navy pt-mini2'); b.type = 'button'; b.onclick = function () { edit(); }; card.appendChild(b); }
      function edit() {
        card.querySelectorAll('.pt-note,.pt-mini,.pt-mini2,.pt-edit').forEach(function (x) { x.remove(); });
        var w = el('div', null, 'pt-edit'); var ta = el('textarea'); ta.rows = 2; ta.maxLength = 280; ta.placeholder = 'What did you do? e.g. Posted 3 statuses, got 2 enquiries'; ta.value = (rec && rec.note) || '';
        var sv = el('button', 'Save', 'btn btn-gold pt-mini2'); sv.type = 'button';
        sv.onclick = function () { sv.disabled = true; api('challenge', { method: 'POST', body: { kind: 'day', day: day, note: ta.value } }).then(function () { return api('challenge'); }).then(buildChallenge).catch(function (e) { sv.disabled = false; msg(e.message); }); };
        w.appendChild(ta); w.appendChild(sv);
        if (rec) { var rm = el('button', 'Untick', 'pt-mini'); rm.type = 'button'; rm.onclick = function () { api('challenge', { method: 'POST', body: { kind: 'day', day: day, done: false } }).then(function () { return api('challenge'); }).then(buildChallenge).catch(function (e) { msg(e.message); }); }; w.appendChild(rm); }
        card.appendChild(w); ta.focus();
      }
      grid.appendChild(card);
    });
    f.appendChild(grid);
    // Day 30 scorecard
    var sc = el('fieldset', null, 'pt-q pt-base'); var lg = el('legend'); lg.appendChild(el('b', 'Day 30 Sales Scorecard')); sc.appendChild(lg);
    if (c.day30) { sc.appendChild(el('p', '✓ Submitted. Thank you — this shows how much your business has grown.', 'pt-small')); }
    else if (c.today >= 28 || done >= c.need) {
      sc.appendChild(el('span', 'Compare with Day 1. Use your real numbers — honest numbers help us help you.', 'pt-small'));
      function num(label, k) { var w = el('label', null, 'pt-in'); w.appendChild(el('span', label)); var i = el('input'); i.type = 'number'; i.min = 0; i.inputMode = 'numeric'; i.name = k; w.appendChild(i); sc.appendChild(w); }
      function choice(label, k, opts) { var w = el('div', null, 'pt-in'); w.appendChild(el('span', label)); var g = el('div', null, 'pt-pills'); opts.forEach(function (o) { var lab = el('label'); var r = el('input'); r.type = 'radio'; r.name = k; r.value = o[0]; lab.appendChild(r); lab.appendChild(el('span', o[1])); g.appendChild(lab); }); w.appendChild(g); sc.appendChild(w); }
      num('New enquiries per week now', 'enquiries'); num('Sales per week now', 'sales'); num('Customers who bought again this month', 'repeat_customers'); num('Google reviews you have now', 'google_reviews'); num('Your AI Check Score now (0–10)', 'ai_score');
      choice('Do you know your profit for last month?', 'profit_known', [['yes', 'Yes'], ['no', 'No']]);
      choice('Do you write down every sale?', 'records', [['yes', 'Yes'], ['no', 'No']]);
      choice('How often do you use AI in your business now?', 'ai_use', [['never', 'Never'], ['sometimes', 'Sometimes'], ['often', 'Often']]);
      var rw = el('label', null, 'pt-in pt-area'); rw.appendChild(el('span', 'Your biggest result in 30 days')); var rt = el('textarea'); rt.name = 'result'; rt.rows = 3; rt.maxLength = 800; rw.appendChild(rt); sc.appendChild(rw);
      var sb = el('button', 'Submit my Day 30 Scorecard', 'btn btn-gold pt-submit'); sb.type = 'button';
      sb.onclick = function () {
        var g = function (n) { var x = f.querySelector('[name="' + n + '"]:checked') || f.querySelector('[name="' + n + '"]'); return x ? x.value : ''; };
        if (g('enquiries') === '' || g('sales') === '') { msg('Please fill in at least your enquiries and sales per week.'); return; }
        sb.disabled = true;
        api('challenge', { method: 'POST', body: { kind: 'day30', enquiries: g('enquiries'), sales: g('sales'), repeat_customers: g('repeat_customers'), google_reviews: g('google_reviews'), ai_score: g('ai_score'), profit_known: (f.querySelector('[name=profit_known]:checked') || {}).value, records: (f.querySelector('[name=records]:checked') || {}).value, ai_use: (f.querySelector('[name=ai_use]:checked') || {}).value, result: rt.value } })
          .then(function () { msg('Scorecard submitted. Well done!', true); return api('challenge'); }).then(buildChallenge).catch(function (e) { sb.disabled = false; msg(e.message); });
      };
      sc.appendChild(sb);
    } else sc.appendChild(el('p', 'Opens on day 28 of the challenge (' + niceDate(c.start, 27) + ').', 'pt-small'));
    f.appendChild(sc);
    f.appendChild(btn('Back to my training', 'btn-plain', function () { load(); }));
    show('pt-test');
  }

  // ---- practitioner upgrade ----
  function shrinkToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return resolve('');
      if (file.type === 'application/pdf') { if (file.size > 2.5 * 1048576) return reject(new Error('PDF receipt must be under 2.5 MB.')); var fr = new FileReader(); fr.onload = function () { resolve(fr.result); }; fr.onerror = reject; return fr.readAsDataURL(file); }
      if (!/^image\//.test(file.type) || !window.createImageBitmap) return reject(new Error('Please choose a photo/screenshot or a PDF.'));
      createImageBitmap(file).then(function (bmp) { var sc = Math.min(1, 1400 / Math.max(bmp.width, bmp.height)); var cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * sc); cv.height = Math.round(bmp.height * sc); cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height); resolve(cv.toDataURL('image/jpeg', 0.75)); }).catch(reject);
    });
  }
  function openUpgrade() {
    var U = ME.upgrade, f = $('pt-test'); f.replaceChildren(); f.onchange = null; f.oninput = null; msg('');
    var head = el('div', null, 'pt-test-h'); head.appendChild(el('h2', 'Upgrade to Certified Practitioner'));
    head.appendChild(el('p', 'Fee: ₦' + U.fee.toLocaleString() + '. Transfer first, then fill this form. We confirm your payment and activate your upgrade.')); f.appendChild(head);
    var info = el('fieldset', null, 'pt-q'); var il = el('legend'); il.appendChild(el('b', 'What you get')); info.appendChild(il);
    var ul = el('ul', null, 'pt-check'); ['Guided 30-Day Smart Sales Challenge with daily tracking', 'Review of your Day 1 vs Day 30 business results', 'Certified AI Customer Growth Practitioner certificate (verifiable, with QR code)', 'Requirement: at least ' + U.need_days + ' of 30 days done, each with a short note, plus your Day 30 Scorecard'].forEach(function (t) { ul.appendChild(el('li', '✓ ' + t, 'ok')); });
    info.appendChild(ul); f.appendChild(info);
    var bank = el('fieldset', null, 'pt-q pt-bank'); var bl = el('legend'); bl.appendChild(el('b', 'Pay by bank transfer')); bank.appendChild(bl);
    [['Account name', U.bank.account_name], ['Bank', U.bank.bank], ['Account number', U.bank.account_number], ['Amount', '₦' + U.fee.toLocaleString()]].forEach(function (x) { var r = el('div', null, 'pt-bk'); r.appendChild(el('span', x[0])); r.appendChild(el('b', x[1])); bank.appendChild(r); });
    var cp = btn('Copy account number', 'btn-plain', function () { (navigator.clipboard ? navigator.clipboard.writeText(U.bank.account_number) : Promise.reject()).then(function () { cp.lastChild.textContent = 'Copied ✓'; }).catch(function () { window.prompt('Copy:', U.bank.account_number); }); }); bank.appendChild(cp);
    f.appendChild(bank);
    var fm = el('fieldset', null, 'pt-q pt-base'); var fl = el('legend'); fl.appendChild(el('b', 'Your payment details')); fm.appendChild(fl);
    function inp(label, name, type, val) { var w = el('label', null, 'pt-in'); w.appendChild(el('span', label)); var i = el('input'); i.type = type || 'text'; i.name = name; if (val != null) i.value = val; i.style.maxWidth = '100%'; i.className = 'pt-text'; w.appendChild(i); fm.appendChild(w); return i; }
    inp('Name on the account you paid from', 'sender_name');
    inp('Amount paid (₦)', 'amount', 'number', U.fee);
    var today = new Date(); inp('Date of transfer', 'payment_date', 'date', new Date(today.getTime() - today.getTimezoneOffset() * 6e4).toISOString().slice(0, 10));
    inp('Transaction reference (optional)', 'payment_ref');
    var rc = inp('Receipt or screenshot (optional, image or PDF)', 'receipt', 'file'); rc.accept = 'image/*,application/pdf';
    f.appendChild(fm);
    var sb = el('button', 'Submit my upgrade', 'btn btn-gold pt-submit'); sb.type = 'submit'; f.appendChild(sb);
    f.appendChild(btn('Back to my training', 'btn-plain', function () { show('pt-dash'); }));
    f.onsubmit = function (e) {
      e.preventDefault(); msg('');
      var v = function (n) { return f.elements[n].value.trim(); };
      if (v('sender_name').length < 2 || !(Number(v('amount')) > 0) || !v('payment_date')) { msg('Please fill in the name on the account, the amount and the date.'); return; }
      sb.disabled = true; sb.textContent = 'Sending…';
      shrinkToDataUrl(rc.files[0]).then(function (data) {
        return api('upgrade', { method: 'POST', body: { sender_name: v('sender_name'), amount: v('amount'), payment_date: v('payment_date'), payment_ref: v('payment_ref'), receipt: data } });
      }).then(function () { msg('Thank you! We will confirm your payment and activate your upgrade.', true); return load(); })
        .catch(function (err) { sb.disabled = false; sb.textContent = 'Submit my upgrade'; msg(err.message); });
    };
    show('pt-test');
  }

  // ---- start ----
  var q = new URLSearchParams(location.search).get('c');
  if (q) { history.replaceState(null, '', location.pathname); if (norm(q)) store(KEY, norm(q)); }
  code = store(KEY) || '';
  if (code) load(); else show('pt-login');
})();
