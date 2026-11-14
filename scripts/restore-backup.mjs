// Restaura dados de um backup (já aberto com decrypt-backup.mjs) para o Supabase.
//   SUPABASE_SECRET_KEY=... node scripts/restore-backup.mjs backup/jhonfit-2026-11-15.json [email]
// Sem e-mail: restaura todos. Com e-mail: só aquela pessoa.
// A conta precisa existir no Supabase (o usuário pode ter que se cadastrar de novo com o mesmo e-mail;
// nesse caso o id muda e o script associa os dados pelo e-mail).
// Os aparelhos sem alterações pendentes passam a mostrar o backup; os que tiverem alterações unem as duas coisas.
import { readFileSync } from 'node:fs';
import { supabase } from './backup-lib.mjs';

const [file, only] = process.argv.slice(2);
if (!file || file.endsWith('.enc')) { console.error('Uso: node scripts/restore-backup.mjs <backup.json aberto> [email]'); process.exit(1); }
try {
  const bk = JSON.parse(readFileSync(file, 'utf8'));
  const { api } = supabase();
  const current = [];
  for (let page = 1; ; page++) { const r = await api(`/auth/v1/admin/users?page=${page}&per_page=200`); current.push(...(r.users || [])); if ((r.users || []).length < 200) break; }
  const byEmail = new Map(current.map(u => [String(u.email).toLowerCase(), u.id]));
  const emailOf = new Map(bk.users.map(u => [u.id, String(u.email).toLowerCase()]));
  let done = 0;
  for (const row of bk.user_data) {
    const email = emailOf.get(row.user_id);
    if (only && email !== only.toLowerCase()) continue;
    const uid = byEmail.get(email);
    if (!uid) { console.warn(`! ${email}: conta não existe hoje no Supabase. Peça para a pessoa se cadastrar e rode de novo.`); continue; }
    const cur = await api(`/rest/v1/user_data?select=rev&user_id=eq.${uid}`);
    const rev = (cur[0] ? Number(cur[0].rev) : 0) + 1;   // rev nova: os aparelhos percebem a mudança
    await api('/rest/v1/user_data?on_conflict=user_id', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ user_id: uid, data: row.data, rev, updated_at: new Date().toISOString() }) });
    console.log(`✓ ${email} restaurado (${(row.data.sessions || []).length} treinos)`); done++;
  }
  console.log(`Concluído: ${done} conta(s) restaurada(s).`);
} catch (e) { console.error('✗ ' + e.message); process.exit(1); }
