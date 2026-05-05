const app = {
    contagemAtiva: null,
    currentEstoqueSector: 'Bar',

    init() {
        this.bindLogin();
        this.bindEvents();
        Auth.loadSession();
        if(window.Orders) Orders.init();
        
        if (Auth.getCurrentUser()) {
            this.setupSession();
            const lastView = localStorage.getItem('lastView') || 'home';
            const activeCountId = localStorage.getItem('activeCountId');
            if (activeCountId) {
                const count = Store.getTable('contagem_estoque').find(c => c.id_contagem === activeCountId);
                if (count && count.status === 'Aberta') this.contagemAtiva = count;
                else localStorage.removeItem('activeCountId');
            }
            this.navigate(lastView);
        } else {
            this.navigate('login');
        }
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = document.createElement('i');
        icon.className = type === 'success' ? 'fa-solid fa-check' : 'fa-solid fa-triangle-exclamation';
        const span = document.createElement('span');
        span.textContent = ` ${message}`;
        toast.appendChild(icon);
        toast.appendChild(span);
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    navigate(viewId) {
        const user = Auth.getCurrentUser();
        if (viewId !== 'login' && !user) return this.navigate('login');

        document.querySelectorAll('.view').forEach(v => { v.classList.add('hidden'); v.classList.remove('active-view'); });
        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
        
        const navMatch = document.querySelector(`[data-view="${viewId}"]`) || document.querySelector(`[data-view="home"]`);
        if(navMatch) navMatch.classList.add('active');

        const appWrapper = document.getElementById('app-wrapper');
        const viewLogin = document.getElementById('view-login');
        
        if (viewId === 'login') {
            appWrapper?.classList.add('hidden');
            if(viewLogin) { viewLogin.classList.remove('hidden'); viewLogin.classList.add('active-view'); }
        } else {
            appWrapper?.classList.remove('hidden');
            viewLogin?.classList.add('hidden');
            const target = document.getElementById(`view-${viewId}`);
            if(target) {
                target.classList.remove('hidden');
                target.classList.add('active-view');
                localStorage.setItem('lastView', viewId);
            } else {
                this.navigate('home');
            }
        }

        const setups = {
            'home': () => window.Dashboard?.renderHome(),
            'estoque': () => window.Dashboard?.renderEstoqueAtual(),
            'relatorios': () => window.Reports?.init(),
            'movimentacao': () => this.setupMovForm(),
            'transferencia': () => this.setupTransferForm(),
            'contagem-setup': () => this.setupCountForm(),
            'admin': () => this.setupAdminPanel(),
            'usuarios': () => this.setupUserPanel(),
            'produtos': () => this.setupProductPanel(),
            'meu-historico': () => this.renderMeuHistorico()
        };
        if(setups[viewId]) setups[viewId]();
        this.renderNotifications();
    },

    bindLogin() {
        let pin = "";
        const dots = document.querySelectorAll('.pin-display .dot');
        const updateDots = () => dots.forEach((dot, i) => dot.classList.toggle('filled', i < pin.length));

        document.querySelectorAll('.key').forEach(btn => {
            btn.addEventListener('click', async () => {
                const isClear = btn.id === 'key-clear' || btn.closest('#key-clear');
                const isEnter = btn.id === 'key-enter' || btn.closest('#key-enter');
                
                if (isClear) pin = pin.slice(0, -1);
                else if (isEnter) {
                    if (pin.length === 4) {
                        try {
                            const user = await Auth.login(pin);
                            if (user) {
                                this.setupSession();
                                this.navigate('home');
                                this.showToast(`Logado como ${user.nome}`);
                            } else {
                                this.showToast('PIN Inválido!', 'error');
                                pin = "";
                                updateDots();
                            }
                        } catch(e) {
                            this.showToast('Erro no sistema', 'error');
                        }
                    }
                } else if (pin.length < 4) {
                    pin += btn.textContent.trim();
                }
                updateDots();
            });
        });

        document.getElementById('btn-logout')?.addEventListener('click', () => {
            Auth.logout();
            pin = ""; updateDots();
            localStorage.removeItem('lastView');
            this.navigate('login');
        });
    },

    bindEvents() {
        // Nav items
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.onclick = () => {
                if(btn.dataset.movType) {
                    this.openMovimentacao(btn.dataset.movType);
                } else {
                    this.navigate(btn.dataset.view);
                }
            };
        });

        // Search contagem
        document.getElementById('search-contagem')?.addEventListener('input', (e) => {
            this.renderActiveCountList(e.target.value.toLowerCase());
        });

        // Start count
        document.getElementById('btn-start-contagem')?.addEventListener('click', async () => {
            const local = document.getElementById('contagem-local').value;
            const btn = document.getElementById('btn-start-contagem');
            const originalHtml = btn.innerHTML;
            try {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Iniciando...';
                const count = await Counting.startCount(local);
                this.contagemAtiva = count;
                localStorage.setItem('activeCountId', count.id_contagem);
                this.setupActiveCount();
            } catch(e) {
                this.showToast(e.message, 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        });

        // Save Mov
        document.getElementById('btn-save-mov')?.addEventListener('click', async (e) => {
            e.preventDefault();
            const btn = e.target;
            const originalText = btn.textContent;
            try {
                btn.disabled = true;
                btn.textContent = 'Gravando...';
                const type = document.querySelector('input[name="mov_tipo"]:checked')?.value || 'Saída';
                const prod = document.getElementById('mov-produto').value;
                const qtd = parseFloat(document.getElementById('mov-qtd').value);
                const local = document.getElementById('mov-local').value;
                const obs = document.getElementById('mov-obs').value;
                const img = document.getElementById('mov-imagem-base64').value;

                await Movements.registerMovement(prod, type, qtd, local, null, obs, img);
                this.showToast('Lançamento registrado!');
                this.navigate('home');
            } catch(e) {
                this.showToast(e.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });

        // Save Transfer
        document.getElementById('btn-save-transf')?.addEventListener('click', async (e) => {
            e.preventDefault();
            const btn = e.target;
            try {
                btn.disabled = true;
                const prod = document.getElementById('transf-produto').value;
                const qtd = parseFloat(document.getElementById('transf-qtd').value);
                const orig = document.getElementById('transf-origem').value;
                const dest = document.getElementById('transf-destino').value;

                await Movements.registerMovement(prod, 'Transferencia', qtd, orig, dest, 'Transferência de estoque');
                this.showToast('Transferência realizada!');
                this.navigate('home');
            } catch(e) {
                this.showToast(e.message, 'error');
            } finally {
                btn.disabled = false;
            }
        });
        
        // Modal handlers
        document.querySelectorAll('.modal-overlay').forEach(m => {
            m.onclick = (e) => { if(e.target === m) m.classList.remove('active'); };
        });
        
        // Close buttons
        document.getElementById('btn-close-user-modal')?.addEventListener('click', () => document.getElementById('user-modal').classList.remove('active'));
        document.getElementById('btn-close-product-modal')?.addEventListener('click', () => document.getElementById('product-modal').classList.remove('active'));

        // Forms
        document.getElementById('user-form')?.addEventListener('submit', (e) => this.saveUser(e));
        document.getElementById('btn-save-product')?.addEventListener('click', (e) => this.saveProduct(e));

        // Setup triggers
        document.getElementById('btn-novo-usuario')?.addEventListener('click', () => {
            document.getElementById('usr-id').value = '';
            document.getElementById('user-form').reset();
            document.getElementById('user-modal-title').textContent = 'Novo Usuário';
            document.getElementById('user-modal').classList.add('active');
        });
        
        document.getElementById('btn-novo-produto')?.addEventListener('click', () => {
            document.getElementById('prod-id').value = '';
            // Reset manually to keep the form ID
            document.getElementById('prod-nome').value = '';
            document.getElementById('prod-categoria').value = '';
            document.getElementById('prod-volume').value = '';
            document.getElementById('prod-unidade').value = '';
            document.getElementById('prod-custo').value = '';
            document.getElementById('prod-min').value = '0';
            document.getElementById('prod-setor').value = 'Todos';
            document.getElementById('prod-imagem-base64').value = '';
            document.getElementById('prod-preview-img').src = '';
            document.getElementById('prod-placeholder').classList.remove('hidden');

            document.getElementById('product-modal-title').textContent = 'Novo Produto';
            document.getElementById('product-modal').classList.add('active');
            document.getElementById('btn-delete-product').classList.add('hidden');
        });

        // Image Handling (Product)
        document.getElementById('prod-imagem')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (re) => {
                const base64 = re.target.result;
                document.getElementById('prod-imagem-base64').value = base64;
                const preview = document.getElementById('prod-preview-img');
                preview.src = base64;
                preview.classList.remove('hidden');
                document.getElementById('prod-placeholder').classList.add('hidden');
            };
            reader.readAsDataURL(file);
        });

        // Image Handling (Movement/Loss)
        document.getElementById('mov-imagem')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (re) => {
                document.getElementById('mov-imagem-base64').value = re.target.result;
                const preview = document.getElementById('mov-preview-img');
                preview.src = re.target.result;
                preview.style.display = 'block';
                document.getElementById('mov-placeholder').style.display = 'none';
            };
            reader.readAsDataURL(file);
        });
    },

    setupSession() {
        const u = Auth.getCurrentUser();
        const userNameEl = document.getElementById('logged-user-name');
        if(userNameEl) userNameEl.textContent = `${u.nome} (${u.setor})`;

        document.querySelectorAll('[data-rbac]').forEach(el => {
            const req = el.getAttribute('data-rbac');
            el.style.display = Auth.hasPermission(req) ? '' : 'none';
        });
    },

    renderNotifications() {
        const content = document.getElementById('notif-list-content');
        if(!content) return;
        content.innerHTML = '';
        const user = Auth.getCurrentUser();
        if(!user) return;
        
        const frag = document.createDocumentFragment();
        Stock.getProducts().forEach(p => {
            const sBar = Stock.getProductStock(p.id_produto, 'Bar');
            const sDel = Stock.getProductStock(p.id_produto, 'Delivery');
            const q = (user.setor === 'Delivery') ? sDel : (user.setor === 'Bar' ? sBar : (sBar + sDel));
            const min = parseFloat(p.estoque_minimo);
            if (!isNaN(min) && q <= min) {
                const div = document.createElement('div');
                div.className = 'notif-item';
                div.onclick = () => this.navigate('estoque');
                div.innerHTML = `
                    <div class="notif-icon" style="background:var(--red-light); color:var(--red);"><i class="fa-solid fa-triangle-exclamation"></i></div>
                    <div class="notif-info"><span class="notif-name"></span><span class="notif-desc"></span></div>
                `;
                div.querySelector('.notif-name').textContent = p.nome_bebida;
                div.querySelector('.notif-desc').textContent = `Saldo baixo: ${q} ${p.unidade_medida}`;
                frag.appendChild(div);
            }
        });

        if (frag.children.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'notif-empty';
            empty.innerHTML = '<i class="fa-solid fa-bell-slash"></i><p>Nenhum alerta.</p>';
            content.appendChild(empty);
        } else {
            content.appendChild(frag);
        }
    },

    toggleNotifications(event) {
        if(event) event.stopPropagation();
        const panel = document.getElementById('notif-panel');
        if (panel) panel.classList.toggle('hidden');
    },

    forceCloudSync() {
        this.showToast('Recarregando e sincronizando sistema...', 'success');
        setTimeout(() => window.location.reload(), 1000);
    },

    openMovimentacao(tipo) {
        this.navigate('movimentacao');
        const titleEl = document.getElementById('mov-title');
        if(titleEl) {
            titleEl.textContent = tipo === 'Entrada' ? 'Entrada / Compra' : 'Saída / Quebra';
        }
        
        const rTipoList = document.querySelectorAll('input[name="mov_tipo"]');
        rTipoList.forEach(radio => {
            if (radio.value === (tipo === 'Entrada' ? 'Entrada' : 'Saída')) {
                radio.checked = true;
            }
        });

        // Toggle camera visibility if loss
        const camBlock = document.getElementById('mov-camera-block');
        if(camBlock) {
            camBlock.style.display = tipo === 'Ajuste Perda' ? 'block' : 'none';
        }
    },

    setEstoqueView(setor, btn) {
        this.currentEstoqueSector = setor;
        document.querySelectorAll('#estoque-tabs-container .tab-btn').forEach(b => b.classList.remove('active'));
        if(btn) btn.classList.add('active');
        if(window.Dashboard) window.Dashboard.renderEstoqueAtual();
    },

    customConfirm(msg) {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem;';
            const box = document.createElement('div');
            box.className = 'confirm-box';
            box.style.cssText = 'background:var(--surface-1);padding:1.5rem;border-radius:1rem;width:100%;max-width:320px;text-align:center;';
            const text = document.createElement('p'); text.textContent = msg;
            const group = document.createElement('div');
            group.style.cssText = 'display:flex;gap:0.75rem;margin-top:1.5rem;';
            const bC = document.createElement('button'); bC.textContent = 'Não'; bC.className = 'btn';
            const bO = document.createElement('button'); bO.textContent = 'Sim'; bO.className = 'btn btn-primary';
            bC.onclick = () => { overlay.remove(); resolve(false); };
            bO.onclick = () => { overlay.remove(); resolve(true); };
            group.appendChild(bC); group.appendChild(bO);
            box.appendChild(text); box.appendChild(group);
            overlay.appendChild(box); document.body.appendChild(overlay);
        });
    },

    // --- CONTABILIDADE / CONFERÊNCIA ---
    setupCountForm() {
        if(this.contagemAtiva) return this.setupActiveCount();
        const sel = document.getElementById('contagem-local');
        const user = Auth.getCurrentUser();
        sel.innerHTML = '';
        if(user.setor === 'Admin') sel.innerHTML = '<option value="Bar">Bar</option><option value="Delivery">Delivery</option>';
        else sel.innerHTML = `<option value="${user.setor}">${user.setor}</option>`;
        document.getElementById('contagem-data-ref').value = new Date().toISOString().split('T')[0];
    },

    setupActiveCount() {
        this.navigate('contagem-act');
        const label = document.getElementById('lbl-contagem-local');
        if(label) label.textContent = this.contagemAtiva.local;
        this.renderActiveCountList();
    },

    renderActiveCountList(search = "") {
        const lista = document.getElementById('lista-contagem');
        if(!lista) return;
        lista.innerHTML = '';
        const prods = Stock.getProducts().filter(p => p.ativo && (p.setor_padrao === 'Todos' || p.setor_padrao === this.contagemAtiva.local));
        const filtered = search ? prods.filter(p => p.nome_bebida.toLowerCase().includes(search)) : prods;

        const frag = document.createDocumentFragment();
        filtered.forEach(p => {
            const li = document.createElement('li');
            li.className = 'contagem-item';
            li.innerHTML = `
                <div class="p-info"><span class="p-name"></span><span class="p-sub"></span></div>
                <div class="p-actions">
                    <button class="calc-trigger" onclick="app.openCalculator('${p.id_produto}')"><i class="fa-solid fa-calculator"></i></button>
                    <div class="number-input">
                        <button onclick="app.updateCount(this, -1)"><i class="fa-solid fa-minus"></i></button>
                        <input type="number" class="input-contagem input-uncounted" id="input-contagem-${p.id_produto}" data-id="${p.id_produto}" value="0">
                        <button onclick="app.updateCount(this, 1)"><i class="fa-solid fa-plus"></i></button>
                    </div>
                </div>
            `;
            li.querySelector('.p-name').textContent = p.nome_bebida;
            li.querySelector('.p-sub').textContent = p.categoria;
            frag.appendChild(li);
        });
        lista.appendChild(frag);
        this.checkFinishCountStatus();
    },

    updateCount(btn, dir) {
        const input = btn.parentNode.querySelector('input');
        let val = parseFloat(input.value) || 0;
        input.value = Math.max(0, val + dir);
        this.markCounted(input);
    },

    markCounted(input) {
        input.classList.remove('input-uncounted');
        input.classList.add('input-counted');
        this.checkFinishCountStatus();
    },

    checkFinishCountStatus() {
        const uncounted = document.querySelectorAll('.input-contagem.input-uncounted').length;
        const btn = document.getElementById('btn-finish-contagem');
        if(btn) {
            btn.disabled = uncounted > 0;
            btn.textContent = uncounted > 0 ? `Faltam ${uncounted} ITENS` : 'PROCESSAR DIFERENÇAS';
        }
    },

    async processarContagem() {
        if(!await this.customConfirm('Deseja finalizar e processar os ajustes?')) return;
        const btn = document.getElementById('btn-finish-contagem');
        btn.disabled = true; btn.textContent = 'SALVANDO...';
        try {
            const inputs = document.querySelectorAll('.input-contagem');
            for(const input of inputs) {
                await Counting.saveItemCount(this.contagemAtiva.id_contagem, input.dataset.id, parseFloat(input.value)||0);
            }
            await Counting.finishCount(this.contagemAtiva.id_contagem);
            this.showToast('Contagem finalizada!');
            this.contagemAtiva = null;
            localStorage.removeItem('activeCountId');
            this.navigate('home');
        } catch(e) {
            this.showToast(e.message, 'error');
            this.checkFinishCountStatus();
        }
    },

    async cancelarContagem() {
        if (await this.customConfirm('Deseja cancelar a auditoria sem salvar as diferenças?')) {
            this.contagemAtiva = null;
            localStorage.removeItem('activeCountId');
            this.navigate('home');
            this.showToast('Auditoria cancelada.', 'success');
            
            // To prevent zombie data in db, could update status
            // Wait, there's no native cancel endpoint in basic storage, 
            // but just leaving it is fine or we can delete it.
        }
    },

    // --- FORMULARIOS ---
    setupMovForm() {
        const sel = document.getElementById('mov-produto');
        sel.innerHTML = '';
        Stock.getProducts().forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id_produto; opt.textContent = p.nome_bebida;
            sel.appendChild(opt);
        });
        const user = Auth.getCurrentUser();
        const loc = document.getElementById('mov-local');
        loc.innerHTML = '';
        if(user.setor === 'Admin') {
            loc.innerHTML = '<option value="Bar">Bar</option><option value="Delivery">Delivery</option>';
        } else {
            const opt = document.createElement('option'); opt.value = user.setor; opt.textContent = user.setor;
            loc.appendChild(opt);
        }
    },

    setupTransferForm() {
        const sel = document.getElementById('transf-produto');
        sel.innerHTML = '';
        Stock.getProducts().forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id_produto; opt.textContent = p.nome_bebida;
            sel.appendChild(opt);
        });
    },

    // --- ADMIN / USERS ---
    setupUserPanel() {
        if(!Auth.hasPermission('Admin')) return;
        const tb = document.getElementById('users-table-body');
        if(!tb) return;
        tb.innerHTML = '';
        const frag = document.createDocumentFragment();
        Users.getAll().forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><b></b></td><td>***</td><td class="u-setor"></td><td class="u-nivel"></td><td class="u-status"></td>
                <td><div class="td-actions"><button class="btn btn-edit bg-primary"><i class="fa-solid fa-pen"></i></button><button class="btn btn-toggle"></button></div></td>`;
            tr.querySelector('b').textContent = u.nome; tr.querySelector('.u-setor').textContent = u.setor;
            tr.querySelector('.u-nivel').textContent = u.nivel_acesso;
            tr.querySelector('.u-status').textContent = u.ativo ? 'Ativo' : 'Inativo';
            tr.querySelector('.btn-edit').onclick = () => this.editUser(u.id_usuario);
            const bt = tr.querySelector('.btn-toggle');
            bt.className = `btn ${u.ativo ? 'bg-danger' : 'bg-success'} text-white`;
            bt.innerHTML = u.ativo ? '<i class="fa-solid fa-ban"></i>' : '<i class="fa-solid fa-check"></i>';
            bt.onclick = () => this.toggleUser(u.id_usuario);
            frag.appendChild(tr);
        });
        tb.appendChild(frag);
    },

    editUser(id) {
        const u = Users.getAll().find(x => x.id_usuario === id);
        if(!u) return;
        document.getElementById('usr-id').value = u.id_usuario;
        document.getElementById('usr-nome').value = u.nome;
        document.getElementById('usr-pin').value = ''; 
        document.getElementById('usr-setor').value = u.setor;
        document.getElementById('usr-nivel').value = u.nivel_acesso;
        document.getElementById('user-modal-title').textContent = 'Editar Usuário';
        document.getElementById('user-modal').classList.add('active');
    },

    async saveUser(e) {
        if(e) e.preventDefault();
        const id = document.getElementById('usr-id').value;
        const nm = document.getElementById('usr-nome').value;
        const pin = document.getElementById('usr-pin').value;
        const set = document.getElementById('usr-setor').value;
        const niv = document.getElementById('usr-nivel').value;
        try {
            if (id) await Users.updateUser(id, nm, pin, set, niv);
            else {
                if(!pin || pin.length !== 4) throw new Error("PIN deve ter 4 dígitos");
                await Users.addUser(nm, pin, set, niv);
            }
            this.showToast('Usuário salvo!');
            document.getElementById('user-modal').classList.remove('active');
            this.setupUserPanel();
        } catch(e) { this.showToast(e.message, 'error'); }
    },

    toggleUser(id) {
        try {
            Users.toggleStatus(id);
            this.showToast('Status alterado');
            this.setupUserPanel();
        } catch(e) { this.showToast(e.message, 'error'); }
    },

    // --- PRODUTOS ---
    setupProductPanel() {
        if(!Auth.hasPermission('Admin')) return;
        const container = document.getElementById('products-list-container');
        if(!container) return;
        container.innerHTML = '';
        const frag = document.createDocumentFragment();
        Products.getAll().forEach(p => {
            const card = document.createElement('div');
            card.className = 'product-item-card';
            card.innerHTML = `
                <div class="p-img"></div>
                <div class="p-details"><span class="p-name"></span><span class="p-sub"></span></div>
                <div class="p-actions">
                    <button class="btn bg-primary text-white btn-edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn bg-dark text-white btn-stock"><i class="fa-solid fa-boxes-stacked"></i></button>
                </div>
            `;
            if(p.imagem) { const img = document.createElement('img'); img.src = p.imagem; card.querySelector('.p-img').appendChild(img); }
            card.querySelector('.p-name').textContent = p.nome_bebida;
            card.querySelector('.p-sub').textContent = `${p.categoria} | R$ ${p.custo_unitario}`;
            
            card.querySelector('.btn-edit').onclick = () => this.editProduct(p.id_produto);
            card.querySelector('.btn-stock').onclick = () => this.openInitialStockModal(p.id_produto);
            
            frag.appendChild(card);
        });
        container.appendChild(frag);
    },

    editProduct(id) {
        const p = Products.getAll().find(x => x.id_produto === id);
        if(!p) return;
        document.getElementById('prod-id').value = p.id_produto;
        document.getElementById('prod-nome').value = p.nome_bebida;
        document.getElementById('prod-categoria').value = p.categoria;
        document.getElementById('prod-volume').value = p.volume_padrao || '';
        document.getElementById('prod-unidade').value = p.unidade_medida;
        document.getElementById('prod-custo').value = p.custo_unitario;
        document.getElementById('prod-min').value = p.estoque_minimo;
        document.getElementById('prod-setor').value = p.setor_padrao;
        document.getElementById('prod-imagem-base64').value = p.imagem || '';
        const preview = document.getElementById('prod-preview-img');
        if(p.imagem) {
            preview.src = p.imagem; preview.classList.remove('hidden');
            document.getElementById('prod-placeholder').classList.add('hidden');
        } else {
            preview.classList.add('hidden');
            document.getElementById('prod-placeholder').classList.remove('hidden');
        }

        document.getElementById('product-modal-title').textContent = 'Editar Produto';
        document.getElementById('product-modal').classList.add('active');
        document.getElementById('btn-delete-product').classList.remove('hidden');
        document.getElementById('btn-delete-product').onclick = () => this.deleteProduct(id);
    },

    async saveProduct(e) {
        if(e) e.preventDefault();
        const id = document.getElementById('prod-id').value;
        const nm = document.getElementById('prod-nome').value;
        const cat = document.getElementById('prod-categoria').value;
        const un = document.getElementById('prod-unidade').value;
        const vol = document.getElementById('prod-volume') ? document.getElementById('prod-volume').value : '';
        const custRaw = document.getElementById('prod-custo').value || "0";
        const cust = custRaw.replace(',','.');
        const min = document.getElementById('prod-min').value;
        const set = document.getElementById('prod-setor').value;
        const img = document.getElementById('prod-imagem-base64').value;

        try {
            if (id) await Products.updateProduct(id, nm, cat, un, null, cust, min, set, true, img);
            else await Products.addProduct(nm, cat, un, null, cust, min, set, true, img);
            this.showToast('Produto salvo!');
            document.getElementById('product-modal').classList.remove('active');
            this.setupProductPanel();
        } catch(ex) { this.showToast(ex.message, 'error'); }
    },

    async deleteProduct(id) {
        if (!await this.customConfirm('Excluir este produto permanentemente?')) return;
        try {
            await Products.deleteProduct(id);
            this.showToast('Produto excluído');
            document.getElementById('product-modal').classList.remove('active');
            this.setupProductPanel();
        } catch(e) { this.showToast(e.message, 'error'); }
    },

    async openInitialStockModal(id) {
        const { value: formValues } = await Swal.fire({
            title: 'Carga Inicial de Estoque',
            html: `
                <div style="text-align: left;">
                    <label>Setor de Destino:</label>
                    <select id="swal-setor" class="swal2-input" style="margin: 0.5rem 0; width: 100%;">
                        <option value="Bar">Bar</option>
                        <option value="Delivery">Delivery</option>
                    </select>
                    <label>Quantidade:</label>
                    <input id="swal-qtd" type="number" class="swal2-input" style="margin: 0.5rem 0; width: 100%;" placeholder="Qtd">
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            preConfirm: () => ({
                setor: document.getElementById('swal-setor').value,
                qtd: document.getElementById('swal-qtd').value
            })
        });

        if (formValues) {
            try {
                await Movements.registerMovement(id, 'Carga Inicial', formValues.qtd, formValues.setor, null, 'Implantação');
                this.showToast('Sucesso!');
                Dashboard.renderHome();
            } catch(e) { this.showToast(e.message, 'error'); }
        }
    },

    // --- CALCULADORA ---
    openCalculator(target) {
        this.calcTarget = target;
        document.getElementById('calc-display').textContent = '0';
        document.getElementById('calc-modal').classList.add('active');
    },
    calcAppend(v) {
        const d = document.getElementById('calc-display');
        if(d.textContent === '0') d.textContent = v; else d.textContent += v;
    },
    calcClear() { document.getElementById('calc-display').textContent = '0'; },
    calcEqual() {
        try {
            const exp = document.getElementById('calc-display').textContent.replace('X','*');
            document.getElementById('calc-display').textContent = eval(exp);
        } catch(e) { this.showToast('Erro no cálculo', 'error'); }
    },
    calcApply() {
        this.calcEqual();
        const res = document.getElementById('calc-display').textContent;
        const input = document.getElementById(`input-contagem-${this.calcTarget}`);
        if(input) { input.value = res; this.markCounted(input); }
        document.getElementById('calc-modal').classList.remove('active');
    },

    closeCalculator() {
        document.getElementById('calc-modal').classList.remove('active');
    },

    setupAdminPanel() {
        const container = document.getElementById('admin-audit-list');
        if (!container) return;
        const logs = Audit.getLogs();
        if (!logs.length) {
            container.innerHTML = '<p style="padding:1rem; color: var(--text-3);">Nenhum registro de auditoria encontrado.</p>';
            return;
        }
        container.innerHTML = logs.map(l => {
            const data = Utils.formatDate(l.data_evento);
            return `<div style="padding:0.6rem 1rem; border-bottom:1px solid var(--border); font-size:0.82rem;">
                <span style="font-weight:600">${_esc(l.usuario)}</span>
                <span style="color:var(--text-3); margin: 0 0.4rem">·</span>
                <span style="color:var(--text-3)">${data}</span>
                <span style="margin: 0 0.4rem; background:var(--green-100); color:var(--green-900); border-radius:4px; padding:1px 6px; font-size:0.75rem">${_esc(l.acao)}</span>
                <span>${_esc(l.detalhes)}</span>
            </div>`;
        }).join('');
    },

    renderMeuHistorico() {
        const user = Auth.getCurrentUser();
        if(!user) return;
        const container = document.getElementById('lista-meu-historico');
        if(!container) return;
        container.innerHTML = '';
        const limit = new Date(); limit.setDate(limit.getDate() - 7);

        const contagens = Store.getTable('contagem_estoque')
            .filter(c => c.operador === user.id_usuario && new Date(c.data_inicio) >= limit)
            .map(c => ({ ...c, _tipo: 'contagem', _data: c.data_inicio }));

        const pedidos = Store.getTable('pedidos_compra')
            .filter(p => p.usuario_solicitante === user.id_usuario && new Date(p.data_pedido) >= limit);
        // Agrupa pedidos por id_grupo para não repetir
        const gruposVistos = new Set();
        const pedidosUnicos = pedidos.filter(p => {
            const key = p.id_grupo || p.id_pedido;
            if (gruposVistos.has(key)) return false;
            gruposVistos.add(key);
            return true;
        }).map(p => ({ ...p, _tipo: 'pedido', _data: p.data_pedido }));

        const hist = [...contagens, ...pedidosUnicos]
            .sort((a, b) => new Date(b._data) - new Date(a._data));

        const emptyEl = document.getElementById('empty-meu-historico');

        if (hist.length === 0) {
            if (emptyEl) emptyEl.classList.remove('hidden');
            return;
        }
        if (emptyEl) emptyEl.classList.add('hidden');

        const frag = document.createDocumentFragment();
        hist.forEach(item => {
            const li = document.createElement('li');
            li.className = 'list-item';
            const isCount = item._tipo === 'contagem';
            const statusClass = (item.status === 'Aberta' || item.status === 'Pendente') ? 'bg-warning' : 'bg-success';
            const icon = isCount ? 'fa-clipboard-check' : 'fa-file-signature';
            const titulo = isCount
                ? `Contagem ${item.local}`
                : `Pedido #${(item.id_grupo || item.id_pedido || '').substring(0,6).toUpperCase()}`;
            li.innerHTML = `
                <div style="display:flex;align-items:center;gap:0.75rem;flex:1;">
                    <div style="width:36px;height:36px;border-radius:10px;background:var(--surface-2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <i class="fa-solid ${icon}" style="color:var(--primary);font-size:0.9rem;"></i>
                    </div>
                    <div style="flex:1;">
                        <span class="item-name" style="display:block;"></span>
                        <small class="item-sub"></small>
                    </div>
                    <span class="badge ${statusClass}"></span>
                </div>`;
            li.querySelector('.item-name').textContent = titulo;
            li.querySelector('.item-sub').textContent = Utils.formatDate(item._data);
            li.querySelector('.badge').textContent = item.status;
            frag.appendChild(li);
        });
        container.appendChild(frag);
    },

    async resetData(type) {
        if (!await this.customConfirm('ATENÇÃO: Deseja realmente excluir permanentemente estes dados? Esta ação não pode ser desfeita!')) return;
        
        try {
            if (type === 'movements') {
                if(Store.wipe) await Store.wipe('movements');
            } else if (type === 'all') {
                if(Store.wipe) await Store.wipe('all');
            }
            this.showToast('Dados apagados com sucesso.', 'success');
            setTimeout(() => window.location.reload(), 1000);
        } catch(e) {
            this.showToast('Erro ao remover dados: ' + e.message, 'error');
        }
    },

    handleBackupImport(inputObj) {
        const file = inputObj.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                if(window.Store && typeof Store.importBackup === 'function') {
                    await Store.importBackup(e.target.result);
                } else {
                    const data = JSON.parse(e.target.result);
                    if (data.produtos) {
                        Object.keys(data).forEach(k => {
                            localStorage.setItem(`appBebidas_${k}`, JSON.stringify(data[k]));
                        });
                    }
                }
                this.showToast('Backup restaurado com sucesso!', 'success');
                setTimeout(() => window.location.reload(), 1500);
            } catch (err) {
                this.showToast('Falha na restauração do backup. Erro: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    }
};

window.app = app;
document.addEventListener('DOMContentLoaded', () => {
    Store.init(() => app.init());
});
