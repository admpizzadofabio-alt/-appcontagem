const DB_VERSION = 2; // Forçando reset de cache local antigo caso necessário

// Fallback de demonstração offline apenas para primeiro uso
const defaultData = {
    usuarios: [
        { id_usuario: 'u1', nome: 'Admin Master', pin: '1234', setor: 'Admin', nivel_acesso: 'Admin', ativo: true }
    ],
    produtos: [],
    estoque_atual: [],
    contagem_estoque: [],
    itens_contagem: [],
    movimentacoes_estoque: [],
    pedidos_compra: [],
    log_auditoria: []
};

const Store = {
    data: null,
    db: null,
    LOCAL_KEY: `erp_offline_data_v${DB_VERSION}`,
    
    // Core Collections
    collections: ['usuarios', 'produtos', 'estoque_atual', 'contagem_estoque', 'itens_contagem', 'movimentacoes_estoque', 'pedidos_compra', 'log_auditoria'],
    pks: {
        usuarios: 'id_usuario',
        produtos: 'id_produto',
        estoque_atual: 'id_estoque',
        contagem_estoque: 'id_contagem',
        itens_contagem: 'id_item_contagem',
        movimentacoes_estoque: 'id_movimentacao',
        pedidos_compra: 'id_pedido',
        log_auditoria: 'id_log'
    },

    loadFromLocal() {
        const local = localStorage.getItem(this.LOCAL_KEY);
        if (local) {
            try {
                this.data = JSON.parse(local);
                console.log("Dados base carregados do LocalStorage.");
                return true;
            } catch(e) {
                console.error("Erro ao ler cache local:", e);
            }
        }
        return false;
    },

    saveToLocal() {
        if (!this.data) return;
        try {
            localStorage.setItem(this.LOCAL_KEY, JSON.stringify(this.data));
        } catch(e) {
            console.warn("LocalStorage lotado, app continua funcionando com IndexedDB/Firestore", e);
        }
    },
    
    async init(onReady) {
        console.log("Iniciando Store V2 — Coleções Separadas...");

        // PASSO 1: Carrega Memória IMEDIATAMENTE (síncrono)
        if (!this.loadFromLocal()) {
            this.data = JSON.parse(JSON.stringify(defaultData));
            this.saveToLocal();
        }
        this.updateSyncUI('offline');

        // PASSO 2: Libera a UI
        if (onReady) onReady();

        // PASSO 3: Inicia Firebase SDK
        try {
            const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js");
            const { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, setDoc, deleteDoc, onSnapshot, collection } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
            
            const firebaseConfig = {
              apiKey: "AIzaSyD_4GChqRYQ631gTrVIY88L4kFlzotKcpo",
              authDomain: "controle-de-bebidas-one.firebaseapp.com",
              projectId: "controle-de-bebidas-one",
              storageBucket: "controle-de-bebidas-one.firebasestorage.app",
              messagingSenderId: "94793203683",
              appId: "1:94793203683:web:383097a9a26db78cc0ead6",
              measurementId: "G-W4YYBCN7D6"
            };
            
            const firebaseApp = initializeApp(firebaseConfig);
            
            try {
                this.db = initializeFirestore(firebaseApp, {
                    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
                });
            } catch(e) {
                const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
                this.db = getFirestore(firebaseApp);
                console.warn("Fallback de Cache:", e.message);
            }

            this.setDoc = setDoc;
            this.doc = doc;
            this.deleteDoc = deleteDoc;
            this.collection = collection;

            this.updateSyncUI('syncing');

            // Timeout para UI
            const syncTimeout = setTimeout(() => {
                this.updateSyncUI('offline');
            }, 5000);

            // PASSO 4: Assinar cada coleção individualmente
            this.collections.forEach(colName => {
                const colRef = collection(this.db, colName);
                onSnapshot(colRef, { includeMetadataChanges: true }, (snap) => {
                    clearTimeout(syncTimeout);
                    const hasPending = snap.metadata.hasPendingWrites;
                    this.updateSyncUI(hasPending ? 'syncing' : 'synced');
                    
                    // Remonta a array local
                    const items = [];
                    snap.forEach(d => items.push(d.data()));
                    this.data[colName] = items;
                });
            });
            
            // Periodicamente atualiza o LocalStorage (Fallback Rápido)
            setInterval(() => this.saveToLocal(), 15000);

        } catch (error) {
            console.error("Erro SDK Firebase:", error);
            this.updateSyncUI('offline');
        }
    },

    updateSyncUI(status) {
        const el = document.getElementById('sync-indicator');
        if (!el) return;
        el.className = 'sync-status ' + (
            status === 'synced' ? 'status-synced' : 
            status === 'syncing' ? 'status-syncing' : 'status-offline'
        );
        el.title = (
            status === 'synced' ? 'Sincronizado com a Nuvem' : 
            status === 'syncing' ? 'Sincronizando...' : 'Apenas Local (Offline)'
        );
    },

    getTable(tableName) {
        return this.data ? (this.data[tableName] || []) : [];
    },

    async insert(tableName, item) {
        if(!this.data) return item;
        if(!this.data[tableName]) this.data[tableName] = [];
        this.data[tableName].push(item);
        this.saveToLocal(); // Salva local imediato

        // Firebase Sync
        if (this.db && this.setDoc) {
            try {
                this.updateSyncUI('syncing');
                const pk = this.pks[tableName];
                const docId = String(item[pk]);
                await this.setDoc(this.doc(this.collection(this.db, tableName), docId), item);
                this.updateSyncUI('synced');
            } catch(e) {
                console.warn("Cloud Sync Queueing:", e);
                this.updateSyncUI('offline');
            }
        }
        return item;
    },

    async update(tableName, predicate, updateFn) {
        if(!this.data) return null;
        const item = this.getTable(tableName).find(predicate);
        if (item) {
            updateFn(item);
            this.saveToLocal();
            
            // Firebase Sync
            if (this.db && this.setDoc) {
                try {
                    this.updateSyncUI('syncing');
                    const pk = this.pks[tableName];
                    const docId = String(item[pk]);
                    await this.setDoc(this.doc(this.collection(this.db, tableName), docId), item, { merge: true });
                    this.updateSyncUI('synced');
                } catch(e) {
                    console.warn("Cloud Sync Queueing:", e);
                    this.updateSyncUI('offline');
                }
            }
            return item;
        }
        return null;
    },

    async updateMany(tableName, predicate, updateFn) {
        if(!this.data || !this.data[tableName]) return;
        const promises = [];
        this.data[tableName].forEach(item => {
            if (predicate(item)) {
                updateFn(item);
                // Trigger individual writes
                if (this.db && this.setDoc) {
                    const pk = this.pks[tableName];
                    const docId = String(item[pk]);
                    promises.push(this.setDoc(this.doc(this.collection(this.db, tableName), docId), item, { merge: true }));
                }
            }
        });
        
        this.saveToLocal();
        
        if (promises.length > 0) {
            this.updateSyncUI('syncing');
            try {
                await Promise.all(promises);
                this.updateSyncUI('synced');
            } catch(e) {
                this.updateSyncUI('offline');
            }
        }
    },

    async delete(tableName, predicate) {
        if(!this.data || !this.data[tableName]) return false;
        
        const toDelete = this.data[tableName].filter(predicate);
        this.data[tableName] = this.data[tableName].filter(item => !predicate(item));
        this.saveToLocal();

        if (this.db && this.deleteDoc && toDelete.length > 0) {
            this.updateSyncUI('syncing');
            const pk = this.pks[tableName];
            const promises = toDelete.map(item => this.deleteDoc(this.doc(this.collection(this.db, tableName), String(item[pk]))));
            try {
                await Promise.all(promises);
                this.updateSyncUI('synced');
            } catch(e) {
                this.updateSyncUI('offline');
            }
            return true;
        }
        return false;
    },

    async wipe(type) {
        if (!this.data) return;
        // Mocked wipe function to preserve compatibility. 
        // Real firestore wipe requires server side functions or dropping all documents manually.
        const admin = this.data.usuarios.find(u => u.nivel_acesso === 'Admin' || u.nivel === 3);
        const toClear = type === 'movements' 
            ? ['estoque_atual', 'contagem_estoque', 'itens_contagem', 'movimentacoes_estoque']
            : this.collections;
            
        for (const tableName of toClear) {
            if (type === 'all' && tableName === 'usuarios') {
                this.data.usuarios = admin ? [admin] : [];
            } else {
                this.data[tableName] = [];
            }
            
            // Clear cloud docs iteratively
            if (this.db && this.deleteDoc) {
                const querySnapshot = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js").then(m => m.getDocs(m.collection(this.db, tableName)));
                querySnapshot.forEach(async (d) => {
                    if (type === 'all' && tableName === 'usuarios' && admin && String(admin.id_usuario) === String(d.id)) return;
                    await this.deleteDoc(d.ref);
                });
            }
        }
        this.saveToLocal();
        return true;
    },

    exportBackup() {
        if (!this.data) return;
        const backupData = JSON.stringify(this.data, null, 2);
        const blob = new Blob([backupData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dataStr = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `backup_erp_pizzadofabio_${dataStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    async importBackup(jsonContent) {
        try {
            const imported = JSON.parse(jsonContent);
            if (!imported.produtos || !imported.usuarios) throw new Error("Arquivo de backup inválido ou corrompido.");
            
            if (!imported.usuarios.length && this.data.usuarios.length) {
                imported.usuarios = this.data.usuarios.filter(u => u.nivel_acesso === 'Admin' || u.nivel === 3);
            }
            
            // Loop through all collections and manually mass insert
            for (const table of this.collections) {
                const rows = imported[table] || [];
                for (const row of rows) {
                    await this.insert(table, row);
                }
            }
            return true;
        } catch (e) {
            throw e;
        }
    }
};

window.Store = Store;
