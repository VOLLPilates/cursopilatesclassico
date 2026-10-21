jQuery(document).ready(function($) {
    // Variáveis de controle de retentativa
    var maxRetries = 3;
    var retryDelay = 1000; // 1 segundo
    var debugMode = turmasPilates.debug || false;

    // Função para exibir mensagens de debug
    function debug(message) {
        if (debugMode && console) {
            console.log('DEBUG [Turmas Pilates]: ' + message);
        }
    }

    // =====================================================
    // FAILSAFE: garante que turmas esgotadas NÃO sejam clicáveis
    // - Remove <a> que envolva badge esgotada
    // - Bloqueia clique no card (caso exista handler/overlay externo)
    // =====================================================
    function neutralizarCliqueEsgotadas($root) {
        if (!$root || !$root.length) return;

        // Remove <a> que contenha badge com status-esgotadas
        $root.find('a:has(.status-badge.status-esgotadas)').each(function() {
            var $a = $(this);
            var $badge = $a.find('.status-badge.status-esgotadas').first();

            if ($badge.length) {
                $a.replaceWith($badge);
            } else {
                $a.replaceWith($a.contents());
            }
        });

        // Bloqueia qualquer clique residual no card que tenha badge esgotada
        $root.find('.status-badge.status-esgotadas')
            .css({ 'pointer-events': 'none', 'cursor': 'default' })
            .closest('.turma-card')
            .css({ 'cursor': 'default' })
            .off('click.turmasEsgotadas')
            .on('click.turmasEsgotadas', function(e) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            });
    }

    // Função para obter um novo nonce via AJAX quando o atual falhar
    function refreshNonce() {
        debug('Solicitando um novo nonce');
        return $.ajax({
            url: turmasPilates.ajaxurl,
            type: 'POST',
            data: {
                action: 'turmas_pilates_refresh_nonce'
            },
            success: function(response) {
                if (response.success && response.data) {
                    debug('Novo nonce recebido: ' + response.data.substr(0, 3) + '...');
                    turmasPilates.nonce = response.data;
                    $('#turmas-nonce').text(response.data);
                    return response.data;
                } else {
                    debug('Falha ao obter novo nonce');
                    return null;
                }
            },
            error: function() {
                debug('Erro ao solicitar novo nonce');
                return null;
            }
        });
    }

    // Função para formatar datas no formato compacto (dd/mm para intermediárias, dd/mm/aaaa para última)
    function formatarDatasCompactas(datas) {
        if (!datas || datas.length === 0) return '';
        
        var datasFormatadas = [];
        
        // Processar todas as datas exceto a última
        for (var i = 0; i < datas.length - 1; i++) {
            var dataPartes = datas[i].split('/');
            if (dataPartes.length === 3) {
                // Formato dd/mm apenas
                datasFormatadas.push(dataPartes[0] + '/' + dataPartes[1]);
            } else {
                // Se não estiver no formato esperado, usar como está
                datasFormatadas.push(datas[i]);
            }
        }
        
        // Adicionar a última data completa (com ano)
        if (datas.length > 0) {
            datasFormatadas.push(datas[datas.length - 1]);
        }
        
        // Juntar com " e " entre as datas
        return datasFormatadas.join(', ').replace(/, ([^,]*)$/, ' e $1');
    }

    // Função para carregar cidades baseado no estado selecionado
    function carregarCidades(estadoId, tentativa = 1, forceNewNonce = false) {
        debug('Carregando cidades para estadoId: ' + estadoId + ', Tentativa: ' + tentativa);
        
        // Se solicitado, obter novo nonce antes da requisição
        var requestPromise = Promise.resolve();
        if (forceNewNonce) {
            requestPromise = refreshNonce();
        }
        
        requestPromise.then(function() {
            $.ajax({
                url: turmasPilates.ajaxurl,
                type: 'POST',
                data: {
                    action: 'turmas_pilates_get_cidades',
                    estado_id: estadoId,
                    nonce: turmasPilates.nonce,
                    timestamp: new Date().getTime() // Impedir cache
                },
                success: function(response) {
                    debug('Resposta AJAX recebida');
                    if (response.success) {
                        var $cidadeSelect = $('#turmas-cidade');
                        $cidadeSelect.empty();
                        $cidadeSelect.append('<option value="">Selecione a Cidade</option>');
                        
                        $.each(response.data, function(id, nome) {
                            $cidadeSelect.append($('<option></option>').val(id).text(nome));
                        });
                        
                        debug('Cidades carregadas com sucesso: ' + Object.keys(response.data).length);
                    } else {
                        debug('Falha na resposta: ' + (response.data || 'Erro desconhecido'));
                        
                        // Verificar se falha é de nonce e tentar novamente com novo nonce
                        if (tentativa < maxRetries) {
                            var useNewNonce = (response.data && response.data.includes('segurança'));
                            setTimeout(function() {
                                carregarCidades(estadoId, tentativa + 1, useNewNonce);
                            }, retryDelay);
                        } else {
                            // Última tentativa com novo nonce
                            refreshNonce().then(function() {
                                carregarCidades(estadoId, tentativa + 1, false);
                            });
                        }
                    }
                },
                error: function(xhr, status, error) {
                    debug('Erro AJAX: ' + status + ' - ' + error);
                    
                    // Tentar novamente após o atraso
                    if (tentativa < maxRetries) {
                        setTimeout(function() {
                            // Na última tentativa, forçar novo nonce
                            var useNewNonce = (tentativa === maxRetries - 1);
                            carregarCidades(estadoId, tentativa + 1, useNewNonce);
                        }, retryDelay * tentativa); // Aumentar atraso exponencialmente
                    }
                }
            });
        });
    }

    // Cache do último estado selecionado
    var ultimoEstadoSelecionado = '';

    // Evento de mudança no select de estado
    $('#turmas-estado').on('change', function() {
        var estadoId = $(this).val();
        if (estadoId && estadoId !== ultimoEstadoSelecionado) {
            ultimoEstadoSelecionado = estadoId;
            $('#turmas-cidade').empty().append('<option value="">Carregando cidades...</option>');
            carregarCidades(estadoId);
        } else if (!estadoId) {
            $('#turmas-cidade').empty().append('<option value="">Selecione a Cidade</option>');
            ultimoEstadoSelecionado = '';
        }
    });

    // Evento de mudança no select de cidade
    $('#turmas-cidade').on('change', function() {
        var cidadeId = $(this).val();
        if (cidadeId) {
            $('#turmas-resultado').html('<p>Carregando turmas...</p>');
            
            $.ajax({
                url: turmasPilates.ajaxurl,
                type: 'POST',
                data: {
                    action: 'turmas_pilates_get_turmas',
                    cidade_id: cidadeId,
                    nonce: turmasPilates.nonce,
                    timestamp: new Date().getTime() // Impedir cache
                },
                success: function(response) {
                    if (response.success) {
                        var $container = $('#turmas-resultado');
                        $container.empty();
                        
                        var turmas_final_semana = response.data.final_semana || [];
                        var turmas_meio_semana = response.data.meio_semana || [];
                        var info_adicional = response.data.info_adicional || {};
                        
                        // Forçar cast para array em caso de objeto
                        if (turmas_final_semana && typeof turmas_final_semana === 'object' && !Array.isArray(turmas_final_semana)) {
                            var temp = [];
                            $.each(turmas_final_semana, function(key, value) {
                                temp.push(value);
                            });
                            turmas_final_semana = temp;
                        }
                        
                        if (turmas_meio_semana && typeof turmas_meio_semana === 'object' && !Array.isArray(turmas_meio_semana)) {
                            var temp = [];
                            $.each(turmas_meio_semana, function(key, value) {
                                temp.push(value);
                            });
                            turmas_meio_semana = temp;
                        }
                        
                        var temTurmas = (turmas_final_semana && turmas_final_semana.length > 0) || 
                                       (turmas_meio_semana && turmas_meio_semana.length > 0);
                        
                        if (temTurmas) {
                            // Ordenar turmas: destaque primeiro, depois ordem natural
                            function naturalSortTurmas(a, b) {
                                // Destaque primeiro
                                if (a.destaque && !b.destaque) return -1;
                                if (!a.destaque && b.destaque) return 1;
                                // Extrai número inicial, se houver, para comparação numérica
                                var numA = (a.numero + '').match(/^\d+/);
                                var numB = (b.numero + '').match(/^\d+/);
                                if (numA && numB) {
                                    var diff = parseInt(numA[0], 10) - parseInt(numB[0], 10);
                                    if (diff !== 0) return diff;
                                } else if (numA) {
                                    return -1;
                                } else if (numB) {
                                    return 1;
                                }
                                // Se números iguais ou não encontrados, comparar como string
                                return (a.numero + '').localeCompare(b.numero + '', undefined, { numeric: true, sensitivity: 'base' });
                            }
                            turmas_final_semana.sort(naturalSortTurmas);
                            turmas_meio_semana.sort(naturalSortTurmas);
                            
                            // Obter o nome da cidade e estado
                            var cidadeNome = $('#turmas-cidade option:selected').text();
                            var estadoNome = $('#turmas-estado option:selected').text();
                            
                            // Exibir turmas de final de semana
                            if (turmas_final_semana.length > 0) {
                                $container.append(`<h2 class="turmas-categoria">Próximas Turmas em ${cidadeNome} - ${estadoNome}</h2>`);
                                var $turmasFdsContainer = $('<div class="turmas-categoria-container"></div>');
                                
                                $.each(turmas_final_semana, function(index, turma) {

                                    // ========= ALTERAÇÃO PRECISA (1/2) =========
                                    // Normaliza e detecta esgotada de forma robusta
                                    var statusNorm = (turma.status || '').toString().trim().toLowerCase();
                                    var isEsgotada = /esgotad/.test(statusNorm); // pega "esgotada", "esgotadas", "vagas esgotada(s)" etc
                                    var isAbertas = (statusNorm === 'abertas');

                                    var statusClass = isAbertas ? 'status-abertas' : 
                                                    isEsgotada ? 'status-esgotadas' : 'status-restantes';
                                                
                                    var statusText = isAbertas ? 'Vagas Abertas' : 
                                                   isEsgotada ? 'Vagas Esgotadas' : 
                                                   (turma.qtd_vagas ? `Vagas Restantes: ${turma.qtd_vagas}` : 'Vagas Restantes');
                                    // ========= FIM ALTERAÇÃO =========
                                    
                                    // Constrói a exibição de quantidade de vagas restantes
                                    var qtdVagas = '';
                                    
                                    // Formatar datas dos módulos
                                    var moduloText = '';
                                    if (turma.modulo_data1 || turma.modulo_data2 || turma.modulo_data3) {
                                        var datas = [];
                                        if (turma.modulo_data1) datas.push(turma.modulo_data1);
                                        if (turma.modulo_data2) datas.push(turma.modulo_data2);
                                        if (turma.modulo_data3) datas.push(turma.modulo_data3);
                                        
                                        // Usar a nova função para formatar datas
                                        moduloText = formatarDatasCompactas(datas);
                                    }
                                    
                                    // ========= ALTERAÇÃO PRECISA =========
                                    // Link só aparece se NÃO esgotada
                                    var isDisponivel = !isEsgotada;
                                    // ========= FIM ALTERAÇÃO =========

                                    var html = `
                                      <div class="turma-card turma-fds">
                                        <h3>Turma ${turma.numero}</h3>
                                        <p><strong>Datas desta turma:</strong> ${moduloText}</p>
                                        ${qtdVagas}

                                        ${
                                          isDisponivel
                                            ? `
                                              <a href="https://cursopilatesclassico.com.br/#inscricao"
                                                title="Inscreva-se no Curso de Pilates Clássico Presencial"
                                                aria-label="Inscreva-se no Curso de Pilates Clássico Presencial (Turma ${turma.numero})"
                                              >
                                                <span class="status-badge ${statusClass}">${statusText}</span>
                                              </a>
                                            `
                                            : `
                                              <span class="status-badge ${statusClass}"
                                                aria-label="Turma ${turma.numero}: ${statusText}"
                                              >
                                                ${statusText}
                                              </span>
                                            `
                                        }
                                      </div>
                                    `;

                                    $turmasFdsContainer.append(html);
                                });
                                
                                // Adicionar informações de local e contato para turmas de final de semana
                                if (info_adicional.info_fds) {
                                    // Limpar e escapar o conteúdo
                                    var infoText = info_adicional.info_fds || '';
                                    // Substituir quebras de linha por <br>
                                    infoText = infoText.replace(/\n/g, '<br>');
                                    
                                    var infoHtml = `
                                        <div class="turma-location-contact">
                                            <h3>Informações sobre o curso</h3>
                                            <div>${infoText}</div>
                                        </div>
                                    `;
                                    $turmasFdsContainer.append(infoHtml);
                                }
                                
                                $container.append($turmasFdsContainer);

                                // FAILSAFE pós-render (fds)
                                neutralizarCliqueEsgotadas($turmasFdsContainer);
                            }
                            
                            // Exibir turmas durante a semana
                            if (turmas_meio_semana.length > 0) {
                                $container.append(`<h2 class="turmas-categoria">Turmas Durante a Semana em ${cidadeNome} - ${estadoNome}</h2>`);
                                var $turmasSemanaContainer = $('<div class="turmas-categoria-container"></div>');
                                
                                $.each(turmas_meio_semana, function(index, turma) {

                                    // ========= ALTERAÇÃO PRECISA (2/2) =========
                                    // Normaliza e detecta esgotada de forma robusta
                                    var statusNorm = (turma.status || '').toString().trim().toLowerCase();
                                    var isEsgotada = /esgotad/.test(statusNorm); // pega "esgotada", "esgotadas", "vagas esgotada(s)" etc
                                    var isAbertas = (statusNorm === 'abertas');

                                    var statusClass = isAbertas ? 'status-abertas' : 
                                                    isEsgotada ? 'status-esgotadas' : 'status-restantes';
                                                    
                                    var statusText = isAbertas ? 'Vagas Abertas' : 
                                                   isEsgotada ? 'Vagas Esgotadas' : 
                                                   (turma.qtd_vagas ? `Vagas Restantes: ${turma.qtd_vagas}` : 'Vagas Restantes');
                                    // ========= FIM ALTERAÇÃO =========
                                    
                                    // Constrói a exibição de quantidade de vagas restantes
                                    var qtdVagas = '';
                                    
                                    // Formatar datas dos módulos
                                    var moduloText = '';
                                    if (turma.modulo_data1 || turma.modulo_data2 || turma.modulo_data3) {
                                        var datas = [];
                                        if (turma.modulo_data1) datas.push(turma.modulo_data1);
                                        if (turma.modulo_data2) datas.push(turma.modulo_data2);
                                        if (turma.modulo_data3) datas.push(turma.modulo_data3);
                                        
                                        // Usar a nova função para formatar datas
                                        moduloText = formatarDatasCompactas(datas);
                                    }
                                
                                    // ========= ALTERAÇÃO PRECISA =========
                                    // Link só aparece se NÃO esgotada
                                    var isDisponivel = !isEsgotada;
                                    // ========= FIM ALTERAÇÃO =========

                                    var html = `
                                      <div class="turma-card turma-semana">
                                        <h3>Turma ${turma.numero}</h3>
                                        <p><strong>Datas desta turma:</strong> ${moduloText}</p>
                                        ${qtdVagas}

                                        ${
                                          isDisponivel
                                            ? `
                                              <a href="https://cursopilatesclassico.com.br/#inscricao"
                                                title="Inscreva-se no Curso de Pilates Clássico Presencial"
                                                aria-label="Inscreva-se no Curso de Pilates Clássico Presencial (Turma ${turma.numero})"
                                              >
                                                <span class="status-badge ${statusClass}">${statusText}</span>
                                              </a>
                                            `
                                            : `
                                              <span class="status-badge ${statusClass}"
                                                aria-label="Turma ${turma.numero}: ${statusText}"
                                              >
                                                ${statusText}
                                              </span>
                                            `
                                        }
                                      </div>
                                    `;

                                    $turmasSemanaContainer.append(html);
                                });
                                
                                // Adicionar informações de local e contato para turmas durante a semana
                                if (info_adicional.info_meio_semana) {
                                    // Limpar e escapar o conteúdo
                                    var infoText = info_adicional.info_meio_semana || '';
                                    // Substituir quebras de linha por <br>
                                    infoText = infoText.replace(/\n/g, '<br>');
                                    
                                    var infoHtml = `
                                        <div class="turma-location-contact">
                                            <h3>Informaçes sobre o curso</h3>
                                            <div>${infoText}</div>
                                        </div>
                                    `;
                                    $turmasSemanaContainer.append(infoHtml);
                                }
                                
                                $container.append($turmasSemanaContainer);

                                // FAILSAFE pós-render (semana)
                                neutralizarCliqueEsgotadas($turmasSemanaContainer);
                            }

                            // FAILSAFE geral no container (caso algum overlay externo envolva tudo)
                            neutralizarCliqueEsgotadas($container);

                        } else {
                            $container.html('<p>Nenhuma turma encontrada para esta cidade.</p>');
                        }
                    } else {
                        $('#turmas-resultado').html('<p>Erro ao carregar turmas. Por favor, tente novamente.</p>');
                        
                        // Se falha for de nonce, obter novo nonce
                        if (response.data && response.data.includes('segurana')) {
                            refreshNonce();
                        }
                    }
                },
                error: function() {
                    $('#turmas-resultado').html('<p>Erro de conexão. Por favor, tente novamente.</p>');
                }
            });
        } else {
            $('#turmas-resultado').empty();
        }
    });
});
