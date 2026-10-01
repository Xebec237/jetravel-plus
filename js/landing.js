/* Animations de la landing page : apparition au défilement, compteurs, cartes interactives */
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('js');

  // Section « Nouveautés IRCC 2026 », générée depuis js/data.js
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function renderNews(news) {
    document.getElementById('lp-cats').innerHTML = CATEGORIES_2026.map((c) => `
      <li><span class="cat-name">${c.name}</span>${c.isNew ? '<span class="cat-new">Nouveau</span>' : ''}</li>`).join('');
    const seen = new Set();
    const latest = DRAWS.filter((d) => !seen.has(d.key) && seen.add(d.key)).slice(0, 7);
    const max = Math.max(...latest.map((d) => d.crs));
    document.getElementById('lp-draws-date').textContent = `au ${IRCC_DATA_DATE}`;
    document.getElementById('lp-draws').innerHTML = latest.map((d) => `
      <li>
        <div class="draw-top"><span>${d.name}</span><b data-count="${d.crs}">${d.crs}</b></div>
        <i style="--w:${Math.round((d.crs / max) * 100)}%"></i>
        <small>${fmtDate(d.date)} · ${d.size.toLocaleString('fr-CA')} invitations</small>
      </li>`).join('');
    const items = (news || []).filter((n) => n.relevant).slice(0, 4);
    if (items.length) {
      document.getElementById('lp-ircc').hidden = false;
      document.getElementById('lp-ircc-list').innerHTML = items.map((n) => `
        <li><a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a><small>${fmtDate(n.date)}</small></li>`).join('');
    }
  }
  if (typeof CATEGORIES_2026 !== 'undefined') {
    renderNews([]);
    // Données fraîches publiées par le bot : on remplace les valeurs intégrées.
    Live.ready.then((data) => {
      if (!data.live) return;
      renderNews(data.news);
      document.querySelectorAll('.lp-news-card.in [data-count]').forEach((el) => { el.textContent = el.dataset.count; });
      document.getElementById('lp-live').classList.add('on');
    });
  }

  // Éléments qui apparaissent au défilement, avec un léger décalage entre frères.
  const groups = [
    '.lp-hero-text > *', '.lp-stats > div', '.lp-marquee', '.lp-head', '.lp-steps > li',
    '.lp-feature-text', '.lp-feature-visual', '.lp-news-card', '.lp-live', '.lp-franco', '.lp-faq details', '.lp-final', '.lp-footer-in > div',
  ];
  groups.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el, i) => {
      el.classList.add('reveal');
      if (el.matches('.lp-feature-visual')) el.classList.add('from-side');
      el.style.setProperty('--d', `${Math.min(i, 6) * 90}ms`);
    });
  });

  // Compteurs animés (format français : espace pour les milliers).
  const fmt = (n) => n.toLocaleString('fr-FR').replace(/ | /g, ' ');
  function countUp(el) {
    const target = +el.dataset.count;
    const suffix = el.dataset.suffix || '';
    if (reduce) { el.textContent = fmt(target) + suffix; return; }
    const dur = 1400;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(target * eased)) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  const show = (el) => {
    el.classList.add('in');
    el.querySelectorAll('[data-count]').forEach(countUp);
    if (el.matches('[data-count]')) countUp(el);
  };

  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(show);
  }

  // Le visuel du haut joue son animation dès le chargement.
  const hero = document.querySelector('.lp-hero-visual');
  requestAnimationFrame(() => {
    hero.classList.add('play');
    hero.querySelectorAll('[data-count]').forEach(countUp);
  });

  // Les cartes du haut suivent légèrement la souris (ordinateur uniquement).
  if (!reduce && window.matchMedia('(pointer: fine)').matches) {
    const cards = hero.querySelectorAll('.mock');
    hero.closest('.lp-hero').addEventListener('mousemove', (e) => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / r.width;
      const y = (e.clientY - (r.top + r.height / 2)) / r.height;
      cards.forEach((c, i) => {
        const depth = (i + 1) * 6;
        c.style.translate = `${(-x * depth).toFixed(1)}px ${(-y * depth).toFixed(1)}px`;
      });
    });
  }

  // Ombre de la barre de navigation après défilement.
  const nav = document.querySelector('.lp-nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
