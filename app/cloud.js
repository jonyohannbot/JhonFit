/* Jhon Fit — nuvem: login (Supabase Auth) + sincronização offline-first.

   Como funciona a sincronização
   -----------------------------
   - O app continua lendo e gravando no aparelho (localStorage). A nuvem é uma cópia.
   - Cada usuário tem UMA linha na tabela user_data: { data: <json do app>, rev: <número> }.
   - "rev" é um contador de versão. Para gravar, o app diz "atualize SE a rev ainda for a que eu conheço".
     Se outro aparelho gravou antes, a rev mudou, a gravação não acontece e o app baixa, mescla e tenta de novo.
     (Isso se chama controle de concorrência otimista.)
   - Sem internet, as mudanças ficam marcadas como pendentes e sobem quando a conexão voltar. */
'use strict';
(function () {
  const cfg = self.JF_CONFIG || {};
  const enabled = !!(cfg.supabaseUrl && cfg.supabaseKey && self.supabase && self.supabase.createClient);
  const LAST_USER = 'jhonfit.user';
  const metaKey = uid => 'jhonfit.sync.' + uid;

  let sb = null, user = null, hooks = null;
  let meta = { base: null, dirty: false };
  let status = enabled ? 'idle' : 'local';   // local | idle | syncing | synced | offline | error
  let lastError = '', lastSyncAt = 0, lastSent = '', timer = null, running = null, again = false;
  const authListeners = [];

  const readJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* armazenamento cheio */ } };
  const publicUser = u => u ? { id: u.id, email: u.email || '', name: (u.user_metadata && u.user_metadata.name) || '' } : null;
  const setStatus = (s, err) => { status = s; lastError = err || ''; if (hooks && hooks.onStatus) hooks.onStatus(s); };
  const isNetErr = e => !navigator.onLine || /fetch|network|load failed|timeout/i.test(String((e && e.message) || e));

  /* Mensagens de erro do Supabase em português */
  function msg(e) {
    const m = String((e && (e.message || e.error_description)) || e || '').toLowerCase();
    const c = (e && e.code) || '';
    if (isNetErr(e)) return 'Sem conexão. Verifique a internet e tente de novo.';
    if (c === 'invalid_credentials' || m.includes('invalid login')) return 'E-mail ou senha incorretos.';
    if (c === 'email_not_confirmed' || m.includes('not confirmed')) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
    if (c === 'user_already_exists' || m.includes('already registered')) return 'Já existe uma conta com este e-mail. Use “Entrar”.';
    if (c === 'weak_password' || m.includes('password should')) return 'Senha fraca: use pelo menos 8 caracteres.';
    if (c === 'same_password') return 'A nova senha precisa ser diferente da atual.';
    if (c === 'signup_disabled' || m.includes('signups not allowed')) return 'O cadastro de novas contas está fechado.';
    if (c === 'over_email_send_rate_limit' || m.includes('rate limit') || (e && e.status === 429)) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
    if (m.includes('invalid') && m.includes('email')) return 'E-mail inválido.';
    if (m.includes('expired') || c === 'otp_expired') return 'Este link expirou. Peça um novo.';
    return 'Algo deu errado. Tente de novo em instantes.';
  }
  const fail = e => { const err = new Error(msg(e)); err.cause = e; return err; };
  const appUrl = () => location.origin + location.pathname;

  /* ---------------- Autenticação ---------------- */
  async function init() {
    if (!enabled) return null;
    sb = self.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    sb.auth.onAuthStateChange((event, session) => {
      // Chamadas ao Supabase aqui dentro podem travar a biblioteca: adiamos com setTimeout.
      setTimeout(() => {
        const u = publicUser(session && session.user);
        if (event === 'SIGNED_OUT') { user = null; localStorage.removeItem(LAST_USER); }
        else if (u) { user = u; writeJSON(LAST_USER, u); }
        authListeners.forEach(f => f(event, u));
      }, 0);
    });
    let u = null;
    try { const { data } = await sb.auth.getSession(); u = publicUser(data && data.session && data.session.user); }
    catch (e) { /* sem rede na abertura: usa o último usuário conhecido */ }
    // Offline na abertura: a sessão pode não ter sido validada, mas o app deve abrir com os dados locais.
    if (!u && !navigator.onLine) u = readJSON(LAST_USER, null);
    user = u; if (u) writeJSON(LAST_USER, u);
    return user;
  }
  async function signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw fail(error);
    user = publicUser(data.user); writeJSON(LAST_USER, user); return user;
  }
  /* Retorna { user, needsConfirm }: com confirmação de e-mail ligada, a sessão só existe após clicar no link. */
  async function signUp(email, password, name) {
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: appUrl() } });
    if (error) throw fail(error);
    // E-mail já cadastrado: o Supabase devolve um usuário "falso" sem identidades (para não revelar quem tem conta).
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw fail({ code: 'user_already_exists' });
    if (!data.session) return { user: null, needsConfirm: true };
    user = publicUser(data.user); writeJSON(LAST_USER, user); return { user, needsConfirm: false };
  }
  async function resetPassword(email) {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
    if (error) throw fail(error);
  }
  async function updatePassword(password) {
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw fail(error);
  }
  async function signOut() {
    clearTimeout(timer); timer = null;
    try { await sb.auth.signOut({ scope: 'local' }); } catch (e) { /* offline: limpa só o aparelho */ }
    user = null; hooks = null; meta = { base: null, dirty: false }; lastSent = '';
    localStorage.removeItem(LAST_USER); setStatus('idle');
  }

  /* ---------------- Sincronização ---------------- */
  /* hooks: { getData() -> objeto, merge(local, remoto) -> objeto, applyRemote(objeto), onStatus(s) } */
  function attach(h) {
    hooks = h;
    meta = readJSON(metaKey(user.id), { base: null, dirty: false });
    lastSent = meta.dirty ? '' : JSON.stringify(hooks.getData());
    setStatus(meta.dirty ? 'idle' : 'synced');
  }
  const saveMeta = () => writeJSON(metaKey(user.id), meta);

  /* Chamado pelo app a cada gravação local. Só marca pendência se o conteúdo realmente mudou. */
  function markDirty() {
    if (!enabled || !user || !hooks) return;
    if (JSON.stringify(hooks.getData()) === lastSent) return;
    if (!meta.dirty) { meta.dirty = true; saveMeta(); }
    clearTimeout(timer); timer = setTimeout(syncNow, 2500);
  }

  function syncNow() {
    if (!enabled || !user || !hooks) return Promise.resolve(false);
    if (running) { again = true; return running; }
    clearTimeout(timer); timer = null;
    running = cycle().finally(() => { running = null; if (again) { again = false; syncNow(); } });
    return running;
  }

  async function cycle() {
    if (!navigator.onLine) { setStatus('offline'); return false; }
    setStatus('syncing');
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: row, error } = await sb.from('user_data').select('data, rev').eq('user_id', user.id).maybeSingle();
        if (error) throw error;
        const remoteRev = row ? Number(row.rev) : null;

        if (row && remoteRev !== meta.base) {
          // A nuvem tem algo que este aparelho ainda não viu.
          const next = meta.dirty ? hooks.merge(hooks.getData(), row.data) : row.data;
          meta.base = remoteRev; saveMeta();
          hooks.applyRemote(next);
          if (!meta.dirty) lastSent = JSON.stringify(hooks.getData());
        }
        if (row && !meta.dirty) break;

        // Envia: só grava se ninguém gravou no meio do caminho (rev confere).
        const payload = hooks.getData(), sent = JSON.stringify(payload);
        let ok = false, newRev = (remoteRev || 0) + 1;
        if (!row) {
          const r = await sb.from('user_data').insert({ user_id: user.id, data: payload, rev: 1 });
          if (!r.error) { ok = true; newRev = 1; } else if (r.error.code !== '23505') throw r.error;
        } else {
          const r = await sb.from('user_data').update({ data: payload, rev: newRev, updated_at: new Date().toISOString() })
            .eq('user_id', user.id).eq('rev', remoteRev).select('rev');
          if (r.error) throw r.error;
          ok = r.data && r.data.length === 1;
        }
        if (ok) {
          lastSent = sent; meta.base = newRev;
          meta.dirty = JSON.stringify(hooks.getData()) !== sent;   // o usuário pode ter editado durante o envio
          saveMeta();
          if (meta.dirty) again = true;
          break;
        }
        // Conflito: outro aparelho gravou primeiro. O laço baixa de novo, mescla e reenvia.
      }
      lastSyncAt = Date.now(); setStatus(meta.dirty ? 'idle' : 'synced');
      return true;
    } catch (e) {
      if (isNetErr(e)) setStatus('offline'); else { console.error('[sync]', e); setStatus('error', (e && e.message) || String(e)); }
      return false;
    }
  }

  /* Dispara a sincronização nos momentos em que ela mais importa */
  if (enabled) {
    window.addEventListener('online', () => syncNow());
    window.addEventListener('offline', () => { if (user && hooks) setStatus('offline'); });
    document.addEventListener('visibilitychange', () => {
      if (!user || !hooks) return;
      if (document.visibilityState === 'hidden') { if (meta.dirty) syncNow(); }
      else if (Date.now() - lastSyncAt > 60000 || meta.dirty) syncNow();
    });
  }

  self.JFCloud = {
    enabled, init, signIn, signUp, signOut, resetPassword, updatePassword,
    onAuth: f => authListeners.push(f),
    attach, markDirty, syncNow,
    get user() { return user; },
    get status() { return status; },
    get pending() { return !!meta.dirty; },
    get lastError() { return lastError; },
    get lastSyncAt() { return lastSyncAt; },
  };
})();
