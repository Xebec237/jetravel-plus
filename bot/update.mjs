/*
 * Bot de mise à jour JeTravel+ (exécuté chaque jour par GitHub Actions).
 *
 * Lit les sources publiques et écrit des fichiers JSON dans data/ :
 *   data/draws.json  : tirages Entrée express d'IRCC + répartition des candidats du bassin
 *   data/news.json   : dernières annonces d'IRCC (flux Atom officiel)
 *   data/jobs.json   : offres récentes de Job Bank pour une liste de métiers
 *   data/status.json : date de mise à jour, état de chaque source et vérification des liens du site
 *
 * Si une source échoue, le fichier précédent est conservé.
 * Lancement local : node bot/update.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const DATA = new URL('data/', ROOT);
const UA = 'JeTravel+ bot (https://github.com/Xebec237/jetravel-plus)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, type = 'text') {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} pour ${url}`);
  return type === 'json' ? res.json() : res.text();
}
const num = (s) => Number(String(s ?? '').replace(/[^\d]/g, '')) || 0;
const decode = (s) => String(s ?? '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .trim();
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)); return m ? decode(m[1]) : ''; };
const entries = (xml) => xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];

/* ---------------- Tirages Entrée express ---------------- */
const DRAW_TYPES = [
  [/french/i, 'french', 'Connaissance du français'],
  [/physician/i, 'physicians', 'Médecins (exp. canadienne)'],
  [/senior manager/i, 'managers', 'Cadres supérieurs (exp. canadienne)'],
  [/research/i, 'researchers', 'Chercheurs (exp. canadienne)'],
  [/military/i, 'military', 'Recrues militaires qualifiées'],
  [/health/i, 'health', 'Santé et services sociaux'],
  [/transport/i, 'transport', 'Transport'],
  [/stem|science/i, 'stem', 'STIM'],
  [/education/i, 'education', 'Éducation'],
  [/agricult/i, 'agriculture', 'Agriculture et agroalimentaire'],
  [/federal skilled trades/i, 'fst', 'Métiers spécialisés (programme fédéral)'],
  [/trade/i, 'trades', 'Métiers spécialisés'],
  [/canadian experience/i, 'cec', 'Expérience canadienne'],
  [/provincial nominee/i, 'pnp', 'Candidats des provinces'],
  [/federal skilled worker/i, 'fsw', 'Travailleurs qualifiés (fédéral)'],
  [/no program|general/i, 'general', 'Tirage général'],
];
// Tranches de score publiées par IRCC (champs dd1 à dd17 ; dd3 et dd9 sont des sous-totaux, dd18 le total)
const RANGES = [
  ['dd1', 601, 1200], ['dd2', 501, 600], ['dd4', 491, 500], ['dd5', 481, 490], ['dd6', 471, 480], ['dd7', 461, 470],
  ['dd8', 451, 460], ['dd10', 441, 450], ['dd11', 431, 440], ['dd12', 421, 430], ['dd13', 411, 420], ['dd14', 401, 410],
  ['dd15', 351, 400], ['dd16', 301, 350], ['dd17', 0, 300],
];

async function updateDraws() {
  const json = await get('https://www.canada.ca/content/dam/ircc/documents/json/ee_rounds_123_en.json', 'json');
  const rounds = json.rounds || [];
  if (!rounds.length) throw new Error('aucun tirage dans la réponse');
  const draws = rounds.slice(0, 40).map((r) => {
    const t = DRAW_TYPES.find(([re]) => re.test(r.drawName)) || [null, 'other', r.drawName];
    return { number: num(r.drawNumber), date: r.drawDate, key: t[1], name: t[2], nameEn: r.drawName, size: num(r.drawSize), crs: num(r.drawCRS) };
  });
  const latest = rounds[0];
  const distribution = {
    asOf: latest.drawDistributionAsOn || '',
    total: num(latest.dd18),
    ranges: RANGES.map(([k, min, max]) => ({ min, max, count: num(latest[k]) })),
  };
  return { draws, distribution };
}

/* ---------------- Actualités IRCC ---------------- */
const RELEVANT = /entrée express|express entry|résidence permanente|permanent resident|francophon|travailleur|worker|étudiant|student|permis|permit|immigra|tirage|catégor|category|réfugi/i;

async function updateNews() {
  const url = 'https://api.io.canada.ca/io-server/gc/news/fr/v2?dept=departmentofcitizenshipandimmigration&sort=publishedDate&orderBy=desc&pick=25&format=atom&atomtitle=IRCC';
  const xml = await get(url);
  const items = entries(xml).map((e) => {
    const href = (e.match(/<link[^>]*href="([^"]+)"/) || [])[1] || '';
    const title = tag(e, 'title');
    const summary = tag(e, 'summary').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 280);
    return {
      title,
      url: href.startsWith('/') ? `https://www.canada.ca${href}` : href,
      date: tag(e, 'updated').slice(0, 10),
      summary,
      relevant: RELEVANT.test(`${title} ${summary}`),
    };
  });
  if (!items.length) throw new Error('flux vide');
  return { items };
}

/* ---------------- Offres Job Bank ---------------- */
// Métiers suivis : field = domaine utilisé par l'assistant (catégories IRCC 2026)
const JOB_QUERIES = [
  { q: 'registered nurse', field: 'health' }, { q: 'licensed practical nurse', field: 'health' },
  { q: 'personal support worker', field: 'health' }, { q: 'pharmacist', field: 'health' },
  { q: 'social worker', field: 'health' }, { q: 'software developer', field: 'stem' },
  { q: 'engineer', field: 'stem' }, { q: 'data analyst', field: 'stem' },
  { q: 'electrician', field: 'trades' }, { q: 'welder', field: 'trades' }, { q: 'carpenter', field: 'trades' },
  { q: 'plumber', field: 'trades' }, { q: 'heavy duty mechanic', field: 'trades' }, { q: 'cook', field: 'trades' },
  { q: 'teacher', field: 'education' }, { q: 'early childhood educator', field: 'education' },
  { q: 'truck driver', field: 'transport' }, { q: 'aircraft mechanic', field: 'transport' },
  { q: 'accountant', field: '' }, { q: 'administrative assistant', field: '' }, { q: 'customer service', field: '' },
  { q: 'physician', field: 'physician' }, { q: 'manager', field: 'manager' },
];

function parseJob(e, query) {
  const summary = tag(e, 'summary');
  const pick = (label) => {
    const m = summary.match(new RegExp(`${label}:</strong>\\s*([^<]*)`));
    return m ? m[1].trim() : '';
  };
  const location = pick('Location');
  return {
    id: pick('Job number') || tag(e, 'id'),
    title: tag(e, 'title'),
    employer: pick('Employer'),
    location: location.replace(/\s*\(\w{2}\)\s*$/, ''),
    province: (location.match(/\((\w{2})\)/) || [])[1] || '',
    salary: pick('Salary'),
    date: tag(e, 'updated').slice(0, 10),
    url: (e.match(/<link[^>]*href="([^"]+)"/) || [])[1] || '',
    q: query.q,
    field: query.field,
  };
}

async function updateJobs() {
  const byId = new Map();
  let ok = 0;
  for (const query of JOB_QUERIES) {
    try {
      const url = `https://www.jobbank.gc.ca/jobsearch/feed/jobSearchRSSfeed?searchstring=${encodeURIComponent(query.q)}&sort=D&rows=25`;
      const xml = await get(url);
      entries(xml).forEach((e) => { const j = parseJob(e, query); if (j.url && !byId.has(j.id)) byId.set(j.id, j); });
      ok += 1;
    } catch (err) {
      console.warn(`  ! Job Bank « ${query.q} » : ${err.message}`);
    }
    await sleep(1200); // rester poli avec le serveur
  }
  if (!ok) throw new Error('aucun flux Job Bank lisible');
  const jobs = [...byId.values()].sort((a, b) => b.date.localeCompare(a.date));
  return { queries: JOB_QUERIES.map((x) => x.q), jobs };
}

/* ---------------- Vérification des liens du site ---------------- */
async function checkLinks() {
  const sources = await Promise.all(['js/data.js', 'index.html', 'app.html'].map((f) => readFile(new URL(f, ROOT), 'utf8')));
  const urls = [...new Set(sources.join('\n').match(/https:\/\/[^\s"'`<>)]+/g) || [])]
    .filter((u) => !u.includes('${') && !/fonts\.(googleapis|gstatic)|mail\.google|api\.io\.canada/.test(u));
  const results = [];
  for (const url of urls) {
    let status = 0;
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
      status = res.status;
    } catch { status = 0; }
    results.push({ url, status, ok: status >= 200 && status < 400 });
    await sleep(300);
  }
  return results;
}

/* ---------------- Exécution ---------------- */
async function readJson(name) {
  try { return JSON.parse(await readFile(new URL(name, DATA), 'utf8')); } catch { return null; }
}
async function writeJson(name, value) {
  await writeFile(new URL(name, DATA), JSON.stringify(value, null, 1) + '\n');
}

async function run() {
  await mkdir(DATA, { recursive: true });
  const now = new Date().toISOString();
  const previous = (await readJson('status.json')) || {};
  const status = { updatedAt: now, sources: {}, links: previous.links || [] };

  const tasks = [
    ['draws', 'draws.json', updateDraws, (v) => `${v.draws.length} tirages`],
    ['news', 'news.json', updateNews, (v) => `${v.items.length} annonces`],
    ['jobs', 'jobs.json', updateJobs, (v) => `${v.jobs.length} offres`],
  ];
  for (const [key, file, fn, describe] of tasks) {
    try {
      const value = await fn();
      await writeJson(file, { updatedAt: now, ...value });
      status.sources[key] = { ok: true, at: now, info: describe(value) };
      console.log(`✓ ${key} : ${describe(value)}`);
    } catch (err) {
      status.sources[key] = { ok: false, at: now, error: err.message, lastSuccess: previous.sources?.[key]?.ok ? previous.sources[key].at : previous.sources?.[key]?.lastSuccess };
      console.error(`✗ ${key} : ${err.message} (ancien fichier conservé)`);
    }
  }

  if (process.env.SKIP_LINKS !== '1') {
    try {
      status.links = await checkLinks();
      const broken = status.links.filter((l) => !l.ok);
      console.log(`✓ liens : ${status.links.length} vérifiés, ${broken.length} en erreur`);
      broken.forEach((l) => console.log(`  ! ${l.status || 'injoignable'} ${l.url}`));
    } catch (err) {
      console.error(`✗ liens : ${err.message}`);
    }
  }
  await writeJson('status.json', status);
}

run().catch((err) => { console.error(err); process.exit(1); });
