# JeTravel+ Canada

Outil web pour préparer son immigration au Canada via Entrée express :

1. **Évaluation** : questionnaire et calcul du score CRS selon la grille officielle d'IRCC (conversion automatique IELTS, CELPIP, TEF, TCF → CLB/NCLC).
2. **Score & plan** : détail du score et plan d'action personnalisé, chaque étape avec son gain en points et les liens officiels (WES, tests de langue, programmes provinciaux…).
3. **CV canadien** : création d'un CV au format canadien avec export PDF.
4. **Emploi & lettre** : recherche d'offres (Guichet-Emplois, Job Bank, Indeed, LinkedIn), lettre de motivation générée et envoi par Gmail ou courriel, suivi des candidatures.

## Utilisation

Ouvrez `index.html` (page d'accueil) dans un navigateur ; l'outil se trouve dans `app.html`. Aucune installation ni serveur requis. Les données restent dans le navigateur de l'utilisateur.

> Estimation indicative : seul l'outil officiel d'IRCC et le profil Entrée express font foi.

## Le système automatique

### Le bot quotidien (`bot/update.mjs`)
Chaque jour à 11 h UTC, GitHub Actions ([.github/workflows/bot.yml](.github/workflows/bot.yml)) lance le bot, qui :

- lit les **tirages Entrée express** d'IRCC et la répartition des candidats du bassin → `data/draws.json`
- lit les **annonces officielles d'IRCC** (flux Atom) → `data/news.json`
- lit les **offres de Job Bank** pour une vingtaine de métiers (flux Atom) → `data/jobs.json`
- **vérifie tous les liens** du site → `data/status.json`

puis publie les fichiers mis à jour : le site se met à jour tout seul. Si une source ne répond pas, l'ancien fichier est conservé.

Lancement manuel : onglet **Actions** du dépôt → « Bot de mise à jour quotidienne » → **Run workflow**. En local : `node bot/update.mjs`.
Pour suivre d'autres métiers, ajoutez-les dans `JOB_QUERIES` dans `bot/update.mjs`.

### L'assistant personnel (`js/assistant.js`)
Dans l'onglet « Mon assistant », il croise ces données avec le profil de la personne (évaluation, CV, candidatures) pour proposer :
offres d'emploi adaptées au métier et à la province, tirages qui la concernent avec l'écart au seuil, position estimée dans le bassin,
rappels (envoyer une candidature, relancer après 7 jours, prochaine action du plan, objectif de la semaine) et annonces d'IRCC.
Les profils restent dans le navigateur de chaque personne : aucune donnée personnelle n'est envoyée.
