const Dashboard = {
    renderHome() {
        const user = Auth.getCurrentUser();
        if (!user) return;
        
        const prods = Stock.getProducts();
        let qBar = 0, qDelivery = 0, vTotal = 0;
        let alertas = [];

        prods.forEach(p => {
            const sBar = Stock.getProductStock(p.id_produto, 'Bar');
            const sDel = Stock.getProductStock(p.id_produto, 'Delivery');
            qBar += sBar;
            qDelivery += sDel;
            vTotal += ((sBar + sDel) * (parseFloat(p.custo_unitario) || 0));

            let qtdContexto = (user.setor === 'Bar') ? sBar : (user.setor === 'Delivery' ? sDel : (sBar + sDel));
            const minimoAlerta = parseFloat(p.estoque_minimo);
            
            if (!isNaN(minimoAlerta) && qtdContexto <= minimoAlerta) {
                alertas.push({ nome: p.nome_bebida, qtd: qtdContexto, unidade: p.unidade_medida, imagem: p.imagem });
            }
        });

        const barEl = document.getElementById('dash-total-bar');
        const deliveryEl = document.getElementById('dash-total-delivery');
        const valueEl = document.getElementById('dash-total-value');
        if(barEl) barEl.textContent = `${qBar} itens`;
        if(deliveryEl) deliveryEl.textContent = `${qDelivery} itens`;
        if(valueEl) valueEl.textContent = Utils.formatCurrency(vTotal);

        const cardBar = document.getElementById('dash-card-bar'), cardDel = document.getElementById('dash-card-delivery');
        if (user.setor === 'Bar') { cardBar?.classList.remove('hidden'); cardDel?.classList.add('hidden'); }
        else if (user.setor === 'Delivery') { cardBar?.classList.add('hidden'); cardDel?.classList.remove('hidden'); }
        else { cardBar?.classList.remove('hidden'); cardDel?.classList.remove('hidden'); }

        const mainBadge = document.getElementById('main-notif-badge');
        if (mainBadge) {
            mainBadge.classList.toggle('hidden', alertas.length === 0);
            mainBadge.classList.toggle('active', alertas.length > 0);
        }

        const listAlertas = document.getElementById('dash-alerts-list');
        if(!listAlertas) return;
        listAlertas.innerHTML = '';

        if (alertas.length === 0) {
            const li = document.createElement('li');
            li.className = 'list-item';
            li.innerHTML = '<span class="text-muted">Estoque regular.</span>';
            listAlertas.appendChild(li);
        } else {
            const frag = document.createDocumentFragment();
            alertas.forEach(a => {
                const li = document.createElement('li');
                li.className = 'list-item';
                li.style.cssText = 'padding: 0.75rem 1rem; display:flex; align-items:center;';
                
                if (a.imagem) {
                    const box = document.createElement('div');
                    box.className = 'product-img-box';
                    box.style.cssText = 'width:35px; height:35px; margin-right:10px; border-radius:8px;';
                    const img = document.createElement('img');
                    img.src = a.imagem;
                    box.appendChild(img);
                    li.appendChild(box);
                } else {
                    const icon = document.createElement('i');
                    icon.className = 'fa-solid fa-circle-exclamation text-warning';
                    icon.style.marginRight = '10px';
                    li.appendChild(icon);
                }

                const det = document.createElement('div');
                det.className = 'item-details'; det.style.flex = '1';
                const n = document.createElement('span'); n.className = 'item-name'; n.textContent = a.nome;
                const s = document.createElement('span'); s.className = 'item-sub text-danger'; s.textContent = 'Abaixo do mínimo';
                det.appendChild(n); det.appendChild(s); li.appendChild(det);

                const q = document.createElement('span'); q.className = 'item-amount critic'; q.textContent = `${a.qtd} ${a.unidade}`;
                li.appendChild(q);
                frag.appendChild(li);
            });
            listAlertas.appendChild(frag);
        }
    },

    renderEstoqueAtual() {
        const user = Auth.getCurrentUser();
        if(!user) return;
        const sector = (user.setor === 'Admin') ? null : user.setor; 
        
        let prods = Stock.getProducts();
        const searchInput = document.getElementById('search-view-estoque');
        const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
        if (searchVal) {
            prods = prods.filter(p => p.nome_bebida.toLowerCase().includes(searchVal) || (p.categoria && p.categoria.toLowerCase().includes(searchVal)));
        }

        const list = document.getElementById('lista-view-estoque');
        if(!list) return;
        list.innerHTML = '';
        
        if(prods.length === 0) {
            list.innerHTML = '<li class="list-item text-muted" style="padding:1rem;">Nenhum produto encontrado.</li>';
            return;
        }

        const activeSector = sector || (app.currentEstoqueSector || 'Bar');
        const frag = document.createDocumentFragment();

        prods.forEach(p => {
            const qtd = Stock.getProductStock(p.id_produto, activeSector);
            const isDefaultHere = (p.setor_padrao === 'Todos' || p.setor_padrao === activeSector);
            if (!isDefaultHere && qtd <= 0) return;

            const li = document.createElement('li');
            li.className = 'list-item clickable';
            li.style.cssText = 'flex-direction:column; items:stretch; padding:0;';
            li.onclick = () => this.toggleProductDetails(p.id_produto, li, activeSector);

            li.innerHTML = `
                <div class="summary" style="display:flex; align-items:center; padding: 0.85rem 1rem; width:100%;">
                    <div class="product-img-box" style="width:45px; height:45px; margin-right:12px; border-radius:10px; flex-shrink:0;"></div>
                    <div class="item-details" style="flex:1;">
                        <span class="item-name" style="font-size:1rem;"></span>
                        <span class="item-sub" style="font-size:0.75rem;"></span>
                        <span class="item-global" style="font-size:0.65rem; color:var(--text-3); display:block; margin-top:2px;"></span>
                    </div>
                    <div class="right-box" style="text-align:right;">
                        <span class="item-amount" style="font-size:1.2rem; font-weight:800;"></span>
                        <div class="item-unit" style="font-size:0.7rem;"></div>
                    </div>
                </div>
                <div class="stock-details-container" id="details-${p.id_produto}"></div>
            `;

            const imgBox = li.querySelector('.product-img-box');
            if (p.imagem) {
                const img = document.createElement('img'); img.src = p.imagem; imgBox.appendChild(img);
            } else {
                const icon = document.createElement('i'); icon.className = 'fa-solid fa-wine-bottle'; icon.style.cssText = 'font-size:1.1rem; opacity:0.3'; imgBox.appendChild(icon);
            }

            const nameEl = li.querySelector('.item-name');
            if (qtd <= (parseFloat(p.estoque_minimo) ?? 0)) {
                const i = document.createElement('i'); i.className = 'fa-solid fa-triangle-exclamation text-warning'; nameEl.appendChild(i); nameEl.appendChild(document.createTextNode(' '));
            }
            nameEl.appendChild(document.createTextNode(p.nome_bebida));
            
            li.querySelector('.item-sub').textContent = p.categoria || 'Geral';
            li.querySelector('.item-global').textContent = `Global: ${Stock.getGlobalStock(p.id_produto)} ${p.unidade_medida}`;
            
            const qEl = li.querySelector('.item-amount');
            qEl.textContent = qtd;
            qEl.classList.add(qtd <= 0 ? 'text-danger' : 'text-primary');
            li.querySelector('.item-unit').textContent = `${p.unidade_medida} (${activeSector})`;

            frag.appendChild(li);
        });
        list.appendChild(frag);
    },

    toggleProductDetails(id, li, sector) {
        const panel = li.querySelector('.stock-details-container');
        if (!panel) return;
        const isActive = panel.classList.contains('active');
        if (isActive) { panel.classList.remove('active'); li.classList.remove('active'); }
        else { this.renderProductDetails(id, panel, sector); panel.classList.add('active'); li.classList.add('active'); }
    },

    renderProductDetails(id, container, sector) {
        container.innerHTML = '<div style="padding:1rem; text-align:center;"><i class="fa-solid fa-circle-notch fa-spin"></i> Calculando extrato...</div>';
        const allMovs = Movements.getMovements().filter(m => m.id_produto === id);
        const movsSetor = allMovs.filter(m => sector === 'Global' || m.local_origem === sector || m.local_destino === sector);

        if (movsSetor.length === 0) {
            container.innerHTML = '<div style="padding:1rem; text-align:center; font-size:0.8rem; color:var(--text-4);">Sem movimentações registrada.</div>';
            return;
        }

        const grupos = {};
        movsSetor.forEach(m => {
            const date = m.data_movimentacao.split('T')[0];
            if (!grupos[date]) grupos[date] = { in: 0, out: 0, loss: 0, div: 0, init: null };
            const q = Math.abs(m.quantidade);
            if (m.tipo_movimentacao === 'Carga Inicial') grupos[date].init = q;
            else if (m.tipo_movimentacao === 'Entrada') grupos[date].in += q;
            else if (m.tipo_movimentacao === 'Transferencia') { if (m.local_origem === sector) grupos[date].out += q; if (m.local_destino === sector) grupos[date].in += q; }
            else if (m.tipo_movimentacao === 'Saída') grupos[date].out += q;
            else if (m.tipo_movimentacao === 'Ajuste Perda') grupos[date].loss += q;
            else if (m.tipo_movimentacao === 'Ajuste_Contagem') { if (m.quantidade < 0) grupos[date].out += q; else grupos[date].in += q; }
        });

        const sortedDates = Object.keys(grupos).sort((a,b) => b.localeCompare(a));
        let runningBalance = Stock.getProductStock(id, sector);
        const extrato = [];
        sortedDates.forEach(date => {
            const g = grupos[date];
            const net = g.in - g.out - g.loss - g.div;
            const closing = runningBalance;
            const opening = (g.init !== null) ? g.init : (closing - net);
            extrato.push({ date, opening, in: g.in, out: g.out, loss: g.loss, div: g.div, closing });
            runningBalance = opening;
        });

        const listDiv = document.createElement('div');
        listDiv.className = 'mov-history-list'; listDiv.style.paddingBottom = '0.5rem';
        
        extrato.forEach(day => {
            const dateObj = new Date(day.date + 'T12:00:00');
            const d = dateObj.getDate(), m = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.','');
            const row = document.createElement('div');
            row.className = 'mov-row-compact';
            row.innerHTML = `
                <div class="mov-date-box"><span class="day">${d}</span><span class="month">${m}</span></div>
                <div class="mov-stats-grid" style="grid-template-columns: repeat(3, 1fr); row-gap: 0.25rem;">
                    <div class="mov-stat"><span class="label">Entrada</span><span class="value in">${day.in > 0 ? '+'+day.in : '0'}</span></div>
                    <div class="mov-stat" style="text-align: center;"><span class="label">Saídas</span><span class="value out">${day.out > 0 ? '-'+day.out : '0'}</span></div>
                    <div class="mov-stat" style="text-align: right;"><span class="label">Saldo Ini</span><span class="value" style="color:var(--text-3); font-weight:400;">${day.opening}</span></div>
                    <div style="grid-column: span 3; height: 1px; background: var(--green-200); margin: 0.25rem 0.75rem; opacity: 0.6;"></div>
                    <div class="mov-stat"><span class="label">Perdas</span><span class="value out" style="color:var(--red)">${day.loss > 0 ? '-'+day.loss : '0'}</span></div>
                    <div class="mov-stat" style="text-align: center;"><span class="label">Diverg.</span><span class="value adj">${day.div > 0 ? '-'+day.div : '0'}</span></div>
                    <div class="mov-stat" style="text-align: right;"><span class="label">Saldo Fin</span><span class="value" style="color:var(--primary); font-size:1.1rem;">${day.closing}</span></div>
                </div>
            `;
            listDiv.appendChild(row);
        });
        container.innerHTML = '';
        container.appendChild(listDiv);
    }
};
window.Dashboard = Dashboard;
