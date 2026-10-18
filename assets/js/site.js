/* Shared site behaviour: settings, links, socials, consent-gated analytics */
(function () {
  var C = window.SITE_CONFIG || {};
  var S = { cohort_name: C.COHORT_NAME, cohort_start: C.COHORT_START, whatsapp_group: C.WHATSAPP_GROUP, cohort_note: '' };

  // ---- settings: admin values (from /api/settings) override config.js ----
  window.siteSettings = fetch('/api/settings', { headers: { accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .catch(function () { return {}; })
    .then(function (remote) {
      Object.keys(remote || {}).forEach(function (k) { if (remote[k]) S[k] = remote[k]; });
      applyLinks(); return S;
    });

  function applyLinks() {
    document.querySelectorAll('.js-wa').forEach(function (a) { a.href = S.whatsapp_group || '#register'; });
  }
  applyLinks();

  // ---- contact details ----
  if (C.PHONE) document.querySelectorAll('.js-tel').forEach(function (a) { a.textContent = C.PHONE; a.href = 'tel:+' + (C.PHONE_INTL || C.PHONE); });
  if (C.EMAIL) document.querySelectorAll('.js-mail').forEach(function (a) { a.textContent = C.EMAIL; a.href = 'mailto:' + C.EMAIL; });
  if (C.LOCATION) document.querySelectorAll('.js-loc').forEach(function (el) { el.textContent = C.LOCATION; });
  var yr = document.getElementById('yr'); if (yr) yr.textContent = new Date().getFullYear();

  // ---- social icons (placeholders until links are added in config.js) ----
  var box = document.getElementById('socials');
  if (box) {
    var names = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn', x: 'X (Twitter)', youtube: 'YouTube' };
    Object.keys(names).forEach(function (k) {
      var url = (C.SOCIAL || {})[k];
      var a = document.createElement('a');
      a.setAttribute('aria-label', names[k] + (url ? '' : ' (coming soon)'));
      a.title = url ? names[k] : names[k] + ' — coming soon';
      if (url) { a.href = url; a.target = '_blank'; a.rel = 'noopener'; } else { a.href = '#'; a.className = 'pending'; a.addEventListener('click', function (e) { e.preventDefault(); }); }
      a.innerHTML = '<svg aria-hidden="true"><use href="#s-' + k + '"/></svg>';
      box.appendChild(a);
    });
  }

  // ---- analytics: loaded ONLY after the visitor accepts ----
  var KEY = 'rst_consent';
  function getConsent() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setConsent(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  var loaded = false;
  function loadAnalytics() {
    if (loaded) return; loaded = true;
    if (C.GA_MEASUREMENT_ID) {
      var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(C.GA_MEASUREMENT_ID); document.head.appendChild(s);
      window.dataLayer = window.dataLayer || []; window.gtag = function () { dataLayer.push(arguments); };
      gtag('js', new Date()); gtag('config', C.GA_MEASUREMENT_ID, { anonymize_ip: true });
    }
    if (C.META_PIXEL_ID) {
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', C.META_PIXEL_ID); fbq('track', 'PageView');
    }
  }
  // public helper for conversion events
  window.track = function (event, params) {
    try {
      if (window.gtag) gtag('event', event, params || {});
      if (window.fbq) { if (event === 'generate_lead') fbq('track', 'Lead', params || {}); else if (event === 'join_whatsapp') fbq('track', 'Contact'); else fbq('trackCustom', event, params || {}); }
    } catch (e) {}
  };
  var anyTracking = C.GA_MEASUREMENT_ID || C.META_PIXEL_ID;
  var bar = document.getElementById('consent-bar');
  if (anyTracking) {
    var c = getConsent();
    if (c === 'yes') loadAnalytics();
    else if (c !== 'no' && bar) bar.classList.add('show');
  }
  if (bar) {
    document.getElementById('c-yes').onclick = function () { setConsent('yes'); bar.classList.remove('show'); loadAnalytics(); };
    document.getElementById('c-no').onclick = function () { setConsent('no'); bar.classList.remove('show'); };
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    if (a.classList.contains('js-wa')) window.track('join_whatsapp', { location: a.dataset.cta || 'link' });
    else if (a.dataset.cta) window.track('cta_click', { location: a.dataset.cta });
  });
})();
