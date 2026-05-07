# Security Findings — APPCONTAGEM

> Documento de registro de vulnerabilidades encontradas e corrigidas.
> Serve como referência e template para auditorias em outros projetos.

---

## Template de Registro

Cada finding segue o formato:

```
ID        : VULN-NNN
Título    : Descrição curta
Severidade: Critical / High / Medium / Low
OWASP     : Categoria (ex: API1:2023)
Status    : Open / Fixed / Accepted Risk
```

---

## VULN-001 — BOLA: Falta de verificação de propriedade nas rotas de contagem

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-001 |
| **Título** | Broken Object Level Authorization nas rotas mutantes de `contagemEstoque` |
| **Severidade** | **High** |
| **OWASP**  | [API1:2023 — Broken Object Level Authorization (BOLA / IDOR)](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/) |
| **Status** | Fixed — 2026-05-07 |
| **Fonte** | Gecko Security — scan automatizado |

### CVSS 3.1

| Métrica | Valor | Justificativa |
|---------|-------|---------------|
| Attack Vector | **N** Network | Endpoint HTTP acessível por qualquer cliente de rede |
| Attack Complexity | **L** Low | Requer apenas JWT válido + ID da contagem (obtível via listagem) |
| Attack Requirements | **N** None | Ativo na configuração padrão, sem feature flag |
| Privileges Required | **L** Low | Qualquer papel incluindo `Operador` alcança a rota |
| User Interaction | **N** None | Nenhuma interação da vítima necessária |
| Confidentiality | **L** Low | Expõe metadados da contagem alheia (produtos, divergências) |
| Integrity | **H** High | Sobrescreve `estoqueAtual` e injeta registros falsos em `movimentacaoEstoque` |
| Availability | **L** Low | Encerra sessões de contagem de outros operadores prematuramente |

**Score estimado: ~7.1 (High)** — `AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:H/A:L`

### Descrição

As três rotas mutantes de contagem aceitam um `id` de recurso via path param mas **não verificam se o operador autenticado é o dono** daquela contagem. Qualquer operador com JWT válido pode manipular a contagem de outro operador.

### Pré-requisitos para exploração

- Conta de operador válida (JWT de qualquer nível, incluindo `Operador` comum)
- ID da contagem alvo — obtível via `GET /api/v1/contagem` (endpoint de listagem sem filtro de dono) ou `GET /api/v1/contagem/:id`

### Rotas afetadas

| Método | Rota | Handler | Impacto |
|--------|------|---------|---------|
| `PATCH` | `/api/v1/contagem/:id/item` | `salvarItemHandler` | Falsificar quantidades de itens contados |
| `POST` | `/api/v1/contagem/:id/processar` | `processarHandler` | Fechar contagem alheia e sobrescrever estoque (`estoqueAtual`) |
| `DELETE` | `/api/v1/contagem/:id` | `cancelarHandler` | Cancelar/deletar contagem alheia |

### Causa Raiz

Em `contagem.controller.ts`, os handlers extraem apenas o `req.params.id` e delegam para o service:

```ts
// contagem.controller.ts — sem verificação de dono
cancelarHandler:   service.cancelar(String(req.params.id))
salvarItemHandler: service.salvarItem(String(req.params.id), ...)
processarHandler:  service.processar(String(req.params.id), req.user!.sub, ...)
```

Em `contagem.service.ts`, a única guarda antes de executar a escrita Prisma é verificar o status:

```ts
// contagem.service.ts — verifica apenas status, nunca o dono
if (contagem.status !== StatusContagem.Aberta) throw new Error('Contagem não está aberta')
// ← FALTANDO: if (contagem.operadorId !== operadorId) throw new AppError(403, 'Acesso negado')
```

Não há comparação de `contagem.operadorId` contra `req.user!.sub`.

### Cenário de Ataque

1. Operador A abre um turno e inicia contagem (ID: `uuid-alvo`)
2. Operador B (mesmo nível de acesso) obtém o UUID via `GET /contagem`
3. Operador B chama `POST /contagem/uuid-alvo/processar` com quantidades falsas
4. Estoque de Operador A é sobrescrito com dados de B
5. Log de auditoria registra `processadoPor = Operador B` mas `operadorId = Operador A` — trilha contaminada

### Impacto

- **Integridade do estoque**: Níveis de estoque (`estoqueAtual`) permanentemente adulterados
- **Auditoria**: Entradas de log enganosas — divergência entre `operadorId` (dono) e `processadoPor` (atacante)
- **Operacional**: Contagens legítimas canceladas ou finalizadas prematuramente, afetando o CMV do turno

### Correção Recomendada

Adicionar verificação de propriedade no service, **após** buscar o registro e **antes** de qualquer escrita:

```ts
// contagem.service.ts — padrão a aplicar em todas funções mutantes
async function cancelar(id: string, operadorId: string) {
  const contagem = await prisma.contagemEstoque.findUnique({ where: { id } })
  if (!contagem) throw new AppError(404, 'Contagem não encontrada')

  // CORREÇÃO: verificar propriedade
  if (contagem.operadorId !== operadorId) throw new AppError(403, 'Acesso negado')

  if (contagem.status !== StatusContagem.Aberta) throw new AppError(400, 'Contagem não está aberta')

  // ... lógica de cancelamento
}
```

O `operadorId` deve ser passado pelo controller via `req.user!.sub` (nunca via body/params).

```ts
// contagem.controller.ts — passar o sub autenticado
cancelarHandler: service.cancelar(String(req.params.id), req.user!.sub)
salvarItemHandler: service.salvarItem(String(req.params.id), req.user!.sub, ...)
processarHandler: service.processar(String(req.params.id), req.user!.sub, ...)
```

**Exceção para Admin**: se o sistema precisar que Admins possam intervir em contagens alheias, adicionar bypass explícito:

```ts
const isAdmin = req.user!.nivel === 'Admin'
if (!isAdmin && contagem.operadorId !== req.user!.sub) throw new AppError(403, 'Acesso negado')
```

### Referências

- [OWASP API Security Top 10 — API1:2023 BOLA](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- [CWE-284: Improper Access Control](https://cwe.mitre.org/data/definitions/284.html)

---

## VULN-002 — Brute-force sem lockout para usuários com PIN em formato legado

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-002 |
| **Título** | Lockout de conta contornável para `pinFormat: 'plaintext'` e `'sha256'` |
| **Severidade** | **Medium** |
| **OWASP**  | [API4:2023 — Unrestricted Resource Consumption / Brute Force](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/) |
| **Status** | Fixed — 2026-05-07 (trust proxy + documentação; legado inexistente em prod) |
| **Fonte** | Gecko Security — scan automatizado |

### CVSS 3.1

| Métrica | Valor | Justificativa |
|---------|-------|---------------|
| Attack Vector | **N** Network | Endpoint HTTP acessível por qualquer cliente |
| Attack Complexity | **L** Low | Envio direto de requisições POST ao endpoint de login |
| Attack Requirements | **N** None | Ativo na configuração padrão |
| Privileges Required | **N** None | Unauthenticated — não requer JWT |
| User Interaction | **N** None | Nenhuma ação da vítima necessária |
| Confidentiality | **L** Low | PIN de 4–8 dígitos pode ser descoberto |
| Integrity | **L** Low | Acesso à conta comprometida |
| Availability | **N** None | Não afeta disponibilidade do serviço |

**Score estimado: ~5.3 (Medium)** — `AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N`

### Descrição

O fluxo de login para usuários com `pinFormat: 'plaintext'` ou `'sha256'` inclui o PIN diretamente na cláusula `WHERE` do Prisma. Quando o PIN submetido é incorreto, a query retorna `null` e o código lança `UnauthorizedError` imediatamente (linha 48) sem chamar `registrarFalha()`. O lockout por tentativas nunca é incrementado para esses formatos.

### Causa Raiz

```ts
// auth.service.ts — PIN na cláusula WHERE: usuário não encontrado = sem lockout
let usuario =
  await prisma.usuario.findFirst({ where: { pinFormat: 'sha256', pin: pinSha256, ativo: true } }) ??
  await prisma.usuario.findFirst({ where: { pinFormat: 'plaintext', pin, ativo: true } })

if (!usuario) throw new UnauthorizedError('PIN inválido')  // ← sai aqui, lockout nunca chamado
// registrarFalha() só é alcançado pelo path bcrypt
```

Para bcrypt o fluxo é correto: usuário carregado pelo `id` (sem PIN no WHERE), hash comparado separadamente, `registrarFalha` chamado em caso de falha.

### Por que o risco é baixo em produção

- **Rate limiting em duas camadas**: global (300 req/15min) e específico no login (10 req/15min por IP)
- **Todos os usuários atuais são bcrypt**: o seed cria com bcrypt, a migração automática converte na próxima autenticação bem-sucedida — nenhum usuário sha256/plaintext existe no banco após o primeiro login de cada conta

### Fix Aplicado

1. **`app.ts`**: adicionado `app.set('trust proxy', 1)` — sem isso, o rate limiter vê o IP do Nginx (127.0.0.1) em vez do IP do cliente real, tornando-o ineficaz em produção atrás de proxy
2. **Longo prazo**: se algum usuário legado existir, usar `scripts/set-pin.ts` para forçar migração para bcrypt. Após todos migrados, remover os code paths `sha256`/`plaintext`

### Verificar usuários legados

```bash
# Verificar se existem usuários com formato legado
cd backend && npx tsx -e "
import { prisma } from './src/config/prisma.js'
const u = await prisma.usuario.findMany({ where: { pinFormat: { not: 'bcrypt' } }, select: { id: true, nome: true, pinFormat: true } })
console.log(u.length ? u : 'Nenhum usuário legado — todos bcrypt ✓')
await prisma.\$disconnect()
"
```

---

## VULN-003 — BOLA: Falta de verificação de propriedade nas rotas de contagem do módulo `turnos`

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-003 |
| **Título** | Broken Object Level Authorization nas rotas mutantes de `contagemEstoque` via módulo `turnos` |
| **Severidade** | **High** |
| **OWASP**  | [API1:2023 — Broken Object Level Authorization (BOLA / IDOR)](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/) |
| **Status** | Fixed — 2026-05-07 |
| **Fonte** | Gecko Security — scan automatizado |

### Rotas afetadas

| Método | Rota | Handler | Impacto |
|--------|------|---------|---------|
| `POST` | `/api/v1/turnos/contagem/:id/item` | `postContagemItem` | Injetar contagens falsas na contagem de outro operador |
| `POST` | `/api/v1/turnos/contagem/:id/foto` | `postContagemFoto` | Sobrescrever foto/justificativa de divergência alheia |
| `POST` | `/api/v1/turnos/contagem/:id/finalizar` | `postContagemFinalizar` | Finalizar contagem de outro operador prematuramente |

### Causa Raiz

Mesmo padrão do VULN-001: `contagemId` é aceito do path param sem verificar `contagem.operadorId === req.user.sub`. Adicionalmente, `registrarFotoEvidencia` não carregava a contagem — só o `itemContagem` — tornando impossível qualquer check de propriedade sem mudança estrutural.

### Fix Aplicado

Mesmo padrão do VULN-001: adicionados parâmetros `operadorId` e `nivelAcesso` nas 3 funções do service. Guarda inserida após carregar a contagem, com bypass para `Admin` e `Supervisor`. Controllers passam `req.user!.sub` e `req.user!.nivelAcesso`.

> **Nota**: O Gecko reportou também a perspectiva mobile desta vulnerabilidade — `ContagemTurnoScreen.tsx` lê `contagemId` de `route.params` e o envia como path param. O comportamento do cliente é legítimo; o ataque requer cliente modificado. Este fix de backend cobre o vetor completamente. **Regra:** nunca confiar no cliente para validar propriedade de recursos — a guarda deve estar sempre na API.

---

## VULN-004 — BOLA: Endpoint `rascunho` aceita `contagemId` de outro operador

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-004 |
| **Título** | Criação de rascunho de entrada vinculado a contagem alheia |
| **Severidade** | **Medium** |
| **OWASP**  | [API1:2023 — Broken Object Level Authorization (BOLA / IDOR)](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/) |
| **Status** | Fixed — 2026-05-07 |
| **Fonte** | Gecko Security — scan automatizado |

### Descrição

`POST /turnos/contagem/:id/rascunho` carregava a contagem alvo apenas para extrair `local` (sem verificar propriedade), depois criava um `EntradaRascunho` vinculado ao `contagemId` do atacante. O `operadorId` do rascunho era corretamente o do usuário autenticado, mas a contagem referenciada era de outro operador.

### Diferença em relação ao VULN-003

VULN-003 modificava diretamente a contagem (itens, foto, finalização). VULN-004 criava registros secundários (`EntradaRascunho`) associados a uma contagem alheia, poluindo o histórico e potencialmente afetando a aprovação de entradas pelo Admin.

### Fix Aplicado

Guarda de propriedade adicionada no controller `postRascunho` imediatamente após carregar a contagem, com bypass para `Admin` e `Supervisor`. A verificação fica no controller (e não no service `criarRascunho`) porque o service não recebe `nivelAcesso` — contexto de autenticação pertence à camada HTTP.

---

## VULN-005 — Vazamento de pedidos de compra entre setores

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-005 |
| **Título** | `GET /pedidos` retorna pedidos de todos os setores quando `setor` não é informado |
| **Severidade** | **Medium** |
| **OWASP**  | [API3:2023 — Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/) |
| **Status** | Fixed — 2026-05-07 |
| **Fonte** | Gecko Security — scan automatizado |

### Descrição

O endpoint `GET /pedidos` aceitava `setor` como query param opcional. Quando omitido, o `WHERE` do Prisma ficava vazio e retornava todos os `pedidoCompra` de todos os setores. Um Operador do Bar chamando `/pedidos` sem `?setor=` recebia pedidos do Delivery, Admin e qualquer outro setor — incluindo nomes de produtos, quantidades, flags de urgência e identidade dos solicitantes.

### Causa Raiz (dupla)

1. **Controller**: sem escopo padrão por setor para Operadores — filtragem era opt-in pelo cliente
2. **Service**: lógica de proteção com dois branches idênticos (dead code):
```ts
// ambas as condições fazem a mesma coisa — o nivelAcesso nunca diferenciava o comportamento
if (filtros.setor && filtros.nivelAcesso !== 'Admin') where.setorSolicitante = filtros.setor
else if (filtros.setor) where.setorSolicitante = filtros.setor
```

### Fix Aplicado

- **Controller**: Operadores recebem `setor` forçado para `req.user!.setor`. Admin/Supervisor podem filtrar livremente via query param
- **Service**: removida lógica duplicada — `nivelAcesso` removido do service (escopo é responsabilidade da camada HTTP)

---

## VULN-006 — Confirmação de transferência por setor não destinatário

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-006 |
| **Título** | `confirmarTransferencia` não verifica que o setor do usuário é o destinatário da transferência |
| **Severidade** | **High** |
| **OWASP**  | [API1:2023 — Broken Object Level Authorization (BOLA)](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/) |
| **Status** | Fixed — 2026-05-07 |
| **Fonte** | Gecko Security — scan automatizado |

### Descrição

`confirmarTransferencia` verificava tipo (`Transferencia`) e status (`Pendente`), mas nunca comparava `mov.localDestino` com o setor do usuário confirmando. Um Operador do Bar podia confirmar transferências pendentes destinadas ao Delivery — debitando o estoque da origem e creditando o Delivery sem a ciência do destinatário real.

### Impacto

- Estoque da **origem** debitado prematuramente (antes do destinatário real receber)
- Estoque do **destinatário** creditado por um usuário de outro setor
- Trilha de auditoria mostra setor errado como confirmador
- Em escala: um operador pode drenar estoque de qualquer setor confirmando transferências alheias

### Fix Aplicado

- **`confirmarTransferencia`**: adicionado `nivelAcesso` como parâmetro; guarda `mov.localDestino !== setor` com bypass para Admin/Supervisor
- **`listarTransferenciasPendentesHandler`**: mesmo padrão do VULN-005 — Operadores só veem transferências do próprio setor; Admin/Supervisor podem filtrar livremente via `?local=`

---

## VULN-007 — Supervisor pode ajustar estoque de qualquer setor via `PATCH /estoque/:id/ajustar`

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-007 |
| **Título** | `ajustar` não verifica que o `estoqueAtual` pertence ao setor do Supervisor |
| **Severidade** | **Medium** |
| **OWASP**  | [API1:2023 — Broken Object Level Authorization (BOLA)](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/) |
| **Status** | Fixed — 2026-05-07 |
| **Fonte** | Gecko Security — scan automatizado |

### Descrição

`PATCH /estoque/:id/ajustar` é restrito a `Admin` e `Supervisor` via `requireNivel`. Porém, o service executava `prisma.estoqueAtual.update({ where: { id } })` sem carregar o registro previamente — impossibilitando qualquer verificação de setor. Um Supervisor do Bar conseguia enumerar IDs de `estoqueAtual` e ajustar quantidades do Delivery (e vice-versa).

### Fix Aplicado

Service agora carrega o registro antes de atualizar: se não existir → 404; se `nivelAcesso !== 'Admin'` e `registro.local !== setor` → 403. Admin continua podendo ajustar qualquer setor.

---

## VULN-008 — Supervisor pode alterar status de pedidos de outros setores

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-008 |
| **Título** | `PATCH /pedidos/:id/status` sem verificação de setor do solicitante |
| **Severidade** | **Medium** |
| **OWASP**  | [API1:2023 — Broken Object Level Authorization (BOLA)](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/) |
| **Status** | Fixed — 2026-05-07 |
| **Fonte** | Gecko Security — scan automatizado |

### Descrição

`atualizarStatus` carregava o pedido apenas para confirmar existência (NotFoundError). O campo `setorSolicitante` do registro nunca era comparado com o setor do usuário autenticado. Um Supervisor do Bar podia cancelar, aprovar ou rejeitar pedidos de compra do Delivery e vice-versa.

### Fix Aplicado

`atualizarStatus` recebe agora `setor` e `nivelAcesso`; verifica `pedido.setorSolicitante !== setor` antes de atualizar. Admin pode alterar pedidos de qualquer setor.

---

## VULN-009 — `errorHandler` expõe mensagem de erro bruta em ambiente não-produção

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-009 |
| **Título** | Stack trace / mensagem de erro interna retornada ao cliente em dev/test |
| **Severidade** | **Low** |
| **OWASP**  | [API9:2023 — Improper Inventory Management / Information Disclosure](https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/) |
| **Status** | Fixed — 2026-05-07 |
| **Fonte** | Gecko Security — scan automatizado |

### Descrição

`errorHandler` retornava `String(err)` no campo `message` quando `NODE_ENV !== 'production'`. Isso expunha nomes de tabelas, colunas, queries Prisma, stack traces e caminhos de arquivo internos — informação valiosa para enumeração de estrutura do banco e superfície de ataque.

### Fix Aplicado

`message` sempre retorna `'Erro interno do servidor'`. O erro completo continua sendo logado via `pino` (linha 36) para observabilidade interna.

---

## FINDING DESCARTADO — XSS em `reports.js` / Firestore

| Campo | Valor |
|-------|-------|
| **Referência Gecko** | XSS via `innerHTML` em `reports.js` com Firestore/localStorage |
| **Status** | **Falso positivo — não se aplica a este projeto** |

O scan descreveu injeção em `Store.insert('movimentacoes_estoque', ...)` com Firestore e localStorage. Este projeto usa **PostgreSQL + Prisma** — não existe Firestore, localStorage nem `reports.js` no codebase. O Gecko provavelmente mesclou resultados de um repositório diferente no mesmo relatório.

---

## Checklist de Revisão para Novos Endpoints

Ao criar qualquer rota mutante (`POST`, `PATCH`, `PUT`, `DELETE`) em APIs REST:

- [ ] O recurso pertence a um usuário? → verificar `recurso.userId === req.user.sub`
- [ ] Admin pode agir em recursos alheios? → bypass explícito com comentário
- [ ] O ID do dono vem do JWT (`req.user.sub`)? → **nunca** do body ou query param
- [ ] O 404 é retornado antes do 403? → não revelar existência de recurso a não-donos
- [ ] Endpoints de listagem filtram por dono? → `WHERE userId = req.user.sub` por padrão
