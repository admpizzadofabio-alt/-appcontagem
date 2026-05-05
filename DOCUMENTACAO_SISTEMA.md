# APPCONTAGEM — Documentação do Sistema
### Pizza do Fábio · Controle de Estoque de Bebidas

**Versão:** 2.0  
**Última atualização:** Maio 2026

---

## 1. Visão Geral

O APPCONTAGEM é um ERP operacional mobile-first desenvolvido para controlar o estoque de bebidas do bar "Pizza do Fábio". O sistema cobre o ciclo completo: contagem inicial de turno, movimentações durante o dia, rastreamento de divergências e painel administrativo anti-furto.

### Problemas que resolve
- **Furto e desvio:** contagem cega obrigatória ao abrir o caixa revela discrepâncias antes de o turno começar
- **Erros de comanda:** produto servido diferente do comandado fica documentado com foto
- **Entradas não rastreadas:** sobras detectadas na contagem geram rascunho que o Admin precisa aprovar
- **Duplicidade de entradas:** sistema bloqueia entrada idêntica nas últimas 24h e avisa sobre entradas diferentes
- **Falta de rastreio:** toda movimentação tem responsável, horário e — quando exigido — foto comprovante

---

## 2. Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Mobile | React Native + Expo (managed workflow) |
| Linguagem | TypeScript |
| Estado / API | Redux Toolkit + RTK Query |
| Backend | Node.js + Express 5 |
| ORM | Prisma |
| Banco de dados | PostgreSQL |
| Autenticação | JWT (access token 1 dia + refresh token 30 dias) |
| Login | PIN numérico + biometria (Face ID / digital) |
| Build mobile | EAS Build |
| PDV externo | Colibri Cloud POS (integração via API OAuth) |

---

## 3. Arquitetura

```
APPCONTAGEM/
├── backend/                  # API Node.js
│   ├── prisma/
│   │   └── schema.prisma     # Modelos do banco de dados
│   ├── src/
│   │   ├── config/           # Env, logger, prisma, swagger
│   │   ├── middlewares/      # auth, error-handler
│   │   ├── modules/          # Módulos de negócio (ver seção 4)
│   │   └── shared/           # diaOperacional, jobs, errors
│   └── .env                  # Variáveis de ambiente
│
└── mobile/                   # App React Native
    └── src/
        ├── config/           # URL da API
        ├── contexts/         # AuthContext
        ├── navigation/       # Rotas (Stack + Tab)
        ├── screens/          # Telas (ver seção 6)
        ├── services/api/     # RTK Query endpoints
        ├── store/            # Redux store
        └── theme/            # colors.ts
```

---

## 4. Módulos do Backend

### 4.1 Auth (`/api/v1/auth`)
| Endpoint | Descrição |
|---|---|
| `POST /login` | Login com PIN, retorna access + refresh token |
| `POST /refresh` | Renova access token via refresh token |
| `POST /logout` | Invalida refresh token |

### 4.2 Usuários (`/api/v1/usuarios`)
| Endpoint | Nível | Descrição |
|---|---|---|
| `GET /` | Admin | Lista todos os usuários |
| `POST /` | Admin | Cria usuário |
| `PUT /:id` | Admin | Atualiza usuário |
| `DELETE /:id` | Admin | Desativa usuário |

**Níveis de acesso:** `Operador` → `Supervisor` → `Admin`

### 4.3 Produtos (`/api/v1/produtos`)
| Endpoint | Nível | Descrição |
|---|---|---|
| `GET /` | Todos | Lista produtos (filtro `?ativo=true`) |
| `POST /` | Admin | Cria produto |
| `PUT /:id` | Admin | Atualiza produto |
| `DELETE /:id` | Admin | Desativa produto (soft delete) |
| `DELETE /:id/fisico` | Admin | Exclui produto permanentemente (só se sem histórico) |

### 4.4 Estoque (`/api/v1/estoque`)
| Endpoint | Descrição |
|---|---|
| `GET /` | Estoque atual por local (Bar / Delivery) |
| `GET /summary` | Resumo: valor total, alertas de estoque mínimo |
| `GET /alertas` | Produtos abaixo do estoque mínimo |

### 4.5 Movimentações (`/api/v1/movimentacoes`)
| Endpoint | Nível | Descrição |
|---|---|---|
| `GET /` | Todos | Histórico de movimentações |
| `POST /` | Todos | Registra movimentação (Entrada / Saída / Perda / Transferência) |
| `GET /pendentes` | Supervisor+ | Lista perdas aguardando aprovação |
| `POST /:id/aprovar` | Supervisor+ | Aprova perda |
| `POST /:id/rejeitar` | Supervisor+ | Rejeita perda com motivo |

**Tipos de movimentação:** `Entrada`, `Saida`, `Transferencia`, `AjustePerda`, `AjusteContagem`, `CargaInicial`

**Anti-duplicação de entradas:**
- `POST /turnos/verificar-entrada` — verifica últimas 24h para o mesmo produto
- Quantidade idêntica → **bloqueio absoluto**
- Quantidade diferente → **aviso** com lista de entradas recentes

### 4.6 Turnos (`/api/v1/turnos`)
| Endpoint | Nível | Descrição |
|---|---|---|
| `GET /atual?local=Bar` | Todos | Turno aberto do local |
| `POST /abrir` | Todos | Abre turno + cria contagem automática |
| `GET /historico` | Todos | Histórico de turnos (últimos 30) |
| `GET /dashboard` | Admin+ | Métricas anti-furto (14 dias) |
| `GET /contagem/:id` | Todos | Detalhes da contagem |
| `POST /contagem/:id/item` | Todos | Registra quantidade contada de um item |
| `POST /contagem/:id/foto` | Todos | Registra foto + justificativa de divergência grande |
| `POST /contagem/:id/finalizar` | Todos | Finaliza contagem e aplica ajustes |
| `POST /contagem/:id/rascunho` | Todos | Cria rascunho de entrada para sobra detectada |
| `GET /rascunhos/pendentes` | Admin | Lista rascunhos aguardando decisão |
| `POST /rascunhos/:id/decidir` | Admin | Aprova / Rejeita rascunho |

### 4.7 Correções de Venda (`/api/v1/correcoes`)
| Endpoint | Nível | Descrição |
|---|---|---|
| `POST /` | Todos | Registra erro de comanda (produto A comandado, produto B servido) |
| `GET /` | Admin+ | Lista correções com filtros |

### 4.8 Pedidos de Compra (`/api/v1/pedidos`)
| Endpoint | Nível | Descrição |
|---|---|---|
| `GET /` | Todos | Lista pedidos |
| `POST /` | Todos | Cria pedido de compra |
| `PUT /:id` | Admin | Edita pedido (nome, quantidade, obs, urgente) |
| `DELETE /:id` | Admin | Exclui pedido |
| `POST /:id/atender` | Admin | Marca pedido como atendido |

### 4.9 Relatórios (`/api/v1/relatorios`)
| Endpoint | Descrição |
|---|---|
| `GET /dashboard` | KPIs gerais com filtro de período |
| `GET /divergencias` | Divergências por turno/período |
| `GET /movimentacoes` | Histórico detalhado com filtros |

### 4.10 CMV (`/api/v1/cmv`)
| Endpoint | Descrição |
|---|---|
| `GET /?dataInicio=&dataFim=` | CMV por categoria: EI, Entradas, EF, CMV, Perdas |

### 4.11 Colibri POS (`/api/v1/colibri`)
| Endpoint | Nível | Descrição |
|---|---|---|
| `GET /catalogo` | Admin | Catálogo de bebidas do Colibri (últimos 30 dias de vendas) |
| `POST /sincronizar` | Admin | Sincroniza produtos Colibri com produtos do sistema |
| `GET /mapeamentos` | Admin | Lista mapeamentos Colibri ↔ Produto interno |
| `POST /importar` | Admin | Importa vendas do Colibri como Saídas de estoque |

---

## 5. Modelos do Banco de Dados

### Principais modelos

| Modelo | Descrição |
|---|---|
| `Usuario` | Operadores do sistema com nível de acesso |
| `Produto` | Bebidas cadastradas (nome, categoria, custo, estoque mínimo) |
| `EstoqueAtual` | Quantidade atual por produto e local |
| `MovimentacaoEstoque` | Todas as movimentações (entrada, saída, perda, ajuste) |
| `FechamentoTurno` | Registro de cada turno (Bar/Delivery) com abertura e fechamento |
| `ContagemEstoque` | Contagem física vinculada a um turno |
| `ItemContagem` | Item individual da contagem (esperado vs. contado) |
| `EntradaRascunho` | Sobra detectada na contagem aguardando aprovação Admin |
| `CorrecaoVenda` | Registro de erro de comanda com foto comprovante |
| `PedidoCompra` | Solicitações de compra de produtos |
| `ColibriProduto` | Mapeamento entre produto Colibri e produto interno |
| `ColibriCatalogo` | Cache do catálogo de bebidas do Colibri |
| `AprovacaoMovimentacao` | Aprovações de perdas por Supervisor/Admin |
| `LogAuditoria` | Trilha de auditoria de ações críticas |

### Conceito de Dia Operacional

O sistema usa o conceito de **dia operacional** para agrupar movimentações do turno corretamente:

- O turno começa às **17:00** (`HORARIO_INICIO_TURNO`)
- Movimentações **antes das 17:00** pertencem ao dia operacional **anterior**
- Movimentações **a partir das 17:00** pertencem ao dia operacional **atual**
- O sistema fecha turnos abertos automaticamente às **04:00** (`HORARIO_FECHAMENTO_AUTO`)

---

## 6. Telas do Mobile

### Navegação por abas (Tab Navigator)
| Aba | Ícone | Tela | Descrição |
|---|---|---|---|
| Início | 🏠 | HomeScreen | Dashboard com KPIs, ações rápidas e botão Abrir Caixa |
| Estoque | 📦 | EstoqueScreen | Estoque atual por local com alertas |
| Contagem | 📋 | ContagemScreen | Histórico de contagens |
| Requisições | 🔗 | RequisicoesScreen | **Em desenvolvimento** — futuras requisições de outros apps |
| Mais | ☰ | MaisScreen | Menu, perfil e logout |

### Telas de Stack (navegação por ação)
| Tela | Arquivo | Acesso | Descrição |
|---|---|---|---|
| AbrirCaixa | Turno/AbrirCaixaScreen | Todos | Seletor de local + iniciar/continuar contagem |
| ContagemTurno | Turno/ContagemTurnoScreen | Todos | Contagem item a item (modo cego) |
| ResumoContagem | Turno/ResumoContagemScreen | Todos | Resumo com OK/leve/grande + finalizar |
| ErroComanda | Turno/ErroComandaScreen | Todos | Registro de produto servido ≠ comanda |
| Movimentacao | Movimentacao/MovimentacaoScreen | Todos | Entrada / Perda de estoque |
| Transferencia | Transferencia/TransferenciaScreen | Todos | Transferência Bar ↔ Delivery |
| Pedidos | Pedidos/PedidosScreen | Todos | Pedidos de compra |
| Relatorios | Relatorios/RelatoriosScreen | Todos | KPIs e divergências |
| Admin | Admin/AdminScreen | Supervisor+ | 4 abas: Rascunhos / Perdas / Comandas / Métricas |
| Usuarios | Usuarios/UsuariosScreen | Admin | CRUD de usuários |
| Produtos | Produtos/ProdutosScreen | Admin | CRUD de produtos |
| Colibri | Colibri/ColibriScreen | Admin | Integração com Colibri POS |

---

## 7. Regras de Negócio

### 7.1 Contagem de Turno (Anti-Furto)

**Fluxo obrigatório:**
1. Operador chega, abre o caixa → sistema cria contagem automática
2. Contagem **modo cego**: operador não vê a quantidade esperada
3. Operador conta produto por produto e digita a quantidade real
4. Sistema compara com o estoque registrado e categoriza:

| Categoria | Critério | Ação |
|---|---|---|
| **OK** | Diferença = 0 | Nenhuma ação |
| **Leve** | Diferença ≤ `max(2 unidades, 5% do esperado)` | Ajuste automático do estoque |
| **Grande** | Diferença > limite | Foto + justificativa obrigatórios, Admin decide |

5. Para **sobras grandes** (produto a mais que o esperado): operador pode criar um **Rascunho de Entrada** com origem e foto → Admin aprova ou rejeita

### 7.2 Anti-Duplicação de Entradas

Antes de registrar qualquer Entrada, o sistema verifica as últimas 24 horas:

| Situação | Ação |
|---|---|
| Sem entradas recentes | Permite normalmente |
| Entrada diferente encontrada | Exibe **aviso** com histórico, operador decide confirmar ou cancelar |
| Entrada com **quantidade idêntica** | **Bloqueio absoluto** — operador não pode prosseguir |

### 7.3 Perda de Estoque

- Perdas acima do limite configurado (`PERDA_THRESHOLD`, padrão 5 unidades) exigem aprovação de Supervisor ou Admin
- Aprovação ou rejeição fica registrada com nome e horário do aprovador

### 7.4 Erro de Comanda

Quando um produto diferente do comandado é servido:
1. Operador acessa **Erro de Comanda** durante o turno
2. Seleciona: produto na comanda (errado) + produto servido (certo)
3. Tira foto da comanda como comprovante
4. Sistema debita automaticamente o produto realmente servido do estoque
5. Registro fica disponível para o Admin no painel anti-furto

### 7.5 Fechamento Automático de Turno

- Cron job verifica a cada 30 minutos
- Às **04:00**, todos os turnos abertos são fechados automaticamente
- Turnos sem contagem ficam marcados como `fechadoSemContagem = true` (flag de alerta)
- Na inicialização do servidor, turnos abertos há mais de 24h também são fechados

---

## 8. Variáveis de Ambiente (Backend)

```env
# Banco de dados
DATABASE_URL=postgresql://user:pass@host:5432/appcontagem

# Segurança
JWT_SECRET=mínimo 32 caracteres
JWT_REFRESH_SECRET=mínimo 32 caracteres
JWT_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=30d

# Servidor
PORT=3333
API_PREFIX=/api/v1
CORS_ORIGIN=http://192.168.15.164:8081

# Regras de negócio
HORARIO_INICIO_TURNO=17       # Hora que começa o dia operacional
HORARIO_FECHAMENTO_AUTO=4     # Hora do fechamento automático de turnos
DIVERGENCIA_LEVE_UNIDADES=2   # Limite leve em unidades absolutas
DIVERGENCIA_LEVE_PERCENT=5    # Limite leve em % do esperado
PERDA_THRESHOLD=5             # Perdas acima desse valor exigem aprovação

# Colibri POS
COLIBRI_BASE_URL=https://cloud.colibricloud.com
COLIBRI_CLIENT_ID=seu-client-id
COLIBRI_STORE_ID=seu-store-id
```

---

## 9. Comandos

```bash
# Backend
cd backend
npm run dev              # Inicia em modo desenvolvimento (hot reload)
npm run prisma:studio    # Interface visual do banco de dados
npm run prisma:migrate   # Cria e aplica migrations
npx prisma db push       # Aplica schema sem migration (desenvolvimento)
npx prisma generate      # Regenera o cliente Prisma (após mudanças no schema)

# Mobile
cd mobile
npx expo start           # Inicia servidor de desenvolvimento
npx expo start --tunnel  # Via túnel (quando na mesma rede não funciona)
eas build --platform android --profile preview  # Build de testes
```

---

## 10. Integração Colibri POS

O Colibri é o sistema de PDV (ponto de venda) do bar. A integração:

1. **Autenticação:** `GET /oauth/authenticate?client_id=XXX` — token válido por 15 minutos, renovado automaticamente aos 13 minutos
2. **Catálogo:** não há endpoint dedicado — o sistema deduplica as vendas dos últimos 30 dias filtradas pelos grupos de bebidas para montar o catálogo
3. **Importação de vendas:** `GET /api/v1/itemvenda` com paginação — cria Saídas de estoque para cada bebida vendida
4. **Grupos de bebidas:** filtro por grupo de produto no Colibri para ignorar alimentos e outros itens

**Grupos sincronizados:** Cervejas, Drinks, Refrigerantes, Sucos, Águas, Destilados, Vinhos, Espumantes, Energéticos e afins.

---

## 11. Plano de Deploy (VPS Hostinger)

- **Servidor:** VPS Linux na Hostinger
- **Processo:** PM2 com restart automático
- **Proxy reverso:** Nginx
- **SSL:** Certbot (Let's Encrypt)
- **Banco:** PostgreSQL instalado no mesmo servidor ou instância externa
- **Mobile:** build via EAS Build (APK para Android)

---

## 12. Segurança Implementada

| Mecanismo | Status | Detalhe |
|---|---|---|
| PIN com bcrypt + migração automática | ✅ | Plaintext/sha256 migram para bcrypt no primeiro login |
| Tokens em SecureStore | ✅ | Não usa AsyncStorage (não criptografado) |
| Refresh token com rotação | ✅ | Token antigo invalidado a cada renovação |
| Access token de 1 hora | ✅ | Reduzido de 24h para minimizar janela de abuso |
| Rate limit no login | ✅ | 10 tentativas / 15 minutos por IP |
| Lockout após 5 falhas | ✅ | Conta bloqueada por 15 minutos |
| Modo cego protegido | ✅ | Endpoint `/cega` omite `quantidadeSistema` do payload |
| Validação de imagens | ✅ | Verifica Magic Bytes (JPEG/PNG), máximo 900KB |
| Fotos mascaradas nos logs | ✅ | Base64 substituído por `[IMAGEM_OMITIDA]` no log |
| Transações atômicas | ✅ | Movimentações, correções e rascunhos em `$transaction` |
| Auto-aprovação bloqueada | ✅ | Supervisor não pode aprovar sua própria solicitação |
| Auditoria de turno | ✅ | Log de abertura de turno registrado |
| Auditoria de correções | ✅ | Erros de comanda registrados no LogAuditoria |
| IP interno removido do APK | ✅ | `EXPO_PUBLIC_API_URL` obrigatória, sem fallback hardcoded |
| `.gitignore` no backend | ✅ | `.env` e `dist/` ignorados |
| Zod para validação de input | ✅ | Todos os endpoints validados |
| Helmet (headers de segurança) | ✅ | CSP, HSTS, X-Frame-Options ativos |
| CORS configurado | ✅ | Origens explícitas via variável de ambiente |

---

## 13. Funcionalidades Em Desenvolvimento

| Feature | Status | Descrição |
|---|---|---|
| Requisições de Estoque | 🚧 Em desenvolvimento | Receber pedidos de outro aplicativo integrado |
| Reconciliação Colibri | 🔜 Planejado | Cruzar erros de comanda com vendas importadas |
| Alertas Telegram | 🔜 Planejado | Notificar Admin sobre eventos críticos |
| Padrão de divergências | 🔜 Planejado | Detecção automática de padrões suspeitos por operador |
