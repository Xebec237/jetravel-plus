/*
 * Outil « Budget de mon projet » (onglet Budget de app.html).
 * Calcule le coût du projet en FCFA, le reste à épargner et la date à laquelle le montant sera atteint.
 * Sauvegarde dans le localStorage (clé jt_budget), copiée dans le compte par js/cloud-sync.js si la personne est connectée.
 * Montants par défaut : indicatifs, relevés sur les sites officiels en octobre 2026.
 */
(() => {
  const { $, esc, store, goTab } = JT;
  const root = $('#budget-root');
  if (!root) return;

  const KEY = 'jt_budget';
  const IRCC_FEES = 'https://ircc.canada.ca/english/information/fees/fees.asp';
  const BIO = 'https://www.canada.ca/en/immigration-refugees-citizenship/campaigns/biometrics.html';
  // Preuve de fonds (CAD) selon le nombre de personnes, en vigueur depuis le 7 juillet 2025
  const FUNDS = [0, 15263, 19001, 23360, 28362, 32168, 36280, 40392];
  const fundsFor = (n) => (n <= 7 ? FUNDS[n] : FUNDS[7] + (n - 7) * 4112);

  // Postes du budget : montant par défaut calculé selon la famille (a = adultes, c = enfants)
  const ITEMS = [
    { key: 'wes', label: 'Évaluation des diplômes (WES)', cur: 'CAD', def: () => 300, hint: 'Pour le demandeur principal, envoi des documents compris.', link: { label: 'WES Canada', url: 'https://www.wes.org/ca/' } },
    { key: 'lang', label: 'Test de langue (IELTS, CELPIP, TEF, TCF)', cur: 'FCFA', def: () => 180000, hint: 'Un test pour le demandeur principal. Ajoutez-en un si votre conjoint passe aussi un test.', link: { label: 'Tests acceptés par IRCC', url: LINKS.ircLang.url } },
    { key: 'ircc', label: 'Frais IRCC (traitement + droit de résidence permanente)', cur: 'CAD', def: (a, c) => 1590 * a + 270 * c, hint: '1 590 $ par adulte et 270 $ par enfant à charge.', link: { label: 'Frais officiels IRCC', url: IRCC_FEES } },
    { key: 'bio', label: 'Biométrie (empreintes et photo)', cur: 'CAD', def: (a, c) => (a + c > 1 ? 170 : 85), hint: '85 $ par personne, 170 $ au maximum pour une famille.', link: { label: 'Biométrie (IRCC)', url: BIO } },
    { key: 'med', label: 'Examen médical', cur: 'FCFA', def: (a, c) => 100000 * (a + c), hint: 'Chez un médecin désigné par IRCC, pour chaque membre de la famille.', link: { label: 'Examen médical (IRCC)', url: LINKS.medPolice.url } },
    { key: 'trad', label: 'Traduction de documents', cur: 'FCFA', def: (a, c) => 100000 + 30000 * (a + c - 1), hint: 'Traduction certifiée des documents qui ne sont pas en français ou en anglais.', link: null },
    { key: 'funds', label: 'Preuve de fonds', cur: 'CAD', def: (a, c) => fundsFor(a + c), hint: 'Montant minimum à avoir sur votre compte. Cet argent reste à vous : il sert à vous installer au Canada.', link: { label: 'Preuve de fonds (IRCC)', url: LINKS.funds.url } },
    { key: 'flight', label: 'Billet d\'avion (aller simple)', cur: 'FCFA', def: (a, c) => 750000 * (a + c), hint: 'Prix moyen depuis l\'Afrique de l\'Ouest ou centrale vers Montréal ou Toronto.', link: null },
    { key: 'other', label: 'Autres (passeport, certificats de police, envois…)', cur: 'FCFA', def: () => 100000, hint: 'Petits frais qui s\'additionnent vite.', link: null },
  ];

  const defaults = () => ({
    rate: 440, adults: 1, children: 0, saved: 0, monthly: 0, departure: '',
    items: Object.fromEntries(ITEMS.map((it) => [it.key, { on: true, amount: null, cur: it.cur }])),
  });
  const saved = store.get(KEY, null);
  const state = Object.assign(defaults(), saved || {});
  state.items = Object.assign(defaults().items, (saved && saved.items) || {});

  const num = (v) => { const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : 0; };
  const fcfa = (n) => `${Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ')} FCFA`;
  const monthLabel = (d) => d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  function amountOf(it) {
    const s = state.items[it.key];
    if (s.amount != null) return { value: s.amount, cur: s.cur, custom: true };
    return { value: it.def(state.adults, state.children), cur: it.cur, custom: false };
  }
  const toFcfa = (value, cur) => (cur === 'CAD' ? value * state.rate : value);

  function compute() {
    const total = ITEMS.reduce((sum, it) => {
      if (!state.items[it.key].on) return sum;
      const a = amountOf(it);
      return sum + toFcfa(a.value, a.cur);
    }, 0);
    const rest = Math.max(0, total - state.saved);
    const progress = total > 0 ? Math.min(100, (state.saved / total) * 100) : 0;
    let months = null;
    let reachDate = null;
    if (rest === 0) months = 0;
    else if (state.monthly > 0) months = Math.ceil(rest / state.monthly);
    if (months != null) {
      reachDate = new Date();
      reachDate.setDate(1);
      reachDate.setMonth(reachDate.getMonth() + months);
    }
    let monthsToDeparture = null;
    if (state.departure) {
      const dep = new Date(state.departure + 'T12:00:00');
      const now = new Date();
      monthsToDeparture = (dep.getFullYear() - now.getFullYear()) * 12 + (dep.getMonth() - now.getMonth());
    }
    return { total, rest, progress, months, reachDate, monthsToDeparture };
  }

  function save() { store.set(KEY, state); }

  /* ---------- Rendu ---------- */
  function itemRow(it) {
    const s = state.items[it.key];
    const a = amountOf(it);
    const conv = a.cur === 'CAD' ? `≈ ${fcfa(toFcfa(a.value, a.cur))}` : '';
    return `<li class="bd-item ${s.on ? '' : 'off'}">
      <label class="bd-check"><input type="checkbox" data-on="${it.key}" ${s.on ? 'checked' : ''}><span>${esc(it.label)}</span></label>
      <div class="bd-amount">
        <input type="number" min="0" step="any" inputmode="decimal" data-amount="${it.key}" value="${Math.round(a.value * 100) / 100}" aria-label="Montant : ${esc(it.label)}">
        <select data-cur="${it.key}" aria-label="Devise">
          <option value="FCFA" ${a.cur === 'FCFA' ? 'selected' : ''}>FCFA</option>
          <option value="CAD" ${a.cur === 'CAD' ? 'selected' : ''}>CAD</option>
        </select>
      </div>
      <div class="bd-meta">
        <span class="bd-conv" data-conv="${it.key}">${conv}</span>
        <span>${esc(it.hint)}</span>
        <span class="bd-warn">Montant indicatif, vérifiez sur le site officiel.${it.link ? ` <a href="${esc(it.link.url)}" target="_blank" rel="noopener">${esc(it.link.label)} ↗</a>` : ''}</span>
        ${a.custom ? `<button type="button" class="bd-reset" data-reset="${it.key}">Revenir au montant par défaut</button>` : ''}
      </div>
    </li>`;
  }

  function render() {
    root.innerHTML = `
      <div class="intro">
        <h1>Budget de mon projet</h1>
        <p>Cochez les dépenses de votre projet : nous calculons le total en FCFA, ce qu'il vous reste à épargner et quand vous serez prêt.</p>
      </div>
      <div class="bd-grid">
        <div>
          <div class="card">
            <h2>Votre situation</h2>
            <div class="row">
              <label class="field"><span>Adultes dans le projet</span><input type="number" min="1" max="10" step="1" data-num="adults" value="${state.adults}"></label>
              <label class="field"><span>Enfants à charge</span><input type="number" min="0" max="10" step="1" data-num="children" value="${state.children}"></label>
              <label class="field"><span>Taux : 1 dollar canadien (CAD) =</span><input type="number" min="1" step="any" data-num="rate" value="${state.rate}"><small class="help">FCFA. Vérifiez le taux du jour auprès de votre banque.</small></label>
            </div>
          </div>
          <div class="card">
            <h2>Les dépenses</h2>
            <p class="help">Tous les montants sont indicatifs et peuvent changer : vérifiez toujours sur le site officiel avant de payer.</p>
            <ul class="bd-list">${ITEMS.map(itemRow).join('')}</ul>
          </div>
        </div>
        <div class="bd-side">
          <div class="card bd-summary" id="bd-summary"></div>
        </div>
      </div>`;
    renderSummary();
  }

  function renderSummary() {
    const r = compute();
    let when = '';
    if (r.months === 0) when = '<div class="alert info">🎉 Vous avez déjà épargné le montant total de votre budget.</div>';
    else if (r.months == null) when = '<p class="help">Indiquez votre épargne mensuelle pour savoir quand vous atteindrez le montant.</p>';
    else when = `<div class="bd-line"><span>Montant atteint en</span><b>${monthLabel(r.reachDate)}</b></div><p class="help">Soit dans ${r.months} mois, en épargnant ${fcfa(state.monthly)} par mois.</p>`;

    let target = '';
    if (state.departure && r.monthsToDeparture != null && r.rest > 0) {
      if (r.monthsToDeparture <= 0) target = '<div class="alert warn">La date de départ visée est déjà passée ou très proche : choisissez une nouvelle date.</div>';
      else {
        const needed = r.rest / r.monthsToDeparture;
        target = r.months != null && r.months <= r.monthsToDeparture
          ? `<div class="alert info">✓ À ce rythme, vous serez prêt avant votre départ visé (${monthLabel(new Date(state.departure + 'T12:00:00'))}).</div>`
          : `<div class="alert warn">Pour être prêt en ${monthLabel(new Date(state.departure + 'T12:00:00'))}, il faudrait épargner environ <b>${fcfa(needed)}</b> par mois.</div>`;
      }
    }

    $('#bd-summary').innerHTML = `
      <h2>Total de mon projet</h2>
      <div class="bd-total">${fcfa(r.total)}</div>
      <div class="bd-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(r.progress)}"><i style="width:${r.progress}%"></i></div>
      <p class="help">${Math.round(r.progress)} % déjà épargné</p>
      <label class="field"><span>Déjà épargné (FCFA)</span><input type="number" min="0" step="1000" data-num="saved" value="${state.saved || ''}" placeholder="0"></label>
      <label class="field"><span>Je peux épargner chaque mois (FCFA)</span><input type="number" min="0" step="1000" data-num="monthly" value="${state.monthly || ''}" placeholder="ex. 150000"></label>
      <label class="field"><span>Date de départ visée</span><input type="date" data-date="departure" value="${esc(state.departure)}"></label>
      <div class="bd-line"><span>Reste à épargner</span><b>${fcfa(r.rest)}</b></div>
      ${when}
      ${target}
      <p class="bd-note">Outil d'orientation : ce budget est une estimation. Il ne garantit ni l'acceptation de votre dossier ni le coût réel de votre projet.</p>`;
  }

  /* ---------- Événements ---------- */
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.amount) {
      const s = state.items[t.dataset.amount];
      s.amount = num(t.value);
      s.cur = root.querySelector(`[data-cur="${t.dataset.amount}"]`).value;
      const conv = root.querySelector(`[data-conv="${t.dataset.amount}"]`);
      if (conv) conv.textContent = s.cur === 'CAD' ? `≈ ${fcfa(toFcfa(s.amount, s.cur))}` : '';
      save(); renderSummary();
    } else if (t.dataset.num) {
      const v = num(t.value);
      if (t.dataset.num === 'adults') state.adults = Math.max(1, Math.round(v) || 1);
      else if (t.dataset.num === 'children') state.children = Math.round(v);
      else if (t.dataset.num === 'rate') { if (v > 0) state.rate = v; }
      else state[t.dataset.num] = v;
      save();
      // Les montants par défaut et les conversions dépendent de la famille et du taux.
      if (['adults', 'children', 'rate'].includes(t.dataset.num)) refreshItems(); else renderSummary();
    } else if (t.dataset.date) {
      state.departure = t.value;
      save(); renderSummary();
    }
  });
  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.on) {
      state.items[t.dataset.on].on = t.checked;
      t.closest('.bd-item').classList.toggle('off', !t.checked);
      save(); renderSummary();
    } else if (t.dataset.cur) {
      const it = ITEMS.find((x) => x.key === t.dataset.cur);
      const s = state.items[it.key];
      const before = amountOf(it);
      // On convertit le montant affiché dans la nouvelle devise.
      const fcfaValue = toFcfa(before.value, before.cur);
      s.cur = t.value;
      s.amount = Math.round((t.value === 'CAD' ? fcfaValue / state.rate : fcfaValue) * 100) / 100;
      save(); refreshItems();
    }
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-reset]');
    if (!b) return;
    const it = ITEMS.find((x) => x.key === b.dataset.reset);
    state.items[it.key] = { on: state.items[it.key].on, amount: null, cur: it.cur };
    save(); refreshItems();
  });

  // Met à jour la liste sans perdre le champ en cours de saisie.
  function refreshItems() {
    const active = document.activeElement;
    const focusKey = active && root.contains(active) ? [...active.attributes].filter((a) => a.name.startsWith('data-')).map((a) => `[${a.name}="${a.value}"]`).join('') : '';
    const list = root.querySelector('.bd-list');
    list.innerHTML = ITEMS.map(itemRow).join('');
    renderSummary();
    if (focusKey) {
      const el = root.querySelector(focusKey);
      if (el && el !== active) { el.focus(); if (el.setSelectionRange && el.type === 'text') el.setSelectionRange(el.value.length, el.value.length); }
    }
  }

  render();
  if (location.hash === '#budget') goTab('budget');
})();
