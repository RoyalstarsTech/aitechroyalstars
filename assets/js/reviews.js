/* Public reviews: renders approved reviews (textContent only). Used on /reviews/ and the home page. */
window.RST_REVIEWS = (function () {
  function el(tag, text, cls) { var n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; }
  function stars(n) { var s = el('span', '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n), 'rv-st'); s.setAttribute('aria-label', n + ' out of 5 stars'); return s; }
  function card(r) {
    var c = el('figure', null, 'rv-card');
    c.appendChild(stars(r.overall));
    c.appendChild(el('blockquote', '“' + r.testimonial + '”'));
    var cap = el('figcaption'); var av = el('span', (r.first || '?').charAt(0).toUpperCase(), 'rv-av'); cap.appendChild(av);
    var who = el('span'); who.appendChild(el('b', r.first)); who.appendChild(el('small', [r.business_type, r.location].filter(Boolean).join(' · ') || 'Participant')); cap.appendChild(who);
    c.appendChild(cap); return c;
  }
  function load(box, opts) {
    opts = opts || {};
    return fetch('/api/reviews').then(function (r) { return r.json(); }).then(function (d) {
      var items = d.items || [];
      if (opts.home) {
        var f = items.filter(function (x) { return x.featured; }); items = (f.length ? f : items).slice(0, 3);
        if (!items.length) return d;
        if (opts.section) opts.section.hidden = false;
      }
      if (!items.length) { box.replaceChildren(el('p', 'Reviews from our first participants will appear here soon.', 'rv-empty')); return d; }
      box.replaceChildren.apply(box, items.map(card));
      if (opts.summary && d.ratings) {
        var s = opts.summary; s.replaceChildren();
        s.appendChild(el('b', d.average.toFixed(1))); s.appendChild(stars(Math.round(d.average)));
        s.appendChild(el('span', d.ratings + ' rating' + (d.ratings === 1 ? '' : 's') + (d.recommend_pct ? ' · ' + d.recommend_pct + '% would recommend' : '')));
        s.hidden = false;
      }
      return d;
    }).catch(function () { if (!opts.home) box.replaceChildren(el('p', 'Reviews could not load right now. Please try again later.', 'rv-empty')); });
  }
  return { load: load };
})();
