/**
 * services.js
 * Centraliza as Regras de Negócio e Lógica de Transações Core
 */

const Services = {

    /**
     * Registra Movimentação Simples e Atualiza o Estoque
     */
    lancarMovimentacao: (tipo, id_produto, local, quantidade, operador, observacao = "") => {
        
        let qtdNumber = parseFloat(quantidade);
        if (qtdNumber <= 0 || isNaN(qtdNumber)) throw new Error("Quantidade inválida.");
        if (tipo === 'Saída') {
            const atual = db.getEstoqueProduto(id_produto, local);
            if (atual < qtdNumber) throw new Error("Estoque insuficiente para saída.");
        }

        // 1. Atualizar Estoque Físico
        const tipoEstoque = tipo === 'Ajuste' ? 'Ajuste_Absoluto' : tipo;
        // Se for ajuste e valor for menor ou maior, a regra pra ajuste avulso é adicionar ou remover? 
        // Na tela deixamos "Ajuste". Vamos tratar Ajuste como recontagem absoluta (Ajuste_Absoluto).
        // Para simplificar "Movimentação":
        // Entrada = Soma, Saída = Subtrai. Ajuste da tela = define o valor exato no banco.
        
        let dif = qtdNumber;
        let tipoLog = tipo;

        if (tipo === 'Ajuste') {
            const atual = db.getEstoqueProduto(id_produto, local);
            dif = qtdNumber - atual;
            tipoLog = dif >= 0 ? 'Ajuste Positivo' : 'Ajuste Negativo';
            qtdNumber = Math.abs(dif); // Qtd da movimentação é absoluta
            db.atualizarEstoqueFisico(id_produto, local, dif >= 0 ? atual + dif : atual - Math.abs(dif), 'Ajuste_Absoluto');
        } else {
            db.atualizarEstoqueFisico(id_produto, local, qtdNumber, tipo);
        }

        // 2. Registrar Log (se houve diferença no ajuste ou se é entrada/saída)
        if (dif !== 0 || tipo !== 'Ajuste') {
            db.registrarMovimentacao({
                data: new Date().toISOString(),
                id_produto: id_produto,
                tipo: tipoLog,
                quantidade: qtdNumber,
                local_origem: tipo === 'Saída' ? local : null,
                local_destino: tipo === 'Entrada' ? local : null,
                operador: operador,
                observacao: observacao || `Lançamento manual de ${tipo}`
            });
        }
        return true;
    },

    /**
     * Efetua Transferência entre Locais (Gera duas movimentações)
     */
    efetuarTransferencia: (id_produto, origem, destino, quantidade, operador) => {
        if(origem === destino) throw new Error("Origem e destino iguais.");
        let qtdNumber = parseFloat(quantidade);
        
        const estOrigem = db.getEstoqueProduto(id_produto, origem);
        if (estOrigem < qtdNumber) throw new Error("Estoque insuficiente na origem.");

        // Atualiza físico (Saída Origem, Entrada Destino)
        db.atualizarEstoqueFisico(id_produto, origem, qtdNumber, 'Saída');
        db.atualizarEstoqueFisico(id_produto, destino, qtdNumber, 'Entrada');

        // Log único como Transferência que descreve a rota
        db.registrarMovimentacao({
            data: new Date().toISOString(),
            id_produto: id_produto,
            tipo: 'Transferência',
            quantidade: qtdNumber,
            local_origem: origem,
            local_destino: destino,
            operador: operador,
            observacao: `Transferência de ${origem} para ${destino}`
        });

        return true;
    },

    /**
     * Encerra a Contagem de Estoque e detecta e aplica divergências
     */
    encerrarContagem: (id_contagem, operador) => {
        const contagem = db.finalizarContagem(id_contagem);
        const itensContados = db.getItensContagem(id_contagem);
        const allProdutos = db.getProdutosAtivos();
        
        let divergenciasEncontradas = 0;

        allProdutos.forEach(prod => {
            const item = itensContados.find(i => i.id_produto === prod.id);
            const qtdContada = item ? item.quantidade_contada : 0; // Se não contou, é zero.
            const qtdEmSistema = db.getEstoqueProduto(prod.id, contagem.local);

            const diferenca = qtdContada - qtdEmSistema;

            if (diferenca !== 0) {
                // 1. Fazer o Ajuste (Sobresscrever o físico)
                db.atualizarEstoqueFisico(prod.id, contagem.local, qtdContada, 'Ajuste_Absoluto');
                
                // 2. Registrar Movimentação do Ajuste de Inventário
                db.registrarMovimentacao({
                    data: new Date().toISOString(),
                    id_produto: prod.id,
                    tipo: diferenca > 0 ? 'Ajuste Positivo' : 'Ajuste Negativo',
                    quantidade: Math.abs(diferenca),
                    local_origem: diferenca < 0 ? contagem.local : null,
                    local_destino: diferenca > 0 ? contagem.local : null,
                    operador: operador,
                    observacao: `Divergência na contagem #${id_contagem}. Sis: ${qtdEmSistema}, Contado: ${qtdContada}`
                });
                divergenciasEncontradas++;
            }
        });

        return {
            sucesso: true,
            divergencias: divergenciasEncontradas
        };
    }

};

window.Services = Services;
