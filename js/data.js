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
