const Products = {
    getAll() {
        return Store.getTable('produtos');
    },

    async addProduct(nome, categoria, unidade, volume, custo, estoqueMin, setor, ativo, imagemBase64) {
        if (!nome || !unidade) throw new Error("Nome e unidade são obrigatórios.");
        const custoNum = parseFloat(custo) || 0;
        if (custoNum < 0) throw new Error("Custo inválido.");

        return await Store.insert('produtos', {
            id_produto: Utils.generateId(),
            nome_bebida: nome,
            categoria: categoria,
            unidade_medida: unidade,
            volume_padrao: volume,
            custo_unitario: custoNum,
            estoque_minimo: parseFloat(estoqueMin) || 0,
            setor_padrao: setor,
            ativo: ativo === 'true' || ativo === true,
            imagem: imagemBase64 || null
        });
    },

    async updateProduct(id, nome, categoria, unidade, volume, custo, estoqueMin, setor, ativo, imagemBase64) {
        if (!nome || !unidade) throw new Error("Nome e unidade são obrigatórios.");
        const custoNum = parseFloat(custo) || 0;
        if (custoNum < 0) throw new Error("Custo inválido.");

        return await Store.update('produtos', p => p.id_produto === id, p => {
            p.nome_bebida = nome;
            p.categoria = categoria;
            p.unidade_medida = unidade;
            p.volume_padrao = volume;
            p.custo_unitario = custoNum;
            p.estoque_minimo = parseFloat(estoqueMin) || 0;
            p.setor_padrao = setor;
            p.ativo = ativo === 'true' || ativo === true;
            if (imagemBase64 !== undefined) {
                p.imagem = imagemBase64;
            }
        });
    },

    async toggleStatus(id) {
        return await Store.update('produtos', p => p.id_produto === id, p => {
            p.ativo = !p.ativo;
        });
    },

    async deleteProduct(id) {
        return await Store.delete('produtos', p => p.id_produto === id);
    }
};

window.Products = Products;
