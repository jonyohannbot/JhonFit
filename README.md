# Jhon Fit

App de treinos (PWA) com login, histórico sincronizado entre aparelhos e funcionamento offline.

- **Front-end:** HTML, CSS e JavaScript puros, sem etapa de build. Instalável no celular.
- **Back-end:** [Supabase](https://supabase.com) (login + banco PostgreSQL), plano gratuito.
- **Hospedagem:** GitHub Pages, publicada automaticamente pelo GitHub Actions.

## Como as peças se encaixam

```
 Celular / computador
 ┌────────────────────────────────────────────┐
 │ app/ (arquivos estáticos)                  │        GitHub Pages
 │  index.html, styles.css, app.js ...        │ ◄───── serve os arquivos
 │  sw.js  → guarda o app para uso offline    │
 │  localStorage → cópia dos dados no aparelho│
 └───────────────┬────────────────────────────┘
                 │ HTTPS (login e sincronização)
                 ▼
 Supabase: Auth (e-mail e senha) + tabela user_data (1 linha por usuário, protegida por RLS)
```

O app sempre lê e grava primeiro no aparelho, por isso funciona na academia sem sinal. Quando há internet, envia as mudanças para a nuvem; ao abrir em outro aparelho, baixa de lá.

## Estrutura

| Caminho | O que é |
| --- | --- |
| `app/` | O aplicativo. É exatamente esta pasta que vai para o ar. |
| `app/app.js` | Telas e regras do app. |
| `app/cloud.js` | Login e sincronização com o Supabase. |
| `app/config.js` | Endereço e chave **pública** do projeto Supabase. |
| `app/sw.js` | Service worker: cache offline e atualização de versão. |
| `app/vendor/supabase.js` | Biblioteca do Supabase (cópia local, para funcionar offline). |
| `supabase/schema.sql` | Tabela e regras de segurança do banco. |
| `tests/` | Testes automáticos de navegador (Playwright) e de acessibilidade (axe). |
| `scripts/check.mjs` | Checagens rápidas de estrutura. |
| `.github/workflows/ci.yml` | Pipeline de CI/CD. |

## Rodar no seu computador

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
npm install        # só na primeira vez
npm start          # abre em http://localhost:8080
```

Com `app/config.js` vazio o app roda em **modo local** (sem login, dados só no navegador). Com as chaves preenchidas, pede login.

Testes:

```bash
npx playwright install chromium   # só na primeira vez
npm run ci                        # lint + checagens + testes
```

## Publicar uma mudança (CI/CD)

```bash
git checkout -b minha-mudanca     # 1. trabalhe em uma branch
# ...edite os arquivos...
git commit -am "Descreva o que mudou"
git push -u origin minha-mudanca  # 2. abra um pull request no GitHub
```

1. No pull request, o GitHub Actions roda lint, checagens e testes. Se algo quebrar, você vê antes de ir para o ar.
2. Ao fazer o merge na `main`, os testes rodam de novo e, se passarem, o site é publicado (cerca de 1 a 2 minutos).
3. Quem já tem o app aberto ou instalado vê o aviso **"Nova versão disponível"** e toca em **Atualizar**.

Os dados dos usuários não são afetados por uma publicação: eles moram no Supabase e no aparelho, não nos arquivos do site.

## Banco de dados

Uma tabela, `user_data`, com uma linha por usuário:

| Coluna | Tipo | Para quê |
| --- | --- | --- |
| `user_id` | `uuid` | Dono da linha (chave primária, ligada a `auth.users`). |
| `data` | `jsonb` | Tudo do app: perfil, treinos, histórico, medidas. |
| `rev` | `bigint` | Contador de versão. Evita que um aparelho sobrescreva o outro. |
| `updated_at` | `timestamptz` | Quando foi gravado pela última vez. |

**Row Level Security (RLS)** garante que cada pessoa só leia e grave a própria linha. É por isso que a chave em `config.js` pode ser pública. A chave `service_role` (ou "secret") ignora o RLS e **nunca** deve aparecer neste repositório.

**Sincronização:** para gravar, o app pede "atualize se a `rev` ainda for a que eu conheço". Se outro aparelho gravou antes, a gravação é recusada; o app baixa a versão nova, une os históricos pelo `id` (nenhum treino se perde) e envia de novo.

Limitação conhecida: se dois aparelhos editarem **offline ao mesmo tempo** e um deles tiver apagado um treino, ele pode reaparecer depois da união.

### Configurar um projeto Supabase do zero

1. Crie um projeto em supabase.com (região São Paulo).
2. **SQL Editor** → cole o conteúdo de `supabase/schema.sql` → **Run**.
3. **Authentication → URL Configuration**: em *Site URL* e *Redirect URLs*, coloque o endereço do app publicado.
4. **Project Settings → API**: copie a *Project URL* e a chave pública para `app/config.js`.
5. Depois que todos criarem suas contas, desligue **Authentication → Sign In / Providers → Allow new users to sign up** para ninguém mais se cadastrar.

O plano gratuito pausa o projeto após uma semana sem uso. Os dados não se perdem: basta reativar no painel. Enquanto isso o app segue funcionando com os dados do aparelho.

## Segurança e acessibilidade

- Senhas nunca passam pelo código do app nem ficam no banco em texto puro: o Supabase Auth cuida disso.
- `Content-Security-Policy` no `index.html`: só scripts do próprio site rodam.
- Testes automáticos de acessibilidade (WCAG 2.1 AA) nas telas principais: contraste, nomes de botões, navegação por teclado.

## Créditos

Imagens dos exercícios: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (domínio público).
