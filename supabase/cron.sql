-- ============================================================
-- JeTravel+ — envoi automatique des rappels par courriel, chaque jour
-- À exécuter APRÈS avoir déployé la fonction daily-digest.
-- Remplacez les deux valeurs entre < > avant d'exécuter :
--   <REF-PROJET>   : identifiant du projet (dans l'URL https://<REF-PROJET>.supabase.co)
--   <CRON_SECRET>  : le même texte secret que le secret CRON_SECRET de la fonction
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Chaque jour à 11 h 45 UTC (7 h 45 à Toronto), après la mise à jour du bot GitHub (11 h UTC).
select cron.schedule(
  'jetravel-daily-digest',
  '45 11 * * *',
  $$
  select net.http_post(
    url     := 'https://<REF-PROJET>.supabase.co/functions/v1/daily-digest',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body    := '{}'::jsonb
  );
  $$
);

-- Pour vérifier : select * from cron.job;
-- Pour arrêter  : select cron.unschedule('jetravel-daily-digest');
