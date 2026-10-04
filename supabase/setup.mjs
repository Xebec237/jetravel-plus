/*
 * Configuration automatique de Supabase pour la connexion Google + sauvegarde cloud.
 * Lit les clés dans le fichier .env à la racine du projet (jamais publié, voir .gitignore) :
 *   SUPABASE_ACCESS_TOKEN=sbp_...     jeton personnel : supabase.com/dashboard/account/tokens
 *   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
 *   GOOGLE_CLIENT_SECRET=...
 * Puis :
 *   1. exécute supabase/user_state.sql (table user_state + profil créé à l'inscription)
 *   2. règle les adresses du site (Site URL et Redirect URLs)
 *   3. active la connexion Google
 * Lancement : node supabase/setup.mjs
 * Aucun secret n'est affiché à l'écran.
 */
import { readFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const REF = 'wnqrmbxfqzkilxqwejdt';
const SITE = 'https://jetravel-plus.vercel.app';
const API = `https://api.supabase.com/v1/projects/${REF}`;

async function loadEnv() {
  const env = {};
  try {
    const text = await readFile(new URL('.env', ROOT), 'utf8');
    text.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
  } catch {
    throw new Error('Fichier .env introuvable à la racine du projet.');
  }
  return env;
}

async function call(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → HTTP ${res.status} : ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const env = await loadEnv();
  const token = env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN manquant dans .env');

  // 1. Base de données
  const sql = await readFile(new URL('supabase/user_state.sql', ROOT), 'utf8');
  await call(token, 'POST', '/database/query', { query: sql });
  console.log('✓ Base de données : table user_state et profils automatiques créés');

  // 2 et 3. Adresses du site + Google
  const config = {
    site_url: `${SITE}/app.html`,
    uri_allow_list: `${SITE}/**,https://xebec237.github.io/jetravel-plus/**`,
  };
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    Object.assign(config, {
      external_google_enabled: true,
      external_google_client_id: env.GOOGLE_CLIENT_ID,
      external_google_secret: env.GOOGLE_CLIENT_SECRET,
    });
  }
  await call(token, 'PATCH', '/config/auth', config);
  console.log(`✓ Adresses : Site URL = ${config.site_url}`);
  console.log(config.external_google_enabled
    ? '✓ Connexion Google activée'
    : '• Connexion Google pas encore activée (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET absents de .env)');
}

main().catch((err) => { console.error(`✗ ${err.message}`); process.exit(1); });
