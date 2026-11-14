// Backup do Jhon Fit: baixa todos os dados do Supabase e grava um arquivo CRIPTOGRAFADO em backup/.
// Roda toda semana pelo GitHub Actions (.github/workflows/backup.yml). Também pode rodar no seu computador:
//   SUPABASE_SECRET_KEY=... BACKUP_PASSPHRASE=... node scripts/backup.mjs
// Por segurança, nada do conteúdo é impresso: só contagens.
import { mkdirSync, writeFileSync } from 'node:fs';
import { encrypt, supabase, passphrase } from './backup-lib.mjs';

try {
  const pass = passphrase();
  const { url, api } = supabase();

  const rows = await api('/rest/v1/user_data?select=*&order=user_id');
  const users = [];
  for (let page = 1; ; page++) {   // a API de administração devolve os usuários em páginas
    const r = await api(`/auth/v1/admin/users?page=${page}&per_page=200`);
    const list = r.users || [];
    users.push(...list.map(u => ({ id: u.id, email: u.email, created_at: u.created_at, user_metadata: u.user_metadata || {} })));
    if (list.length < 200) break;
  }

  const sessions = rows.reduce((n, r) => n + ((r.data && r.data.sessions) || []).length, 0);
  const backup = { app: 'jhonfit', version: 1, created_at: new Date().toISOString(), project: new URL(url).host, users, user_data: rows };

  const stamp = new Date().toISOString().slice(0, 10);
  mkdirSync(new URL('../backup/', import.meta.url), { recursive: true });
  const file = new URL(`../backup/jhonfit-${stamp}.json.enc`, import.meta.url);
  writeFileSync(file, encrypt(backup, pass));

  const msg = `Backup ${stamp}: ${users.length} usuário(s), ${rows.length} com dados, ${sessions} treino(s) registrados.`;
  console.log('✓ ' + msg);
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `### ✓ ${msg}\nArquivo criptografado (AES-256-GCM). Para abrir: \`node scripts/decrypt-backup.mjs <arquivo>\`.\n`, { flag: 'a' });
} catch (e) {
  console.error('✗ Backup falhou: ' + e.message);
  process.exit(1);
}
