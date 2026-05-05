const Orders = {
    init() {
        console.log("Orders: Inicializado.");
        this.bindEvents();
    },

    bindEvents() {
        document.getElementById('btn-order-add-item')?.addEventListener('click', () => this.addItemRow());
    },

    openModal() {
        const user = Auth.getCurrentUser();
        if(!user) return;
        
        const dataEl = document.getElementById('pedido-data-fixa');
        if(dataEl) dataEl.value = new Date().toLocaleDateString('pt-BR');

        const sectorEl = document.getElementById('pedido-setor-fixo');
        if(sectorEl) sectorEl.value = user.setor;

        const list = document.getElementById('pedido-itens-lista');
        if(list) {
            list.innerHTML = '';
            this.addItemRow(); // Começa com uma linha
        }
        
        const obsEl = document.getElementById('pedido-obs');
        if(obsEl) obsEl.value = '';

        document.getElementById('modal-pedido').classList.add('active');
    },

    closeModal() {
        const modal = document.getElementById('modal-pedido');
        if(modal) modal.classList.remove('active');
    },

    addItemRow() {
        const list = document.getElementById('pedido-itens-lista');
        if(!list) return;

        const row = document.createElement('div');
        row.className = 'order-item-row';
        row.style.cssText = 'display:grid; grid-template-columns: 1fr 80px 40px; gap:0.5rem; margin-bottom:0.5rem; align-items:center;';
        
        const sel = document.createElement('select');
        sel.className = 'form-control ord-p-id';
        Stock.getProducts().forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id_produto;
            opt.textContent = p.nome_bebida;
            sel.appendChild(opt);
        });

        const inp = document.createElement('input');
        inp.type = 'number'; inp.className = 'form-control ord-p-qtd';
        inp.min = '1'; inp.value = '1';

        const btn = document.createElement('button');
        btn.className = 'btn btn-icon text-danger';
        btn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        btn.onclick = () => { if(list.children.length > 1) row.remove(); };

        row.appendChild(sel);
        row.appendChild(inp);
        row.appendChild(btn);
        list.appendChild(row);
    },

    async submitPedido() {
        const user = Auth.getCurrentUser();
        if(!user) return;
        const sector = document.getElementById('pedido-setor-fixo')?.value || user.setor;
        const obs = document.getElementById('pedido-obs')?.value || '';
        const rows = document.querySelectorAll('.order-item-row');
        
        if(rows.length === 0) return;
        
        try {
            const grupoId = Utils.generateId();
            const agora = new Date().toISOString();
            
            for (const row of rows) {
                const idProd = row.querySelector('.ord-p-id').value;
                const qtd = parseFloat(row.querySelector('.ord-p-qtd').value);
                const p = Stock.getProduct(idProd);

                if (qtd <= 0) continue;

                await Store.insert('pedidos_compra', {
                    id_pedido: Utils.generateId(),
                    id_grupo: grupoId,
                    data_pedido: agora,
                    id_produto: idProd,
                    nome_produto: p ? p.nome_bebida : '?',
                    quantidade: qtd,
                    setor_solicitante: sector,
                    usuario_solicitante: user.id_usuario,
                    observacao: obs,
                    status: 'Pendente'
                });
            }

            if(window.app) app.showToast('Solicitação enviada com sucesso!');
            this.closeModal();
            if(window.app) app.navigate('home');
        } catch(e) {
            if(window.app) app.showToast('Erro ao salvar pedido', 'error');
        }
    },

    async updateStatus(id_grupo, newStatus, isGroup = true) {
        try {
            if(!await app.customConfirm(`Deseja alterar o status para ${newStatus}?`)) return;
            
            await Store.updateMany('pedidos_compra', 
                p => (isGroup ? p.id_grupo === id_grupo : p.id_pedido === id_grupo),
                p => { p.status = newStatus; }
            );

            app.showToast('Status atualizado!');
            if(window.Reports && Reports.currentTab === 'tab-pedidos') Reports.renderPedidos();
        } catch(e) {
            app.showToast('Erro ao atualizar status', 'error');
        }
    }
};
window.Orders = Orders;
