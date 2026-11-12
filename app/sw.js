/* Jhon Fit — service worker: app offline + cache de imagens dos exercícios.

   Atualizações: a cada deploy o arquivo version.js muda. O navegador percebe, instala este
   service worker de novo, baixa TODOS os arquivos do app para um cache novo (nomeado com a
   versão) e apaga o antigo. Assim o app nunca fica com metade dos arquivos de uma versão e
   metade de outra. */
importScripts('version.js');
const VERSION = self.JF_VERSION || 'dev';
const APP = 'jhonfit-app-' + VERSION;
const IMG = 'jhonfit-img-v1';
const SHELL = ['./', 'index.html', 'styles.css', 'shell.js', 'version.js', 'config.js', 'vendor/supabase.js', 'cloud.js',
  'exercises.js', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  // cache: 'reload' ignora o cache HTTP do navegador e busca os arquivos novos de verdade
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('jhonfit-app-') && k !== APP).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'raw.githubusercontent.com') {
    // imagens: cache-first (funcionam offline depois da 1ª visualização)
    e.respondWith(caches.open(IMG).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      } catch (err) { return new Response('', { status: 504 }); }
    }));
    return;
  }
  if (url.origin === location.origin) {
    // app: sempre do cache desta versão (abre instantâneo e funciona offline); rede só para o que não estiver no cache
    e.respondWith(caches.open(APP).then(async c => {
      const hit = await c.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try { return await fetch(req); }
      catch (err) { return (req.mode === 'navigate' && await c.match('index.html')) || new Response('', { status: 504 }); }
    }));
  }
  // Demais origens (Supabase): passam direto para a rede, sem cache.
});
