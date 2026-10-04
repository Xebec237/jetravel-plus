/*
 * Connexion Google + sauvegarde cloud.
 *
 * - Sans compte : rien ne change, les données restent dans le navigateur.
 * - Connecté : chaque écriture du localStorage (setItem / removeItem) est copiée
 *   dans la table Supabase « user_state » (une ligne par clé), par lots, 1,5 s après le dernier changement.
 * - Première connexion : tout le localStorage existant est envoyé vers le compte.
 * - Autre appareil : la version du compte fait foi, la page se recharge une seule fois.
 * - Les clés « sb-… » (session Supabase) ne sont jamais synchronisées.
 *
 * À charger le plus tôt possible dans la page, avant les autres scripts de l'app.
 * Utilise SUPABASE_URL et SUPABASE_ANON_KEY de js/config.js (clé publique uniquement).
 */
(() => {
  if (window.__jtCloudSync) return;
  window.__jtCloudSync = true;

  const LIB_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  const TABLE = 'user_state';
  const META = 'jtsync:'; // clés internes de ce fichier, jamais synchronisées
  const DELAY = 1500;

  let ls = null;
  try { ls = window.localStorage; } catch (e) { return; } // stockage indisponible : on ne fait rien
  if (!ls) return;

  const proto = Storage.prototype;
  const origSet = proto.setItem;
  const origRemove = proto.removeItem;
  const origGet = proto.getItem;
  const syncable = (k) => typeof k === 'string' && !k.startsWith('sb-') && !k.startsWith(META);
  const meta = {
    get: (k) => { try { return origGet.call(ls, META + k); } catch (e) { return null; } },
    set: (k, v) => { try { origSet.call(ls, META + k, v); } catch (e) { /* ignoré */ } },
    del: (k) => { try { origRemove.call(ls, META + k); } catch (e) { /* ignoré */ } },
  };

  let sb = null;
  let user = null;
  let ready = false; // vrai une fois l'état du compte vérifié pour cet appareil
  let timer = null;
  let status = 'ok';
  const pending = new Map(); // clé -> valeur (null = suppression)

  /* ---------- 1. Interception du localStorage ---------- */
  proto.setItem = function setItem(key, value) {
    origSet.call(this, key, value);
    if (this === ls && syncable(String(key))) queue(String(key), String(value));
  };
  proto.removeItem = function removeItem(key) {
    origRemove.call(this, key);
    if (this === ls && syncable(String(key))) queue(String(key), null);
  };

  function queue(key, value) {
    pending.set(key, value);
    if (!user || !ready) return; // envoyé plus tard, ou abandonné si personne n'est connecté
    setStatus('saving');
    clearTimeout(timer);
    timer = setTimeout(flush, DELAY);
  }

  function localKeys() {
    const keys = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (syncable(k)) keys.push(k);
    }
    return keys;
  }

  function rememberSync(rows) {
    let at = meta.get('at') || '';
    (rows || []).forEach((r) => { if (r.updated_at && Date.parse(r.updated_at) > (Date.parse(at) || 0)) at = r.updated_at; });
    if (at) meta.set('at', at);
  }

  /* ---------- 2. Envoi groupé vers Supabase ---------- */
  async function flush() {
    clearTimeout(timer);
    if (!user || !ready || !pending.size) return;
    const batch = new Map(pending);
    pending.clear();
    const upserts = [];
    const deletes = [];
    batch.forEach((value, key) => {
      if (value === null) deletes.push(key);
      else upserts.push({ user_id: user.id, key, value });
    });
    try {
      if (upserts.length) {
        const { data, error } = await sb.from(TABLE).upsert(upserts, { onConflict: 'user_id,key' }).select('updated_at');
        if (error) throw error;
        rememberSync(data);
      }
      if (deletes.length) {
        const { error } = await sb.from(TABLE).delete().eq('user_id', user.id).in('key', deletes);
        if (error) throw error;
      }
      setStatus(pending.size ? 'saving' : 'ok');
    } catch (err) {
      // On remet le lot en attente (sans écraser un changement plus récent) et on réessaie plus tard.
      batch.forEach((value, key) => { if (!pending.has(key)) pending.set(key, value); });
      setStatus('error');
      console.warn('[JeTravel+ sauvegarde]', err && err.message ? err.message : err);
      timer = setTimeout(flush, 15000);
    }
  }

  /* ---------- 3. Connexion : migration ou récupération ---------- */
  function reloadOnce() {
    let last = 0;
    try { last = Number(sessionStorage.getItem(META + 'reload')) || 0; } catch (e) { /* ignoré */ }
    if (Date.now() - last < 15000) return false; // déjà rechargé à l'instant : pas de boucle
    try { sessionStorage.setItem(META + 'reload', String(Date.now())); } catch (e) { /* ignoré */ }
    location.reload();
    return true;
  }

  function applyCloud(rows, replaceAll) {
    if (replaceAll) localKeys().forEach((k) => origRemove.call(ls, k));
    rows.forEach((r) => {
      if (r.value === null) origRemove.call(ls, r.key);
      else origSet.call(ls, r.key, r.value);
    });
    pending.clear();
    meta.set('uid', user.id);
    rememberSync(rows);
  }

  async function onSignedIn() {
    setStatus('saving');
    const { data: rows, error } = await sb.from(TABLE).select('key,value,updated_at').eq('user_id', user.id);
    if (error) {
      setStatus('error');
      console.warn('[JeTravel+ sauvegarde]', error.message);
      return;
    }

    if (!rows.length) {
      // Première connexion : tout le localStorage existant part vers le compte.
      localKeys().forEach((k) => pending.set(k, origGet.call(ls, k)));
      meta.set('uid', user.id);
      ready = true;
      await flush();
      return;
    }

    if (meta.get('uid') !== user.id) {
      // Nouvel appareil (ou autre compte) : la version du compte fait foi.
      applyCloud(rows, true);
      if (reloadOnce()) return;
      ready = true;
      setStatus('ok');
      return;
    }

    // Appareil déjà lié : on récupère ce qui a changé ailleurs depuis la dernière synchro.
    const since = Date.parse(meta.get('at') || '') || 0;
    const changed = rows.filter((r) => Date.parse(r.updated_at) > since && origGet.call(ls, r.key) !== r.value && !pending.has(r.key));
    if (changed.length) {
      applyCloud(changed, false);
      if (reloadOnce()) return;
    } else {
      rememberSync(rows);
    }
    ready = true;
    if (pending.size) await flush(); else setStatus('ok');
  }

  /* ---------- 4. Interface : bouton Google / nom + Déconnexion ---------- */
  const G_LOGO = '<svg class="gs-g" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
  const STATUS_TEXT = { ok: 'Sauvegardé dans votre compte', saving: 'Sauvegarde en cours…', error: 'Sauvegarde impossible pour le moment, nouvel essai bientôt' };
  let slot = null;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function mountSlot() {
    const appBar = document.querySelector('.topbar');
    const landingBar = document.querySelector('.lp-nav-in');
    slot = document.createElement('div');
    slot.className = 'gs-slot';
    if (appBar) appBar.appendChild(slot);
    else if (landingBar) landingBar.insertBefore(slot, landingBar.querySelector('.btn.primary'));
    else return false;
    slot.addEventListener('click', onClick);
    return true;
  }

  function firstName() {
    const m = (user && user.user_metadata) || {};
    const full = m.full_name || m.name || (user && user.email ? user.email.split('@')[0] : '');
    return String(full).trim().split(/\s+/)[0] || 'Mon compte';
  }

  function render() {
    if (!slot) return;
    if (!user) {
      slot.innerHTML = `<button type="button" class="gs-btn" data-gs="login" aria-label="Se connecter avec Google" title="Se connecter avec Google">${G_LOGO}<span class="gs-long">Se connecter avec Google</span><span class="gs-short">Connexion</span></button>`;
      return;
    }
    const m = user.user_metadata || {};
    const pic = m.avatar_url || m.picture;
    const name = firstName();
    slot.innerHTML = `
      <div class="gs-user">
        <span class="gs-ava">${pic ? `<img src="${esc(pic)}" alt="" referrerpolicy="no-referrer">` : esc(name.charAt(0).toUpperCase())}<i class="gs-dot gs-${status}" title="${STATUS_TEXT[status]}"></i></span>
        <span class="gs-name" title="${esc(user.email || '')}">${esc(name)}</span>
        <button type="button" class="gs-out" data-gs="logout">Déconnexion</button>
      </div>`;
    const img = slot.querySelector('.gs-ava img');
    if (img) img.addEventListener('error', () => { img.replaceWith(document.createTextNode(name.charAt(0).toUpperCase())); });
  }

  function setStatus(s) {
    status = s;
    const dot = slot && slot.querySelector('.gs-dot');
    if (dot) { dot.className = `gs-dot gs-${s}`; dot.title = STATUS_TEXT[s]; }
  }

  async function googleEnabled() {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } });
      const settings = await res.json();
      return !!(settings.external && settings.external.google);
    } catch (e) {
      return true; // en cas de doute, on laisse Supabase répondre
    }
  }

  function toast(text) {
    let el = document.querySelector('.gs-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'gs-toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('on'), 6000);
  }

  async function onClick(e) {
    const btn = e.target.closest('[data-gs]');
    if (!btn) return;
    if (btn.dataset.gs === 'login') {
      btn.disabled = true;
      // Tant que Google n'est pas activé dans Supabase, on prévient au lieu d'afficher une page d'erreur.
      if (!(await googleEnabled())) {
        btn.disabled = false;
        toast('La connexion avec Google sera bientôt disponible. En attendant, vos données restent enregistrées sur cet appareil.');
        return;
      }
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: location.origin + location.pathname },
      });
      if (error) {
        btn.disabled = false;
        alert(`Connexion impossible : ${error.message}`);
      }
      return;
    }
    if (btn.dataset.gs === 'logout') {
      await flush();
      const wipe = confirm('Vous allez être déconnecté. Vos données restent sauvegardées dans votre compte.\n\nVoulez-vous aussi les effacer de cet appareil ? (conseillé sur un ordinateur partagé)\n\nOK = effacer de cet appareil · Annuler = les garder ici');
      await sb.auth.signOut({ scope: 'local' });
      if (wipe) localKeys().forEach((k) => origRemove.call(ls, k));
      meta.del('uid');
      meta.del('at');
      location.reload();
    }
  }

  /* ---------- 5. Démarrage ---------- */
  function loadCss() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    const me = document.querySelector('script[src*="cloud-sync.js"]');
    link.href = me ? me.src.replace(/js\/cloud-sync\.js.*$/, 'css/cloud-sync.css') : 'css/cloud-sync.css';
    document.head.appendChild(link);
  }

  async function start() {
    if (typeof SUPABASE_URL !== 'string' || !SUPABASE_URL || typeof SUPABASE_ANON_KEY !== 'string' || !SUPABASE_ANON_KEY) {
      pending.clear();
      return; // pas de configuration : l'app fonctionne sans compte
    }
    let lib;
    try {
      lib = window.JT_SUPABASE_LIB || await import(LIB_URL); // JT_SUPABASE_LIB : point d'entrée pour les tests
    } catch (e) {
      console.warn('[JeTravel+ sauvegarde] bibliothèque Supabase indisponible', e);
      pending.clear();
      return;
    }
    loadCss();
    if (!mountSlot()) return;
    sb = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    render();
    sb.auth.onAuthStateChange((event, session) => {
      const next = session ? session.user : null;
      if (next && (!user || user.id !== next.id)) {
        user = next;
        ready = false;
        render();
        setTimeout(onSignedIn, 0); // ne pas appeler Supabase directement dans ce rappel
      } else if (!next) {
        user = null;
        ready = false;
        pending.clear();
        render();
      } else {
        user = next;
      }
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('pagehide', () => { flush(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
