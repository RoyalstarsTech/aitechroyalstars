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

  // ---- registration form ----
  var form = document.getElementById('reg-form');
  if (!form) return;
  var msg = document.getElementById('f-msg'), btn = document.getElementById('f-submit');
  var phoneOk = function (v) { var d = v.replace(/[^\d+]/g, ''); return /^(\+?234|0)[789]\d{9}$/.test(d) || /^\+?\d{10,15}$/.test(d); };
  var emailOk = function (v) { return !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); };
  function check() {
    var ok = true;
    var rules = { full_name: function (v) { return v.trim().length >= 3; }, phone: phoneOk, email: emailOk, business_type: function (v) { return !!v; }, location: function (v) { return v.trim().length >= 2; } };
    Object.keys(rules).forEach(function (n) {
      var f = form.elements[n], wrap = form.querySelector('[data-f="' + n + '"]');
      var good = rules[n](f.value); wrap.classList.toggle('bad', !good); if (!good && ok) { f.focus(); } ok = ok && good;
    });
    if (ok && !form.elements.consent.checked) { msg.textContent = 'Please tick the consent box so we can contact you about the training.'; msg.style.display = 'block'; ok = false; }
    return ok;
  }
  form.addEventListener('input', function (e) { var w = e.target.closest('.field'); if (w) w.classList.remove('bad'); msg.style.display = 'none'; });
  form.addEventListener('submit', function (e) {
    e.preventDefault(); msg.style.display = 'none';
    if (!check()) return;
    btn.disabled = true; btn.textContent = 'Submitting…';
    var data = new URLSearchParams(new FormData(form)).toString();
    fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: data })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); })
      .then(function () {
        window.track('generate_lead', { form: 'registration', business_type: form.elements.business_type.value });
        form.style.display = 'none';
        var ok = document.getElementById('reg-success'); ok.style.display = 'block';
        ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
        window.siteSettings.then(function (S) {
          var url = S.whatsapp_group;
          if (!url) { document.getElementById('wa-auto').textContent = ''; return; }
          setTimeout(function () { window.location.href = url; }, 2500);
        });
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = 'Register & join WhatsApp group';
        msg.innerHTML = 'Sorry, something went wrong. Please try again, or join the <a class="js-wa" target="_blank" rel="noopener" href="' + ((window.SITE_CONFIG || {}).WHATSAPP_GROUP || '#') + '">WhatsApp group</a> directly.';
        msg.style.display = 'block';
      });
  });
})();
