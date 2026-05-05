const Counting = {
    async startCount(local) {
        const user = Auth.getCurrentUser();
        if(!user) throw new Error("Autenticação requerida");
        
        const contagem = {
            id_contagem: Utils.generateId(),
            data_contagem: new Date().toISOString(),
            data_inicio: new Date().toISOString(),
            local: local,
            responsavel: user.id_usuario,
            operador: user.id_usuario,
            status: 'Aberta',
            data_abertura: new Date().toISOString()
        };
        await Store.insert('contagem_estoque', contagem);
        await Audit.log('CONTAGEM_INICIADA', 'CONTAGEM', contagem.id_contagem, `Contagem iniciada no ${local} por ${user.nome}`);
        return contagem;
    },

    async saveItemCount(id_contagem, id_produto, qtd_contada) {
        const contagem = Store.getTable('contagem_estoque').find(c => c.id_contagem === id_contagem);
        if(!contagem) throw new Error("Contagem fechada ou inválida");

        const qtd_sistema = Stock.getProductStock(id_produto, contagem.local);
        const dif = qtd_contada - qtd_sistema;

        const existing = Store.getTable('itens_contagem').find(i => i.id_contagem === id_contagem && i.id_produto === id_produto);
        if (existing) {
            await Store.update('itens_contagem', i => i.id_item_contagem === existing.id_item_contagem, i => {
                i.quantidade_contada = qtd_contada;
                i.diferenca = dif;
            });
        } else {
            await Store.insert('itens_contagem', {
                id_item_contagem: Utils.generateId(),
                id_contagem: id_contagem,
                id_produto: id_produto,
                quantidade_sistema: qtd_sistema,
                quantidade_contada: qtd_contada,
                diferenca: dif
            });
        }
    },

    async finishCount(id_contagem) {
        const user = Auth.getCurrentUser();
        const contagem = Store.getTable('contagem_estoque').find(c => c.id_contagem === id_contagem);
        if(!contagem) throw new Error("Contagem não encontrada");
        
        const itens = Store.getTable('itens_contagem').filter(i => i.id_contagem === id_contagem);
        const agora = new Date().toISOString();
        const userId = user ? user.id_usuario : 'system';

        let divgs = 0;
        
        for (const item of itens) {
            if (item.diferenca !== 0) {
                divgs++;
                
                // 1. Atualizar o estoque físico direto em memória e nuvem
                const stockItem = Store.getTable('estoque_atual').find(e => e.id_produto === item.id_produto && e.local === contagem.local);
                if (stockItem) {
                    await Store.update('estoque_atual', e => e.id_estoque === stockItem.id_estoque, e => {
                        e.quantidade_atual = item.quantidade_contada;
                        e.data_atualizacao = agora;
                        e.atualizado_por = userId;
                    });
                } else {
                    await Store.insert('estoque_atual', {
                        id_estoque: Utils.generateId(),
                        id_produto: item.id_produto,
                        local: contagem.local,
                        quantidade_atual: item.quantidade_contada,
                        data_atualizacao: agora,
                        atualizado_por: userId
                    });
                }

                // 2. Registrar histórico de movimentação
                const tipoMov = item.diferenca > 0 ? 'Entrada' : 'Ajuste Perda';
                await Store.insert('movimentacoes_estoque', {
                    id_movimentacao: Utils.generateId(),
                    data_movimentacao: agora,
                    id_produto: item.id_produto,
                    tipo_movimentacao: 'Ajuste_Contagem',
                    quantidade: item.diferenca, 
                    local_origem: contagem.local,
                    local_destino: null,
                    usuario_responsavel: userId,
                    observacao: `Ajuste Contagem #${id_contagem.substring(0,6).toUpperCase()}`,
                    imagem_comprovante: null
                });
            }
        }

        // 3. Fechar contagem
        await Store.update('contagem_estoque', c => c.id_contagem === id_contagem, c => {
            c.status = 'Fechada';
            c.data_fechamento = agora;
        });
        
        await Audit.log('CONTAGEM_FINALIZADA', 'CONTAGEM', id_contagem, `Fechada com ${divgs} divergência(s).`);
        return { success: true, divergencias: divgs };
    },

    getCountsBySector(sector) {
        let c = Store.getTable('contagem_estoque');
        if (sector && sector !== 'Admin') c = c.filter(x => x.local === sector);
        return c.sort((a,b) => new Date(b.data_contagem) - new Date(a.data_contagem));
    }
};
window.Counting = Counting;
