const Audit = {
    async log(acao, entidade, id_referencia, detalhes = "") {
        const user = Auth.getCurrentUser();
        const entry = {
            id_log: Utils.generateId(),
            data_evento: new Date().toISOString(),
            usuario: user ? user.nome : 'Sistema',
            setor: user ? user.setor : 'Sistema',
            acao: acao,
            entidade: entidade,
            id_referencia: id_referencia,
            detalhes: detalhes
        };
        await Store.insert('log_auditoria', entry);
        await this.cleanup();
    },
    async cleanup() {
        const table = Store.getTable('log_auditoria');
        if (table.length > 500) {
            const sorted = [...table].sort((a,b) => new Date(a.data_evento) - new Date(b.data_evento));
            const toDelete = sorted.slice(0, 100);
            for(const item of toDelete) {
                await Store.delete('log_auditoria', l => l.id_log === item.id_log);
            }
        }
    },
    getLogs(filters = {}) {
        let logs = Store.getTable('log_auditoria');
        if (filters.setor && filters.setor !== 'Admin') logs = logs.filter(l => l.setor === filters.setor);
        if (filters.usuario) logs = logs.filter(l => l.usuario.toLowerCase().includes(filters.usuario.toLowerCase()));
        return logs.sort((a,b) => new Date(b.data_evento) - new Date(a.data_evento));
    }
};
window.Audit = Audit;
