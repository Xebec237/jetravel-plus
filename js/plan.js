/*
 * Génère le plan d'action personnalisé.
 * Chaque amélioration est simulée avec CRS.score() pour afficher le gain réel en points.
 */
const Plan = (() => {
  const { esc, store } = JT;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const lift = (arr, lvl) => (arr || [0, 0, 0, 0]).map((c) => Math.max(c, lvl));
  const minOf = (a) => (a ? Math.min(...a) : 0);
  const prio = (g) => (g >= 50 ? 'haute' : g >= 15 ? 'moyenne' : 'basse');

  function build(d, p, r) {
    const base = r.total;
    const sim = (fn) => { const q = clone(p); fn(q); return CRS.score(q).total - base; };
    const boost = [];   // A. actions qui augmentent le score
    const process = []; // B. étapes du dossier et de la recherche d'emploi
    const alerts = [];
    const L = LINKS;
    const firstKey = r.firstKey;
    const first = p[firstKey];
    const langLabel = (key, arr) => arr
      ? arr.map((c, i) => `${SKILL_NAMES[i]} : ${key === 'fr' ? 'NCLC' : 'CLB'} ${c < 4 ? '< 4' : c}`).join(' · ')
      : '';

    /* ----- Âge : alerte d'urgence ----- */
    if (p.age >= 29 && p.age < 45) {
      const loss = sim((q) => { q.age += 1; });
      if (loss < 0) alerts.push({ cls: 'warn', html: `⏳ <b>Le temps compte :</b> à votre prochain anniversaire, vous perdrez environ <b>${-loss} points</b> d'âge. Les actions ci-dessous sont à lancer dès maintenant.` });
    }
    if (!p.en && !p.fr) alerts.push({ cls: 'bad', html: '⚠ <b>Sans test de langue valide, vous ne pouvez pas créer de profil Entrée express.</b> Commencez par l\'action « Passer un test de langue ».' });
    else if (minOf(first) < 7 && p.cdnWork === 0) alerts.push({ cls: 'warn', html: '⚠ Le Programme des travailleurs qualifiés (fédéral) exige au minimum <b>CLB 7 dans les 4 compétences</b> et 1 an d\'expérience qualifiée continue. Améliorer votre test de langue est prioritaire.' });
    if (d.province === 'QC') alerts.push({ cls: 'info', html: 'ℹ Le <b>Québec ne participe pas à Entrée express</b> : il sélectionne ses travailleurs avec ses propres programmes (Arrima / PSTQ). Le plan ci-dessous reste utile pour les autres provinces, et le français est un atout majeur au Québec.' });

    /* ----- 1. Évaluation des diplômes (EDE / WES) ----- */
    if (!p.hasEca && p.canEdu === 0 && p.declaredEdu > 0) {
      const g = sim((q) => { q.edu = q.declaredEdu; });
      boost.push({
        id: 'eca', gain: g, title: 'Faire évaluer vos diplômes étrangers (EDE / ECA) avec WES',
        why: `Sans évaluation des diplômes d'études (EDE), IRCC ne vous accorde <b>aucun point</b> pour vos études faites hors du Canada. Avec l'EDE de votre ${EDU_LABELS[p.declaredEdu]}, vous gagnez environ <b>${g} points</b>. C'est aussi obligatoire pour le Programme des travailleurs qualifiés (fédéral).`,
        steps: [
          'Créez votre compte sur le site de WES Canada (lien ci-dessous) et choisissez « ECA Application for IRCC ».',
          'Payez les frais en ligne et notez votre numéro de référence WES.',
          'Demandez à votre université ou école d\'envoyer vos relevés de notes officiels directement à WES (enveloppe scellée ou envoi électronique sécurisé), et téléversez une copie de votre diplôme.',
          'Si possible, faites évaluer tous vos diplômes post-secondaires : deux diplômes dont un de 3 ans ou plus donnent plus de points.',
          'Comptez environ 35 jours ouvrables après réception du dossier complet. L\'EDE est valide 5 ans.',
          'Indiquez le numéro de l\'EDE dans votre profil Entrée express et sur votre CV (« Équivalence canadienne : … »).',
        ],
        links: [L.wes, L.ecaList],
      });
    }

    /* ----- 2. Langue principale ----- */
    const firstName = firstKey === 'fr' ? 'français' : 'anglais';
    const langLinks = firstKey === 'fr'
      ? [L.tef, L.tcf, L.tv5, L.rfi, L.ircLang]
      : [L.ielts, L.celpip, L.pte, L.britishCouncil, L.ircLang];
    if (!p.en && !p.fr) {
      const g7 = sim((q) => { q.en = [7, 7, 7, 7]; });
      const g9 = sim((q) => { q.en = [9, 9, 9, 9]; });
      boost.push({
        id: 'lang-test', gain: g9, title: 'Passer un test de langue officiel (obligatoire)',
        why: `Aucun profil n'est possible sans résultat de test approuvé par IRCC. Avec <b>CLB 7</b> dans les 4 compétences, vous gagneriez environ <b>+${g7} points</b> ; avec <b>CLB 9</b>, environ <b>+${g9} points</b>.`,
        steps: [
          'Choisissez votre test : IELTS General Training, CELPIP-General ou PTE Core pour l\'anglais ; TEF Canada ou TCF Canada pour le français.',
          'Préparez-vous 4 à 8 semaines avec des tests blancs chronométrés.',
          'Réservez votre session dans un centre agréé (le résultat est valide 2 ans).',
          'Si vous parlez les deux langues, passez les deux tests : la deuxième langue rapporte des points supplémentaires.',
        ],
        links: [L.ielts, L.celpip, L.tef, L.tcf, L.ircLang],
      });
    } else if (minOf(first) < 10) {
      const g9 = sim((q) => { q[firstKey] = lift(q[firstKey], 9); });
      const g10 = sim((q) => { q[firstKey] = lift(q[firstKey], 10); });
      const weak = first.map((c, i) => ({ c, i })).filter((x) => x.c < 9).map((x) => SKILL_NAMES[x.i].toLowerCase());
      boost.push({
        id: 'lang-main', gain: g9 > 0 ? g9 : g10,
        title: `Améliorer votre résultat en ${firstName} (viser ${firstKey === 'fr' ? 'NCLC' : 'CLB'} 9 et plus)`,
        why: `La langue est le facteur qui rapporte le plus de points, et le niveau 9 débloque aussi les points de transférabilité. Vos niveaux actuels : ${langLabel(firstKey, first)}.<br>`
          + (g9 > 0 ? `→ Niveau 9 partout : <b>+${g9} points</b>. ` : '')
          + `→ Niveau 10 partout : <b>+${g10} points</b>.`,
        steps: [
          weak.length ? `Concentrez-vous d'abord sur : ${weak.join(', ')}.` : 'Vous êtes à 9 partout : visez 10 dans chaque compétence.',
          'Faites un test blanc complet pour mesurer votre niveau réel, puis entraînez-vous chaque jour sur la compétence la plus faible.',
          firstKey === 'fr'
            ? 'TEF Canada et TCF Canada sont tous deux acceptés : choisissez le format qui vous convient le mieux.'
            : 'Comparez IELTS, CELPIP et PTE Core : CELPIP et PTE se passent entièrement sur ordinateur, avec un accent nord-américain pour CELPIP.',
          'Repassez le test lorsque vos tests blancs atteignent le niveau visé, puis mettez à jour votre profil Entrée express.',
        ],
        links: langLinks,
      });
    }

    /* ----- 3. Deuxième langue officielle ----- */
    if (firstKey === 'en' && p.en && minOf(p.fr) < 7) {
      const g = sim((q) => { q.fr = lift(q.fr, 7); });
      boost.push({
        id: 'french', gain: g, title: 'Ajouter le français : viser NCLC 7 au TEF Canada ou au TCF Canada',
        why: `Atteindre NCLC 7 dans les 4 compétences en français vous rapporterait <b>+${g} points</b> (bonus francophone de 25 à 50 points + points de deuxième langue). Il donne surtout accès aux <b>tirages réservés aux francophones</b> : 5 000 invitations par tirage en 2026, avec un dernier seuil de <b>${lastDraw('french').crs} points</b> (au ${IRCC_DATA_DATE}).`,
        steps: [
          'NCLC 7 correspond environ au niveau B2 : prévoyez quelques mois d\'apprentissage régulier.',
          'Utilisez des ressources gratuites (TV5Monde, RFI) et, si possible, un cours à l\'Alliance française.',
          'Entraînez-vous avec des épreuves blanches TEF Canada ou TCF Canada.',
          'Passez le test et ajoutez les résultats à votre profil Entrée express.',
        ],
        links: [L.tef, L.tcf, L.tv5, L.rfi],
      });
    }
    if (firstKey === 'fr' && minOf(p.en) < 7) {
      const g5 = sim((q) => { q.en = lift(q.en, 5); });
      const g7 = sim((q) => { q.en = lift(q.en, 7); });
      if (g7 > 0) {
        const bonusNote = minOf(p.fr) >= 7
          ? 'Avec votre français à NCLC 7+, un anglais à <b>CLB 5</b> dans les 4 compétences fait passer votre bonus francophone de 25 à 50 points.'
          : 'L\'anglais vous rapporte des points de deuxième langue et augmente vos chances d\'emploi hors Québec.';
        boost.push({
          id: 'english', gain: g7, title: 'Ajouter ou améliorer l\'anglais (viser CLB 5, puis CLB 7)',
          why: `${bonusNote} Gain estimé : <b>+${g5} points</b> avec CLB 5, <b>+${g7} points</b> avec CLB 7.`,
          steps: [
            'Commencez par un test blanc pour connaître votre niveau actuel.',
            'Pratiquez chaque jour (cours gratuits du British Council, podcasts, séries en anglais).',
            'Passez l\'IELTS General Training, le CELPIP-General ou le PTE Core.',
            'L\'anglais est aussi décisif pour trouver un emploi hors Québec : mentionnez votre niveau sur votre CV.',
          ],
          links: [L.ielts, L.celpip, L.pte, L.britishCouncil],
        });
      }
    }

    /* ----- 4. Conjoint ----- */
    if (p.ws) {
      if (minOf(p.spouse.lang) < 9) {
        const g = sim((q) => { q.spouse.lang = lift(q.spouse.lang, 9); });
        if (g > 0) boost.push({
          id: 'sp-lang', gain: g, title: 'Faire passer (ou repasser) un test de langue à votre conjoint(e)',
          why: `Les résultats de langue de votre conjoint(e) comptent jusqu'à 20 points. Niveau 9 dans les 4 compétences : <b>+${g} points</b>.`,
          steps: [
            'Votre conjoint(e) peut passer le test en anglais OU en français.',
            'Même un niveau 5 rapporte déjà des points (1 par compétence).',
            'Ajoutez ses résultats dans la section « Conjoint » de votre profil Entrée express.',
          ],
          links: [L.ielts, L.celpip, L.tef, L.tcf],
        });
      }
      if (!p.spEca && p.spouse.declaredEdu > 0) {
        const g = sim((q) => { q.spouse.edu = q.spouse.declaredEdu; });
        if (g > 0) boost.push({
          id: 'sp-eca', gain: g, title: 'Faire évaluer les diplômes de votre conjoint(e) (EDE)',
          why: `Les études de votre conjoint(e) ne comptent que si elles sont évaluées : <b>+${g} points</b>.`,
          steps: ['Même démarche que pour vous : compte WES, choix « ECA for IRCC », envoi des relevés officiels.'],
          links: [L.wes, L.ecaList],
        });
      }
      const g = sim((q) => { q.ws = false; });
      if (g > 0) boost.push({
        id: 'sp-strategy', gain: g, title: 'Option stratégique : conjoint(e) non accompagnant(e) ou inversion des rôles',
        why: `Si votre conjoint(e) ne vous accompagne pas au moment de la demande, vous êtes évalué(e) comme une personne seule : <b>+${g} points</b>. Il ou elle pourrait être parrainé(e) plus tard, mais ce choix a des conséquences importantes : informez-vous bien avant de le faire.`,
        steps: [
          'Refaites l\'évaluation en inversant les rôles : votre conjoint(e) a peut-être un meilleur score comme demandeur principal.',
          'Comparez les deux scénarios avant de créer le profil.',
          'Pour une décision de ce type, consultez un consultant réglementé (vérifiable sur le site du CICC).',
        ],
        links: [L.cicc, L.ee],
      });
    }

    /* ----- 5. Expérience canadienne ----- */
    if (p.cdnWork < 5) {
      const g = sim((q) => { q.cdnWork += 1; });
      boost.push({
        id: 'cdn-work', gain: g, title: 'Acquérir de l\'expérience de travail qualifiée au Canada',
        why: `Une année supplémentaire d'expérience au Canada : <b>+${g} points</b> (points directs + transférabilité). Une première année donne aussi accès à la <b>Catégorie de l'expérience canadienne</b>, souvent invitée lors de tirages ciblés.`,
        steps: [
          'Si vous avez 18-35 ans et que votre pays a un accord avec le Canada : demandez un permis Vacances-Travail (PVT / EIC).',
          'Si vous êtes francophone : la Mobilité francophone permet à un employeur hors Québec de vous embaucher sans EIMT (voir la page « Travailler au Canada »).',
          'Sinon : un employeur peut vous embaucher avec une EIMT (étude d\'impact sur le marché du travail).',
          'Après des études au Canada, le permis de travail post-diplôme permet aussi d\'accumuler cette expérience.',
          'L\'emploi doit être qualifié (FEER 0, 1, 2 ou 3) et rémunéré : gardez vos fiches de paie et lettres d\'employeur.',
        ],
        links: [L.iec, L.workCanada, L.noc],
      });
    }

    /* ----- 6. Expérience étrangère ----- */
    if (p.forWork < 3) {
      const g = sim((q) => { q.forWork += 1; });
      if (g > 0) boost.push({
        id: 'for-work', gain: g, title: 'Continuer à accumuler de l\'expérience qualifiée dans votre pays',
        why: `L'expérience hors Canada compte dans la transférabilité (avec un bon niveau de langue). Une année de plus : <b>+${g} points</b>. Le maximum est atteint à 3 ans.`,
        steps: [
          'L\'emploi doit être qualifié (FEER 0 à 3), rémunéré, au moins 30 h/semaine, dans les 10 dernières années.',
          'Demandez à chaque employeur une attestation d\'emploi détaillée : poste, tâches, heures/semaine, salaire, dates, signature et coordonnées.',
          'Vérifiez que vos tâches correspondent au code CNP que vous déclarez.',
        ],
        links: [L.noc],
      });
    }

    /* ----- 7. Études supplémentaires ----- */
    if (p.declaredEdu < 6) {
      // Gain mesuré à partir du score avec EDE, pour ne pas compter deux fois l'évaluation des diplômes.
      const withEca = sim((q) => { q.edu = q.declaredEdu; });
      const gMaster = sim((q) => { q.edu = 6; }) - withEca;
      const g2 = p.declaredEdu === 4 ? sim((q) => { q.edu = 5; }) - withEca : 0;
      boost.push({
        id: 'more-edu', gain: gMaster, title: 'Obtenir un diplôme supplémentaire (master ou deuxième diplôme)',
        why: `Un master (évalué par l'EDE) vous rapporterait <b>+${gMaster} points</b>${g2 ? `, et un simple deuxième diplôme post-secondaire (en plus de votre licence) <b>+${g2} points</b>` : ''}. C'est une action à moyen terme.`,
        steps: [
          'Les formations en ligne ou à distance reconnues comptent si elles mènent à un vrai diplôme.',
          'Pensez à faire évaluer chaque nouveau diplôme par WES.',
          'Étudier au Canada donne en plus des points de diplôme canadien et un permis de travail post-diplôme.',
        ],
        links: [L.wes, L.study],
      });
    }
    if (p.canEdu < 2) {
      const g = sim((q) => { q.canEdu = q.canEdu === 0 ? 1 : 2; });
      boost.push({
        id: 'cdn-study', gain: g, title: 'Étudier au Canada',
        why: `Un diplôme canadien rapporte des points supplémentaires (<b>+${g} points</b> pour l'étape suivante) et vous permet d'obtenir ensuite un permis de travail post-diplôme pour acquérir de l'expérience canadienne.`,
        steps: [
          'Choisissez un établissement d\'enseignement désigné et un programme admissible au permis post-diplôme.',
          'Demandez votre permis d\'études (lettre d\'acceptation, preuve de fonds, etc.).',
          'Travaillez pendant et après vos études pour accumuler de l\'expérience canadienne.',
        ],
        links: [L.study],
      });
    }

    /* ----- 8. Métiers spécialisés ----- */
    if (!p.tradeCert) {
      const g = sim((q) => { q.tradeCert = true; });
      if (g > 0) boost.push({
        id: 'trade', gain: g, title: 'Si vous exercez un métier spécialisé : certificat de qualification',
        why: `Électricien, plombier, soudeur, cuisinier, mécanicien… Un certificat de qualification d'une province canadienne avec un bon niveau de langue rapporte <b>+${g} points</b>.`,
        steps: [
          'Vérifiez si votre métier fait partie du programme Sceau rouge.',
          'Contactez l\'organisme de certification de la province visée pour faire reconnaître votre expérience et passer l\'examen.',
        ],
        links: [L.redSeal],
      });
    }

    /* ----- 9. Nomination provinciale ----- */
    if (!p.pnp) {
      const prov = PROVINCES[d.province];
      const provLinks = Object.entries(PROVINCES)
        .filter(([, v]) => v.pnp)
        .sort(([a], [b]) => (a === d.province ? -1 : b === d.province ? 1 : 0))
        .map(([, v]) => v.pnp);
      boost.push({
        id: 'pnp', gain: 600, gainLabel: '+600 pts', title: 'Obtenir une nomination provinciale (PNP)',
        why: 'Une nomination d\'une province via un volet « Entrée express » ajoute <b>600 points</b> : l\'invitation est alors quasiment garantie au tirage suivant. C\'est la voie la plus puissante si votre score de base est moyen.',
        steps: [
          'Créez d\'abord votre profil Entrée express et indiquez les provinces qui vous intéressent.',
          `Repérez les volets « Express Entry » de chaque province${prov ? ` (en priorité : ${prov.name})` : ''} : certaines provinces invitent directement des candidats du bassin (ex. Ontario — volet travailleurs qualifiés francophones).`,
          'Beaucoup de provinces ciblent des métiers en pénurie (santé, construction, technologies, transport) : vérifiez si le vôtre en fait partie.',
          'Une offre d\'emploi dans la province augmente fortement vos chances de nomination.',
          'Une fois nommé(e), acceptez la nomination dans votre profil en ligne : les 600 points s\'ajoutent automatiquement.',
        ],
        links: [L.pnp, ...provLinks],
      });
    }

    /* ----- 10. Frère / sœur ----- */
    if (!p.sibling) {
      boost.push({
        id: 'sibling', gain: 15, title: 'Avez-vous un frère ou une sœur au Canada ?',
        why: 'Si un frère ou une sœur (même parent biologique ou adoptif, ou par mariage), citoyen(ne) ou résident(e) permanent(e), de 18 ans ou plus, vit au Canada : <b>+15 points</b>.',
        steps: ['Rassemblez les preuves du lien (actes de naissance) et de son statut (carte RP, passeport canadien), et déclarez-le dans votre profil.'],
        links: [L.ee],
      });
    }

    boost.sort((a, b) => b.gain - a.gain);

    /* ===== B. Étapes du dossier et de la recherche d'emploi ===== */
    process.push({
      id: 'eligibility', title: 'Vérifier votre admissibilité et trouver votre code CNP',
      why: 'Entrée express gère 3 programmes : travailleurs qualifiés (fédéral), expérience canadienne et métiers spécialisés. Votre code CNP (Classification nationale des professions) détermine si votre expérience est qualifiée.',
      steps: [
        'Cherchez votre métier sur le site de la CNP et notez le code à 5 chiffres et son niveau FEER.',
        'Comparez les « fonctions principales » avec vos vraies tâches : elles doivent correspondre.',
        'Vérifiez les critères du programme visé (expérience, langue, études, fonds).',
        'Comparez votre résultat ici avec le calculateur CRS officiel.',
      ],
      links: [L.noc, L.eligibility, L.crsTool],
    });
    process.push({
      id: 'cv', title: 'Rédiger un CV au format canadien',
      why: 'Les employeurs canadiens attendent un format précis : sans photo ni informations personnelles, centré sur les réalisations chiffrées. Notre outil vous guide et exporte un PDF.',
      steps: [
        'Ouvrez l\'onglet « CV canadien » : vos langues et votre métier sont déjà pré-remplis.',
        'Décrivez chaque poste avec 3 à 5 réalisations chiffrées commençant par un verbe d\'action.',
        'Indiquez l\'équivalence canadienne de vos diplômes (EDE / WES).',
        'Exportez en PDF, puis adaptez les mots-clés pour chaque offre.',
      ],
      action: { label: 'Créer mon CV canadien', tab: 'cv' },
      links: [],
    });
    process.push({
      id: 'linkedin', title: 'Optimiser votre profil LinkedIn',
      why: 'Les recruteurs canadiens consultent presque toujours LinkedIn avant un entretien.',
      steps: [
        'Photo professionnelle, titre clair (« Comptable | IFRS | Disponible pour le Canada »).',
        'Recopiez le résumé et les expériences de votre CV, en anglais et/ou en français.',
        'Indiquez la ville canadienne visée dans « Préférences d\'emploi ».',
        'Connectez-vous avec des recruteurs et des professionnels de votre domaine au Canada.',
      ],
      links: [L.linkedin],
    });
    process.push({
      id: 'jobs', title: 'Chercher un emploi et envoyer vos candidatures',
      why: 'Depuis le 25 mars 2025, une offre d\'emploi ne donne plus de points CRS, mais elle reste un levier majeur : nomination provinciale (+600), permis de travail (expérience canadienne) et installation plus facile.',
      steps: [
        'Ouvrez l\'onglet « Emploi & lettre » et lancez une recherche sur Job Bank / Guichet-Emplois, Indeed et LinkedIn.',
        'Sur Job Bank, filtrez les employeurs ouverts aux candidats étrangers.',
        'Pour chaque offre, générez une lettre de motivation adaptée et envoyez-la avec votre CV en PDF.',
        'Suivez vos candidatures et relancez poliment après 7 à 10 jours.',
      ],
      action: { label: 'Chercher un emploi et écrire ma lettre', tab: 'jobs' },
      links: [L.guichet, L.jobBank, L.indeed, L.linkedinJobs],
    });
    process.push({
      id: 'funds', title: 'Préparer votre preuve de fonds',
      why: 'Sauf si vous avez une offre d\'emploi valide ou passez par l\'expérience canadienne, vous devez prouver un montant minimum qui dépend de la taille de votre famille (mis à jour chaque année).',
      steps: [
        'Consultez le montant exigé pour votre famille sur le site d\'IRCC.',
        'Gardez cet argent sur un compte à votre nom, disponible et non emprunté.',
        'Demandez à la banque une lettre officielle avec le solde actuel et le solde moyen des 6 derniers mois.',
      ],
      links: [L.funds],
    });
    process.push({
      id: 'profile', title: 'Créer votre profil Entrée express',
      why: 'Le profil est valide 12 mois. Vous entrez dans le bassin de candidats et pouvez recevoir une invitation à présenter une demande (IPD).',
      steps: [
        'Préparez : passeport, résultats de test de langue, numéro d\'EDE, code CNP, détail de votre expérience.',
        'Créez votre compte IRCC sécurisé et remplissez le profil (déclarez les informations exactes).',
        'Indiquez les provinces qui vous intéressent pour être repéré(e) par les programmes provinciaux.',
        'Mettez à jour le profil à chaque nouveau résultat (langue, diplôme, expérience).',
      ],
      links: [L.ee, L.rounds],
    });
    process.push({
      id: 'draws', title: 'Viser les bons tirages : catégories 2026',
      why: `En 2026, IRCC invite surtout par catégorie et par programme. Derniers seuils au ${IRCC_DATA_DATE} : français ${lastDraw('french').crs}, santé ${lastDraw('health').crs}, métiers ${lastDraw('trades').crs}, transport ${lastDraw('transport').crs}, expérience canadienne ${lastDraw('cec').crs}. Nouveautés 2026 : médecins, cadres supérieurs et chercheurs avec expérience canadienne, transport et recrues militaires.`,
      steps: [
        'Regardez la carte « Vos chances dans les tirages 2026 » plus haut : elle compare votre score aux derniers seuils.',
        'Vérifiez que votre code CNP figure dans la liste officielle de la catégorie visée.',
        'Les catégories demandent désormais 12 mois d\'expérience à temps plein dans les 3 dernières années (au Canada uniquement pour médecins, cadres supérieurs et chercheurs).',
        'Consultez régulièrement la page des tirages : un nouveau tirage a lieu presque chaque semaine.',
      ],
      links: [L.categories, L.rounds, L.news2026],
    });
    process.push({
      id: 'docs', title: 'Préparer vos documents à l\'avance',
      why: 'Après l\'invitation, vous n\'avez que 60 jours pour soumettre la demande complète. Préparer les documents maintenant évite de perdre l\'invitation.',
      steps: [
        'Passeport valide pour vous et votre famille.',
        'Certificats de police de chaque pays où vous avez vécu 6 mois ou plus depuis vos 18 ans.',
        'Attestations d\'emploi détaillées (tâches, heures, salaire), fiches de paie, contrats.',
        'Actes de naissance, acte de mariage, photos au format IRCC.',
        'Examen médical auprès d\'un médecin désigné par IRCC (à faire après l\'invitation).',
      ],
      links: [L.medPolice],
    });
    process.push({
      id: 'fraud', title: 'Se protéger contre les arnaques',
      why: 'Les démarches sur les sites d\'IRCC sont gratuites (hors frais officiels). Personne ne peut « garantir » un visa ou une offre d\'emploi contre paiement.',
      steps: [
        'N\'utilisez que les sites officiels (canada.ca) pour les formulaires et les paiements.',
        'Si vous prenez un consultant, vérifiez qu\'il est inscrit au CICC.',
        'Méfiez-vous de toute offre d\'emploi qui demande de l\'argent.',
      ],
      links: [L.fraud, L.cicc],
    });

    /* ----- Score atteignable à court terme ----- */
    const q = clone(p);
    if (!q.hasEca && q.declaredEdu > 0) q.edu = Math.max(q.edu, q.declaredEdu);
    if (q.en || q.fr) q[firstKey] = lift(q[firstKey], 9); else q.en = [9, 9, 9, 9];
    if (firstKey === 'fr' && p.fr) q.en = lift(q.en, 5);
    if (q.ws) { q.spouse.lang = lift(q.spouse.lang, 7); q.spouse.edu = Math.max(q.spouse.edu, q.spouse.declaredEdu); }
    const potential = Math.max(base, CRS.score(q).total);

    return { boost, process, alerts, potential };
  }

  /* ---------- Rendu HTML ---------- */
  function itemHtml(it, n, done) {
    const gain = it.gainLabel || (it.gain != null ? (it.gain > 0 ? `+${it.gain} pts` : null) : null);
    const links = (it.links || []).map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('');
    const action = it.action ? `<button type="button" data-goto="${it.action.tab}">${esc(it.action.label)} →</button>` : '';
    const p = it.gain != null ? `p-${prio(it.gain)}` : '';
    return `<article class="plan-item ${p} ${done ? 'done' : ''}" data-id="${it.id}">
      <div class="pi-head"><span class="pi-num">${n}</span><h3>${esc(it.title)}</h3>
        ${gain ? `<span class="gain">${gain}</span>` : (it.gain == null ? '' : '<span class="gain neutral">info</span>')}</div>
      <p class="why">${it.why}</p>
      <ol>${it.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      ${links || action ? `<div class="plan-links">${action}${links}</div>` : ''}
      <label class="done-toggle"><input type="checkbox" data-done="${it.id}" ${done ? 'checked' : ''}> C'est fait</label>
    </article>`;
  }

  function render(plan) {
    const done = store.get('jt_done', {});
    let n = 0;
    const all = [...plan.boost, ...plan.process];
    const count = all.filter((it) => done[it.id]).length;
    return `
      <div class="plan-head">
        <h2>Votre plan d'action (${all.length} étapes)</h2>
        <span class="plan-progress" id="plan-progress">${count} / ${all.length} terminées</span>
      </div>
      ${plan.alerts.map((a) => `<div class="alert ${a.cls}">${a.html}</div>`).join('')}
      <h3 class="plan-section-title">A. Augmenter votre score — classé par nombre de points gagnés</h3>
      ${plan.boost.map((it) => itemHtml(it, ++n, done[it.id])).join('')}
      <h3 class="plan-section-title">B. Préparer votre dossier et trouver un emploi</h3>
      ${plan.process.map((it) => itemHtml(it, ++n, done[it.id])).join('')}`;
  }

  return { build, render };
})();
