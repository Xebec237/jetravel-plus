/* Questionnaire, calcul et affichage du résultat */
(() => {
  const { $, $$, esc, store, goTab } = JT;
  const form = $('#eval-form');
  const PREFIXES = ['en', 'fr', 'sp'];
  const HINTS = {
    ielts: 'IELTS General Training : bandes de 0 à 9 (ex. 6.5).',
    celpip: 'CELPIP-General : niveaux de 1 à 12.',
    tef: 'TEF Canada : scores du barème en vigueur depuis le 11 décembre 2023 (CO 0-360, CE 0-300, EE et EO 0-450).',
    tcf: 'TCF Canada : compréhension orale et écrite de 100 à 699, expression écrite et orale de 0 à 20.',
    clb: 'Saisissez directement le niveau CLB / NCLC (1 à 12) de chaque compétence.',
  };

  /* ---------- Construction des grilles de langue ---------- */
  PREFIXES.forEach((prefix) => {
    $(`.lang-grid[data-prefix="${prefix}"]`).innerHTML = SKILL_NAMES.map((name, i) => `
      <label class="field"><span>${name}</span>
        <input type="number" step="any" min="0" name="${prefix}_${i}" inputmode="decimal">
        <small class="clb" data-clb="${prefix}_${i}"></small>
      </label>`).join('');
  });

  const val = (name) => (form.elements[name] ? form.elements[name].value : '');
  const testOf = (prefix) => val(prefix + 'Test');
  const isFrenchTest = (t) => t === 'tef' || t === 'tcf';

  function updateLang(prefix) {
    const test = testOf(prefix);
    const grid = $(`.lang-grid[data-prefix="${prefix}"]`);
    grid.hidden = !test || test === 'none';
    $(`[data-hint="${prefix}"]`).textContent = HINTS[test] || '';
    const unit = prefix === 'fr' || isFrenchTest(test) ? 'NCLC' : 'CLB';
    SKILL_NAMES.forEach((_, i) => {
      const v = val(`${prefix}_${i}`);
      const c = v === '' ? null : CRS.toClb(test, i, v);
      $(`[data-clb="${prefix}_${i}"]`).textContent = c == null ? '' : `→ ${unit} ${c < 4 ? 'inférieur à 4' : c}`;
    });
  }

  function withSpouse() {
    return val('married') === 'yes' && val('spouseCanadian') !== 'yes' && val('spouseComing') !== 'no';
  }

  function applyConditions() {
    $$('[data-show-if]', form).forEach((el) => {
      const [k, v] = el.dataset.showIf.split('=');
      el.hidden = val(k) !== v;
    });
  }

  /* ---------- Sauvegarde ---------- */
  const data = () => Object.fromEntries(new FormData(form).entries());
  function save() { store.set('jt_eval', data()); }
  function restore() {
    const saved = store.get('jt_eval', null);
    if (!saved) return;
    Object.entries(saved).forEach(([k, v]) => { if (form.elements[k]) form.elements[k].value = v; });
  }

  /* ---------- Assistant pas à pas ---------- */
  let cur = 0;
  const visibleSteps = () => $$('.step', form).filter((s) => s.dataset.step !== 'spouse' || withSpouse());
  function showStep(i) {
    const steps = visibleSteps();
    cur = Math.max(0, Math.min(i, steps.length - 1));
    $$('.step', form).forEach((s) => { s.hidden = s !== steps[cur]; });
    $('#progress-bar').style.width = `${((cur + 1) / steps.length) * 100}%`;
    $('#step-label').textContent = `Étape ${cur + 1} sur ${steps.length} — ${steps[cur].dataset.title}`;
    $('#prev').hidden = cur === 0;
    $('#next').hidden = cur === steps.length - 1;
    $('#calc').hidden = cur !== steps.length - 1;
  }
  function validate(step) {
    for (const el of $$('[required]', step)) {
      if (!el.checkValidity()) { el.reportValidity(); el.focus(); return false; }
    }
    return true;
  }

  /* ---------- Normalisation des réponses ---------- */
  function normalize(d) {
    const eduIdx = Math.max(0, CRS.EDU_KEYS.indexOf(d.edu));
    const spEduIdx = Math.max(0, CRS.EDU_KEYS.indexOf(d.spEdu));
    const canEdu = +d.canEdu || 0;
    const hasEca = d.hasEca === 'yes';
    const spEca = d.spEca === 'yes';
    const langOf = (prefix) => CRS.clbs(d[prefix + 'Test'], [0, 1, 2, 3].map((i) => d[`${prefix}_${i}`]));
    return {
      ws: withSpouse(),
      age: +d.age || 0,
      declaredEdu: eduIdx,
      hasEca,
      // Les diplômes étrangers ne comptent qu'avec une EDE (ou un diplôme obtenu au Canada).
      edu: hasEca || canEdu > 0 ? eduIdx : 0,
      canEdu,
      en: langOf('en'),
      fr: langOf('fr'),
      cdnWork: +d.cdnWork || 0,
      forWork: +d.forWork || 0,
      tradeCert: d.tradeCert === 'yes',
      sibling: d.sibling === 'yes',
      pnp: d.pnp === 'yes',
      spEca,
      spouse: { declaredEdu: spEduIdx, edu: spEca ? spEduIdx : 0, lang: langOf('sp'), cdnWork: +d.spCdnWork || 0 },
    };
  }

  /* ---------- Calcul et affichage ---------- */
  function compute(navigate) {
    const d = data();
    const p = normalize(d);
    const r = CRS.score(p);
    const plan = Plan.build(d, p, r);
    renderResult(d, p, r, plan);
    CV.prefill(d, p);
    store.set('jt_computed', true);
    JT.state = { d, p, r, plan };
    document.dispatchEvent(new CustomEvent('jt:computed'));
    if (navigate) goTab('result');
  }

  function verdict(total) {
    if (total >= 500) return ['ok', 'Profil très compétitif', 'Votre score est dans la zone des tirages généraux récents. Créez votre profil sans attendre.'];
    if (total >= 450) return ['ok', 'Bon profil', 'Compétitif pour plusieurs tirages par catégorie, encore un peu juste pour certains tirages généraux.'];
    if (total >= 380) return ['warn', 'Profil moyen', 'Visez les tirages par catégorie (français, santé, métiers…) et les programmes provinciaux, et suivez le plan ci-dessous.'];
    return ['bad', 'Score à renforcer', 'Suivez le plan ci-dessous en commençant par les actions qui rapportent le plus de points.'];
  }

  function renderResult(d, p, r, plan) {
    const m = r.max;
    const row = (label, pts, max) => `<tr><td>${label}</td><td class="num">${pts}</td><td class="max">/ ${max}</td></tr>`;
    const group = (label, pts, max) => `<tr class="group"><td>${label}</td><td class="num">${pts}</td><td class="max">/ ${max}</td></tr>`;
    const [cls, title, text] = verdict(r.total);
    const firstName = r.firstKey === 'fr' ? 'le français' : 'l\'anglais';
    const ecaScore = !p.hasEca && p.canEdu === 0 && p.declaredEdu > 0 ? CRS.score({ ...p, edu: p.declaredEdu }).total : null;

    $('#result-root').innerHTML = `
      <div class="card">
        <div class="score-hero">
          <div>
            <div class="score-sub">Votre score CRS estimé</div>
            <div class="score-num">${r.total}<small> / 1200</small></div>
            <div style="margin-top:.5rem"><span class="pill ${cls}">${title}</span></div>
          </div>
          <div>
            <p style="margin-top:0">${text}</p>
            ${ecaScore ? `<div class="alert warn">Vos études ne sont pas encore comptées faute d'évaluation (EDE). Avec l'EDE, votre score passerait à <b>${ecaScore}</b>.</div>` : ''}
            ${plan.potential > r.total ? `<div class="potential">🎯 Score atteignable à court terme en suivant le plan : <b>${plan.potential}</b> (EDE, langue à 9${p.ws ? ', langue et EDE du conjoint' : ''}${r.firstKey === 'fr' ? ', anglais CLB 5' : ''}) — et jusqu'à <b>${Math.min(1200, plan.potential + (p.pnp ? 0 : 600))}</b> avec une nomination provinciale.</div>` : ''}
            <p class="score-sub">Première langue officielle retenue : ${firstName} (le choix le plus avantageux pour vous).</p>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h2>Détail de votre score</h2>
          <table class="breakdown">
            ${group('A. Facteurs de base', r.A.total, m.A)}
            ${row('Âge', r.A.age, m.age)}
            ${row('Niveau d\'études', r.A.edu, m.edu)}
            ${row('Première langue officielle', r.A.lang1, m.lang1)}
            ${row('Deuxième langue officielle', r.A.lang2, m.lang2)}
            ${row('Expérience de travail au Canada', r.A.cdn, m.cdn)}
            ${r.ws ? `${group('B. Facteurs liés au conjoint', r.B.total, 40)}
              ${row('Études du conjoint', r.B.edu, 10)}
              ${row('Langue du conjoint', r.B.lang, 20)}
              ${row('Expérience canadienne du conjoint', r.B.cdn, 10)}` : ''}
            ${group('C. Transférabilité des compétences', r.C.total, 100)}
            ${row('Études + langue / expérience canadienne', r.C.edu, 50)}
            ${row('Expérience étrangère + langue / exp. canadienne', r.C.foreign, 50)}
            ${row('Certificat de qualification (métiers)', r.C.cert, 50)}
            ${group('D. Points supplémentaires', r.D.total, 600)}
            ${row('Nomination provinciale', r.D.pnp, 600)}
            ${row('Bonus français', r.D.french, 50)}
            ${row('Études au Canada', r.D.canEdu, 30)}
            ${row('Frère ou sœur au Canada', r.D.sibling, 15)}
            <tr class="total"><td>Total</td><td class="num">${r.total}</td><td class="max">/ 1200</td></tr>
          </table>
        </div>
        <div class="card">
          <h2>À savoir</h2>
          <ul>
            <li>Les tirages Entrée express invitent les candidats au-dessus d'un seuil qui change à chaque tirage : consultez les <a href="${LINKS.rounds.url}" target="_blank" rel="noopener">derniers résultats</a>.</li>
            <li>Il existe des tirages par catégorie (francophones, santé, métiers, etc.) avec des seuils souvent plus bas que les tirages généraux.</li>
            <li>${d.jobOffer === 'yes' ? 'Votre offre d\'emploi ne donne plus de points CRS depuis le 25 mars 2025, mais elle aide beaucoup pour une nomination provinciale et un permis de travail.' : 'Une offre d\'emploi ne donne plus de points CRS depuis le 25 mars 2025, mais elle reste très utile (nomination provinciale, permis de travail).'}</li>
            <li><b>Réforme à surveiller :</b> IRCC a consulté en 2026 sur une refonte du CRS (le bonus français, les points frère ou sœur, études au Canada et conjoint pourraient changer). Au ${IRCC_DATA_DATE}, rien n'est encore en vigueur : <a href="${LINKS.reform.url}" target="_blank" rel="noopener">voir la consultation</a>.</li>
            <li>Ce calcul est une estimation. Vérifiez avec le <a href="${LINKS.crsTool.url}" target="_blank" rel="noopener">calculateur officiel d'IRCC</a>.</li>
          </ul>
          <div class="link-buttons">
            <button type="button" class="btn" data-goto="eval">Modifier mes réponses</button>
            <button type="button" class="btn ghost" id="print-plan">Imprimer mon plan</button>
          </div>
        </div>
      </div>

      ${drawsCard(d, p, r)}

      ${Plan.render(plan)}`;

    $('#print-plan').onclick = () => window.print();
  }

  /* ---------- Tirages et catégories 2026 ---------- */
  function drawsCard(d, p, r) {
    const rows = matchDraws(d.field, p);
    const item = (m) => {
      const dr = m.draw;
      let status;
      if (!m.ok) status = `<span class="pill warn">Condition manquante</span>`;
      else if (!dr) status = '<span class="pill warn">Pas encore de tirage en 2026</span>';
      else if (r.total >= dr.crs) status = `<span class="pill ok">✓ Au-dessus du dernier seuil (${dr.crs})</span>`;
      else status = `<span class="pill bad">Il vous manque ${dr.crs - r.total} points (seuil ${dr.crs})</span>`;
      const info = !m.ok
        ? esc(m.rule)
        : dr ? `Dernier tirage : ${fmtDate(dr.date)} · ${dr.size.toLocaleString('fr-CA')} invitations · seuil ${dr.crs}` : esc(m.rule);
      return `<li class="draw-row">
        <div><b>${esc(m.name)}</b>${m.isNew ? ' <span class="pill new">Nouveau 2026</span>' : ''}<div class="help">${info}</div></div>
        <div>${status}</div></li>`;
    };
    const french = lastDraw('french');
    return `<div class="card">
        <h2>Vos chances dans les tirages 2026</h2>
        <p class="help">IRCC invite désormais surtout par catégorie et par programme, plutôt que par tirages généraux. Données officielles au ${IRCC_DATA_DATE}.</p>
        ${rows.length
          ? `<ul class="draw-list">${rows.map(item).join('')}</ul>`
          : `<div class="alert info">Avec votre profil actuel, aucune catégorie 2026 ne vous vise directement. Les pistes les plus accessibles : atteindre <b>NCLC 7 en français</b> (dernier seuil : ${french.crs} points) ou obtenir <b>un an d'expérience au Canada</b>.</div>`}
        <div class="link-buttons">
          <a class="btn ghost small" href="${LINKS.categories.url}" target="_blank" rel="noopener">Catégories officielles ↗</a>
          <a class="btn ghost small" href="${LINKS.rounds.url}" target="_blank" rel="noopener">Tous les tirages ↗</a>
        </div>
      </div>`;
  }

  /* ---------- Événements ---------- */
  function refresh() { applyConditions(); PREFIXES.forEach(updateLang); }

  $$('#tabs button').forEach((b) => b.addEventListener('click', () => goTab(b.dataset.tab)));
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-goto]');
    if (g) { e.preventDefault(); goTab(g.dataset.goto); }
  });
  document.addEventListener('change', (e) => {
    const cb = e.target.closest('[data-done]');
    if (!cb) return;
    const done = store.get('jt_done', {});
    done[cb.dataset.done] = cb.checked;
    store.set('jt_done', done);
    cb.closest('.plan-item').classList.toggle('done', cb.checked);
    const total = $$('[data-done]').length;
    const count = $$('[data-done]:checked').length;
    const prog = $('#plan-progress');
    if (prog) prog.textContent = `${count} / ${total} terminées`;
  });

  form.addEventListener('input', () => { refresh(); save(); });
  form.addEventListener('change', () => { refresh(); save(); showStep(cur); });
  $('#prev').onclick = () => showStep(cur - 1);
  $('#next').onclick = () => { if (validate(visibleSteps()[cur])) showStep(cur + 1); };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const steps = visibleSteps();
    if (!validate(steps[cur])) return;
    if (cur < steps.length - 1) showStep(cur + 1);
    else compute(true);
  });

  restore();
  refresh();
  showStep(0);
  CV.init();
  Assistant.init();
  Account.init();
  if (store.get('jt_computed', false)) compute(false);
  const hashTab = location.hash.slice(1);
  if (['eval', 'result', 'cv', 'jobs', 'bot'].includes(hashTab)) goTab(hashTab);
  // Les données du bot (tirages à jour) arrivent après le premier affichage : on recalcule.
  Live.ready.then(() => { if (store.get('jt_computed', false)) compute(false); });
})();
