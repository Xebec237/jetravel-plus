/*
 * Comptes utilisateurs (Supabase) : connexion par lien envoyé par courriel
 * et synchronisation du profil entre appareils.
 *
 * Le site continue d'enregistrer dans le navigateur (localStorage). Une fois connecté,
 * chaque changement est aussi enregistré dans Supabase, et un autre appareil récupère
 * la version la plus récente à la connexion.
 */
const Account = (() => {
  const { $, esc, store } = JT;
  const KEYS = { jt_eval: 'eval', jt_computed: 'computed', jt_cv: 'cv', jt_letter: 'letter', jt_apps: 'apps', jt_done: 'done', jt_bot: 'bot' };
  const raw = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignoré */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignoré */ } },
  };
  const enabled = typeof SUPABASE_URL === 'string' && SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase;
  let sb = null;
  let user = null;
  let profile = {};
  let timer = null;
  let status = '';

  /* ---------- Suivi des changements locaux ---------- */
  // On note l'heure du dernier vrai changement local, pour savoir quelle version est la plus récente.
  const originalSet = store.set;
  store.set = (key, value) => {
    const changed = key in KEYS && raw.get(key) !== JSON.stringify(value);
    originalSet(key, value);
    if (!changed) return;
    raw.set('jt_local_at', new Date().toISOString());
    if (user) schedulePush();
  };

  const time = (s) => (s ? Date.parse(s) || 0 : 0);

  function snapshot() {
    const row = {};
    Object.entries(KEYS).forEach(([k, col]) => {
      const v = raw.get(k);
      try { row[col] = v == null ? null : JSON.parse(v); } catch (e) { row[col] = null; }
    });
    return row;
  }

  function schedulePush() {
    clearTimeout(timer);
    setStatus('saving');
    timer = setTimeout(push, 1500);
  }

  async function push() {
    const at = raw.get('jt_local_at') || new Date().toISOString();
    const row = { id: user.id, email: user.email, ...snapshot(), updated_at: at };
    const { error } = await sb.from('profiles').upsert(row);
    if (error) { setStatus('error'); console.warn('Synchronisation :', error.message); return; }
    raw.set('jt_pushed_at', at);
    setStatus('ok');
  }

  async function sync() {
    setStatus('saving');
    const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) { setStatus('error'); console.warn('Synchronisation :', error.message); return; }
    profile = data || {};
    const remoteHasData = data && Object.values(KEYS).some((col) => data[col] != null);
    const localAt = time(raw.get('jt_local_at'));
    const remoteAt = time(data && data.updated_at);

    if (remoteHasData && remoteAt > localAt) {
      // La version en ligne est plus récente : on l'applique sur cet appareil puis on recharge.
      if (raw.get('jt_applied_at') === data.updated_at) { setStatus('ok'); return; }
      Object.entries(KEYS).forEach(([k, col]) => {
        if (data[col] == null) raw.del(k); else raw.set(k, JSON.stringify(data[col]));
      });
      raw.set('jt_local_at', new Date(remoteAt).toISOString());
      raw.set('jt_pushed_at', new Date(remoteAt).toISOString());
      raw.set('jt_applied_at', data.updated_at);
      location.reload();
      return;
    }
    if (!remoteHasData || localAt > time(raw.get('jt_pushed_at'))) await push();
    else setStatus('ok');
    render();
  }

  /* ---------- Interface ---------- */
  const STATUS = { saving: 'Enregistrement…', ok: 'Synchronisé ✓', error: 'Synchronisation impossible' };
  function setStatus(s) {
    status = s;
    const el = $('#acc-status');
    if (el) el.textContent = STATUS[s] || '';
  }

  function render() {
    const slot = $('#account-slot');
    if (!slot) return;
    if (!user) {
      slot.innerHTML = '<button type="button" class="btn small primary" id="acc-open">Se connecter</button>';
      return;
    }
    const name = profile.display_name || user.email.split('@')[0];
    slot.innerHTML = `
      <details class="acc-menu">
        <summary><span class="acc-ava">${esc(name.charAt(0).toUpperCase())}</span><span class="acc-name">${esc(name)}</span></summary>
        <div class="acc-pop">
          <div class="acc-email">${esc(user.email)}</div>
          <div class="acc-sync" id="acc-status">${STATUS[status] || ''}</div>
          ${typeof EMAIL_DIGEST_ENABLED !== 'undefined' && EMAIL_DIGEST_ENABLED
            ? `<label class="done-toggle"><input type="checkbox" id="acc-notify" ${profile.notify_email ? 'checked' : ''}> Recevoir mes rappels par courriel (1 par jour au maximum)</label>`
            : '<p class="help">Vos rappels s\'affichent dans « Mon assistant ». Les rappels par courriel arrivent bientôt.</p>'}
          <button type="button" class="btn small ghost" id="acc-logout">Se déconnecter</button>
        </div>
      </details>`;
  }

  function openModal() {
    let modal = $('#acc-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'acc-modal';
      modal.className = 'acc-modal';
      modal.innerHTML = `
        <div class="acc-dialog" role="dialog" aria-modal="true" aria-labelledby="acc-title">
          <button type="button" class="bot-x" id="acc-close" aria-label="Fermer">✕</button>
          <div class="bot-avatar">🔐</div>
          <h2 id="acc-title">Mon espace JeTravel+</h2>
          <p class="help">Connectez-vous pour retrouver votre profil, votre CV et vos candidatures sur tous vos appareils, et recevoir vos rappels par courriel. Pas de mot de passe : nous vous envoyons un lien de connexion.</p>
          <form id="acc-form">
            <label class="field"><span>Votre adresse courriel</span><input type="email" id="acc-email" required placeholder="prenom.nom@gmail.com" autocomplete="email"></label>
            <button type="submit" class="btn primary" id="acc-send">Recevoir mon lien de connexion</button>
          </form>
          <p class="acc-msg" id="acc-msg" hidden></p>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => { if (e.target === modal || e.target.id === 'acc-close') modal.hidden = true; });
      $('#acc-form').addEventListener('submit', sendLink);
    }
    modal.hidden = false;
    $('#acc-email').focus();
  }

  async function sendLink(e) {
    e.preventDefault();
    const email = $('#acc-email').value.trim();
    const msg = $('#acc-msg');
    $('#acc-send').disabled = true;
    const redirect = location.origin + location.pathname.replace(/[^/]*$/, '') + 'app.html';
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
    $('#acc-send').disabled = false;
    msg.hidden = false;
    msg.className = `acc-msg ${error ? 'bad' : 'ok'}`;
    msg.textContent = error
      ? `Envoi impossible : ${error.message}`
      : `C'est envoyé ! Ouvrez le courriel reçu à ${email} et cliquez sur le lien pour vous connecter. Pensez à vérifier vos indésirables.`;
  }

  async function onClick(e) {
    if (e.target.closest('#acc-open')) openModal();
    if (e.target.closest('#acc-logout')) {
      if (!confirm('Se déconnecter ? Vos données restent enregistrées dans votre compte et seront effacées de cet appareil.')) return;
      await sb.auth.signOut();
      Object.keys(KEYS).concat(['jt_local_at', 'jt_pushed_at', 'jt_applied_at']).forEach(raw.del);
      location.reload();
    }
  }

  async function onChange(e) {
    if (e.target.id !== 'acc-notify') return;
    profile.notify_email = e.target.checked;
    const { error } = await sb.from('profiles').update({ notify_email: e.target.checked }).eq('id', user.id);
    setStatus(error ? 'error' : 'ok');
  }

  function init() {
    if (!enabled) return;
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true },
    });
    const slot = $('#account-slot');
    if (slot) {
      slot.addEventListener('click', onClick);
      slot.addEventListener('change', onChange);
    }
    sb.auth.onAuthStateChange((event, session) => {
      const next = session ? session.user : null;
      const changed = (next && next.id) !== (user && user.id);
      user = next;
      render();
      if (user && changed) {
        const modal = $('#acc-modal');
        if (modal) modal.hidden = true;
        // Laisse Supabase terminer la connexion avant d'interroger la base.
        setTimeout(sync, 0);
      }
    });
    render();
  }

  return { init, isEnabled: () => !!enabled, user: () => user };
})();
