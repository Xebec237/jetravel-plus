/*
 * Configuration Supabase (comptes utilisateurs).
 * Ces deux valeurs sont publiques par conception : la clé « anon / publishable » est faite
 * pour être dans le site. La sécurité vient des règles RLS de supabase/schema.sql.
 * Ne mettez JAMAIS ici la clé « service_role » ou « secret ».
 * Si ces valeurs sont vides, le site fonctionne sans comptes (données dans le navigateur).
 */
const SUPABASE_URL = 'https://wnqrmbxfqzkilxqwejdt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InducXJtYnhmcXpraWx4cXdlamR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4ODYwNjMsImV4cCI6MjEwNjQ2MjA2M30.r2SU3cUJa80ORcjDNqjn57ETpgRJtfGfdWFwTFwRSas';

// Passer à true une fois Resend branché et la fonction daily-digest déployée (supabase/cron.sql exécuté).
const EMAIL_DIGEST_ENABLED = false;
