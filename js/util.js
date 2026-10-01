/* Petits utilitaires partagés */
const JT = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // localStorage peut être indisponible (navigation privée, etc.) : on ne plante jamais.
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignoré */ }
    },
  };

  function goTab(name) {
    $$('.tab').forEach((t) => t.classList.toggle('active', t.id === 'tab-' + name));
    $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    window.scrollTo({ top: 0 });
  }

  function flash(btn, text) {
    if (!btn) return;
    const old = btn.textContent;
    btn.textContent = text;
    setTimeout(() => { btn.textContent = old; }, 1600);
  }

  function copy(text, btn) {
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); flash(btn, 'Copié ✓'); } catch (e) { flash(btn, 'Échec de la copie'); }
      ta.remove();
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => flash(btn, 'Copié ✓'), fallback);
    } else fallback();
  }

  return { $, $$, esc, store, goTab, copy, flash };
})();
