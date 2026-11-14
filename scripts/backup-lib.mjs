// Funções compartilhadas pelos scripts de backup: criptografia e acesso ao Supabase.
//
// Criptografia: AES-256-GCM com chave derivada da senha por scrypt.
//  - scrypt é propositalmente lento: tentar adivinhar a senha por força bruta fica caro.
//  - GCM detecta adulteração: um arquivo alterado (ou senha errada) falha ao abrir, em vez de gerar lixo.
import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { readFileSync } from 'node:fs';

const KDF = { N: 2 ** 17, r: 8, p: 1 };
const deriveKey = (pass, salt, k = KDF) => scryptSync(pass, salt, 32, { ...k, maxmem: 256 * 1024 * 1024 });

export function encrypt(obj, pass) {
  const salt = randomBytes(16), iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', deriveKey(pass, salt), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return JSON.stringify({
    format: 'jhonfit-backup-v1', cipher: 'aes-256-gcm',
    kdf: { name: 'scrypt', ...KDF, salt: salt.toString('base64') },
    iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64'),
  });
}

export function decrypt(text, pass) {
  const f = JSON.parse(text);
  if (f.format !== 'jhonfit-backup-v1') throw new Error('Este arquivo não é um backup do Jhon Fit.');
  const { N, r, p, salt } = f.kdf;
  const d = createDecipheriv('aes-256-gcm', deriveKey(pass, Buffer.from(salt, 'base64'), { N, r, p }), Buffer.from(f.iv, 'base64'));
  d.setAuthTag(Buffer.from(f.tag, 'base64'));
  try { return JSON.parse(Buffer.concat([d.update(Buffer.from(f.data, 'base64')), d.final()]).toString('utf8')); }
  catch { throw new Error('Senha incorreta ou arquivo corrompido.'); }
}

/* A URL do projeto já está no app (é pública); a chave secreta vem de variável de ambiente. */
export function supabase() {
  const cfg = readFileSync(new URL('../app/config.js', import.meta.url), 'utf8');
  const url = process.env.SUPABASE_URL || (cfg.match(/supabaseUrl:\s*'([^']+)'/) || [])[1];
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url) throw new Error('URL do Supabase não encontrada em app/config.js.');
  if (!key) throw new Error('Defina a variável SUPABASE_SECRET_KEY (chave secreta do Supabase).');
  if (!/^sb_secret_/.test(key) && !/^eyJ/.test(key)) throw new Error('SUPABASE_SECRET_KEY não parece uma chave secreta do Supabase.');
  const api = async (path, init = {}) => {
    const res = await fetch(url + path, { ...init, headers: { apikey: key, 'content-type': 'application/json', ...(init.headers || {}) } });
    const body = await res.text();
    if (!res.ok) throw new Error(`${init.method || 'GET'} ${path.split('?')[0]} → HTTP ${res.status}: ${body.slice(0, 200)}`);
    return body ? JSON.parse(body) : null;
  };
  return { url, api };
}

export function passphrase() {
  const p = process.env.BACKUP_PASSPHRASE || '';
  if (p.length < 12) throw new Error('Defina BACKUP_PASSPHRASE com pelo menos 12 caracteres.');
  return p;
}
