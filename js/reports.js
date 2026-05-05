const Reports = {
    currentTab: 'tab-macro',
    _charts: {},

    init() {
        console.log("Reports: Inicializando...");
        if (!Auth.getCurrentUser()) return;
        this.populateFilters();
        this.setDefaultDates();
        this.renderActiveTab();
    },

    populateFilters() {
        const u = Auth.getCurrentUser();
        const selProd = document.getElementById('filtro-produto');
        const selUsr = document.getElementById('filtro-usuario');
        const selSetor = document.getElementById('filtro-setor');
        if(!selProd || !selUsr || !selSetor) return;

        selProd.innerHTML = '<option value="Todos">Todos Produtos</option>';
        selUsr.innerHTML = '<option value="Todos">Todos Usuários</option>';

        Stock.getProducts().forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id_produto;
            opt.textContent = p.nome_bebida;
            selProd.appendChild(opt);
        });

        Users.getAll().forEach(us => {
            const opt = document.createElement('option');
            opt.value = us.id_usuario;
            opt.textContent = us.nome;
            selUsr.appendChild(opt);
        });

        if (u && u.setor !== 'Admin') {
            selSetor.innerHTML = '';
            const opt = document.createElement('option');
            opt.value = u.setor;
            opt.textContent = u.setor;
            selSetor.appendChild(opt);
            selSetor.disabled = true;
        } else {
            selSetor.innerHTML = '<option value="Todos">Todos</option><option value="Bar">Bar</option><option value="Delivery">Delivery</option>';
            selSetor.disabled = false;
        }
    },

    setDefaultDates() {
        const end = new Date();
        const start = new Date();
        const iniInput = document.getElementById('filtro-data-ini');
        const fimInput = document.getElementById('filtro-data-fim');
        if(iniInput) iniInput.value = start.toISOString().split('T')[0];
        if(fimInput) fimInput.value = end.toISOString().split('T')[0];
    },

    getFilters() {
        return {
            inicio: document.getElementById('filtro-data-ini')?.value || '',
            fim: document.getElementById('filtro-data-fim')?.value || '',
            setor: document.getElementById('filtro-setor')?.value || 'Todos',
            produto: document.getElementById('filtro-produto')?.value || 'Todos',
            usuario: document.getElementById('filtro-usuario')?.value || 'Todos'
        };
    },

    applyFilters(data, dateField, sectorField = null, userField = null, productField = null) {
        const f = this.getFilters();
        let filtered = data || [];

        if (f.inicio && dateField) {
            const dIni = new Date(f.inicio + 'T00:00:00');
            filtered = filtered.filter(item => new Date(item[dateField]) >= dIni);
        }
        if (f.fim && dateField) {
            const dFim = new Date(f.fim + 'T23:59:59');
            filtered = filtered.filter(item => new Date(item[dateField]) <= dFim);
        }
        if (f.setor !== 'Todos' && sectorField) filtered = filtered.filter(item => item[sectorField] === f.setor);
        if (f.usuario !== 'Todos' && userField) filtered = filtered.filter(item => item[userField] === f.usuario);
        if (f.produto !== 'Todos' && productField) filtered = filtered.filter(item => item[productField] === f.produto);
        return filtered;
    },

    switchTab(tabId) {
        this.currentTab = tabId;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.target === tabId));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === tabId));
        this.renderActiveTab();
    },

    renderActiveTab() {
        const tabs = {
            'tab-macro': () => this.renderMacro(),
            'tab-estoque': () => this.renderEstoque(),
            'tab-saidas': () => this.renderSaidas(),
            'tab-perdas': () => this.renderPerdas(),
            'tab-contagens': () => this.renderContagens(),
            'tab-pedidos': () => this.renderPedidos(),
            'tab-comparativo': () => this.renderComparativoSetup(),
            'tab-auditoria-diaria': () => this.renderAuditoriaDiaria()
        };
        if(tabs[this.currentTab]) tabs[this.currentTab]();
    },

    createStatCard(iconClass, bgClass, label, value) {
        const card = document.createElement('div');
        card.className = 'stat-card';
        card.innerHTML = `
            <div class="stat-icon ${bgClass}"><i class="${iconClass}"></i></div>
            <div class="stat-info">
                <span class="stat-label">${label}</span>
                <span class="stat-value"></span>
            </div>
        `;
        card.querySelector('.stat-value').textContent = value;
        return card;
    },

    renderMacro() {
        const movs = this.applyFilters(Movements.getMovements(), 'data_movimentacao', 'local_origem', 'usuario_responsavel', 'id_produto');
        const prods = Stock.getProducts();
        const f = this.getFilters();
        
        // --- KPIs ---
        let totalVal = 0;
        prods.forEach(p => {
            let qtd = (f.setor === 'Todos')
                ? (Stock.getProductStock(p.id_produto, 'Bar') + Stock.getProductStock(p.id_produto, 'Delivery'))
                : Stock.getProductStock(p.id_produto, f.setor);
            totalVal += (qtd * (parseFloat(p.custo_unitario) || 0));
        });

        const qSaidas = movs.filter(m => m.tipo_movimentacao === 'Saída').reduce((a, b) => a + (b.quantidade || 0), 0);
        const qPerdas = movs.filter(m => m.tipo_movimentacao.includes('Perda') || m.tipo_movimentacao === 'Ajuste_Contagem').reduce((a, b) => a + Math.abs(b.quantidade || 0), 0);
        const qCtgs = this.applyFilters(Store.getTable('contagem_estoque'), 'data_inicio', 'local', 'operador').filter(c => c.status !== 'Cancelada').length;

        const container = document.getElementById('macro-cards');
        if (!container) return;
        container.innerHTML = '';
        container.appendChild(this.createStatCard('fa-solid fa-boxes-stacked', 'bg-success', 'Valor Patrimonial', Utils.formatCurrency(totalVal)));
        container.appendChild(this.createStatCard('fa-solid fa-arrow-up-right-dots', 'bg-primary', 'Total Saídas', qSaidas + ' un'));
        container.appendChild(this.createStatCard('fa-solid fa-triangle-exclamation', 'bg-warning', 'Perdas/Ajustes', qPerdas + ' un'));
        container.appendChild(this.createStatCard('fa-solid fa-clipboard-check', 'bg-dark text-white', 'Inventários', qCtgs));

        // --- GRÁFICO 1: Donut por Categoria ---
        this._renderChartCategorias(prods, f);

        // --- GRÁFICO 2: Bar Top 5 Consumo ---
        this._renderChartConsumo(movs, prods);

        // --- RANKINGS ---
        this._renderRankings(movs, prods);
    },

    _renderChartCategorias(prods, f) {
        const ctx = document.getElementById('chart-categorias');
        if (!ctx) return;
        if (this._charts.categorias) { this._charts.categorias.destroy(); }

        const map = {};
        prods.forEach(p => {
            const cat = p.categoria || 'Outros';
            const qtd = (f.setor === 'Todos')
                ? (Stock.getProductStock(p.id_produto, 'Bar') + Stock.getProductStock(p.id_produto, 'Delivery'))
                : Stock.getProductStock(p.id_produto, f.setor);
            const val = qtd * (parseFloat(p.custo_unitario) || 0);
            if (val > 0) map[cat] = (map[cat] || 0) + val;
        });

        const labels = Object.keys(map);
        const data = labels.map(l => parseFloat(map[l].toFixed(2)));
        const palette = ['#1a4731','#2d7a52','#4caf7d','#80c9a4','#b2dfcc','#e8f5e9','#66bb6a','#43a047','#2e7d32','#1b5e20'];

        this._charts.categorias = new Chart(ctx, {
            type: 'doughnut',
            data: { labels, datasets: [{ data, backgroundColor: palette.slice(0, labels.length), borderWidth: 0 }] },
            options: {
                responsive: true,
                cutout: '65%',
                plugins: {
                    legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } },
                    tooltip: { callbacks: { label: ctx => ` R$ ${ctx.parsed.toFixed(2)}` } }
                }
            }
        });
    },

    _renderChartConsumo(movs, prods) {
        const ctx = document.getElementById('chart-consumo');
        if (!ctx) return;
        if (this._charts.consumo) { this._charts.consumo.destroy(); }

        const map = {};
        movs.filter(m => m.tipo_movimentacao === 'Saída').forEach(m => {
            map[m.id_produto] = (map[m.id_produto] || 0) + (m.quantidade || 0);
        });

        const top5 = Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id, qtd]) => {
                const p = prods.find(x => x.id_produto === id);
                return { nome: p ? p.nome_bebida.substring(0, 14) : '?', qtd };
            });

        if (!top5.length) { ctx.parentElement.style.display = 'none'; return; }
        ctx.parentElement.style.display = '';

        this._charts.consumo = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: top5.map(x => x.nome),
                datasets: [{ label: 'Unidades', data: top5.map(x => x.qtd), backgroundColor: '#2d7a52', borderRadius: 6 }]
            },
            options: {
                responsive: true,
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                    y: { grid: { display: false }, ticks: { font: { size: 10 } } }
                }
            }
        });
    },

    _renderRankings(movs, prods) {
        const rankings = document.getElementById('macro-rankings');
        if (!rankings) return;
        rankings.innerHTML = '';

        // Top Saídas por produto
        const mapSaidas = {};
        movs.filter(m => m.tipo_movimentacao === 'Saída').forEach(m => {
            mapSaidas[m.id_produto] = (mapSaidas[m.id_produto] || 0) + (m.quantidade || 0);
        });
        const topSaidas = Object.entries(mapSaidas).sort((a, b) => b[1] - a[1]).slice(0, 5);

        // Top Perdas por produto
        const mapPerdas = {};
        movs.filter(m => m.tipo_movimentacao.includes('Perda') || m.tipo_movimentacao === 'Ajuste_Contagem').forEach(m => {
            mapPerdas[m.id_produto] = (mapPerdas[m.id_produto] || 0) + Math.abs(m.quantidade || 0);
        });
        const topPerdas = Object.entries(mapPerdas).sort((a, b) => b[1] - a[1]).slice(0, 3);

        const renderRankList = (title, icon, color, items, unit = 'un') => {
            if (!items.length) return;
            const maxVal = items[0][1] || 1;
            const block = document.createElement('div');
            block.className = 'card-form';
            block.style.cssText = 'padding:1rem; margin-bottom:0.5rem;';
            block.innerHTML = `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;"><i class="${icon}" style="color:${color}"></i><span style="font-weight:700;font-size:0.9rem;">${title}</span></div>`;
            items.forEach(([id, val], i) => {
                const p = prods.find(x => x.id_produto === id);
                const nome = p ? p.nome_bebida : '?';
                const pct = Math.round((val / maxVal) * 100);
                const row = document.createElement('div');
                row.style.cssText = 'margin-bottom:0.6rem;';
                row.innerHTML = `
                    <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:3px;">
                        <span style="font-weight:600;"><span style="color:${color};margin-right:6px;">#${i+1}</span>${nome}</span>
                        <span style="font-weight:700;color:${color};">${val} ${unit}</span>
                    </div>
                    <div style="height:5px;background:var(--border);border-radius:9px;overflow:hidden;">
                        <div style="height:100%;width:${pct}%;background:${color};border-radius:9px;transition:width 0.4s;"></div>
                    </div>`;
                block.appendChild(row);
            });
            rankings.appendChild(block);
        };

        renderRankList('Top Saídas / Consumo', 'fa-solid fa-arrow-trend-up', 'var(--primary)', topSaidas);
        renderRankList('Top Perdas / Ajustes', 'fa-solid fa-triangle-exclamation', 'var(--danger)', topPerdas);

        if (!topSaidas.length && !topPerdas.length) {
            rankings.innerHTML = '<p style="padding:1rem;color:var(--text-3);text-align:center;">Nenhuma movimentação no período selecionado.</p>';
        }
    },

    renderEstoque() {
        const f = this.getFilters();
        const list = document.getElementById('rel-estoque-list');
        if(!list) return;
        list.innerHTML = '';
        
        const movs = this.applyFilters(Movements.getMovements(), 'data_movimentacao', 'local_origem', 'usuario_responsavel', 'id_produto');
        const idsComMovimento = new Set(movs.map(m => m.id_produto));
        
        let somaVal = 0;
        const frag = document.createDocumentFragment();

        Stock.getProducts().forEach(p => {
             if (!idsComMovimento.has(p.id_produto) && f.produto === 'Todos') return;
             if(f.produto !== 'Todos' && f.produto !== p.id_produto) return;
             
             let qtd = (f.setor === 'Todos') 
                ? (Stock.getProductStock(p.id_produto, 'Bar') + Stock.getProductStock(p.id_produto, 'Delivery'))
                : Stock.getProductStock(p.id_produto, f.setor);
             
             somaVal += (qtd * (parseFloat(p.custo_unitario)||0));

             const li = document.createElement('li');
             li.className = 'list-item';
             li.innerHTML = `
                <div class="item-details">
                    <span class="item-name"></span>
                    <span class="item-sub"></span>
                </div>
                <span class="item-amount text-primary" style="font-size:1.1rem"></span>
             `;
             li.querySelector('.item-name').textContent = p.nome_bebida;
             li.querySelector('.item-sub').textContent = `R$ ${parseFloat(p.custo_unitario||0).toFixed(2)} / ${p.unidade_medida}`;
             li.querySelector('.item-amount').textContent = qtd;
             frag.appendChild(li);
        });

        if (frag.children.length === 0) {
            list.innerHTML = '<li class="p-4 text-center text-muted">Nenhum produto com movimentação neste período.</li>';
        } else {
            list.appendChild(frag);
        }

        const el = document.getElementById('estoque-total-val');
        if(el) el.textContent = Utils.formatCurrency(somaVal);
    },

    renderSaidas() {
        const list = document.getElementById('rel-saidas-list');
        if(!list) return;
        
        const movs = this.applyFilters(Movements.getMovements(), 'data_movimentacao', 'local_origem', 'usuario_responsavel', 'id_produto')
                    .filter(m => m.tipo_movimentacao === 'Saída' || (m.tipo_movimentacao === 'Ajuste_Contagem' && m.quantidade < 0));

        list.innerHTML = '';
        if(!movs.length) {
            list.innerHTML = '<li class="p-4 text-center text-muted">Nenhuma saída no período.</li>';
        } else {
            const frag = document.createDocumentFragment();
            let soma = 0;
            movs.sort((a,b) => new Date(b.data_movimentacao) - new Date(a.data_movimentacao)).forEach(m => {
                const p = Stock.getProduct(m.id_produto);
                const qtdAbs = Math.abs(m.quantidade || 0);
                soma += qtdAbs;
                
                const li = document.createElement('li');
                li.className = 'list-item';
                li.innerHTML = `
                    <div class="item-details">
                        <span class="item-name"></span>
                        <span class="item-sub"></span>
                    </div>
                    <span class="item-amount text-danger"></span>
                `;
                li.querySelector('.item-name').textContent = p ? p.nome_bebida : 'Produto ?';
                if(m.tipo_movimentacao !== 'Saída') {
                    const b = document.createElement('span');
                    b.className = 'badge bg-secondary';
                    b.style.fontSize = '0.6rem';
                    b.style.marginLeft = '5px';
                    b.textContent = 'Conferência';
                    li.querySelector('.item-name').appendChild(b);
                }
                li.querySelector('.item-sub').textContent = `${m.local_origem || 'Setor ?'} em ${Utils.formatDate(m.data_movimentacao)}`;
                li.querySelector('.item-amount').textContent = qtdAbs;
                frag.appendChild(li);
            });
            list.appendChild(frag);
            const el = document.getElementById('saidas-total-val');
            if(el) el.textContent = soma + " itens";
        }
    },

    renderPerdas() {
        const list = document.getElementById('rel-perdas-list');
        if(!list) return;
        const movs = this.applyFilters(Movements.getMovements(), 'data_movimentacao', 'local_origem', 'usuario_responsavel', 'id_produto')
                    .filter(m => m.tipo_movimentacao.includes('Perda'));

        list.innerHTML = '';
        if(!movs.length) {
            list.innerHTML = '<li class="p-4 text-center text-muted">Nenhuma perda no período.</li>';
        } else {
            const frag = document.createDocumentFragment();
            let somaVal = 0;
            movs.forEach(m => {
                const p = Stock.getProduct(m.id_produto);
                const val = (m.quantidade||0) * parseFloat(p?p.custo_unitario:0);
                somaVal += Math.abs(val);

                const li = document.createElement('li');
                li.className = 'list-item';
                li.innerHTML = `
                    <div class="item-details">
                        <span class="item-name"></span>
                        <span class="item-sub"></span>
                    </div>
                    <span class="item-amount text-danger"></span>
                `;
                li.querySelector('.item-name').textContent = p ? p.nome_bebida : '?';
                li.querySelector('.item-sub').textContent = `${m.local_origem} | Obs: ${m.observacao||'-'}`;
                li.querySelector('.item-amount').textContent = Math.abs(m.quantidade||0);
                frag.appendChild(li);
            });
            list.appendChild(frag);
            const el = document.getElementById('perdas-total-val');
            if(el) el.textContent = Utils.formatCurrency(somaVal);
        }
    },

    renderContagens() {
        const list = document.getElementById('rel-contagens-list');
        if(!list) return;
        const ctgs = this.applyFilters(Store.getTable('contagem_estoque'), 'data_inicio', 'local', 'operador');
        list.innerHTML = '';
        if(!ctgs.length) {
            list.innerHTML = '<li class="p-4 text-center text-muted">Nenhuma contagem no período.</li>';
        } else {
            const frag = document.createDocumentFragment();
            ctgs.sort((a,b) => new Date(b.data_inicio) - new Date(a.data_inicio)).forEach(c => {
                const li = document.createElement('li');
                li.className = 'list-item';
                li.innerHTML = `
                    <div class="item-details">
                        <span class="item-name"></span>
                        <span class="item-sub"></span>
                    </div>
                    <span class="badge"></span>
                `;
                li.querySelector('.item-name').textContent = `#${c.id_contagem.substring(0,6).toUpperCase()} - ${c.local}`;
                li.querySelector('.item-sub').textContent = Utils.formatDate(c.data_inicio);
                const b = li.querySelector('.badge');
                b.textContent = c.status;
                b.classList.add(c.status === 'Aberta' ? 'bg-warning' : 'bg-success');
                frag.appendChild(li);
            });
            list.appendChild(frag);
        }
    },

    renderPedidos() {
        const list = document.getElementById('rel-pedidos-list');
        if(!list) return;
        const filtered = this.applyFilters(Store.getTable('pedidos_compra'), 'data_pedido', 'setor_solicitante', 'usuario_solicitante', 'id_produto');
        list.innerHTML = '';
        if(!filtered.length) {
            list.innerHTML = '<li class="p-4 text-center text-muted">Nenhuma solicitação no período.</li>';
            return;
        }

        const grupos = {};
        filtered.forEach(p => { 
            const key = p.id_grupo || p.id_pedido; 
            if(!grupos[key]) grupos[key] = []; 
            grupos[key].push(p); 
        });

        const sortedKeys = Object.keys(grupos).sort((a,b) => new Date(grupos[b][0].data_pedido) - new Date(grupos[a][0].data_pedido));
        
        sortedKeys.forEach(key => {
            const itens = grupos[key]; 
            const p = itens[0];
            const isPendente = p.status === 'Pendente';

            const li = document.createElement('li');
            li.className = 'list-item';
            li.style.cssText = 'flex-direction:column; align-items:stretch; padding:1.25rem; gap:0.5rem;';
            
            li.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <div>
                        <div class="ord-id" style="font-size:0.7rem; color:var(--text-3); font-weight:700;"></div>
                        <div class="ord-setor" style="font-weight:800; color:var(--primary);"></div>
                    </div>
                    <span class="badge ord-status"></span>
                </div>
                <div class="ord-items-box" style="background:var(--surface-2); padding:0.5rem; border-radius:8px;"></div>
                <div class="ord-date" style="font-size:0.7rem; color:var(--text-3); text-align:right;"></div>
                <div class="ord-actions" style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:0.85rem;"></div>
            `;

            li.querySelector('.ord-id').textContent = `#${key.substring(0,5).toUpperCase()}`;
            li.querySelector('.ord-setor').textContent = p.setor_solicitante;
            const b = li.querySelector('.ord-status');
            b.textContent = p.status;
            b.classList.add(isPendente ? 'bg-warning' : 'bg-success');
            li.querySelector('.ord-date').textContent = Utils.formatDate(p.data_pedido);

            const itemsBox = li.querySelector('.ord-items-box');
            itens.forEach(it => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex; justify-content:space-between; font-size:0.9rem; padding: 4px 0; border-bottom: 1px dashed var(--border-light);';
                row.innerHTML = '<span><b></b> - <span class="p-name"></span></span>';
                row.querySelector('b').textContent = it.quantidade;
                row.querySelector('.p-name').textContent = it.nome_produto;
                itemsBox.appendChild(row);
            });

            const actions = li.querySelector('.ord-actions');
            if (isPendente) {
                const btnOk = document.createElement('button');
                btnOk.className = 'btn btn-primary btn-sm';
                btnOk.innerHTML = '<i class="fa-solid fa-check-double"></i> Pagar/Atender';
                btnOk.onclick = () => Orders.updateStatus(key, 'Atendido', true);
                
                const btnNo = document.createElement('button');
                btnNo.className = 'btn btn-danger btn-sm';
                btnNo.innerHTML = '<i class="fa-solid fa-ban"></i> Recusar';
                btnNo.onclick = () => Orders.updateStatus(key, 'Cancelado', true);
                
                actions.appendChild(btnOk);
                actions.appendChild(btnNo);
            } else {
                actions.remove();
            }

            list.appendChild(li);
        });
    },

    renderComparativoSetup() {
        const ctgs = (Store.getTable('contagem_estoque') || []).filter(c => c.status === 'Fechada').sort((a,b) => new Date(b.data_inicio) - new Date(a.data_inicio));
        const ini = document.getElementById('comp-ini'), fim = document.getElementById('comp-fim');
        if(!ini || !fim) return;
        ini.innerHTML = '<option value="">Selecione...</option>';
        fim.innerHTML = '<option value="">Selecione...</option>';
        ctgs.forEach(c => { 
            const opt = document.createElement('option');
            opt.value = c.id_contagem;
            opt.textContent = `[${c.local}] ${Utils.formatDate(c.data_inicio)}`;
            ini.appendChild(opt.cloneNode(true));
            fim.appendChild(opt);
        });
    },

    renderComparativoCalc() {
        const idIni = document.getElementById('comp-ini')?.value;
        const idFim = document.getElementById('comp-fim')?.value;
        if(!idIni || !idFim) return window.app && app.showToast('Selecione duas contagens fechadas', 'error');

        const tableContas = Store.getTable('contagem_estoque');
        const c1 = tableContas.find(c => c.id_contagem === idIni);
        const c2 = tableContas.find(c => c.id_contagem === idFim);
        
        if(c1.local !== c2.local) {
            return window.app && app.showToast('As contagens devem ser do mesmo setor!', 'error');
        }

        const dataIni = new Date(Math.min(new Date(c1.data_inicio), new Date(c2.data_inicio)));
        const dataFim = new Date(Math.max(new Date(c1.data_inicio), new Date(c2.data_inicio)));
        
        const contagemAnteriorId = new Date(c1.data_inicio) < new Date(c2.data_inicio) ? c1.id_contagem : c2.id_contagem;
        const contagemAtualId = new Date(c1.data_inicio) > new Date(c2.data_inicio) ? c1.id_contagem : c2.id_contagem;

        const tableItens = Store.getTable('itens_contagem');
        const iAnteriores = tableItens.filter(i => i.id_contagem === contagemAnteriorId);
        const iAtuais = tableItens.filter(i => i.id_contagem === contagemAtualId);

        // Movimentações ocorridas *entre* as contagens
        const movs = Store.getTable('movimentacoes_estoque').filter(m => {
            if(m.local_origem !== c1.local && m.local_destino !== c1.local) return false;
            const d = new Date(m.data_movimentacao);
            return d > dataIni && d < dataFim;
        });

        const mapProds = {};
        Stock.getProducts().forEach(p => {
            mapProds[p.id_produto] = { nome: p.nome_bebida, cI: 0, cF: 0, ent: 0, sai: 0, dif: 0, cmv: 0, custo: parseFloat(p.custo_unitario)||0 };
        });

        iAnteriores.forEach(i => { if(mapProds[i.id_produto]) mapProds[i.id_produto].cI = i.quantidade_contada; });
        iAtuais.forEach(i => { if(mapProds[i.id_produto]) mapProds[i.id_produto].cF = i.quantidade_contada; });

        movs.forEach(m => {
            if(!mapProds[m.id_produto]) return;
            const pm = mapProds[m.id_produto];
            let q = parseFloat(m.quantidade) || 0;
            
            // Entrada real no setor (foi compra, ou foi transferencia de outro setor)
            if((m.tipo_movimentacao === 'Entrada' || m.tipo_movimentacao === 'Carga Inicial') && m.local_destino === c1.local) {
                pm.ent += q;
            } else if (m.tipo_movimentacao === 'Transferencia' && m.local_destino === c1.local) {
                pm.ent += q;
            } else if (m.tipo_movimentacao === 'Saída' && m.local_origem === c1.local) {
                pm.sai += q;
            } else if (m.tipo_movimentacao.includes('Perda') && m.local_origem === c1.local) {
                pm.sai += q;
            } else if (m.tipo_movimentacao === 'Transferencia' && m.local_origem === c1.local) {
                pm.sai += q;
            }
        });

        const list = document.getElementById('comp-results-list');
        if(!list) return;
        list.innerHTML = '';
        let somaCmv = 0;
        
        const frag = document.createDocumentFragment();
        Object.keys(mapProds).forEach(id => {
            const p = mapProds[id];
            if(p.cI === 0 && p.cF === 0 && p.ent === 0 && p.sai === 0) return;
            
            const estoqueIdeal = p.cI + p.ent - p.sai;
            const consumoReal = (p.cI + p.ent) - p.cF;
            const diferencaPerdida = p.cF - estoqueIdeal; // Se negativo, perdeu. Se positivo, sobrou.
            
            const cmv = consumoReal * p.custo;
            somaCmv += cmv;

            const li = document.createElement('li');
            li.className = 'list-item';
            li.style.cssText = 'flex-direction:column; align-items:flex-start; padding:10px; background:var(--surface-2); margin-bottom:10px; border-radius:8px;';
            li.innerHTML = `
                <div style="font-weight:700; color:var(--text); margin-bottom:5px;">${p.nome}</div>
                <div style="display:grid; grid-template-columns:1fr 1fr; width:100%; gap:5px; font-size:0.8rem; color:var(--text-2);">
                    <div>Inicial: <b>${p.cI}</b></div>
                    <div>Entradas: <b>${p.ent}</b></div>
                    <div>Final: <b>${p.cF}</b></div>
                    <div>Consumo: <b>${consumoReal}</b></div>
                </div>
            `;
            frag.appendChild(li);
        });

        if(frag.children.length > 0) list.appendChild(frag);
        else list.innerHTML = '<li class="p-4 text-center text-muted">Sem dados para comparar.</li>';
        
        const tCmv = document.getElementById('comp-cmv-total');
        if(tCmv) tCmv.textContent = Utils.formatCurrency(somaCmv);
    },

    renderAuditoriaDiaria() {
        const list = document.getElementById('rel-auditoria-diaria-list'); 
        if(!list) return;
        const movs = this.applyFilters(Movements.getMovements(), 'data_movimentacao', 'local_origem', 'usuario_responsavel', 'id_produto');
        list.innerHTML = '';
        if(!movs.length) {
            list.innerHTML = '<li class="p-4 text-center text-muted">Nada para mostrar no período.</li>';
        } else {
            const tipoColors = {
                'Entrada': 'var(--green-900)', 'Carga Inicial': 'var(--primary)',
                'Saída': 'var(--danger)', 'Ajuste Perda': 'var(--danger)',
                'Transferencia': '#f59e0b', 'Ajuste_Contagem': '#8b5cf6'
            };
            const frag = document.createDocumentFragment();
            movs.slice(0, 60).forEach(m => {
                const prod = Stock.getProduct(m.id_produto);
                const user = Users.getAll().find(u => u.id_usuario === m.usuario_responsavel);
                const cor = tipoColors[m.tipo_movimentacao] || 'var(--text-3)';
                const setor = m.local_origem || m.local_destino || '-';
                const sinal = ['Entrada','Carga Inicial','Transferencia'].includes(m.tipo_movimentacao) ? '+' : '-';
                const li = document.createElement('li');
                li.className = 'list-item';
                li.style.cssText = 'padding:0.75rem 1rem; gap:0.75rem;';
                li.innerHTML = `
                    <div style="display:flex;flex-direction:column;flex:1;gap:2px;">
                        <span style="font-weight:700;font-size:0.88rem;">${prod ? prod.nome_bebida : '?'}</span>
                        <span style="font-size:0.72rem;color:var(--text-3);">${Utils.formatDate(m.data_movimentacao)} &bull; ${setor} &bull; ${user ? user.nome : '?'}</span>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-weight:800;font-size:1rem;color:${cor};">${sinal}${Math.abs(m.quantidade)}</span>
                        <div style="font-size:0.65rem;font-weight:700;color:${cor};background:${cor}18;padding:1px 6px;border-radius:999px;margin-top:2px;">${m.tipo_movimentacao.replace('_',' ')}</div>
                    </div>`;
                frag.appendChild(li);
            });
            list.appendChild(frag);
        }
    },

    generateComprehensiveReport() { window.print(); }
};
window.Reports = Reports;
