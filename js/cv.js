/* CV canadien, lettre de motivation, recherche d'emploi et suivi des candidatures */
const CV = (() => {
  const { $, $$, esc, store, copy, flash } = JT;

  const emptyExp = () => ({ title: '', company: '', place: '', start: '', end: '', bullets: '' });
  const emptyEdu = () => ({ degree: '', school: '', place: '', year: '', eca: '' });
  const defaults = () => ({
    lang: 'fr', name: '', title: '', email: '', phone: '', city: '', linkedin: '', summary: '', skills: '',
    languages: '', certs: '', volunteer: '', exp: [emptyExp()], edu: [emptyEdu()],
  });
  let cv = Object.assign(defaults(), store.get('jt_cv', {}));
  let lt = Object.assign({ lang: 'fr', status: 'ee' }, store.get('jt_letter', {}));
  let apps = store.get('jt_apps', []);
  let years = 0; // années d'expérience totales, venant de l'évaluation

  const lines = (s) => String(s || '').split('\n').map((x) => x.replace(/^[\s•\-*]+/, '').trim()).filter(Boolean);
  const T = {
    fr: { profile: 'Profil professionnel', skills: 'Compétences clés', exp: 'Expérience professionnelle', edu: 'Formation', lang: 'Langues', certs: 'Certifications', vol: 'Bénévolat', ref: 'Références disponibles sur demande.', eca: 'Équivalence canadienne', present: 'présent' },
    en: { profile: 'Professional Summary', skills: 'Core Competencies', exp: 'Professional Experience', edu: 'Education', lang: 'Languages', certs: 'Certifications', vol: 'Volunteer Experience', ref: 'References available upon request.', eca: 'Canadian equivalency', present: 'present' },
  };

  /* ---------------- CV : formulaire ---------------- */
  function bindSimple() {
    $$('[data-cv]').forEach((el) => {
      el.value = cv[el.dataset.cv] || '';
      el.addEventListener('input', () => { cv[el.dataset.cv] = el.value; saveCv(); });
    });
  }

  function renderLists() {
    $('#cv-exp').innerHTML = cv.exp.map((e, i) => `
      <div class="entry">
        <button type="button" class="btn ghost small remove" data-remove="exp" data-i="${i}">Retirer</button>
        <div class="row">
          <label class="field"><span>Poste</span><input data-list="exp" data-i="${i}" data-k="title" value="${esc(e.title)}" placeholder="Comptable senior"></label>
          <label class="field"><span>Entreprise</span><input data-list="exp" data-i="${i}" data-k="company" value="${esc(e.company)}" placeholder="Nom de l'entreprise"></label>
        </div>
        <div class="row">
          <label class="field"><span>Ville, pays</span><input data-list="exp" data-i="${i}" data-k="place" value="${esc(e.place)}" placeholder="Yaoundé, Cameroun"></label>
          <label class="field"><span>Début</span><input data-list="exp" data-i="${i}" data-k="start" value="${esc(e.start)}" placeholder="03/2021"></label>
          <label class="field"><span>Fin</span><input data-list="exp" data-i="${i}" data-k="end" value="${esc(e.end)}" placeholder="présent"></label>
        </div>
        <label class="field"><span>Réalisations (une par ligne, avec des chiffres)</span>
          <textarea rows="4" data-list="exp" data-i="${i}" data-k="bullets" placeholder="Réduit les délais de clôture mensuelle de 30 % en automatisant les rapprochements&#10;Encadré une équipe de 4 comptables">${esc(e.bullets)}</textarea></label>
      </div>`).join('');
    $('#cv-edu').innerHTML = cv.edu.map((e, i) => `
      <div class="entry">
        <button type="button" class="btn ghost small remove" data-remove="edu" data-i="${i}">Retirer</button>
        <div class="row">
          <label class="field"><span>Diplôme</span><input data-list="edu" data-i="${i}" data-k="degree" value="${esc(e.degree)}" placeholder="Master en finance"></label>
          <label class="field"><span>Établissement</span><input data-list="edu" data-i="${i}" data-k="school" value="${esc(e.school)}" placeholder="Université de Douala"></label>
        </div>
        <div class="row">
          <label class="field"><span>Pays</span><input data-list="edu" data-i="${i}" data-k="place" value="${esc(e.place)}" placeholder="Cameroun"></label>
          <label class="field"><span>Année</span><input data-list="edu" data-i="${i}" data-k="year" value="${esc(e.year)}" placeholder="2018"></label>
        </div>
        <label class="field"><span>Équivalence canadienne (EDE / WES)</span><input data-list="edu" data-i="${i}" data-k="eca" value="${esc(e.eca)}" placeholder="Équivalent à une maîtrise canadienne (WES, 2026)"></label>
      </div>`).join('');
  }

  function onListInput(e) {
    const el = e.target.closest('[data-list]');
    if (!el) return;
    cv[el.dataset.list][+el.dataset.i][el.dataset.k] = el.value;
    saveCv();
  }

  /* ---------------- CV : aperçu ---------------- */
  function cvParts() {
    const t = T[cv.lang] || T.fr;
    const exp = cv.exp.filter((e) => e.title || e.company);
    const edu = cv.edu.filter((e) => e.degree || e.school);
    return { t, exp, edu };
  }

  function renderPreview() {
    const { t, exp, edu } = cvParts();
    if (!cv.name && !cv.summary && !exp.length) {
      $('#cv-preview').innerHTML = '<p class="cv-empty">L\'aperçu de votre CV apparaîtra ici.</p>';
      return;
    }
    const contact = [cv.city, cv.phone, cv.email, cv.linkedin].filter(Boolean).map(esc).join(' &nbsp;|&nbsp; ');
    const list = (s) => `<ul>${lines(s).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    const section = (title, body) => (body ? `<h2>${title}</h2>${body}` : '');
    $('#cv-preview').innerHTML = `
      <h1>${esc(cv.name || 'Votre nom')}</h1>
      ${cv.title ? `<div class="cv-title">${esc(cv.title)}</div>` : ''}
      <div class="cv-contact">${contact}</div>
      ${section(t.profile, cv.summary ? `<p>${esc(cv.summary)}</p>` : '')}
      ${section(t.skills, lines(cv.skills).length ? `<ul class="cv-skills">${lines(cv.skills).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '')}
      ${section(t.exp, exp.map((e) => `
        <div class="cv-job"><span>${esc(e.title)}</span><span>${esc([e.start, e.end || t.present].filter(Boolean).join(' – '))}</span></div>
        <div class="cv-org">${esc([e.company, e.place].filter(Boolean).join(', '))}</div>
        ${lines(e.bullets).length ? list(e.bullets) : ''}`).join(''))}
      ${section(t.edu, edu.map((e) => `
        <div class="cv-job"><span>${esc(e.degree)}</span><span>${esc(e.year)}</span></div>
        <div class="cv-org">${esc([e.school, e.place].filter(Boolean).join(', '))}</div>
        ${e.eca ? `<div>${t.eca} : ${esc(e.eca)}</div>` : ''}`).join(''))}
      ${section(t.lang, lines(cv.languages).length ? list(cv.languages) : '')}
      ${section(t.certs, lines(cv.certs).length ? list(cv.certs) : '')}
      ${section(t.vol, lines(cv.volunteer).length ? list(cv.volunteer) : '')}
      <p class="cv-ref">${t.ref}</p>`;
  }

  function cvText() {
    const { t, exp, edu } = cvParts();
    const out = [cv.name, cv.title, [cv.city, cv.phone, cv.email, cv.linkedin].filter(Boolean).join(' | '), ''];
    const sec = (title, body) => { if (body.length) out.push(title.toUpperCase(), ...body, ''); };
    sec(t.profile, cv.summary ? [cv.summary] : []);
    sec(t.skills, lines(cv.skills).map((x) => '• ' + x));
    sec(t.exp, exp.flatMap((e) => [`${e.title} — ${[e.company, e.place].filter(Boolean).join(', ')} (${[e.start, e.end || t.present].filter(Boolean).join(' – ')})`, ...lines(e.bullets).map((x) => '• ' + x), '']));
    sec(t.edu, edu.map((e) => `${e.degree} — ${[e.school, e.place, e.year].filter(Boolean).join(', ')}${e.eca ? ` (${t.eca} : ${e.eca})` : ''}`));
    sec(t.lang, lines(cv.languages));
    sec(t.certs, lines(cv.certs));
    sec(t.vol, lines(cv.volunteer));
    out.push(t.ref);
    return out.filter((x) => x != null).join('\n');
  }

  function saveCv() { store.set('jt_cv', cv); renderPreview(); renderLetter(); }

  /* ---------------- Lettre de motivation ---------------- */
  const STATUS = {
    fr: {
      ee: 'Je suis actuellement en démarche de résidence permanente au Canada (Entrée express) et je peux m\'organiser rapidement pour mon arrivée.',
      lmia: 'Je suis disposé(e) à m\'installer au Canada et je peux obtenir un permis de travail avec votre soutien (EIMT ou, pour un poste hors Québec, Mobilité francophone).',
      wp: 'Je détiens un permis de travail canadien valide et je suis disponible rapidement.',
      pr: 'Je suis autorisé(e) à travailler au Canada sans restriction et je suis disponible rapidement.',
      none: '',
    },
    en: {
      ee: 'I am currently in the process of obtaining Canadian permanent residence through Express Entry and can plan my arrival promptly.',
      lmia: 'I am ready to relocate to Canada and can obtain a work permit with your support (LMIA or, for positions outside Quebec, the Francophone Mobility program).',
      wp: 'I hold a valid Canadian work permit and am available to start soon.',
      pr: 'I am fully authorized to work in Canada and am available to start soon.',
      none: '',
    },
  };

  function buildLetter() {
    const fr = lt.lang !== 'en';
    const job = lt.job || (fr ? '[poste]' : '[position]');
    const company = lt.company || (fr ? '[entreprise]' : '[company]');
    const latest = cv.exp.find((e) => e.title) || {};
    const achievements = cv.exp.flatMap((e) => lines(e.bullets)).slice(0, 3);
    const skills = lines(cv.skills).slice(0, 5);
    const edu = cv.edu.find((e) => e.degree);
    const langs = lines(cv.languages);
    const today = new Date().toLocaleDateString(fr ? 'fr-CA' : 'en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
    const contact = [cv.city, cv.phone, cv.email].filter(Boolean).join(' | ');
    const yrs = years > 0 ? years : null;
    const status = (STATUS[fr ? 'fr' : 'en'][lt.status] || '');
    const p = [];

    p.push(cv.name || (fr ? '[Votre nom]' : '[Your name]'));
    if (contact) p.push(contact);
    p.push('', today, '');
    p.push(lt.recruiter || (fr ? 'Service des ressources humaines' : 'Human Resources'));
    p.push(company);
    if (lt.companyCity) p.push(lt.companyCity);
    p.push('');

    if (fr) {
      p.push(`Objet : Candidature au poste de ${job}${lt.ref ? ` (réf. ${lt.ref})` : ''}`, '');
      p.push(lt.recruiter ? `Bonjour ${lt.recruiter},` : 'Madame, Monsieur,', '');
      p.push(`C'est avec un vif intérêt que j'ai découvert votre offre pour le poste de ${job}${lt.source ? ` publiée sur ${lt.source}` : ''}. ${yrs ? `Avec ${yrs} an${yrs > 1 ? 's' : ''} d'expérience` : 'Grâce à mon expérience'}${latest.title ? ` comme ${latest.title.toLowerCase()}` : ''}, je souhaite mettre mes compétences au service de ${company}.`, '');
      if (achievements.length) { p.push('Au cours de mon parcours, j\'ai notamment :'); achievements.forEach((a) => p.push(`• ${a}`)); p.push(''); }
      if (lt.reqs || skills.length) p.push(`${lt.reqs ? `Votre offre met l'accent sur ${lt.reqs.trim().replace(/\.$/, '')}. ` : ''}${skills.length ? `Ces attentes correspondent à mes forces : ${skills.join(', ')}.` : ''}`, '');
      if (lt.motivation) p.push(`Ce qui m'attire particulièrement chez ${company} : ${lt.motivation.trim()}`, '');
      const formation = [edu ? `Je suis titulaire d'un ${edu.degree}${edu.eca ? ` (équivalence canadienne : ${edu.eca})` : ''}` : '', langs.length ? `${edu ? ' et je maîtrise' : 'Je maîtrise'} : ${langs.join(' ; ')}` : ''].join('');
      if (formation) p.push(formation + '.', '');
      if (status) p.push(status, '');
      p.push('Je souhaiterais vivement vous présenter ma motivation plus en détail lors d\'un entretien, en personne ou par visioconférence. Vous trouverez mon CV ci-joint.', '');
      p.push('Je vous remercie de votre attention et vous prie d\'agréer mes salutations distinguées.', '');
    } else {
      p.push(`Re: Application for the ${job} position${lt.ref ? ` (Ref. ${lt.ref})` : ''}`, '');
      p.push(lt.recruiter ? `Dear ${lt.recruiter},` : 'Dear Hiring Manager,', '');
      p.push(`I am excited to apply for the ${job} position${lt.source ? ` advertised on ${lt.source}` : ''}. ${yrs ? `With ${yrs} year${yrs > 1 ? 's' : ''} of experience` : 'With my professional experience'}${latest.title ? ` as a ${latest.title}` : ''}, I am confident I can bring real value to ${company}.`, '');
      if (achievements.length) { p.push('Highlights of my experience include:'); achievements.forEach((a) => p.push(`• ${a}`)); p.push(''); }
      if (lt.reqs || skills.length) p.push(`${lt.reqs ? `Your posting emphasizes ${lt.reqs.trim().replace(/\.$/, '')}. ` : ''}${skills.length ? `These align directly with my strengths: ${skills.join(', ')}.` : ''}`, '');
      if (lt.motivation) p.push(`What draws me to ${company}: ${lt.motivation.trim()}`, '');
      const formation = [edu ? `I hold a ${edu.degree}${edu.eca ? ` (Canadian equivalency: ${edu.eca})` : ''}` : '', langs.length ? `${edu ? ' and my languages are' : 'My languages are'}: ${langs.join('; ')}` : ''].join('');
      if (formation) p.push(formation + '.', '');
      if (status) p.push(status, '');
      p.push('I would welcome the opportunity to discuss how I can contribute to your team, in person or by video call. Please find my resume attached.', '');
      p.push('Thank you for your time and consideration.', '', 'Sincerely,', '');
    }
    p.push(cv.name || '');
    return p.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function renderLetter() { const out = $('#letter-out'); if (out) out.value = buildLetter(); }

  function bindLetter() {
    $$('[data-lt]').forEach((el) => {
      if (lt[el.dataset.lt] != null) el.value = lt[el.dataset.lt];
      el.addEventListener('input', () => { lt[el.dataset.lt] = el.value; store.set('jt_letter', lt); renderLetter(); });
    });
    const subject = () => (lt.lang === 'en' ? `Application – ${lt.job || 'Position'}${lt.ref ? ` (Ref. ${lt.ref})` : ''} – ${cv.name}` : `Candidature – ${lt.job || 'Poste'}${lt.ref ? ` (réf. ${lt.ref})` : ''} – ${cv.name}`);
    const body = () => $('#letter-out').value;
    $('#lt-copy').onclick = (e) => copy(body(), e.target);
    $('#lt-gmail').onclick = () => {
      const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(lt.email || '')}&su=${encodeURIComponent(subject())}&body=${encodeURIComponent(body())}`;
      window.open(url, '_blank', 'noopener');
      track('Envoyée');
    };
    $('#lt-mail').onclick = () => {
      window.location.href = `mailto:${encodeURIComponent(lt.email || '')}?subject=${encodeURIComponent(subject())}&body=${encodeURIComponent(body())}`;
      track('Envoyée');
    };
    $('#lt-track').onclick = (e) => { track('À envoyer'); flash(e.target, 'Ajouté ✓'); };
  }

  /* ---------------- Recherche d'emploi ---------------- */
  function renderJobLinks() {
    const q = encodeURIComponent($('#js-q').value.trim());
    const l = encodeURIComponent($('#js-l').value.trim());
    const links = [
      ['Guichet-Emplois', `https://www.guichetemplois.gc.ca/jobsearch/rechercheemplois?searchstring=${q}&locationstring=${l}`],
      ['Job Bank', `https://www.jobbank.gc.ca/jobsearch/jobsearch?searchstring=${q}&locationstring=${l}`],
      ['Indeed Canada', `https://ca.indeed.com/jobs?q=${q}&l=${l}`],
      ['LinkedIn Emplois', `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${l || 'Canada'}`],
      ['Québec emploi', LINKS.quebecEmploi.url],
      ['Jobillico', LINKS.jobillico.url],
    ];
    $('#js-links').innerHTML = links.map(([name, url]) => `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">${name} ↗</a>`).join('');
  }

  /* ---------------- Suivi des candidatures ---------------- */
  const STATUSES = ['À envoyer', 'Envoyée', 'Relancée', 'Entretien', 'Offre', 'Refus'];
  function track(status) {
    if (!lt.company && !lt.job) return;
    const existing = apps.find((a) => a.company === lt.company && a.job === lt.job);
    if (existing) { if (status === 'Envoyée') existing.status = status; } else {
      apps.unshift({ company: lt.company || '—', job: lt.job || '—', date: new Date().toISOString().slice(0, 10), status });
    }
    saveApps();
  }
  function saveApps() { store.set('jt_apps', apps); renderTracker(); }
  function renderTracker() {
    const el = $('#tracker');
    if (!apps.length) { el.innerHTML = '<p class="help">Aucune candidature pour le moment. Elles s\'ajoutent ici quand vous envoyez une lettre.</p>'; return; }
    el.innerHTML = `<table class="tracker-table"><thead><tr><th>Entreprise</th><th>Poste</th><th>Date</th><th>Statut</th><th></th></tr></thead><tbody>
      ${apps.map((a, i) => `<tr><td>${esc(a.company)}</td><td>${esc(a.job)}</td><td>${esc(a.date)}</td>
        <td><select data-app="${i}">${STATUSES.map((s) => `<option ${s === a.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
        <td><button type="button" title="Supprimer" data-del-app="${i}">✕</button></td></tr>`).join('')}
    </tbody></table><p class="help">Relancez poliment par courriel 7 à 10 jours après l'envoi sans réponse.</p>`;
  }

  /* ---------------- Pré-remplissage depuis l'évaluation ---------------- */
  function prefill(d, p) {
    years = (p.cdnWork || 0) + (p.forWork || 0);
    const clbText = (arr, key, test) => {
      if (!arr) return null;
      const m = Math.min(...arr);
      const names = { ielts: 'IELTS General', celpip: 'CELPIP-General', tef: 'TEF Canada', tcf: 'TCF Canada', clb: '' };
      const lvl = `${key === 'fr' ? 'NCLC' : 'CLB'} ${m}`;
      const lang = key === 'fr' ? (cv.lang === 'en' ? 'French' : 'Français') : (cv.lang === 'en' ? 'English' : 'Anglais');
      return `${lang} — ${lvl}${names[test] ? ` (${names[test]})` : ''}`;
    };
    let changed = false;
    if (!cv.languages.trim()) {
      const l = [clbText(p.en, 'en', d.enTest), clbText(p.fr, 'fr', d.frTest)].filter(Boolean);
      if (l.length) { cv.languages = l.join('\n'); changed = true; }
    }
    if (!cv.title && d.jobTitle) { cv.title = d.jobTitle; changed = true; }
    if (!lt.job && d.jobTitle) { lt.job = d.jobTitle; store.set('jt_letter', lt); const el = $('[data-lt="job"]'); if (el) el.value = lt.job; }
    if (!$('#js-q').value && d.jobTitle) $('#js-q').value = d.jobTitle;
    if (!$('#js-l').value && d.province && PROVINCES[d.province]) $('#js-l').value = PROVINCES[d.province].name;
    if (changed) { $$('[data-cv]').forEach((el) => { el.value = cv[el.dataset.cv] || ''; }); saveCv(); }
    renderJobLinks();
    renderLetter();
  }

  /* ---------------- Initialisation ---------------- */
  function init() {
    bindSimple();
    renderLists();
    renderPreview();
    $('#cv-form').addEventListener('input', onListInput);
    $('#add-exp').onclick = () => { cv.exp.push(emptyExp()); renderLists(); saveCv(); };
    $('#add-edu').onclick = () => { cv.edu.push(emptyEdu()); renderLists(); saveCv(); };
    $('#cv-form').addEventListener('click', (e) => {
      const b = e.target.closest('[data-remove]');
      if (!b) return;
      cv[b.dataset.remove].splice(+b.dataset.i, 1);
      if (!cv[b.dataset.remove].length) cv[b.dataset.remove].push(b.dataset.remove === 'exp' ? emptyExp() : emptyEdu());
      renderLists(); saveCv();
    });
    $('#cv-print').onclick = () => window.print();
    $('#cv-copy').onclick = (e) => copy(cvText(), e.target);

    bindLetter();
    renderLetter();
    $('#js-q').addEventListener('input', renderJobLinks);
    $('#js-l').addEventListener('input', renderJobLinks);
    renderJobLinks();

    $('#tracker').addEventListener('change', (e) => {
      const s = e.target.closest('[data-app]');
      if (s) { apps[+s.dataset.app].status = s.value; saveApps(); }
    });
    $('#tracker').addEventListener('click', (e) => {
      const b = e.target.closest('[data-del-app]');
      if (b) { apps.splice(+b.dataset.delApp, 1); saveApps(); }
    });
    renderTracker();
  }

  return { init, prefill };
})();
