const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const { USER, mockBackend, trackErrors, signIn } = require('./helpers');

test.describe('modo local (sem backend configurado)', () => {
  test('abre, navega pelas abas e não gera erros', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/#/seed-demo');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Demo');
    for (const [aba, titulo] of [['Treinos', 'Treinos'], ['Corpo', 'Corpo'], ['Relatórios', 'Relatórios'], ['Início', /Bo[am] /]]) {
      await page.getByRole('navigation').getByRole('link', { name: aba }).click();
      await expect(page.getByRole('heading', { level: 1 })).toContainText(titulo);
    }
    expect(errors).toEqual([]);
  });

  test('registra um treino do início ao fim', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Pular por enquanto' }).click();
    await page.getByRole('button', { name: 'Iniciar treino' }).click();
    await page.getByLabel('Peso série 1').first().fill('40');
    await page.getByRole('button', { name: 'Concluir série' }).first().click();
    await page.getByRole('button', { name: 'Finalizar', exact: true }).click();
    await page.getByRole('button', { name: 'Finalizar e salvar' }).click();
    await expect(page.getByRole('heading', { name: 'Treino concluído!' })).toBeVisible();
    await expect(page.getByText('400 kg').first()).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('conta e sincronização', () => {
  test('exige login e recusa senha errada', async ({ page, context }) => {
    await mockBackend(context);
    await page.goto('/');
    await expect(page.getByRole('navigation')).toBeHidden();
    await page.getByLabel('E-mail').fill(USER.email);
    await page.getByLabel('Senha', { exact: true }).fill('errada');
    await page.getByRole('button', { name: 'Entrar', exact: true }).last().click();
    await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.');
  });

  test('login envia os dados para a nuvem e um segundo aparelho os recebe', async ({ page, context, browser }) => {
    const errors = trackErrors(page);
    const db = await mockBackend(context);
    await signIn(page);
    await page.getByLabel('Altura (cm)').fill('170');
    await page.getByRole('button', { name: 'Começar' }).click();
    await expect.poll(() => db.rows.get(USER.id)?.data.profile.height).toBe(170);
    await expect.poll(() => db.rows.get(USER.id)?.data.onboarded).toBe(true);

    // "Segundo aparelho": outro contexto de navegador (armazenamento vazio) falando com o mesmo banco.
    const ctx2 = await browser.newContext();
    const db2 = await mockBackend(ctx2);
    db2.rows.set(USER.id, structuredClone(db.rows.get(USER.id)));
    const page2 = await ctx2.newPage();
    await signIn(page2);
    await expect(page2.getByRole('heading', { level: 1 })).toContainText('Teste');
    await expect(page2.getByRole('button', { name: 'Começar' })).toHaveCount(0);   // perfil já veio da nuvem
    await page2.getByRole('button', { name: 'Ajustes e conta' }).click();
    await expect(page2.getByLabel('Altura (cm)')).toHaveValue('170');
    await expect(page2.getByRole('status').filter({ hasText: 'Sincronizado' })).toBeVisible();
    await ctx2.close();
    expect(errors).toEqual([]);
  });

  test('sem internet guarda no aparelho e envia quando a conexão volta', async ({ page, context }) => {
    const db = await mockBackend(context);
    await signIn(page);
    await page.getByRole('button', { name: 'Pular por enquanto' }).click();
    await page.getByRole('button', { name: 'Ajustes e conta' }).click();
    await expect.poll(() => db.rows.has(USER.id)).toBe(true);
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Aumentar meta semanal' }).click();
    await expect(page.getByText('Sem conexão · salvo neste aparelho')).toBeVisible();
    expect(db.rows.get(USER.id).data.settings.goal).toBe(4);
    await context.setOffline(false);
    await expect.poll(() => db.rows.get(USER.id).data.settings.goal).toBe(5);
    await expect(page.getByRole('status').filter({ hasText: 'Sincronizado' })).toBeVisible();
  });

  test('sair volta para a tela de login', async ({ page, context }) => {
    await mockBackend(context);
    await signIn(page);
    await page.getByRole('button', { name: 'Pular por enquanto' }).click();
    await page.getByRole('button', { name: 'Ajustes e conta' }).click();
    await page.getByRole('button', { name: 'Sair' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Sair' }).click();
    await expect(page.getByLabel('E-mail')).toBeVisible();
  });
});

test.describe('acessibilidade (axe, WCAG 2.1 AA)', () => {
  const scan = async page => (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations
    .map(v => `${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);

  test('tela de login', async ({ page, context }) => {
    await mockBackend(context);
    await page.goto('/');
    await expect(page.getByLabel('E-mail')).toBeVisible();
    expect(await scan(page)).toEqual([]);
    await page.getByRole('button', { name: 'Criar conta' }).first().click();
    expect(await scan(page)).toEqual([]);
  });

  for (const rota of ['home', 'routines', 'body', 'reports', 'settings']) {
    test(`tela ${rota}`, async ({ page }) => {
      await page.goto('/#/seed-demo');
      await page.goto('/#/' + rota);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await scan(page)).toEqual([]);
    });
  }

  test('boas-vindas, detalhe do treino, editor e seletor de exercícios', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await scan(page)).toEqual([]);
    await page.getByRole('button', { name: 'Pular por enquanto' }).click();
    await page.getByRole('navigation').getByRole('link', { name: 'Treinos' }).click();
    await page.getByRole('button', { name: /Perna/ }).first().click();
    await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible();
    expect(await scan(page)).toEqual([]);
    await page.getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByLabel('Nome do treino')).toBeVisible();
    expect(await scan(page)).toEqual([]);
    await page.getByRole('button', { name: 'Adicionar exercícios' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });

  test('treino em andamento', async ({ page }) => {
    await page.goto('/#/seed-demo');
    await page.getByRole('button', { name: 'Iniciar treino' }).click();
    await expect(page.getByRole('button', { name: 'Finalizar', exact: true })).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });
});
