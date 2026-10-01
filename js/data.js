/* Liens officiels et utiles utilisés dans le plan d'action */
const IRCC = 'https://www.canada.ca/en/immigration-refugees-citizenship/services';

const LINKS = {
  // Évaluation des diplômes
  wes: { label: 'WES Canada — faire évaluer mes diplômes', url: 'https://www.wes.org/ca/' },
  ecaList: { label: 'Organismes d\'évaluation désignés par IRCC', url: `${IRCC}/immigrate-canada/express-entry/documents/education-assessed.html` },

  // Langues
  ircLang: { label: 'Tests de langue acceptés par IRCC', url: `${IRCC}/immigrate-canada/express-entry/documents/language-requirements.html` },
  ielts: { label: 'IELTS General Training', url: 'https://ielts.org/' },
  celpip: { label: 'CELPIP-General', url: 'https://www.celpip.ca/' },
  pte: { label: 'PTE Core', url: 'https://www.pearsonpte.com/pte-core' },
  britishCouncil: { label: 'British Council — cours d\'anglais gratuits', url: 'https://learnenglish.britishcouncil.org/' },
  tef: { label: 'TEF Canada (CCI Paris)', url: 'https://www.lefrancaisdesaffaires.fr/tests-diplomes/test-evaluation-francais-tef/tef-canada/' },
  tcf: { label: 'TCF Canada (France Éducation International)', url: 'https://www.france-education-international.fr/test/tcf-canada' },
  tv5: { label: 'TV5Monde — apprendre le français', url: 'https://apprendre.tv5monde.com/' },
  rfi: { label: 'RFI — Français facile', url: 'https://francaisfacile.rfi.fr/' },

  // Entrée express
  ee: { label: 'Entrée express (site officiel IRCC)', url: `${IRCC}/immigrate-canada/express-entry.html` },
  eligibility: { label: 'Vérifier mon admissibilité', url: `${IRCC}/immigrate-canada/express-entry/eligibility.html` },
  crsTool: { label: 'Calculateur CRS officiel', url: 'https://www.cic.gc.ca/english/immigrate/skilled/crs-tool.asp' },
  rounds: { label: 'Résultats des tirages Entrée express', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/corporate/mandate/policies-operational-instructions-agreements/ministerial-instructions/express-entry-rounds.html' },
  funds: { label: 'Preuve de fonds — montants exigés', url: `${IRCC}/immigrate-canada/express-entry/documents/proof-funds.html` },
  medPolice: { label: 'Examen médical et certificats de police', url: `${IRCC}/application/medical-police.html` },
  noc: { label: 'Trouver mon code CNP (NOC)', url: 'https://noc.esdc.gc.ca/' },
  pnp: { label: 'Programme des candidats des provinces (IRCC)', url: `${IRCC}/immigrate-canada/provincial-nominees.html` },
  workCanada: { label: 'Travailler au Canada — permis de travail', url: `${IRCC}/work-canada.html` },
  iec: { label: 'Expérience internationale Canada (PVT / EIC)', url: `${IRCC}/work-canada/iec.html` },
  study: { label: 'Étudier au Canada', url: `${IRCC}/study-canada.html` },
  redSeal: { label: 'Programme Sceau rouge (métiers)', url: 'https://www.red-seal.ca/' },
  fraud: { label: 'Se protéger contre la fraude (IRCC)', url: `${IRCC}/protect-fraud.html` },
  cicc: { label: 'Vérifier un consultant autorisé (CICC)', url: 'https://college-ic.ca/' },
  quebec: { label: 'Immigrer au Québec (programmes québécois)', url: 'https://www.quebec.ca/immigration' },

  // Emploi
  jobBank: { label: 'Job Bank (Canada)', url: 'https://www.jobbank.gc.ca/' },
  guichet: { label: 'Guichet-Emplois (Canada)', url: 'https://www.guichetemplois.gc.ca/' },
  indeed: { label: 'Indeed Canada', url: 'https://ca.indeed.com/' },
  linkedinJobs: { label: 'LinkedIn Emplois', url: 'https://www.linkedin.com/jobs/' },
  linkedin: { label: 'LinkedIn', url: 'https://www.linkedin.com/' },
  quebecEmploi: { label: 'Québec emploi', url: 'https://www.quebecemploi.gouv.qc.ca/' },
  jobillico: { label: 'Jobillico (Québec)', url: 'https://www.jobillico.com/' },
};

const PROVINCES = {
  ON: { name: 'Ontario', pnp: { label: 'Ontario — OINP', url: 'https://www.ontario.ca/page/ontario-immigrant-nominee-program-oinp' } },
  QC: { name: 'Québec', pnp: null },
  BC: { name: 'Colombie-Britannique', pnp: { label: 'Colombie-Britannique — BC PNP', url: 'https://www.welcomebc.ca/immigrate-to-b-c' } },
  AB: { name: 'Alberta', pnp: { label: 'Alberta — AAIP', url: 'https://www.alberta.ca/alberta-advantage-immigration-program' } },
  MB: { name: 'Manitoba', pnp: { label: 'Manitoba — MPNP', url: 'https://immigratemanitoba.com/' } },
  SK: { name: 'Saskatchewan', pnp: { label: 'Saskatchewan — SINP', url: 'https://www.saskatchewan.ca/residents/moving-to-saskatchewan/live-in-saskatchewan/by-immigrating/saskatchewan-immigrant-nominee-program' } },
  NS: { name: 'Nouvelle-Écosse', pnp: { label: 'Nouvelle-Écosse — NSNP', url: 'https://liveinnovascotia.com/' } },
  NB: { name: 'Nouveau-Brunswick', pnp: { label: 'Nouveau-Brunswick — NBPNP', url: 'https://www.welcomenb.ca/' } },
  PE: { name: 'Île-du-Prince-Édouard', pnp: { label: 'Île-du-Prince-Édouard — PEI PNP', url: 'https://www.princeedwardisland.ca/en/topic/office-immigration' } },
  NL: { name: 'Terre-Neuve-et-Labrador', pnp: { label: 'Terre-Neuve-et-Labrador — NLPNP', url: 'https://www.gov.nl.ca/immigration/' } },
  YT: { name: 'Yukon', pnp: { label: 'Yukon — YNP', url: 'https://yukon.ca/en/immigration' } },
  NT: { name: 'Territoires du Nord-Ouest', pnp: { label: 'T.N.-O. — NTNP', url: 'https://www.immigratenwt.ca/' } },
  NU: { name: 'Nunavut', pnp: null },
};

const EDU_LABELS = [
  'moins qu\'un diplôme secondaire', 'diplôme secondaire', 'diplôme post-secondaire d\'un an',
  'diplôme post-secondaire de deux ans', 'licence / diplôme de 3 ans', 'deux diplômes post-secondaires',
  'master', 'doctorat',
];
const SKILL_NAMES = ['Compréhension orale', 'Compréhension écrite', 'Expression écrite', 'Expression orale'];

/*
 * Catégories Entrée express 2026 et derniers tirages.
 * Sources : IRCC, page « Category-based selection » (modifiée le 22 juin 2026),
 * communiqué du 18 février 2026 et données officielles des tirages.
 * À mettre à jour quand IRCC publie de nouveaux tirages.
 */
const IRCC_DATA_DATE = '1er octobre 2026';
LINKS.categories = { label: 'Catégories Entrée express 2026 (IRCC)', url: `${IRCC}/immigrate-canada/express-entry/rounds-invitations/category-based-selection.html` };
LINKS.news2026 = { label: 'Annonce IRCC des catégories 2026', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/news/2026/02/canada-prioritizes-top-talent-in-2026-immigration-express-entry-categories.html' };
LINKS.reform = { label: 'Consultation IRCC sur la réforme du CRS', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/corporate/transparency/consultations/2026-consultation-express-entry.html' };

// field : valeur du champ « Domaine de métier » du questionnaire
// cdnOnly : l'expérience de 12 mois doit avoir été acquise au Canada
const CATEGORIES_2026 = [
  { key: 'french', name: 'Connaissance du français', isNew: false, rule: 'NCLC 7 ou plus dans les 4 compétences en français' },
  { key: 'health', field: 'health', name: 'Santé et services sociaux', isNew: false, rule: '12 mois d\'expérience à temps plein (au Canada ou à l\'étranger) dans les 3 dernières années' },
  { key: 'stem', field: 'stem', name: 'Sciences, technologies, génie et mathématiques (STIM)', isNew: false, rule: '12 mois d\'expérience à temps plein (Canada ou étranger) dans les 3 dernières années' },
  { key: 'trades', field: 'trades', name: 'Métiers spécialisés', isNew: false, rule: '12 mois d\'expérience à temps plein (Canada ou étranger) dans les 3 dernières années' },
  { key: 'education', field: 'education', name: 'Éducation', isNew: false, rule: '12 mois d\'expérience à temps plein (Canada ou étranger) dans les 3 dernières années' },
  { key: 'transport', field: 'transport', name: 'Transport', isNew: true, rule: '12 mois d\'expérience à temps plein (Canada ou étranger) dans les 3 dernières années — pilotes, mécaniciens d\'aéronefs, inspecteurs…' },
  { key: 'physicians', field: 'physician', cdnOnly: true, name: 'Médecins avec expérience canadienne', isNew: true, rule: '12 mois d\'expérience à temps plein AU CANADA dans les 3 dernières années' },
  { key: 'managers', field: 'manager', cdnOnly: true, name: 'Cadres supérieurs avec expérience canadienne', isNew: true, rule: '12 mois d\'expérience à temps plein AU CANADA dans les 3 dernières années' },
  { key: 'researchers', field: 'researcher', cdnOnly: true, name: 'Chercheurs avec expérience canadienne', isNew: true, rule: '12 mois d\'expérience à temps plein AU CANADA dans les 3 dernières années' },
  { key: 'military', field: 'military', name: 'Recrues militaires qualifiées', isNew: true, rule: '10 ans de service militaire continu et recrutement par les Forces armées canadiennes' },
];

// Derniers tirages publiés par IRCC (du plus récent au plus ancien)
const DRAWS = [
  { date: '2026-10-01', key: 'trades', name: 'Métiers spécialisés', size: 3500, crs: 476 },
  { date: '2026-09-29', key: 'cec', name: 'Expérience canadienne', size: 2000, crs: 518 },
  { date: '2026-09-28', key: 'pnp', name: 'Candidats des provinces', size: 733, crs: 725 },
  { date: '2026-09-16', key: 'managers', name: 'Cadres supérieurs (exp. canadienne)', size: 250, crs: 389 },
  { date: '2026-09-15', key: 'cec', name: 'Expérience canadienne', size: 2000, crs: 519 },
  { date: '2026-09-14', key: 'pnp', name: 'Candidats des provinces', size: 576, crs: 734 },
  { date: '2026-09-04', key: 'health', name: 'Santé et services sociaux', size: 3500, crs: 475 },
  { date: '2026-09-03', key: 'physicians', name: 'Médecins (exp. canadienne)', size: 229, crs: 198 },
  { date: '2026-09-01', key: 'cec', name: 'Expérience canadienne', size: 2000, crs: 521 },
  { date: '2026-08-31', key: 'pnp', name: 'Candidats des provinces', size: 562, crs: 697 },
  { date: '2026-08-19', key: 'french', name: 'Connaissance du français', size: 5000, crs: 382 },
  { date: '2026-08-18', key: 'cec', name: 'Expérience canadienne', size: 1000, crs: 523 },
  { date: '2026-08-17', key: 'pnp', name: 'Candidats des provinces', size: 442, crs: 760 },
  { date: '2026-08-07', key: 'transport', name: 'Transport', size: 300, crs: 470 },
  { date: '2026-08-06', key: 'french', name: 'Connaissance du français', size: 5000, crs: 391 },
  { date: '2026-08-05', key: 'cec', name: 'Expérience canadienne', size: 3000, crs: 516 },
  { date: '2026-08-04', key: 'pnp', name: 'Candidats des provinces', size: 507, crs: 768 },
  { date: '2026-07-23', key: 'military', name: 'Recrues militaires qualifiées', size: 4, crs: 368 },
  { date: '2026-07-22', key: 'french', name: 'Connaissance du français', size: 5000, crs: 399 },
  { date: '2026-07-21', key: 'cec', name: 'Expérience canadienne', size: 2000, crs: 516 },
];
const lastDraw = (key) => DRAWS.find((d) => d.key === key) || null;
const fmtDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });

// Catégories et programmes visés par un profil.
function matchDraws(field, p) {
  const out = [];
  const expOk = (c) => (c.cdnOnly ? p.cdnWork >= 1 : p.cdnWork >= 1 || p.forWork >= 1);
  CATEGORIES_2026.forEach((c) => {
    let ok;
    if (c.key === 'french') ok = !!p.fr && Math.min(...p.fr) >= 7;
    else if (c.key === 'military') ok = field === 'military';
    else ok = c.field === field && expOk(c);
    const close = !ok && (c.key === 'french' ? !!p.fr : c.field === field);
    if (ok || close) out.push({ ...c, ok, draw: lastDraw(c.key) });
  });
  if (p.cdnWork >= 1) out.push({ key: 'cec', name: 'Catégorie de l\'expérience canadienne (programme)', rule: '1 an d\'expérience qualifiée au Canada', ok: true, draw: lastDraw('cec') });
  return out;
}
