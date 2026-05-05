const Auth = {
    currentUser: null,
    
    async login(pin) {
        const users = Store.getTable('usuarios');
        const inputHash = await Utils.hash(pin);
        
        // 1. Tenta buscar por PIN hasheado (Novo Padrão)
        let user = users.find(u => u.pin === inputHash && u.ativo);
        
        // 2. Fallback: Migração Transparente (Padrão Antigo - Texto Plano)
        if (!user) {
            user = users.find(u => u.pin === pin && u.ativo);
            if (user && pin.length === 4) {
                console.log(`[Auth] Migrando PIN do usuário ${user.nome} para formato seguro (Hash)...`);
                await Store.update('usuarios', u => u.id_usuario === user.id_usuario, u => {
                    u.pin = inputHash;
                });
                // Atualiza a referência do objeto local para o resto da sessão
                user.pin = inputHash;
            }
        }

        if (user) {
            this.currentUser = user;
            localStorage.setItem('AppUserSession', JSON.stringify(user));
            Audit.log('LOGIN', 'USUARIO', user.id_usuario, 'Login realizado (Seguro)');
            return user;
        }
        return null;
    },

    logout() {
        if (this.currentUser) {
            Audit.log('LOGOUT', 'USUARIO', this.currentUser.id_usuario, 'Encerramento de sessão');
        }
        this.currentUser = null;
        localStorage.removeItem('AppUserSession');
    },

    loadSession() {
        const session = localStorage.getItem('AppUserSession');
        if (session) {
            this.currentUser = JSON.parse(session);
            return this.currentUser;
        }
        return null;
    },

    getCurrentUser() {
        return this.currentUser;
    },

    hasPermission(requiredNivel) {
        if (!this.currentUser) return false;
        const niveis = { 'Operador': 1, 'Supervisor': 2, 'Admin': 3 };
        return niveis[this.currentUser.nivel_acesso] >= niveis[requiredNivel];
    },

    canViewSector(sector) {
        if (!this.currentUser) return false;
        if (this.currentUser.setor === 'Admin') return true;
        return this.currentUser.setor === sector;
    }
};
window.Auth = Auth;
