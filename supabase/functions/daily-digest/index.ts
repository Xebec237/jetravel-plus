/*
 * Rappels quotidiens par courriel (Supabase Edge Function).
 * Appelée chaque jour par pg_cron (voir supabase/cron.sql), après la mise à jour du bot GitHub.
 *
 * Pour chaque personne qui a activé « Recevoir mes rappels par courriel » :
 *   - nouvelles offres Job Bank correspondant à son métier (depuis le dernier courriel)
 *   - nouveaux tirages qui la concernent, avec l'écart au seuil
 *   - candidatures à envoyer ou à relancer
 * Rien n'est envoyé s'il n'y a rien de nouveau.
 *
 * Secrets à définir (Supabase → Edge Functions → Secrets) :
 *   RESEND_API_KEY  clé de l'API Resend (https://resend.com)
 *   MAIL_FROM       expéditeur, ex. « JeTravel+ <rappels@votre-domaine.com> »
 *   CRON_SECRET     texte secret partagé avec supabase/cron.sql
 *   SITE_URL        https://xebec237.github.io/jetravel-plus/
 * SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par Supabase.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SITE_URL = (Deno.env.get('SITE_URL') || 'https://xebec237.github.io/jetravel-plus/').replace(/\/?$/, '/');

type Job = { id: string; title: string; employer: string; location: string; province: string; salary: string; date: string; url: string; field: string };
type Draw = { date: string; key: string; name: string; size: number; crs: number };
type App = { company: string; job: string; date: string; status: string };

const FR_EN: [RegExp, string][] = [
  [/comptab/, 'account'], [/infirmi/, 'nurse'], [/préposé|aide-soignant|soignant/, 'support worker'],
  [/pharmac/, 'pharmac'], [/développeu|programmeu|informatic/, 'developer'], [/ingénieu/, 'engineer'],
  [/analyste/, 'analyst'], [/électricien/, 'electrician'], [/soudeu/, 'welder'], [/charpentier|menuisier/, 'carpenter'],
  [/plombier/, 'plumber'], [/mécanicien/, 'mechanic'], [/cuisinier|chef/, 'cook'], [/enseignant|professeur/, 'teacher'],
  [/éducat/, 'educator'], [/chauffeur|camionneu/, 'driver'], [/administrati|secrétaire|adjoint/, 'administrative'],
  [/clientèle|service client/, 'customer service'], [/médecin/, 'physician'], [/gestionnaire|directeu|cadre/, 'manager'],
];
// Catégories auxquelles un domaine de métier donne accès (voir js/data.js)
const FIELD_DRAWS: Record<string, string> = {
  health: 'health', stem: 'stem', trades: 'trades', education: 'education', transport: 'transport',
  physician: 'physicians', manager: 'managers', researcher: 'researchers', military: 'military',
};

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso + 'T12:00:00Z').getTime()) / 864e5);
const fmtDate = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('fr-CA', { day: 'numeric', month: 'long' });

function keywords(profile: any): string[] {
  const raw = String(profile.bot?.keywords || profile.eval?.jobTitle || '').toLowerCase();
  const out = new Set<string>();
  raw.split(/[,;/]+/).map((s) => s.trim()).filter((s) => s.length > 1).forEach((w) => {
    out.add(w);
    FR_EN.forEach(([re, en]) => { if (re.test(w)) out.add(en); });
  });
  return [...out];
}

function digestFor(profile: any, jobs: Job[], draws: Draw[]) {
  const since = profile.last_digest_at ? profile.last_digest_at.slice(0, 10) : new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
  const prov = profile.bot?.province || profile.eval?.province || '';
  const kws = keywords(profile);

  const newJobs = kws.length
    ? jobs.filter((j) => j.date > since && kws.some((k) => j.title.toLowerCase().includes(k)))
      .sort((a, b) => Number(b.province === prov) - Number(a.province === prov) || b.date.localeCompare(a.date))
      .slice(0, 6)
    : [];

  const field = profile.eval?.field || '';
  const keys = new Set(['general', 'fsw']);
  if (FIELD_DRAWS[field]) keys.add(FIELD_DRAWS[field]);
  if (profile.eval?.frTest && profile.eval.frTest !== 'none') keys.add('french');
  if (Number(profile.eval?.cdnWork) >= 1) keys.add('cec');
  const newDraws = draws.filter((d) => d.date > since && keys.has(d.key)).slice(0, 4);

  const apps: App[] = Array.isArray(profile.apps) ? profile.apps : [];
  const toSend = apps.filter((a) => a.status === 'À envoyer' && daysSince(a.date) >= 1);
  const toFollow = apps.filter((a) => a.status === 'Envoyée' && daysSince(a.date) >= 7);

  return { newJobs, newDraws, toSend, toFollow, empty: !newJobs.length && !newDraws.length && !toSend.length && !toFollow.length };
}

function emailHtml(profile: any, d: ReturnType<typeof digestFor>) {
  const name = String(profile.cv?.name || '').split(' ')[0];
  const section = (title: string, body: string) => (body ? `<h2 style="font-size:17px;color:#ad4430;margin:24px 0 8px">${title}</h2>${body}` : '');
  const li = (html: string) => `<li style="margin:0 0 10px">${html}</li>`;
  const ul = (items: string[]) => (items.length ? `<ul style="padding-left:18px;margin:0">${items.join('')}</ul>` : '');
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#fffcf9;font-family:Arial,sans-serif;color:#33291f">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px">
    <p style="font-size:22px;font-weight:bold;margin:0 0 4px">JeTravel<span style="color:#c8553d">+</span></p>
    <p style="font-size:16px">Bonjour${name ? ` ${esc(name)}` : ''}, voici vos propositions du jour.</p>
    ${section('💼 Nouvelles offres pour vous', ul(d.newJobs.map((j) => li(`<a href="${esc(j.url)}" style="color:#c8553d;font-weight:bold">${esc(j.title)}</a><br><span style="color:#85776c">${esc(j.employer)} · ${esc(j.location)} (${esc(j.province)})${j.salary ? ` · ${esc(j.salary)}` : ''}</span>`))))}
    ${section('📢 Nouveaux tirages Entrée express', ul(d.newDraws.map((x) => li(`<b>${esc(x.name)}</b> — ${fmtDate(x.date)} · ${x.size.toLocaleString('fr-CA')} invitations · seuil <b>${x.crs}</b>`))))}
    ${section('✉️ Candidatures à envoyer', ul(d.toSend.map((a) => li(`${esc(a.job)} chez <b>${esc(a.company)}</b>`))))}
    ${section('🔔 Candidatures à relancer', ul(d.toFollow.map((a) => li(`${esc(a.job)} chez <b>${esc(a.company)}</b>, envoyée il y a ${daysSince(a.date)} jours`))))}
    <p style="margin:28px 0"><a href="${SITE_URL}app.html#bot" style="background:#c8553d;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold">Ouvrir mon assistant</a></p>
    <p style="font-size:12px;color:#85776c">Vous recevez ce courriel car vous avez activé les rappels dans votre espace JeTravel+. Pour arrêter, décochez « Recevoir mes rappels par courriel » dans votre espace.</p>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('Non autorisé', { status: 401 });
  }
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('MAIL_FROM');
  if (!resendKey || !from) return new Response('RESEND_API_KEY ou MAIL_FROM manquant', { status: 500 });

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const [jobsRes, drawsRes] = await Promise.all([
    fetch(`${SITE_URL}data/jobs.json`).then((r) => r.json()),
    fetch(`${SITE_URL}data/draws.json`).then((r) => r.json()),
  ]);
  const jobs: Job[] = jobsRes.jobs || [];
  const draws: Draw[] = drawsRes.draws || [];

  const { data: profiles, error } = await sb.from('profiles').select('*').eq('notify_email', true);
  if (error) return new Response(error.message, { status: 500 });

  let sent = 0;
  let skipped = 0;
  for (const profile of profiles || []) {
    if (!profile.email) { skipped++; continue; }
    const digest = digestFor(profile, jobs, draws);
    if (digest.empty) { skipped++; continue; }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: profile.email, subject: 'JeTravel+ — vos propositions du jour', html: emailHtml(profile, digest) }),
    });
    if (res.ok) {
      sent++;
      await sb.from('profiles').update({ last_digest_at: new Date().toISOString() }).eq('id', profile.id);
    } else {
      console.error(`Envoi impossible à ${profile.email} :`, await res.text());
    }
  }
  return Response.json({ sent, skipped });
});
