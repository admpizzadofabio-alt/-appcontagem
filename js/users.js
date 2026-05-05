const Users = {
    getAll() {
        return Store.getTable('usuarios');
    },
    async addUser(nome, pin, setor, nivel) {
        if(!Auth.hasPermission('Admin')) throw new Error("Acesso negado");
        
        const pinHash = await Utils.hash(pin);
        if(this.getAll().find(u => u.pin === pinHash)) throw new Error("PIN já existe");
        
        const user = {
            id_usuario: Utils.generateId(),
            nome: nome,
            pin: pinHash,
            setor: setor,
            nivel_acesso: nivel,
            ativo: true,
            data_criacao: new Date().toISOString()
        };
        await Store.insert('usuarios', user);
        await Audit.log('USUARIO_CRIADO', 'USUARIO', user.id_usuario, `Usuário ${nome} criado no setor ${setor}`);
    },
    async updateUser(id_usuario, nome, pin, setor, nivel) {
        if(!Auth.hasPermission('Admin')) throw new Error("Acesso negado");
        
        // Se o PIN tiver 4 caracteres, assumimos que é uma tentativa de trocar a senha (novo PIN em texto plano)
        // Se for maior, pode ser o hash vindo de um formulário que não foi alterado (depende da UI)
        // No nosso app, o campo de PIN no modal de Edição geralmente vem preenchido ou vazio.
        
        let pinParaSalvar = pin;
        if (pin && pin.length === 4) {
            pinParaSalvar = await Utils.hash(pin);
        }

        const existingWithPin = this.getAll().find(u => u.pin === pinParaSalvar && u.id_usuario !== id_usuario);
        if(existingWithPin) throw new Error("PIN já em uso por outro usuário.");
        
        await Store.update('usuarios', u => u.id_usuario === id_usuario, u => {
            u.nome = nome;
            if (pinParaSalvar) u.pin = pinParaSalvar;
            u.setor = setor;
            u.nivel_acesso = nivel;
        });
        await Audit.log('USUARIO_EDITADO', 'USUARIO', id_usuario, `Dados atualizados para ${nome}`);
    },
    async toggleStatus(id_usuario) {
        if(!Auth.hasPermission('Admin')) throw new Error("Acesso negado");
        await Store.update('usuarios', u => u.id_usuario === id_usuario, u => {
            u.ativo = !u.ativo;
        });
        await Audit.log('USUARIO_STATUS', 'USUARIO', id_usuario, `Status alterado`);
    }
};
window.Users = Users;
