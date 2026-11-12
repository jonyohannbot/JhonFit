// Checagens estruturais rápidas (rodam no CI antes dos testes de navegador).
import { readFileSync, existsSync } from 'node:fs';

const fail = [];
const read = f => readFileSync(new URL('../app/' + f, import.meta.url), 'utf8');

// 1) Todo arquivo que o service worker promete guardar offline precisa existir.
const sw = read('sw.js');
const shell = [...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]).filter(f => f !== './');
for (const f of shell) if (!existsSync(new URL('../app/' + f, import.meta.url))) fail.push(`sw.js lista "${f}", mas o arquivo não existe`);

// 2) Todo script carregado pelo index.html precisa estar na lista offline.
const html = read('index.html');
for (const m of html.matchAll(/<script src="([^"]+)"/g)) if (!shell.includes(m[1])) fail.push(`index.html carrega "${m[1]}", que não está na lista SHELL do sw.js (não funcionaria offline)`);

// 3) Manifesto válido e com ícones existentes.
const manifest = JSON.parse(read('manifest.webmanifest'));
for (const i of manifest.icons) if (!existsSync(new URL('../app/' + i.src, import.meta.url))) fail.push(`manifest: ícone "${i.src}" não existe`);

// 4) Segredos: a chave de administrador do Supabase nunca pode ir para o front-end.
const cfg = read('config.js').replace(/\/\*[\s\S]*?\*\//g, '');   // ignora comentários
if (/service_role|sb_secret_/.test(cfg)) fail.push('config.js parece conter uma chave SECRETA do Supabase. Use apenas a chave pública (anon/publishable).');
for (const m of cfg.matchAll(/eyJ[\w-]+\.([\w-]+)\.[\w-]+/g)) {
  try { if (JSON.parse(Buffer.from(m[1], 'base64url').toString()).role === 'service_role') fail.push('config.js contém a chave service_role do Supabase.'); } catch { /* não é JWT */ }
}

// 5) Sem scripts inline (a Content-Security-Policy bloquearia).
if (/<script(?![^>]*\bsrc=)[^>]*>/.test(html)) fail.push('index.html tem <script> inline; mova para um arquivo .js');

if (fail.length) { console.error('✗ Problemas encontrados:\n- ' + fail.join('\n- ')); process.exit(1); }
console.log(`✓ Estrutura ok (${shell.length} arquivos offline, ${manifest.icons.length} ícones)`);
