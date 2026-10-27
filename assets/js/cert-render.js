/* Draws a Royalstars certificate on a canvas and exports it as JPG or PDF (no server needed).
   Needs /assets/js/vendor/qrcode.js loaded first. */
window.RST_CERT = (function () {
  var W = 2479, H = 1754, cache = {};
  function img(src) {
    if (!cache[src]) cache[src] = new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
    return cache[src];
  }
  function fonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var t = new Promise(function (r) { setTimeout(r, 2500); });
    return Promise.race([Promise.all([document.fonts.load('italic 700 100px "Playfair Display"'), document.fonts.load('500 30px Poppins')]), t]).catch(function () {});
  }
  function fmtDate(s) {
    var d = s ? new Date(s + (String(s).length === 10 ? 'T12:00:00' : '')) : new Date();
    if (isNaN(d)) return s || '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function render(canvas, o) {
    canvas.width = W; canvas.height = H;
    var practitioner = /prac/i.test(o.type_key || o.type || '');
    return Promise.all([img(practitioner ? '/assets/img/cert-prac.jpg' : '/assets/img/cert-part.jpg'), img('/assets/img/signature.png'), fonts()]).then(function (r) {
      var c = canvas.getContext('2d'), bg = r[0], sig = r[1];
      c.drawImage(bg, 0, 0, W, H);
      // participant name — shrink to fit
      var name = String(o.name || 'Participant Name').trim(), size = 132;
      c.fillStyle = '#0A1A5C'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      do { c.font = 'italic 700 ' + size + 'px "Playfair Display", Georgia, "Times New Roman", serif'; size -= 4; } while (c.measureText(name).width > 1640 && size > 50);
      c.fillText(name, W / 2, 925);
      // signature above the left line
      var sh = 245, sw = sig.width * (sh / sig.height);
      if (sw > 560) { sw = 560; sh = sig.height * (sw / sig.width); }
      c.drawImage(sig, 646 - sw / 2, 1372 - sh + 18, sw, sh);
      // number and date
      c.font = '500 31px Poppins, Arial, sans-serif'; c.fillStyle = '#5A6480';
      c.textAlign = 'left'; c.fillText('Certificate No: ' + (o.number || 'RST-AICG-2026-000-XXXX'), 329, 1572);
      c.textAlign = 'right'; c.fillText('Date: ' + fmtDate(o.issued), 2150, 1572);
      // QR code to the verify page
      if (window.qrcode && o.verifyUrl) {
        var q = window.qrcode(0, 'M'); q.addData(o.verifyUrl); q.make();
        var n = q.getModuleCount(), box = 176, x0 = 176, y0 = 168, cell = box / n;
        c.fillStyle = '#fff'; c.fillRect(x0 - 12, y0 - 12, box + 24, box + 24);
        c.fillStyle = '#0A1A5C';
        for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (q.isDark(y, x)) c.fillRect(Math.floor(x0 + x * cell), Math.floor(y0 + y * cell), Math.ceil(cell), Math.ceil(cell));
        c.font = '600 21px Poppins, Arial, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#5A6480';
        c.fillText('Scan to verify', x0 + box / 2, y0 + box + 40);
      }
      return canvas;
    });
  }
  function jpegBlob(canvas) { return new Promise(function (r) { canvas.toBlob(r, 'image/jpeg', 0.92); }); }
  // Minimal one-page PDF (A4 landscape) holding the JPEG.
  function pdfBlob(canvas) {
    return jpegBlob(canvas).then(function (b) { return b.arrayBuffer(); }).then(function (buf) {
      var jpg = new Uint8Array(buf), enc = new TextEncoder(), parts = [], len = 0, offs = [];
      function add(x) { var u = typeof x === 'string' ? enc.encode(x) : x; parts.push(u); len += u.length; }
      function obj(n, body) { offs[n] = len; add(n + ' 0 obj\n'); body(); add('\nendobj\n'); }
      var content = 'q 842 0 0 595 0 0 cm /Im0 Do Q';
      add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
      obj(1, function () { add('<< /Type /Catalog /Pages 2 0 R >>'); });
      obj(2, function () { add('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'); });
      obj(3, function () { add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>'); });
      obj(4, function () { add('<< /Type /XObject /Subtype /Image /Width ' + canvas.width + ' /Height ' + canvas.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n'); add(jpg); add('\nendstream'); });
      obj(5, function () { add('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream'); });
      obj(6, function () { add('<< /Title (Royalstars Certificate) /Producer (Royalstars Technologies Ltd.) >>'); });
      var xref = len, s = 'xref\n0 7\n0000000000 65535 f \n';
      for (var i = 1; i <= 6; i++) s += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
      add(s + 'trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n' + xref + '\n%%EOF');
      return new Blob(parts, { type: 'application/pdf' });
    });
  }
  function save(blob, filename) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  function fileName(o, ext) { return ('Certificate ' + (o.name || '') + ' ' + (o.number || '')).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') + '.' + ext; }
  function download(canvas, o, kind) { return (kind === 'pdf' ? pdfBlob(canvas) : jpegBlob(canvas)).then(function (b) { save(b, fileName(o, kind === 'pdf' ? 'pdf' : 'jpg')); }); }
  return { render: render, download: download, jpegBlob: jpegBlob, pdfBlob: pdfBlob, fmtDate: fmtDate };
})();
