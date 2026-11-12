/* Jhon Fit — casca do app: aviso de erro, service worker e aviso de nova versão.
   Fica em arquivo separado (e não dentro do index.html) para a página poder proibir scripts inline. */
'use strict';
(function () {
  // Erro inesperado: mostra uma faixa em vez de falhar em silêncio.
  window.addEventListener('error', function (e) {
    if (!e.message) return;   // erros de carregamento de imagem não têm mensagem
    var b = document.createElement('div'); b.className = 'err-box'; b.setAttribute('role', 'alert');
    b.textContent = 'Erro: ' + e.message + ' @' + (e.lineno || '');
    document.body.appendChild(b);
  });

  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  var sw = navigator.serviceWorker;
  // Em desenvolvimento (localhost) o cache só atrapalha: sem service worker.
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    sw.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); });
    return;
  }
  var hadController = !!sw.controller;
  window.addEventListener('load', function () {
    sw.register('sw.js').then(function (reg) {
      // Ao voltar para o app, pergunta ao servidor se saiu versão nova.
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') reg.update().catch(function () { });
      });
    }).catch(function () { });
  });
  // Um service worker novo assumiu: há versão nova baixada. O usuário decide quando recarregar
  // (nada se perde: o treino em andamento está salvo no aparelho).
  sw.addEventListener('controllerchange', function () {
    if (hadController) document.getElementById('update').hidden = false;
    hadController = true;
  });
  document.getElementById('update-go').addEventListener('click', function () { location.reload(); });
})();
