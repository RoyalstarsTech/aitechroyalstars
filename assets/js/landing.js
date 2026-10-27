/* Landing page: cohort info, countdown, registration form */
(function () {
  // ---- reveal on scroll ----
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: .12 }) : null;
  document.querySelectorAll('.reveal').forEach(function (el) { io ? io.observe(el) : el.classList.add('in'); });

  // ---- cohort + countdown ----
  var timer;
  window.siteSettings.then(function (S) {
    var nameEl = document.getElementById('cohort-name'), dateEl = document.getElementById('cohort-date'), noteEl = document.getElementById('cohort-note');
    if (S.cohort_name) { nameEl.textContent = S.cohort_name; document.getElementById('f-cohort').value = S.cohort_name; }
    if (S.cohort_note) noteEl.textContent = S.cohort_note;
    var start = S.cohort_start ? new Date(S.cohort_start) : null;
    if (start && !isNaN(start) && start > new Date()) {
      dateEl.textContent = start.toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' }) +
        ' · ' + start.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' }) + ' (WAT)';
      var cd = document.getElementById('countdown'); cd.hidden = false;
      var tick = function () {
        var ms = start - new Date(); if (ms <= 0) { clearInterval(timer); cd.hidden = true; return; }
        var d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
        cd.querySelector('[data-u=d]').textContent = d; cd.querySelector('[data-u=h]').textContent = h; cd.querySelector('[data-u=m]').textContent = m;
      };
      tick(); timer = setInterval(tick, 30000);
    }
  });

  // ---- live seat counter (confirmed participants only) ----
  window.siteSettings.then(function (S) {
    var C = window.SITE_CONFIG || {};
    var cohort = S.cohort_name || C.COHORT_NAME || '';
    return fetch('/api/stats?cohort=' + encodeURIComponent(cohort)).then(function (r) { return r.json(); });
  }).then(function (d) {
    if (!d || typeof d.confirmed !== 'number') return;
    var left = d.early_left, total = d.early_total || 15, parts = [];
    if (d.confirmed >= 3) parts.push(d.confirmed + ' participants confirmed');
    parts.push(left > 0 ? (left === 1 ? 'Only 1 early-bird spot left!' : 'Only ' + left + ' of ' + total + ' early-bird spots left') : 'Early-bird spots are all taken — seats still open');
    document.getElementById('seat-text').textContent = parts.join(' · ');
    document.getElementById('seat-count').hidden = false;
    document.querySelectorAll('.js-eb-left').forEach(function (el) {
      el.textContent = left > 0 ? '⏳ ' + left + ' of ' + total + ' early-bird spots left.' : 'All early-bird spots have been taken.';
      el.hidden = false;
    });
  }).catch(function () {});

  // ---- referral link (?ref=ABC123) — remembered for 30 days ----
  (function () {
    var r = (new URLSearchParams(location.search).get('ref') || '').toUpperCase();
    try {
      if (/^[A-F0-9]{6}$/.test(r)) localStorage.setItem('rst_ref', JSON.stringify({ r: r, t: Date.now() }));
      var s = JSON.parse(localStorage.getItem('rst_ref') || 'null');
      if (s && Date.now() - s.t < 30 * 864e5) { var f = document.getElementById('f-referral'); if (f) f.value = s.r; }
    } catch (e) { if (/^[A-F0-9]{6}$/.test(r)) { var g = document.getElementById('f-referral'); if (g) g.value = r; } }
  })();

  // ---- copy buttons ----
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.getAttribute('data-copy');
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { b.textContent = 'Copied ✓'; setTimeout(function () { b.textContent = 'Copy'; }, 1800); })
        .catch(function () { window.prompt('Copy the account number:', t); });
    });
  });

  // ---- enrollment form ----
  var form = document.getElementById('reg-form');
  if (!form) return;
  var msg = document.getElementById('f-msg'), btn = document.getElementById('f-submit');
  var today = new Date(); var pd = form.elements.payment_date;
  if (pd && !pd.value) pd.value = new Date(today.getTime() - today.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  var phoneOk = function (v) { var d = v.replace(/[^\d+]/g, ''); return /^(\+?234|0)[789]\d{9}$/.test(d) || /^\+?\d{10,15}$/.test(d); };
  var emailOk = function (v) { return !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); };
  function fileOk() {
    var f = form.elements.proof.files[0]; if (!f) return true;
    if (/^image\//.test(f.type)) return true;
    return f.type === 'application/pdf' && f.size <= 3 * 1024 * 1024;
  }
  function check() {
    var ok = true;
    var rules = {
      full_name: function (v) { return v.trim().length >= 3; }, phone: phoneOk, email: emailOk,
      participant_type: function (v) { return !!v; }, business_type: function (v) { return !!v; }, location: function (v) { return v.trim().length >= 2; },
      sender_name: function (v) { return v.trim().length >= 2; }, amount_paid: function (v) { return Number(v) > 0; }, payment_date: function (v) { return !!v; }
    };
    Object.keys(rules).forEach(function (n) {
      var f = form.elements[n], wrap = form.querySelector('[data-f="' + n + '"]');
      var good = rules[n](f.value); wrap.classList.toggle('bad', !good); if (!good && ok) f.focus(); ok = ok && good;
    });
    var pf = form.querySelector('[data-f="proof"]'); var fgood = fileOk(); pf.classList.toggle('bad', !fgood); ok = ok && fgood;
    if (ok && !form.elements.paid_confirm.checked) { msg.textContent = 'Please confirm that you have made the transfer.'; msg.style.display = 'block'; ok = false; }
    else if (ok && !form.elements.consent.checked) { msg.textContent = 'Please tick the consent box so we can contact you about the training.'; msg.style.display = 'block'; ok = false; }
    return ok;
  }
  // shrink large photos so uploads stay small and fast on mobile data
  function shrink(file) {
    return new Promise(function (resolve) {
      if (!file || !/^image\//.test(file.type) || file.size < 350 * 1024 || !window.createImageBitmap) return resolve(file);
      createImageBitmap(file).then(function (bmp) {
        var max = 1400, sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
        var c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
        c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        c.toBlob(function (b) { resolve(b ? new File([b], (file.name || 'receipt').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : file); }, 'image/jpeg', 0.72);
      }).catch(function () { resolve(file); });
    });
  }
  form.addEventListener('input', function (e) { var w = e.target.closest('.field'); if (w) w.classList.remove('bad'); msg.style.display = 'none'; });
  form.addEventListener('submit', function (e) {
    e.preventDefault(); msg.style.display = 'none';
    if (!check()) return;
    btn.disabled = true; btn.textContent = 'Submitting…';
    var fd = new FormData(form);
    shrink(form.elements.proof.files[0]).then(function (f) {
      if (f) fd.set('proof', f, f.name || 'receipt.jpg'); else fd.delete('proof');
      return fetch('/', { method: 'POST', body: fd });
    }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); })
      .then(function () {
        window.track('generate_lead', { form: 'enrollment', value: Number(form.elements.amount_paid.value) || 0, currency: 'NGN' });
        var name = form.elements.full_name.value.trim();
        document.getElementById('s-name').textContent = name;
        var C = window.SITE_CONFIG || {};
        var text = 'Hello Royalstars, I just enrolled for Grow Your Sales with AI Skills (Cohort 1).\nName: ' + name +
          '\nPhone: ' + form.elements.phone.value.trim() + '\nAmount: ₦' + form.elements.amount_paid.value +
          '\nPaid from: ' + form.elements.sender_name.value.trim() + '\nDate: ' + form.elements.payment_date.value + '\nHere is my payment receipt:';
        document.getElementById('s-receipt').href = 'https://wa.me/' + (C.PHONE_INTL || '2347039106808') + '?text=' + encodeURIComponent(text);
        var share = 'I just enrolled for *Grow Your Sales with AI Skills* by Royalstars Technologies 🚀\n\nLive online class: Tue 27 & Wed 28 October, 5–8 PM. You learn to use AI to find customers, sell more and keep proper records.\n\nIt is ₦15,000 now (normally ₦50,000), and the first 15 confirmed get 6 months FREE Google Gemini AI. Join me 👉 ' + location.origin + '/?ref=share#register';
        var sh = document.getElementById('s-share');
        if (sh) { sh.href = 'https://wa.me/?text=' + encodeURIComponent(share); sh.onclick = function () { window.track('share', { method: 'whatsapp', content_type: 'enrollment' }); }; }
        form.style.display = 'none';
        var ok = document.getElementById('reg-success'); ok.style.display = 'block';
        ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = 'Submit my enrollment';
        var C = window.SITE_CONFIG || {};
        msg.innerHTML = 'Sorry, something went wrong. Please try again, or send your name and payment receipt on WhatsApp to <a target="_blank" rel="noopener" href="https://wa.me/' + (C.PHONE_INTL || '2347039106808') + '">' + (C.PHONE || '07039106808') + '</a>.';
        msg.style.display = 'block';
      });
  });
})();
