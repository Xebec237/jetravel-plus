/*
 * Configuration Supabase (comptes utilisateurs).
 * Ces deux valeurs sont publiques par conception : la clé « anon / publishable » est faite
 * pour être dans le site. La sécurité vient des règles RLS de supabase/schema.sql.
 * Ne mettez JAMAIS ici la clé « service_role » ou « secret ».
 * Tant que ces valeurs sont vides, le site fonctionne sans comptes (données dans le navigateur).
 */
const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';
