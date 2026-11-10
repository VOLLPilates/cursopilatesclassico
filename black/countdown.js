/* Cronômetro da Ultra Black — conta os dias até 30/11 (fim da Ultra Black), horário de Brasília (UTC-3).
   Atualiza todos os elementos .cd-pre (rótulo) e .cd-main (valor) na página. */
(function () {
  function compute() {
    var DAY = 86400000, BRT = 3 * 3600000;
    var today = Math.floor((Date.now() - BRT) / DAY);
    var endDay = Math.floor(Date.parse('2026-11-30T00:00:00Z') / DAY);
    var days = endDay - today, cd;
    if (days < 0)        cd = { pre: 'Encerrada',  main: 'a Ultra Black' };
    else if (days === 0) cd = { pre: 'Último dia', main: 'até 23h59' };
    else if (days === 1) cd = { pre: 'Falta',      main: '1 dia' };
    else if (days < 7)   cd = { pre: 'Faltam',     main: days + ' dias' };
    else if (days === 7) cd = { pre: 'Falta',      main: '1 semana' };
    else if (days % 7 === 0) cd = { pre: 'Faltam', main: (days / 7) + ' semanas' };
    else                 cd = { pre: 'Faltam',     main: 'menos de ' + Math.ceil(days / 7) + ' semanas' };
    document.querySelectorAll('.cd-pre').forEach(function (e) { e.textContent = cd.pre; });
    document.querySelectorAll('.cd-main').forEach(function (e) { e.textContent = cd.main; });
  }
  compute();
  setInterval(compute, 30000);

  /* Carrossel do Conselho de especialistas */
  window.scrollCar = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    var c = document.getElementById('profCar');
    if (!c) return;
    if (c.scrollLeft + c.clientWidth >= c.scrollWidth - 12) {
      c.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      c.scrollBy({ left: Math.max(220, Math.round(c.clientWidth * 0.8)), behavior: 'smooth' });
    }
  };
})();
