// Um "Supabase de mentira" para os testes: responde às chamadas de login e de banco
// dentro do próprio navegador de teste, sem depender de internet nem do projeto real.
const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'teste@jhonfit.dev', password: 'senha-de-teste', name: 'Teste' };

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
function session() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = { id: USER.id, aud: 'authenticated', role: 'authenticated', email: USER.email, user_metadata: { name: USER.name }, app_metadata: {}, identities: [{ id: USER.id }] };
  return { access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, email: USER.email, exp, role: 'authenticated' })}.assinatura`, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'refresh', user };
}

/** Liga o backend falso em um contexto do navegador. Devolve o "banco" para os testes inspecionarem. */
async function mockBackend(context) {
  const db = { rows: new Map(), writes: 0 };
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json' };
  const json = (route, status, body) => route.fulfill({ status, headers: cors, body: body === undefined ? '' : JSON.stringify(body) });

  await context.route('**/config.js', route => route.fulfill({ contentType: 'application/javascript', body: "self.JF_CONFIG={supabaseUrl:'https://teste.supabase.co',supabaseKey:'chave-publica-de-teste'};" }));
  await context.route('https://teste.supabase.co/**', async route => {
    const req = route.request(), url = req.url(), method = req.method();
    if (method === 'OPTIONS') return json(route, 204);
    const body = req.postData() ? req.postDataJSON() : null;
    if (url.includes('/auth/v1/token')) {
      if (url.includes('grant_type=password') && (body.email !== USER.email || body.password !== USER.password)) return json(route, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return json(route, 200, session());
    }
    if (url.includes('/auth/v1/logout')) return json(route, 204);
    if (url.includes('/auth/v1/user')) return json(route, 200, session().user);
    if (url.includes('/rest/v1/user_data')) {
      const uid = (url.match(/user_id=eq\.([0-9a-f-]+)/) || [])[1] || (body && body.user_id);
      const row = db.rows.get(uid);
      if (method === 'GET') return json(route, 200, row ? [row] : []);
      if (method === 'POST') { if (row) return json(route, 409, { code: '23505', message: 'duplicate key' }); db.rows.set(uid, { data: body.data, rev: body.rev }); db.writes++; return json(route, 201); }
      if (method === 'PATCH') {
        const rev = Number(url.match(/rev=eq\.(\d+)/)[1]);
        if (!row || row.rev !== rev) return json(route, 200, []);          // rev não confere: outro aparelho gravou antes
        db.rows.set(uid, { data: body.data, rev: body.rev }); db.writes++; return json(route, 200, [{ rev: body.rev }]);
      }
    }
    return json(route, 404, {});
  });
  return db;
}

/** Junta erros de JavaScript e do console para o teste falhar se algo quebrar em silêncio. */
function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  return errors;
}

async function signIn(page) {
  await page.goto('/');
  await page.getByLabel('E-mail').fill(USER.email);
  await page.getByLabel('Senha', { exact: true }).fill(USER.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).last().click();
}

module.exports = { USER, mockBackend, trackErrors, signIn };
