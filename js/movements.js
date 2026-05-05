const Movements = {
    async registerMovement(id_produto, tipo, quantidade, local_origem, local_destino, observacao = "", fotoBase64 = null) {
        const user = Auth.getCurrentUser();
        if(!user) throw new Error("Usuário não autenticado.");
        
        const quantidadeNum = parseFloat(quantidade);
        if(isNaN(quantidadeNum) || (quantidadeNum <= 0 && tipo !== 'Ajuste' && tipo !== 'Ajuste Perda')) throw new Error("Quantidade inválida.");

        let dif = quantidadeNum;
        let tipoFinal = tipo;

        // Apply physical changes
        if(tipo === 'Ajuste' || tipo === 'Ajuste Perda') {
            const atual = Stock.getProductStock(id_produto, local_origem);
            dif = -quantidadeNum;
            const novoValor = (atual - quantidadeNum) < 0 ? 0 : (atual - quantidadeNum);
            await Stock.updatePhysicalStock(id_produto, local_origem, novoValor, user.id_usuario);
        } else if(tipo === 'Carga Inicial') {
            await Stock.updatePhysicalStock(id_produto, local_origem, quantidadeNum, user.id_usuario);
            dif = quantidadeNum; 
        } else if(tipo === 'Entrada') {
            const atual = parseFloat(Stock.getProductStock(id_produto, local_origem)) || 0;
            await Stock.updatePhysicalStock(id_produto, local_origem, atual + quantidadeNum, user.id_usuario);
        } else if(tipo === 'Saída') {
            const atual = parseFloat(Stock.getProductStock(id_produto, local_origem)) || 0;
            if(atual < quantidadeNum) throw new Error("Estoque insuficiente na origem.");
            await Stock.updatePhysicalStock(id_produto, local_origem, atual - quantidadeNum, user.id_usuario);
        } else if(tipo === 'Transferencia') {
            const atualOrig = Stock.getProductStock(id_produto, local_origem);
            if(atualOrig < quantidadeNum) throw new Error("Estoque insuficiente na origem.");
            const atualDest = Stock.getProductStock(id_produto, local_destino);
            await Stock.updatePhysicalStock(id_produto, local_origem, atualOrig - quantidadeNum, user.id_usuario);
            await Stock.updatePhysicalStock(id_produto, local_destino, atualDest + quantidadeNum, user.id_usuario);
        }

        if(dif !== 0 || tipo === 'Transferencia' || tipo === 'Carga Inicial') {
            const id_mov = Utils.generateId();
            await Store.insert('movimentacoes_estoque', {
                id_movimentacao: id_mov,
                data_movimentacao: new Date().toISOString(),
                id_produto: id_produto,
                tipo_movimentacao: tipo, // ✅ Preserva o tipo original
                quantidade: quantidadeNum,
                local_origem: (tipo === 'Entrada' || tipo === 'Carga Inicial') ? null : local_origem,
                local_destino: (tipo === 'Entrada' || tipo === 'Carga Inicial') ? local_origem : (tipo === 'Transferencia' ? local_destino : null),
                usuario_responsavel: user.id_usuario,
                observacao: observacao || (tipo === 'Carga Inicial' ? 'Carga Inicial de Estoque' : ''),
                imagem_comprovante: fotoBase64,
                referencia_origem: tipo
            });
            
            // Audit logic separation check to avoid duplicate on count
            if(tipo !== 'Contagem' && tipo !== 'Ajuste_Contagem') {
                await Audit.log('MOVIMENTACAO', 'ESTOQUE', id_mov, `${tipo} de ${quantidadeNum} do produto ${id_produto}`);
            }
        }
        return true;
    },
    
    getMovements(filters = {}) {
        let movs = Store.getTable('movimentacoes_estoque');
        if (filters.setor && filters.setor !== 'Admin') {
            movs = movs.filter(m => m.local_origem === filters.setor || m.local_destino === filters.setor);
        }
        return movs.sort((a,b) => new Date(b.data_movimentacao) - new Date(a.data_movimentacao));
    }
};
window.Movements = Movements;
