const Stock = {
    getProducts() {
        return Store.getTable('produtos').filter(p => p.ativo);
    },
    
    getProduct(id_produto) {
        return Store.getTable('produtos').find(p => p.id_produto === id_produto);
    },

    getCurrentStock(sector) {
        let stock = Store.getTable('estoque_atual');
        if (sector && sector !== 'Admin') {
            stock = stock.filter(e => e.local === sector);
        }
        return stock;
    },

    getProductStock(id_produto, local) {
        const item = Store.getTable('estoque_atual').find(e => e.id_produto === id_produto && e.local === local);
        return item ? item.quantidade_atual : 0;
    },

    getGlobalStock(id_produto) {
        const sBar = this.getProductStock(id_produto, 'Bar');
        const sDel = this.getProductStock(id_produto, 'Delivery');
        return sBar + sDel;
    },

    isDuplicateName(nome, id_atual) {
        if (!nome) return false;
        const normalized = nome.trim().toLowerCase();
        return Store.getTable('produtos').some(p => 
            p.ativo && 
            p.id_produto !== id_atual && 
            p.nome_bebida.trim().toLowerCase() === normalized
        );
    },

    async updatePhysicalStock(id_produto, local, nova_quantidade, id_usuario) {
        let existing = Store.getTable('estoque_atual').find(e => e.id_produto === id_produto && e.local === local);
        if (existing) {
            await Store.update('estoque_atual', e => e.id_estoque === existing.id_estoque, e => {
                e.quantidade_atual = nova_quantidade;
                e.data_atualizacao = new Date().toISOString();
                e.atualizado_por = id_usuario;
            });
        } else {
            await Store.insert('estoque_atual', {
                id_estoque: Utils.generateId(),
                id_produto: id_produto,
                local: local,
                quantidade_atual: nova_quantidade,
                data_atualizacao: new Date().toISOString(),
                atualizado_por: id_usuario
            });
        }
    }
};
window.Stock = Stock;
