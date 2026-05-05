# APPCONTAGEM — Controle de Bebidas (Pizza do Fábio)

## Visão Geral
ERP operacional de controle de estoque de bebidas. Gerencia entradas, saídas, perdas, transferências Bar↔Delivery, contagem física e relatórios.

## Stack Tecnológica
- **Mobile**: React Native (Expo managed) + TypeScript
- **State/Requests**: Redux Toolkit + RTK Query (baseApi com autocache)
- **Backend**: Node.js + TypeScript + Express 5
- **ORM**: Prisma (PostgreSQL)
- **Auth**: JWT (PIN + biometria)
- **Build**: EAS Build

## Estrutura de Módulos (Backend)
```
backend/src/modules/<nome>/
├── <nome>.routes.ts
├── <nome>.controller.ts
└── <nome>.service.ts
```
Módulos: auth, usuarios, produtos, estoque, movimentacoes, contagem, pedidos, relatorios, cmv

## Mapa de Telas (Mobile)
| Tela | Arquivo | Função |
|---|---|---|
| Login | Login/LoginScreen.tsx | PIN + biometria |
| Home | Home/HomeScreen.tsx | Dashboard KPIs + ações rápidas |
| Estoque | Estoque/EstoqueScreen.tsx | Estoque por local (Bar/Delivery) |
| Movimentação | Movimentacao/MovimentacaoScreen.tsx | Entrada / Saída / Perda |
| Transferência | Transferencia/TransferenciaScreen.tsx | Bar ↔ Delivery |
| Contagem | Contagem/ContagemScreen.tsx | Iniciar/histórico de contagens |
| Contagem Ativa | Contagem/ContagemAtivaScreen.tsx | Contagem item a item |
| Pedidos | Pedidos/PedidosScreen.tsx | Solicitações de compra |
| Relatórios | Relatorios/RelatoriosScreen.tsx | KPIs + divergências com filtro de período |
| Admin | Admin/AdminScreen.tsx | Aprovações de perda (Supervisor+) |
| Usuários | Usuarios/UsuariosScreen.tsx | CRUD usuários (Admin) |
| Produtos | Produtos/ProdutosScreen.tsx | CRUD produtos (Admin) |
| Mais | Mais/MaisScreen.tsx | Menu + perfil + logout |

## Mapa de Services RTK Query (Mobile)
| Service | Arquivo |
|---|---|
| Estoque | services/api/estoque.ts |
| Movimentações | services/api/movimentacoes.ts |
| Contagem | services/api/contagem.ts |
| Produtos | services/api/produtos.ts |
| Pedidos | services/api/pedidos.ts |
| Relatórios | services/api/relatorios.ts |
| Usuários | services/api/usuarios.ts |

## API Base URL
Configurada em `mobile/src/config/api.ts` via `EXPO_PUBLIC_API_URL`.
Default dev: `http://192.168.15.164:3333/api/v1`

## Endpoint CMV (para integração com CMV APP)
`GET /api/v1/cmv?dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD`
Retorna CMV de bebidas por categoria: EI, Entradas, EF, CMV, Perdas.

## Comandos
```bash
# Backend
cd backend && npm run dev          # Hot reload
cd backend && npm run prisma:studio # Interface visual do banco
cd backend && npm run prisma:migrate # Migrations

# Mobile
cd mobile && npx expo start        # Dev server
```

## Padrões de Código
- Importações com extensão `.js` no backend (ESM)
- Respostas sempre JSON
- Erros passam pelo middleware `errorHandler`
- Peso/quantidade usam number (não string)
- IDs são UUID v4

## 🚀 Economia de Tokens
- NUNCA reescreva arquivo inteiro — use edições cirúrgicas
- NUNCA reescreva StyleSheet se só alterou lógica
- Peça apenas os arquivos necessários para a tarefa
