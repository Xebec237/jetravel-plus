/*
 * Assistant personnel JeTravel+.
 * Croise le profil de la personne (évaluation, CV, candidatures) avec les données
 * publiées chaque jour par le bot (tirages, offres Job Bank, annonces IRCC)
 * pour proposer des opportunités et des rappels. Tout reste dans le navigateur.
 */
const Assistant = (() => {
  const { $, esc, store, goTab } = JT;
  const today = () => new Date().toISOString().slice(0, 10);
  const daysSince = (iso) => Math.floor((Date.now() - new Date(iso + 'T12:00:00').getTime()) / 864e5);

  const S = Object.assign({
    seenJobs: [], lastDrawSeen: '', dismissed: {}, notif: false, lastNotified: '',
    keywords: '', province: '', provinceOnly: false,
  }, store.get('jt_bot', {}));
  const save = () => store.set('jt_bot', S);

  // Ce qui était « nouveau » au début de cette visite (figé pour toute la session)
  const prevSeenJobs = new Set(S.seenJobs);
  const prevDrawSeen = S.lastDrawSeen;
  let live = { jobs: [], news: [], distribution: null, updatedAt: null, live: false };

  /* ---------- Correspondance des métiers (titres Job Bank en anglais) ---------- */
  const FR_EN = [
    [/comptab/, 'account'], [/infirmi/, 'nurse'], [/préposé|aide-soignant|soignant/, 'support worker'],
    [/pharmac/, 'pharmac'], [/développeu|programmeu|informatic/, 'developer'], [/ingénieu/, 'engineer'],
    [/analyste/, 'analyst'], [/données/, 'data'], [/électricien/, 'electrician'], [/soudeu/, 'welder'],
    [/charpentier|menuisier/, 'carpenter'], [/plombier/, 'plumber'], [/mécanicien/, 'mechanic'],
    [/cuisinier|chef/, 'cook'], [/enseignant|professeur/, 'teacher'], [/éducat/, 'educator'],
    [/chauffeur|camionneu/, 'driver'], [/administrati|secrétaire|adjoint/, 'administrative'],
    [/clientèle|service client/, 'customer service'], [/médecin/, 'physician'],
    [/gestionnaire|directeu|cadre/, 'manager'], [/travailleu.*social/, 'social worker'],
  ];
  const FIELD_EN = {
    health: ['nurse', 'support worker', 'pharmac', 'health', 'care', 'social worker'],
    stem: ['developer', 'engineer', 'analyst', 'data', 'software'],
    trades: ['electrician', 'welder', 'carpenter', 'plumber', 'mechanic', 'cook'],
    education: ['teacher', 'educator'], transport: ['driver', 'aircraft', 'pilot'],
    physician: ['physician'], manager: ['manager'], researcher: ['research'],
  };

  function keywords(d) {
    const raw = (S.keywords || (d && d.jobTitle) || '').toLowerCase();
    const out = new Set();
    raw.split(/[,;/]+/).map((s) => s.trim()).filter((s) => s.length > 1).forEach((w) => {
      out.add(w);
      FR_EN.forEach(([re, en]) => { if (re.test(w)) out.add(en); });
    });
    return [...out];
  }

  function rankJobs(d) {
    const kws = keywords(d);
    const field = d ? d.field : '';
    const prov = S.province || (d && d.province) || '';
    if (!kws.length && !field) return [];
    return live.jobs.map((job) => {
      const t = job.title.toLowerCase();
      let score = 0;
      const why = [];
      if (kws.some((k) => t.includes(k))) { score += 60; why.push('votre métier'); }
      else if (field && (FIELD_EN[field] || []).some((k) => t.includes(k))) { score += 35; why.push('votre domaine'); }
      if (!score) return null;
      if (prov && job.province === prov) { score += 20; why.push(PROVINCES[prov] ? PROVINCES[prov].name : prov); }
      else if (prov && S.provinceOnly) return null;
      if (daysSince(job.date) <= 3) score += 10;
      return { ...job, score, why, isNew: !prevSeenJobs.has(job.id) };
    }).filter(Boolean).sort((a, b) => b.score - a.score || b.date.localeCompare(a.date));
  }

  /* ---------- Opportunités liées aux tirages ---------- */
  function drawOpportunities(st) {
    const out = [];
    if (!st) return out;
    const { d, p, r } = st;
    const matched = matchDraws(d.field, p).filter((m) => m.ok);
    const keys = new Set(matched.map((m) => m.key).concat(p.pnp ? ['pnp'] : [], ['general', 'fsw']));
    DRAWS.filter((dr) => (prevDrawSeen ? dr.date > prevDrawSeen : daysSince(dr.date) <= 14) && keys.has(dr.key)).slice(0, 5).forEach((dr) => {
      const above = r.total >= dr.crs;
      out.push({
        id: `draw-${dr.date}-${dr.key}`, icon: above ? '🎉' : '📢', isNew: true,
        title: `Nouveau tirage : ${dr.name}`,
        text: `${fmtDate(dr.date)} · ${dr.size.toLocaleString('fr-CA')} invitations · seuil ${dr.crs}. `
          + (above ? `<b>Votre score (${r.total}) était au-dessus du seuil.</b> Si votre profil Entrée express est actif, surveillez votre compte IRCC.` : `Il vous manquait ${dr.crs - r.total} points.`),
        tone: above ? 'ok' : '',
      });
    });
    matched.forEach((m) => {
      if (!m.draw) return;
      const gap = m.draw.crs - r.total;
      out.push({
        id: `cat-${m.key}`, icon: gap <= 0 ? '✅' : '🎯',
        title: `Catégorie ${m.name}`,
        text: gap <= 0
          ? `Vous êtes admissible et votre score dépasse le dernier seuil (${m.draw.crs}). Créez ou mettez à jour votre profil Entrée express.`
          : `Vous êtes admissible. Il vous manque <b>${gap} points</b> par rapport au dernier seuil (${m.draw.crs}). Votre plan d'action vous montre comment les gagner.`,
        action: gap > 0 ? { label: 'Voir mon plan', tab: 'result' } : null,
        tone: gap <= 0 ? 'ok' : '',
      });
    });
    const pos = poolPosition(r.total);
    if (pos) {
      out.push({
        id: 'pool', icon: '📊', title: 'Votre position dans le bassin',
        text: `Environ <b>${pos.above.toLocaleString('fr-CA')}</b> candidats sur ${pos.total.toLocaleString('fr-CA')} ont un score supérieur au vôtre (répartition publiée par IRCC${asOfFr(live.distribution.asOf)}).`,
      });
    }
    return out;
  }

  function asOfFr(s) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? '' : ` le ${new Date(t).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  }

  function poolPosition(score) {
    const dist = live.distribution;
    if (!dist || !dist.ranges) return null;
    let above = 0;
    dist.ranges.forEach(({ min, max, count }) => {
      if (min > score) above += count;
      else if (max >= score) above += Math.round(count * ((max - score) / (max - min + 1)));
    });
    return { above, total: dist.total };
  }

  /* ---------- Rappels personnalisés ---------- */
  const QUICK_WINS = ['eca', 'lang-test', 'lang-main', 'french', 'english', 'sp-lang', 'sp-eca'];

  function reminders(st) {
    const out = [];
    const cv = CV.getCv();
    const apps = CV.getApps();
    if (!st) {
      out.push({ id: 'eval', icon: '📝', title: 'Faites votre évaluation', text: 'Je pourrai alors vous proposer des offres, des tirages et des rappels adaptés à votre profil.', action: { label: 'Commencer', tab: 'eval' } });
      return out;
    }
    st.plan.alerts.filter((a) => a.cls === 'warn' && a.html.includes('⏳')).forEach((a) => out.push({ id: 'age', icon: '⏳', title: 'Le temps compte', text: a.html.replace(/^⏳\s*<b>[^<]*<\/b>\s*/, '').replace(/^./, (c) => c.toUpperCase()) }));
    const done = store.get('jt_done', {});
    st.plan.boost.filter((it) => QUICK_WINS.includes(it.id) && !done[it.id] && it.gain > 0).slice(0, 2).forEach((it) => {
      out.push({ id: `plan-${it.id}`, icon: '🎯', title: `Prochaine action : ${it.title}`, text: `Gain estimé : <b>+${it.gain} points</b>. Cochez « C'est fait » dans votre plan une fois terminé.`, action: { label: 'Voir le plan', tab: 'result' } });
    });
    if (!cv.name || !cv.summary || !cv.exp.some((e) => e.title)) {
      out.push({ id: 'cv', icon: '📄', title: 'Complétez votre CV canadien', text: 'Il manque encore votre nom, votre profil professionnel ou une expérience. Un CV complet est indispensable pour postuler.', action: { label: 'Compléter mon CV', tab: 'cv' } });
    }
    apps.forEach((a, i) => {
      if (a.status === 'À envoyer' && daysSince(a.date) >= 1) {
        out.push({ id: `send-${i}-${a.date}`, icon: '✉️', title: `Envoyez votre candidature : ${a.job}`, text: `Chez ${esc(a.company)}, ajoutée le ${fmtDate(a.date)}. Les offres se remplissent vite.`, action: { label: 'Préparer la lettre', tab: 'jobs' } });
      }
      if (a.status === 'Envoyée' && daysSince(a.date) >= 7) {
        out.push({ id: `follow-${i}-${a.date}`, icon: '🔔', title: `Relancez ${a.company}`, text: `Candidature « ${esc(a.job)} » envoyée il y a ${daysSince(a.date)} jours sans réponse. Un court courriel poli de relance augmente vos chances.`, followUp: i });
      }
    });
    const recent = apps.filter((a) => a.status !== 'À envoyer' && daysSince(a.date) <= 7).length;
    if (recent < 3) {
      out.push({ id: `goal-${today()}`, icon: '🏁', title: 'Objectif de la semaine : 3 candidatures', text: `Vous en avez envoyé ${recent} ces 7 derniers jours. Les offres ci-dessous sont un bon point de départ.` });
    }
    return out;
  }

  /* ---------- Rendu ---------- */
  const isDismissed = (id) => S.dismissed[id] && daysSince(S.dismissed[id]) < 3;

  function card(it) {
    const action = it.action ? `<button type="button" class="btn small" data-goto="${it.action.tab}">${esc(it.action.label)} →</button>` : '';
    const follow = it.followUp != null ? `<button type="button" class="btn small" data-follow="${it.followUp}">J'ai relancé ✓</button>` : '';
    return `<li class="bot-card ${it.tone || ''}" data-id="${esc(it.id)}">
      <span class="bot-ico">${it.icon}</span>
      <div class="bot-body"><b>${esc(it.title)}</b>${it.isNew ? ' <span class="pill new">Nouveau</span>' : ''}<p>${it.text}</p>
        ${action || follow ? `<div class="bot-actions">${action}${follow}</div>` : ''}</div>
      <button type="button" class="bot-x" title="Masquer 3 jours" data-dismiss="${esc(it.id)}">✕</button>
    </li>`;
  }

  function jobCard(j) {
    return `<li class="bot-job">
      <div class="bot-job-main">
        <b>${esc(j.title)}</b>${j.isNew ? ' <span class="pill new">Nouveau</span>' : ''}
        <div class="help">${esc(j.employer)} · ${esc(j.location)}${j.province ? ` (${esc(j.province)})` : ''} · publiée le ${fmtDate(j.date)}</div>
        ${j.salary ? `<div class="bot-salary">${esc(j.salary)}</div>` : ''}
        <div class="help">Proposée pour : ${esc(j.why.join(', '))}</div>
      </div>
      <div class="bot-job-actions">
        <a class="btn small" href="${esc(j.url)}" target="_blank" rel="noopener">Voir l'offre ↗</a>
        <button type="button" class="btn small primary" data-apply="${esc(j.id)}">Préparer ma lettre</button>
        <button type="button" class="btn small ghost" data-dismiss="job-${esc(j.id)}">Pas pour moi</button>
      </div>
    </li>`;
  }

  function render() {
    const root = $('#bot-root');
    if (!root) return;
    const st = JT.state || null;
    const d = st ? st.d : store.get('jt_eval', null);
    const cv = CV.getCv();
    const rem = reminders(st).filter((x) => !isDismissed(x.id));
    const opps = drawOpportunities(st).filter((x) => !isDismissed(x.id));
    const jobs = rankJobs(d).filter((j) => !S.dismissed[`job-${j.id}`]);
    const shownJobs = jobs.slice(0, 12);
    const newJobs = shownJobs.filter((j) => j.isNew).length;
    const relevantNews = live.news.filter((n) => n.relevant).slice(0, 5);
    const name = cv.name ? cv.name.split(' ')[0] : '';
    const dateLabel = new Date().toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
    const provOptions = Object.entries(PROVINCES).map(([k, v]) => `<option value="${k}" ${S.province === k ? 'selected' : ''}>${v.name}</option>`).join('');
    const notifSupported = 'Notification' in window;

    root.innerHTML = `
      <div class="card bot-hero">
        <div class="bot-avatar">🤖</div>
        <div>
          <h1>Bonjour${name ? ` ${esc(name)}` : ''} !</h1>
          <p>Voici vos propositions du ${dateLabel} : <b>${rem.length}</b> rappel${rem.length > 1 ? 's' : ''}, <b>${newJobs}</b> nouvelle${newJobs > 1 ? 's' : ''} offre${newJobs > 1 ? 's' : ''} et <b>${opps.length}</b> opportunité${opps.length > 1 ? 's' : ''}.</p>
          <div class="bot-chips">
            ${st ? `<span>Score ${st.r.total}</span>` : ''}
            ${d && d.jobTitle ? `<span>${esc(d.jobTitle)}</span>` : ''}
            ${(S.province || (d && d.province)) ? `<span>${esc((PROVINCES[S.province || d.province] || {}).name || '')}</span>` : ''}
            <span class="${live.live ? 'ok' : ''}">${live.live ? `Données mises à jour par le bot le ${IRCC_DATA_DATE}` : 'Données intégrées (le bot publie en ligne)'}</span>
          </div>
        </div>
      </div>

      <details class="card bot-settings">
        <summary>⚙️ Personnaliser mon assistant</summary>
        <div class="row">
          <label class="field"><span>Métiers recherchés (séparés par des virgules)</span><input id="bot-kw" value="${esc(S.keywords)}" placeholder="${esc((d && d.jobTitle) || 'ex. infirmière, préposée aux bénéficiaires')}"></label>
          <label class="field"><span>Province préférée</span><select id="bot-prov"><option value="">Celle de mon évaluation</option>${provOptions}</select></label>
        </div>
        <label class="done-toggle"><input type="checkbox" id="bot-provonly" ${S.provinceOnly ? 'checked' : ''}> Seulement les offres de cette province</label>
        ${notifSupported ? `<div class="bot-actions"><button type="button" class="btn small" id="bot-notif">${S.notif && Notification.permission === 'granted' ? '🔔 Notifications activées' : '🔕 Activer les notifications'}</button>
          <span class="help">Vous recevez un résumé une fois par jour, à l'ouverture du site.</span></div>` : ''}
      </details>

      <div class="bot-grid">
        <section class="card">
          <h2>À faire</h2>
          ${rem.length ? `<ul class="bot-list">${rem.map(card).join('')}</ul>` : '<p class="help">Rien d\'urgent : bravo ! 🎉</p>'}
        </section>
        <section class="card">
          <h2>Opportunités d'immigration</h2>
          ${opps.length ? `<ul class="bot-list">${opps.map(card).join('')}</ul>` : `<p class="help">${st ? 'Pas de nouvelle opportunité ciblée pour votre profil aujourd\'hui. Les catégories 2026 les plus ouvertes : français, santé, métiers.' : 'Faites votre évaluation pour voir les tirages qui vous concernent.'}</p>`}
        </section>
      </div>

      <section class="card">
        <div class="bot-head"><h2>Offres d'emploi pour vous</h2><span class="help">${jobs.length} offre${jobs.length > 1 ? 's' : ''} correspondante${jobs.length > 1 ? 's' : ''} sur Job Bank</span></div>
        ${shownJobs.length ? `<ul class="bot-jobs">${shownJobs.map(jobCard).join('')}</ul>`
          : `<p class="help">${keywords(d).length || (d && d.field) ? 'Aucune offre récente ne correspond pour l\'instant parmi les métiers suivis par le bot. Lancez une recherche directe dans l\'onglet « Emploi & lettre ».' : 'Indiquez votre métier dans « Personnaliser mon assistant » (ou dans l\'évaluation) pour recevoir des offres.'}</p>`}
      </section>

      ${relevantNews.length ? `<section class="card">
        <h2>Dernières annonces d'IRCC</h2>
        <ul class="bot-news">${relevantNews.map((n) => `<li><a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a><span class="help">${fmtDate(n.date)}</span></li>`).join('')}</ul>
      </section>` : ''}`;

    updateBadge(rem.length + newJobs + opps.filter((o) => o.isNew).length);
  }

  function updateBadge(n) {
    const b = $('#bot-badge');
    if (b) { b.textContent = n > 99 ? '99+' : String(n); b.hidden = !n; }
    const t = $('#tab-bot-count');
    if (t) { t.textContent = n ? ` (${n})` : ''; }
  }

  // Une fois l'onglet ouvert, les éléments actuels ne seront plus « nouveaux » à la prochaine visite.
  function markSeen() {
    const st = JT.state;
    const d = st ? st.d : store.get('jt_eval', null);
    const ids = rankJobs(d).map((j) => j.id);
    S.seenJobs = [...new Set([...ids, ...S.seenJobs])].slice(0, 3000);
    if (DRAWS[0]) S.lastDrawSeen = DRAWS[0].date;
    save();
  }

  function notify() {
    if (!S.notif || !('Notification' in window) || Notification.permission !== 'granted' || S.lastNotified === today()) return;
    const st = JT.state;
    const d = st ? st.d : store.get('jt_eval', null);
    const n = rankJobs(d).slice(0, 12).filter((j) => j.isNew).length;
    const r = reminders(st).length;
    if (!n && !r) return;
    try {
      new Notification('JeTravel+ — vos propositions du jour', { body: `${n} nouvelle(s) offre(s) d'emploi et ${r} rappel(s) vous attendent.` });
      S.lastNotified = today();
      save();
    } catch (e) { /* notifications indisponibles */ }
  }

  /* ---------- Événements ---------- */
  function onClick(e) {
    const dis = e.target.closest('[data-dismiss]');
    if (dis) { S.dismissed[dis.dataset.dismiss] = today(); save(); render(); return; }
    const apply = e.target.closest('[data-apply]');
    if (apply) {
      const job = live.jobs.find((j) => j.id === apply.dataset.apply);
      if (!job) return;
      CV.prepareLetter({ job: job.title, company: job.employer, companyCity: `${job.location}${job.province ? ` (${job.province})` : ''}`, source: 'Job Bank', ref: job.id });
      CV.addApp({ company: job.employer, job: job.title, link: job.url });
      goTab('jobs');
      return;
    }
    const follow = e.target.closest('[data-follow]');
    if (follow) { CV.setAppStatus(+follow.dataset.follow, 'Relancée'); render(); return; }
    if (e.target.id === 'bot-notif') {
      Notification.requestPermission().then((perm) => {
        S.notif = perm === 'granted';
        save();
        render();
        if (S.notif) new Notification('JeTravel+', { body: 'Les notifications sont activées. Vous recevrez un résumé par jour.' });
      });
    }
  }
  function onChange(e) {
    if (e.target.id === 'bot-kw') S.keywords = e.target.value.trim();
    else if (e.target.id === 'bot-prov') S.province = e.target.value;
    else if (e.target.id === 'bot-provonly') S.provinceOnly = e.target.checked;
    else return;
    save();
    render();
  }

  function init() {
    const root = $('#bot-root');
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    document.addEventListener('jt:computed', render);
    document.addEventListener('jt:apps', render);
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-tab="bot"], [data-goto="bot"]')) setTimeout(markSeen, 1500);
    });
    render();
    Live.ready.then((data) => {
      live = data;
      render();
      notify();
    });
  }

  return { init, render };
})();
