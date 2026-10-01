/*
 * Charge les données publiées chaque jour par le bot (dossier data/).
 * Si elles sont indisponibles (ex. fichier ouvert en local), le site garde les valeurs de js/data.js.
 */
const Live = (() => {
  async function load(name) {
    try {
      const res = await fetch(`data/${name}`, { cache: 'no-cache' });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  const ready = Promise.all(['draws.json', 'news.json', 'jobs.json', 'status.json'].map(load))
    .then(([draws, news, jobs, status]) => {
      if (draws && Array.isArray(draws.draws) && draws.draws.length) {
        DRAWS.splice(0, DRAWS.length, ...draws.draws);
      }
      const updatedAt = (status && status.updatedAt) || (draws && draws.updatedAt) || null;
      if (updatedAt) {
        IRCC_DATA_DATE = new Date(updatedAt).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
      }
      return {
        live: !!draws,
        updatedAt,
        distribution: draws ? draws.distribution : null,
        news: news ? news.items : [],
        jobs: jobs ? jobs.jobs : [],
        status,
      };
    });

  return { ready };
})();
