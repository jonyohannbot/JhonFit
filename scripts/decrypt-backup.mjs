// Abre um backup criptografado e grava o JSON legível ao lado.
//   node scripts/decrypt-backup.mjs jhonfit-2026-11-15.json.enc
// A senha é pedida no terminal (ou lida de BACKUP_PASSPHRASE).
// ATENÇÃO: o arquivo .json gerado contém dados pessoais sem proteção. Apague depois de usar.
import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { decrypt } from './backup-lib.mjs';

const file = process.argv[2];
if (!file) { console.error('Uso: node scripts/decrypt-backup.mjs <arquivo.json.enc>'); process.exit(1); }
let pass = process.env.BACKUP_PASSPHRASE;
if (!pass) { const rl = createInterface({ input: process.stdin, output: process.stdout }); pass = await rl.question('Senha do backup: '); rl.close(); }
try {
  const data = decrypt(readFileSync(file, 'utf8'), pass);
  const out = file.replace(/\.enc$/, '') + (file.endsWith('.enc') ? '' : '.json');
  writeFileSync(out, JSON.stringify(data, null, 2));
  console.log(`✓ ${out}: ${data.users.length} usuário(s), criado em ${data.created_at}`);
} catch (e) { console.error('✗ ' + e.message); process.exit(1); }
