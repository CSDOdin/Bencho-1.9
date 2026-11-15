(() => {
  'use strict';
  const root = document.getElementById('legal-editable-content');
  const slug = document.body.dataset.legalPage;
  if (!root || !['privacidad','cookies','terminos','eliminar-datos'].includes(slug)) return;
  function render(body) {
    const fragment = document.createDocumentFragment();
    String(body).split(/\n\s*\n/).forEach(paragraph => {
      const text = paragraph.trim();
      if (!text) return;
      const isHeading = text.startsWith('## ');
      const el = document.createElement(isHeading ? 'h2' : 'p');
      el.textContent = isHeading ? text.slice(3).trim() : text;
      if (!isHeading) el.className = 'legal-copy-paragraph';
      fragment.append(el);
    });
    if (fragment.childNodes.length) root.replaceChildren(fragment);
  }
  fetch('/api/config', { cache: 'no-store' }).then(response => {
    if (!response.ok) throw new Error('No se pudo cargar la configuración.');
    return response.json();
  }).then(config => {
    const page = config.legalPages?.[slug];
    if (page && typeof page.title === 'string' && typeof page.body === 'string') {
      document.getElementById('legal-page-title').textContent = page.title;
      document.title = page.title + ' | ' + document.body.dataset.siteName;
      render(page.body);
    }
    const r = config.restaurant || {};
    const phone = String(r.whatsapp || '').replace(/\D/g,'');
    if (/^\d{8,15}$/.test(phone)) document.querySelectorAll('[data-privacy-contact]').forEach(a=>a.href='https://wa.me/'+phone);
  }).catch(() => { /* El texto inicial continúa visible si no hay conexión. */ });
})();

