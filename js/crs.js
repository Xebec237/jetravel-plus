/*
 * Calcul du score CRS (Système de classement global) d'Entrée express.
 * Grille officielle IRCC. Depuis le 25 mars 2025, une offre d'emploi ne donne plus de points.
 *
 * Profil normalisé attendu par score() :
 *   ws        : true si le conjoint est accompagnant et n'est pas citoyen/RP
 *   age       : nombre
 *   edu       : index dans EDU_KEYS (0 si aucun diplôme reconnu / sans EDE)
 *   en, fr    : [L, R, W, S] niveaux CLB/NCLC, ou null si aucun test
 *   cdnWork   : 0..5   forWork : 0..3   tradeCert : bool
 *   canEdu    : 0 | 1 (1-2 ans) | 2 (3 ans et +)
 *   sibling, pnp : bool
 *   spouse    : { edu, lang: [L,R,W,S] | null, cdnWork }
 */
const CRS = (() => {
  const EDU_KEYS = ['none', 'secondary', 'oneYear', 'twoYear', 'bachelor', 'twoOrMore', 'master', 'phd'];
  const EDU_NS = [0, 30, 90, 98, 120, 128, 135, 150];
  const EDU_WS = [0, 28, 84, 91, 112, 119, 126, 140];
  const SP_EDU = [0, 2, 6, 7, 8, 9, 10, 10];
  const CDN_NS = [0, 40, 53, 64, 72, 80];
  const CDN_WS = [0, 35, 46, 56, 63, 70];
  const SP_CDN = [0, 5, 7, 8, 9, 10];
  const AGE_NS = { 18: 99, 19: 105, 30: 105, 31: 99, 32: 94, 33: 88, 34: 83, 35: 77, 36: 72, 37: 66, 38: 61, 39: 55, 40: 50, 41: 39, 42: 28, 43: 17, 44: 6 };
  const AGE_WS = { 18: 90, 19: 95, 30: 95, 31: 90, 32: 85, 33: 80, 34: 75, 35: 70, 36: 65, 37: 60, 38: 55, 39: 50, 40: 45, 41: 35, 42: 25, 43: 15, 44: 5 };

  const MAX = {
    ws: { A: 460, age: 100, edu: 140, lang1: 128, lang2: 22, cdn: 70 },
    ns: { A: 500, age: 110, edu: 150, lang1: 136, lang2: 24, cdn: 80 },
  };

  function agePts(age, ws) {
    age = Math.floor(age);
    if (!age || age < 18 || age >= 45) return 0;
    if (age >= 20 && age <= 29) return ws ? 100 : 110;
    return (ws ? AGE_WS : AGE_NS)[age] || 0;
  }
  function lang1(c, ws) {
    if (c < 4) return 0;
    if (c <= 5) return 6;
    if (c === 6) return ws ? 8 : 9;
    if (c === 7) return ws ? 16 : 17;
    if (c === 8) return ws ? 22 : 23;
    if (c === 9) return ws ? 29 : 31;
    return ws ? 32 : 34;
  }
  const lang2 = (c) => (c >= 9 ? 6 : c >= 7 ? 3 : c >= 5 ? 1 : 0);
  const spLang = (c) => (c >= 9 ? 5 : c >= 7 ? 3 : c >= 5 ? 1 : 0);
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  const min = (a) => (a ? Math.min(...a) : 0);

  /* ---------- Conversion des résultats de test en CLB / NCLC ---------- */
  // Seuils [score minimal, niveau] par compétence : 0 = oral, 1 = lecture, 2 = écrit, 3 = parler
  const W_S_IELTS = [[7.5, 10], [7, 9], [6.5, 8], [6, 7], [5.5, 6], [5, 5], [4, 4]];
  const TEF_WS = [[393, 10], [371, 9], [349, 8], [310, 7], [271, 6], [226, 5], [181, 4]];
  const TCF_WS = [[16, 10], [14, 9], [12, 8], [10, 7], [7, 6], [6, 5], [4, 4]];
  const TABLES = {
    ielts: [
      [[8.5, 10], [8, 9], [7.5, 8], [6, 7], [5.5, 6], [5, 5], [4.5, 4]],
      [[8, 10], [7, 9], [6.5, 8], [6, 7], [5, 6], [4, 5], [3.5, 4]],
      W_S_IELTS, W_S_IELTS,
    ],
    tef: [ // barème TEF Canada en vigueur depuis le 11 décembre 2023
      [[316, 10], [298, 9], [280, 8], [249, 7], [217, 6], [181, 5], [145, 4]],
      [[263, 10], [248, 9], [233, 8], [207, 7], [181, 6], [151, 5], [121, 4]],
      TEF_WS, TEF_WS,
    ],
    tcf: [
      [[549, 10], [523, 9], [503, 8], [458, 7], [398, 6], [369, 5], [331, 4]],
      [[549, 10], [524, 9], [499, 8], [453, 7], [406, 6], [375, 5], [342, 4]],
      TCF_WS, TCF_WS,
    ],
  };

  function toClb(test, skill, value) {
    const v = parseFloat(String(value).replace(',', '.'));
    if (Number.isNaN(v)) return null;
    if (test === 'celpip' || test === 'clb') return Math.max(0, Math.min(12, Math.floor(v)));
    const t = TABLES[test];
    if (!t) return null;
    for (const [threshold, level] of t[skill]) if (v >= threshold) return level;
    return 0;
  }

  // Retourne [L, R, W, S] ou null si aucun test ou résultats incomplets
  function clbs(test, values) {
    if (!test || test === 'none') return null;
    const out = values.map((v, i) => (v === '' || v == null ? null : toClb(test, i, v)));
    return out.some((x) => x === null) ? null : out;
  }

  /* ---------- Calcul ---------- */
  function compute(p, first, second, firstKey) {
    const ws = !!p.ws;
    const f = first || [0, 0, 0, 0];
    const cdn = Math.min(5, p.cdnWork || 0);

    const A = {
      age: agePts(p.age, ws),
      edu: (ws ? EDU_WS : EDU_NS)[p.edu] || 0,
      lang1: sum(f.map((c) => lang1(c, ws))),
      lang2: second ? Math.min(ws ? 22 : 24, sum(second.map(lang2))) : 0,
      cdn: (ws ? CDN_WS : CDN_NS)[cdn],
    };
    A.total = A.age + A.edu + A.lang1 + A.lang2 + A.cdn;

    const B = { edu: 0, lang: 0, cdn: 0, total: 0 };
    if (ws && p.spouse) {
      B.edu = SP_EDU[p.spouse.edu] || 0;
      B.lang = p.spouse.lang ? sum(p.spouse.lang.map(spLang)) : 0;
      B.cdn = SP_CDN[Math.min(5, p.spouse.cdnWork || 0)];
      B.total = B.edu + B.lang + B.cdn;
    }

    // Transférabilité des compétences (max 100)
    const minF = first ? min(first) : 0;
    const langTier = minF >= 9 ? 2 : minF >= 7 ? 1 : 0;
    const eduTier = p.edu >= 5 ? 2 : p.edu >= 2 ? 1 : 0;
    const cdnTier = cdn >= 2 ? 2 : cdn === 1 ? 1 : 0;
    const forTier = p.forWork >= 3 ? 2 : p.forWork >= 1 ? 1 : 0;
    const grid = (tierA, tierB) => (tierA === 1 ? [0, 13, 25][tierB] : tierA === 2 ? [0, 25, 50][tierB] : 0);
    const C = {
      eduLang: grid(eduTier, langTier),
      eduCdn: grid(eduTier, cdnTier),
      forLang: grid(forTier, langTier),
      forCdn: grid(forTier, cdnTier),
      cert: p.tradeCert && minF >= 5 ? (minF >= 7 ? 50 : 25) : 0,
    };
    C.edu = Math.min(50, C.eduLang + C.eduCdn);
    C.foreign = Math.min(50, C.forLang + C.forCdn);
    C.total = Math.min(100, C.edu + C.foreign + C.cert);

    // Points supplémentaires (max 600)
    let french = 0;
    if (p.fr && min(p.fr) >= 7) french = p.en && min(p.en) >= 5 ? 50 : 25;
    const D = {
      pnp: p.pnp ? 600 : 0,
      sibling: p.sibling ? 15 : 0,
      french,
      canEdu: p.canEdu === 2 ? 30 : p.canEdu === 1 ? 15 : 0,
      job: 0,
    };
    D.total = Math.min(600, D.pnp + D.sibling + D.french + D.canEdu);

    return {
      A, B, C, D, ws, firstKey,
      max: ws ? MAX.ws : MAX.ns,
      total: Math.min(1200, A.total + B.total + C.total + D.total),
    };
  }

  // La première langue officielle est celle qui donne le meilleur score.
  function score(p) {
    const candidates = [];
    if (p.en || !p.fr) candidates.push(compute(p, p.en, p.fr, 'en'));
    if (p.fr) candidates.push(compute(p, p.fr, p.en, 'fr'));
    return candidates.reduce((a, b) => (b.total > a.total ? b : a));
  }

  return { EDU_KEYS, toClb, clbs, score, agePts };
})();
