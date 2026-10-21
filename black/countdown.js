/* Cronômetro da Formação de Pilates Clássico Presencial · Ultra Black VOLL
   Conta em dias/semanas até a live (horário de Brasília).
   Altere apenas a data abaixo se a live mudar. */
(function () {
  var DIA_DA_LIVE = '2026-11-11';

  var DIA = 86400000, BRT = 3 * 3600000;
  function set(papel, texto) {
    var els = document.querySelectorAll('[data-cd="' + papel + '"]');
    for (var i = 0; i < els.length; i++) els[i].textContent = texto;
  }
  function atualizar() {
    var hoje = Math.floor((Date.now() - BRT) / DIA);
    var dias = Math.floor(Date.parse(DIA_DA_LIVE + 'T00:00:00Z') / DIA) - hoje;
    var pre = 'Faltam', main;
    if (dias <= 0) { pre = 'É hoje'; main = 'às 20h'; }
    else if (dias === 1) { pre = 'Falta'; main = '1 dia'; }
    else if (dias < 7) main = dias + ' dias';
    else if (dias === 7) { pre = 'Falta'; main = '1 semana'; }
    else if (dias % 7 === 0) main = (dias / 7) + ' semanas';
    else main = 'menos de ' + Math.ceil(dias / 7) + ' semanas';
    set('faixa', pre + ' ' + main);
    set('pre', pre);
    set('main', main);
  }
  atualizar();
  setInterval(atualizar, 30000);
})();
