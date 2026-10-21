/* Busca de turmas por Estado/Cidade.
   Lê ao vivo os dados do plugin "Turmas Pilates Clássico" no WordPress.
   A página fica no mesmo domínio do WordPress, por isso o endereço é relativo. */
(function () {
  var API = '/wp-json/turmas/v1';

  var selEstado = document.getElementById('turmas-estado');
  var selCidade = document.getElementById('turmas-cidade');
  var resultado = document.getElementById('turmas-resultado');
  if (!selEstado || !selCidade || !resultado) return;

  function get(caminho) {
    return fetch(API + caminho).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }

  function el(tag, cls, texto) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (texto != null) e.textContent = texto;
    return e;
  }

  function opcoes(select, primeira, itens) {
    select.innerHTML = '';
    select.appendChild(new Option(primeira, ''));
    itens.forEach(function (i) { select.appendChild(new Option(i[1], i[0])); });
  }

  function mensagem(texto) {
    resultado.innerHTML = '';
    resultado.appendChild(el('p', null, texto));
  }

  // "13/11/2026","14/11/2026","15/11/2026" -> "13/11, 14/11 e 15/11/2026"
  function formatarDatas(datas) {
    var f = datas.map(function (d, i) {
      var p = d.split('/');
      return i < datas.length - 1 && p.length === 3 ? p[0] + '/' + p[1] : d;
    });
    return f.join(', ').replace(/, ([^,]*)$/, ' e $1');
  }

  // Destaque primeiro, depois número da turma em ordem natural
  function ordenar(a, b) {
    if (!!a.destaque !== !!b.destaque) return a.destaque ? -1 : 1;
    return String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true, sensitivity: 'base' });
  }

  function lista(v) {
    return Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
  }

  function card(t) {
    var status = String(t.status || '').trim().toLowerCase();
    var esgotada = /esgotad/.test(status);
    var texto = status === 'abertas' ? 'Vagas Abertas'
      : esgotada ? 'Vagas Esgotadas'
      : (t.qtd_vagas ? 'Vagas Restantes: ' + t.qtd_vagas : 'Vagas Restantes');

    var c = el('div', 'turma-card');
    c.appendChild(el('h3', null, 'Turma ' + t.numero));
    var datas = [t.modulo_data1, t.modulo_data2, t.modulo_data3].filter(Boolean);
    if (datas.length) {
      var p = el('p');
      p.appendChild(el('strong', null, 'Datas desta turma: '));
      p.appendChild(document.createTextNode(formatarDatas(datas)));
      c.appendChild(p);
    }
    var badge;
    if (esgotada) {
      badge = el('span', 'turma-badge esgotada', texto);
    } else {
      badge = el('a', 'turma-badge', texto);
      badge.href = '#inscricao';
      badge.setAttribute('aria-label', texto + ' · inscreva-se na Turma ' + t.numero);
    }
    c.appendChild(badge);
    return c;
  }

  function grupo(titulo, turmas, info) {
    if (!turmas.length) return;
    resultado.appendChild(el('h2', 'turmas-titulo', titulo));
    var grid = el('div', 'turmas-grid');
    turmas.sort(ordenar).forEach(function (t) { grid.appendChild(card(t)); });
    if (info) {
      var box = el('div', 'turma-info');
      box.appendChild(el('h3', null, 'Informações sobre o curso'));
      var corpo = el('div');
      corpo.innerHTML = info.replace(/\r?\n/g, '<br>'); // HTML cadastrado no admin do WordPress
      box.appendChild(corpo);
      grid.appendChild(box);
    }
    resultado.appendChild(grid);
  }

  function erro() { mensagem('Não foi possível carregar as turmas agora. Tente novamente em instantes.'); }

  get('/estados').then(function (estados) {
    opcoes(selEstado, 'Selecione o Estado', estados.map(function (e) { return [e.id, e.name]; }));
  }).catch(erro);

  selEstado.addEventListener('change', function () {
    resultado.innerHTML = '';
    if (!selEstado.value) return opcoes(selCidade, 'Selecione a Cidade', []);
    opcoes(selCidade, 'Carregando cidades...', []);
    get('/cidades?estado_id=' + encodeURIComponent(selEstado.value)).then(function (cidades) {
      opcoes(selCidade, 'Selecione a Cidade', cidades.map(function (c) { return [c.id, c.title]; }));
    }).catch(erro);
  });

  selCidade.addEventListener('change', function () {
    if (!selCidade.value) { resultado.innerHTML = ''; return; }
    mensagem('Carregando turmas...');
    get('/turmas?cidade_id=' + encodeURIComponent(selCidade.value)).then(function (d) {
      var fds = lista(d.final_semana), semana = lista(d.meio_semana), info = d.info_adicional || {};
      resultado.innerHTML = '';
      if (!fds.length && !semana.length) return mensagem('Nenhuma turma encontrada para esta cidade.');
      var local = selCidade.options[selCidade.selectedIndex].text + ' - ' + selEstado.options[selEstado.selectedIndex].text;
      grupo('Próximas Turmas em ' + local, fds, info.info_fds);
      grupo('Turmas Durante a Semana em ' + local, semana, info.info_meio_semana);
    }).catch(erro);
  });
})();
