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

## FINDING DESCARTADO — CSV Injection em relatórios exportados

| Campo | Valor |
|-------|-------|
| **Referência** | Lista interna de hardening pré-pentest |
| **Status** | **Não se aplica — sem vetor existente** |
| **Verificado** | 2026-05-08 |

CSV Injection só é vulnerabilidade quando a aplicação **gera CSV/XLSX a partir de input do usuário** (nome de produto começando com `=`, `+`, `-`, `@` vira fórmula no Excel). Verificações:

- Backend: `grep -ri "csv|xlsx|text/csv|res.attachment|res.download"` em `src/` → **0 matches**
- Mobile: idem em `src/` (incluindo `expo-sharing`, `expo-file-system`, `expo-print`) → **0 matches**

Os relatórios (`/relatorios/macro`, `/saidas`, `/perdas`, `/divergencias`, `/auditoria`) retornam apenas JSON consumido pela própria UI. **Nenhum endpoint produz arquivo para download.** Caso exportação seja adicionada no futuro, prefixar valores com aspa simples (`'`) ou validar que campos não comecem com `=+−@` antes de escrever a célula.

---

## VULN-010 — `POST /colibri/importar-pendente` sem rate limit por usuário

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-010 |
| **Título** | Endpoint de importação Colibri acessível a Operadores sem limitação de frequência |
| **Severidade** | **Low** |
| **OWASP**  | [API4:2023 — Unrestricted Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/) |
| **Status** | Fixed — 2026-05-07 |
| **Fonte** | Gecko Security — scan automatizado |

### Descrição

A rota está corretamente posicionada antes do `requireNivel(['Admin'])` por design — operadores precisam acionar o botão "Carregar Vendas Colibri". O finding do Gecko é válido quanto à ausência de rate limiting: um operador podia chamar o endpoint repetidamente, causando consumo desnecessário da API Colibri e writes no banco.

O impacto real é menor do que o Gecko descreve porque: (1) os dados vêm da API Colibri, não do input do operador; (2) o `local` vem do JWT, não do body; (3) a importação é idempotente — mesma data não acumula Saídas.

### Fix Aplicado

Rate limiter por `usuarioId` (do JWT) aplicado na rota: máximo 3 chamadas por 5 minutos. O acesso de Operadores foi mantido — restringir a Admin quebraria o botão na Home e no Meu Turno.

---

## VULN-011 — `PATCH /transferencias/:id/confirmar` sem `requireNivel` no middleware

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-011 |
| **Título** | Rota de confirmação de transferência acessível a Operadores sem guard de nível |
| **Severidade** | **Low** |
| **OWASP**  | [API5:2023 — Broken Function Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/) |
| **Status** | Accepted Risk (design intencional) + documentado — 2026-05-07 |
| **Fonte** | Gecko Security — scan automatizado |

### Descrição

A rota `PATCH /transferencias/:id/confirmar` usa apenas `requireAuth`, enquanto `aprovar` e `rejeitar` exigem `requireNivel(['Supervisor', 'Admin'])`. O Gecko identifica isso como ausência de controle de nível.

### Decisão de Design

Confirmar recebimento de transferência é uma **ação operacional** (o Operador do Delivery confirma que recebeu os produtos do Bar), não administrativa. Restringir a Supervisor/Admin quebraria o fluxo de turno autônomo sem supervisor disponível 24h.

A proteção de propriedade está na camada de service (VULN-006): `mov.localDestino !== setor` garante que um Operador só confirma transferências cujo destino é seu próprio setor. A diferença em relação a `aprovar`/`rejeitar` é de semântica de negócio — essas exigem accountability de nível superior por envolverem perdas e ajustes financeiros.

### Ação Tomada

Comentário adicionado na rota documentando a intenção explicitamente para evitar que futuras revisões tratem isso como omissão.

---

## VULN-012 — Self-rejection bypass no fluxo de aprovação de perdas

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-012 |
| **Título** | `rejeitar` permite que o solicitante rejeite sua própria aprovação de perda |
| **Severidade** | **Medium** |
| **OWASP**  | [API5:2023 — Broken Function Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/) |
| **Status** | Fixed — 2026-05-07 |
| **Fonte** | Gecko Security — scan automatizado |

### Descrição

O princípio "four-eyes" (quatro olhos) exige que nenhum usuário possa aprovar ou rejeitar sua própria solicitação. `aprovar` tinha o guard `solicitanteId === aprovadorId` (linha 208), mas `rejeitar` não. Um Supervisor podia criar um `AjustePerda`, depois rejeitar sua própria aprovação — efetivamente cancelando o registro de perda sem revisão de outro usuário, ou usando a rejeição para encobrir ajustes indevidos.

### Fix Aplicado

Guard `solicitanteId === aprovadorId` adicionado em `rejeitar`, espelhando exatamente o padrão de `aprovar`.

---

## VULN-013 — `GET /cmv` acessível a qualquer usuário autenticado

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-013 |
| **Título** | Endpoint CMV sem restrição de nível expõe dados financeiros sensíveis |
| **Severidade** | **Medium** |
| **OWASP**  | [API5:2023 — Broken Function Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/) |
| **Status** | Fixed — 2026-05-07 |
| **Fonte** | Gecko Security — scan automatizado |

### Descrição

`GET /cmv` retorna CMV por categoria, valores de estoque inicial e final ao custo, total de perdas e agregados financeiros de todo o catálogo. Qualquer Operador com JWT válido conseguia acessar esses dados de inteligência de negócio sem restrição de nível.

### Fix Aplicado

`requireNivel(['Admin', 'Supervisor'])` adicionado na rota. Operadores não têm acesso a dados financeiros agregados.

---

## VULN-014 — `GET /turnos/contagem/:id` expõe contagem completa a qualquer Operador

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-014 |
| **Título** | Endpoint de revisão de contagem acessível sem restrição de nível |
| **Severidade** | **Medium** |
| **OWASP**  | [API5:2023 — Broken Function Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/) |
| **Status** | Fixed — 2026-05-07 |
| **Fonte** | Gecko Security — scan automatizado |

### Descrição

`GET /turnos/contagem/:id` retorna a contagem completa incluindo `quantidadeSistema` de qualquer contagem (ativa ou fechada). Qualquer Operador podia ler contagens de outros operadores, incluindo os valores do sistema em contagens cegas ativas — violando o princípio do modo cego.

### Distinção entre os endpoints

| Endpoint | Nível | Uso |
|----------|-------|-----|
| `GET /contagem/:id/cega` | Operador | Fluxo ativo — omite `quantidadeSistema` |
| `GET /contagem/:id` | Admin/Supervisor | Revisão completa pós-finalização |

### Fix Aplicado

`requireNivel(['Admin', 'Supervisor'])` adicionado em `getContagem`. Operadores continuam com acesso ao endpoint cego para o próprio fluxo de trabalho.

---

## VULN-015 — `aprovar` e `rejeitar` sem verificação de status Pendente

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-015 |
| **Título** | Aprovações já resolvidas podiam ser reprocessadas, causando debits repetidos no estoque |
| **Severidade** | **High** |
| **OWASP**  | [API3:2023 — Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/) |
| **Status** | Fixed — 2026-05-07 |
| **Fonte** | Gecko Security — scan automatizado |

### Descrição

`aprovar` e `rejeitar` não verificavam `aprovacao.status === Pendente` antes de executar `_upsertEstoque`. Um Supervisor podia chamar `PATCH /aprovacoes/:id/aprovar` repetidamente sobre uma aprovação já resolvida, causando debits acumulativos no estoque (`-quantidade` por chamada) sem limite.

### Fix Aplicado

Guard `status !== Pendente → BusinessRuleError` adicionado em ambas as funções, antes de qualquer mutação de estoque ou atualização de registro.

---

## VULN-016 — `GET /movimentacoes` sem escopo de setor para Operadores

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-016 |
| **Título** | Listagem de movimentações expõe todos os setores a qualquer Operador |
| **Severidade** | **Medium** |
| **OWASP**  | [API3:2023 — Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/) |
| **Status** | Fixed — 2026-05-07 |
| **Fonte** | Gecko Security — scan automatizado |

### Descrição

`GET /movimentacoes` com todos os filtros opcionais. Sem `local` na query, o `WHERE` ficava vazio e retornava movimentações de todos os setores. Operador do Bar podia ver quantidades, motivos de ajuste, referências de imagens e nomes de produtos do Delivery.

### Fix Aplicado

Mesmo padrão de VULN-005/006: Operadores recebem `local` forçado para `req.user!.setor` no controller. Admin/Supervisor podem filtrar livremente via query param.

---

## VULN-017 — `GET /contagem/:id` e `GET /contagem/` sem escopo de propriedade

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-017 |
| **Título** | Leitura de contagens alheias e listagem sem filtro de operador |
| **Severidade** | **Medium** |
| **OWASP**  | [API1:2023 — Broken Object Level Authorization (BOLA)](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/) |
| **Status** | Fixed — 2026-05-07 |
| **Fonte** | Gecko Security — scan automatizado |

### Descrição

`GET /contagem/:id` não verificava se `contagem.operadorId === req.user.sub`. Qualquer Operador conseguia ler contagens de outros operadores. A proteção de `quantidadeSistema=-1` do modo cego mitiga parte do risco, mas dados estruturais (itens, datas, divergências) permaneciam visíveis. `GET /contagem/` também listava contagens de todos os operadores sem filtro.

### Fix Aplicado

- `buscarHandler`: ownership check no controller após carregar a contagem. Admin/Supervisor têm bypass
- `listarHandler`: Operadores recebem `operadorId` forçado para `req.user!.sub`; service `listar` aceita novo parâmetro opcional `operadorId`

---

## VULN-018 — `buscarHandler` retorna 403 em vez de 404 para contagem alheia

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-018 |
| **Título** | IDOR enumeration via 403 vs 404 em `GET /contagem/:id` |
| **Severidade** | **Medium** |
| **OWASP**  | [API1:2023 — Broken Object Level Authorization (BOLA / IDOR)](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/) |
| **Status** | Fixed — 2026-05-08 |
| **Fonte** | Revisão interna pré-pentest |

### Descrição

`buscarHandler` carregava a contagem (404 se não existir) e depois retornava 403 se `contagem.operadorId !== req.user.sub`. Resposta 403 confirma a existência do recurso ao Operador não-autorizado, permitindo enumerar UUIDs de contagens alheias: 404 = não existe, 403 = existe mas é de outro.

### Fix Aplicado

Substituído `throw new AppError(..., 403)` por `throw new NotFoundError('Contagem não encontrada')` para não-privilegiados em **todos os endpoints da contagem** (descoberto durante revisão posterior — só `GET` havia sido corrigido inicialmente):

| Endpoint | Arquivo |
|---|---|
| `GET /contagem/:id` | [contagem.controller.ts:26](backend/src/modules/contagem/contagem.controller.ts#L26) |
| `PATCH /contagem/:id/item` | [contagem.service.ts:85](backend/src/modules/contagem/contagem.service.ts#L85) |
| `POST /contagem/:id/processar` | [contagem.service.ts:107](backend/src/modules/contagem/contagem.service.ts#L107) |
| `DELETE /contagem/:id` | [contagem.service.ts:175](backend/src/modules/contagem/contagem.service.ts#L175) |

Comportamento externo agora idêntico ao de recurso inexistente — sem leakage de existência em nenhum verbo HTTP.

---

## VULN-019 — Hardening de produção (3 vetores consolidados)

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-019 |
| **Título** | Configuração permissiva permitia secrets fracos, CORS=`*` e Swagger exposto a Operadores |
| **Severidade** | **Medium** |
| **OWASP**  | [API8:2023 — Security Misconfiguration](https://owasp.org/API-Security/editions/2023/en/0xa8-security-misconfiguration/) |
| **Status** | Fixed — 2026-05-08 |
| **Fonte** | Revisão interna pré-pentest |

### Descrição

Três configurações permissivas no startup permitiriam deploy inseguro:

1. **Swagger acessível a Operadores** — `app.use('/api/docs', requireAuth, ...)` sem `requireNivel`. Qualquer Operador via o mapa completo da API.
2. **CORS=`*` aceito em produção** — sem validação no startup; um deploy com `.env.production` mal preenchido exporia o CORS para qualquer origem.
3. **JWT_SECRET = JWT_REFRESH_SECRET aceito** — schema validava só o tamanho mínimo (32). Se o operador copiasse o mesmo valor para os dois, access e refresh assinariam com o mesmo segredo.

### Fix Aplicado

- **Swagger**: [app.ts:75](backend/src/app.ts#L75) — adicionado `requireNivel(['Admin'])` na rota `/api/docs`
- **Validações fail-fast em produção**: [env.ts:25-37](backend/src/config/env.ts#L25-L37) — servidor não sobe se em produção:
  - `JWT_SECRET === JWT_REFRESH_SECRET`
  - `CORS_ORIGIN` contém `*`
  - Qualquer secret < 64 caracteres
- **Auditoria de migração de PIN**: gravava `acao=PIN_MIGRADO` em `LogAuditoria` quando upgrade ocorria (removido junto com VULN-020 abaixo, pois não há mais para onde migrar)

---

## VULN-020 — Code paths legacy de hash (sha256/plaintext/bcrypt) removidos

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-020 |
| **Título** | Suporte a formatos de PIN legados (sha256, plaintext, bcrypt) elimina o argon2id como única superfície |
| **Severidade** | **Low** (defesa em profundidade) |
| **OWASP**  | [API8:2023 — Security Misconfiguration](https://owasp.org/API-Security/editions/2023/en/0xa8-security-misconfiguration/) |
| **Status** | Fixed — 2026-05-08 |
| **Fonte** | Hardening pré-pentest (sistema sem usuários em produção) |

### Descrição

Após a migração para argon2id (sessão de 2026-05-08), o `auth.service.ts` ainda continha caminhos de código para validar PINs em `sha256`, `plaintext` e `bcrypt` — necessários durante a janela de migração para usuários existentes. Como o sistema não tem usuários em produção, esses caminhos não tinham razão de existir e representavam superfície de ataque desnecessária:

- `sha256`/`plaintext`: sujeitos ao bypass de rate limit por usuário documentado em VULN-002
- `bcrypt`: válido mas mais fraco que argon2id contra ataques offline (não é memory-hard)

### Fix Aplicado

| Arquivo | Mudança |
|---|---|
| `auth.service.ts` | Toda lógica de busca/validação de sha256, plaintext e bcrypt removida. Login agora itera apenas usuários `argon2id`. |
| `usuarios.service.ts` | `criar` e `atualizar` gravam direto em argon2id |
| `seed.ts` | Hash inicial em argon2id |
| `scripts/set-pin.ts` | Hash em argon2id |
| `schema.prisma` | Enum `PinFormat` reduzido a um único valor: `argon2id`; `@default(argon2id)` |
| `package.json` | `bcryptjs` e `@types/bcryptjs` desinstalados |

### Trade-off documentado

Como o modelo é PIN-only sem username, o lockout per-usuário (`registrarFalha`, `MAX_ATTEMPTS`, `LOCKOUT_MINUTES`) era dead code — só seria acionado se a busca por hash retornasse falso positivo, o que não acontece com argon2. Esses elementos foram removidos.

**Defesa real contra brute-force fica delegada a:**
- Rate limit por IP no endpoint de login: 10 tentativas / 15 min ([auth.routes.ts:6](backend/src/modules/auth/auth.routes.ts#L6))
- Rate limit global: 300 req / 15 min ([app.ts:32-38](backend/src/app.ts#L32-L38))
- `trust proxy = 1` para que o limiter veja IP real atrás do Nginx

---

## VULN-021 — PIN expandido de 4 para 6 dígitos (hardening anti-brute-force)

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-021 |
| **Título** | PIN de 4 dígitos expande superfície de brute-force além do que o rate limit cobre |
| **Severidade** | **Medium** |
| **OWASP**  | [API4:2023 — Unrestricted Resource Consumption / Brute Force](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/) |
| **Status** | Fixed — 2026-05-08 |
| **Fonte** | Hardening pré-pentest |

### Análise

Com PIN de 4 dígitos (10.000 possibilidades) e rate limit de 10 req/15min por IP:
- **Atacante com 1 IP**: ~125h em média para acertar um PIN (impraticável, mas possível)
- **Botnet com 100 IPs distribuídos**: **~18 minutos em média** para acertar (totalmente viável)

O modelo PIN-only (sem username) impede lockout per-usuário — o rate limit por IP é a única defesa, e ele é contornável por botnet.

### Fix Aplicado

PIN expandido para **exatamente 6 dígitos** (1.000.000 possibilidades). Mesma matemática × 100:
- Mesma botnet de 100 IPs: **~30 horas em média** para acertar — atacante geralmente desiste antes
- Custo de UX zero — operador memoriza 6 dígitos com a mesma facilidade que 4

### Arquivos Alterados

| Arquivo | Mudança |
|---|---|
| [auth.schemas.ts](backend/src/modules/auth/auth.schemas.ts) | `z.string().regex(/^\d{6}$/)` — só aceita exatos 6 dígitos numéricos |
| [seed.ts](backend/prisma/seed.ts) | PINs iniciais: Admin=`123456`, Bar=`111111`, Delivery=`222222` |
| [reset-login.ts](backend/scripts/reset-login.ts) | Mensagem atualizada |
| [LoginScreen.tsx](mobile/src/screens/Login/LoginScreen.tsx) | `length === 6`, `maxLength={6}`, texto "6 dígitos" |
| [PinPad.tsx](mobile/src/components/PinPad.tsx) | Default `maxLength = 6` |
| [UsuariosScreen.tsx](mobile/src/screens/Usuarios/UsuariosScreen.tsx) | Validação regex `/^\d{6}$/` no formulário Admin |
| [schemas.test.ts](backend/src/tests/schemas.test.ts) | Suite de testes do `loginSchema` reescrita (rejeita 4, 5, 7 dígitos; rejeita letras/espaços) |
| [security.test.ts](backend/src/tests/security.test.ts) | Tokens com novos PINs + 2 testes adicionais (rejeição de 4 dígitos e letras) |

### Validação

- TypeScript: 0 erros
- Tests: **65/65 passando** (39 → 41 schemas, 22 → 24 security)
- Smoke test: `POST /auth/login {pin:"1234"}` → 422 (rejeitado) | `POST /auth/login {pin:"123456"}` → 200

### Próximo upgrade possível (não aplicado)

Para defesa em profundidade adicional contra botnets sofisticadas, considerar 2FA TOTP **apenas para Admin** — operadores ficam só com PIN 6 dígitos, Admin precisa de PIN + 6 dígitos do app autenticador. Esforço estimado: 4–6h. Não aplicado nesta fase porque PIN 6 dígitos já reduz brute-force a impraticável para o cenário deste app interno.

---

## VULN-022 — Timing leak no login revela banco vazio + rate limit ausente em refresh + auditoria sem índices

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-022 |
| **Título** | Hardening operacional: timing-equalization no login, rate limit em refresh, índices na tabela de auditoria |
| **Severidade** | **Low** (defesa em profundidade) |
| **OWASP**  | API4:2023 (rate limit) + CWE-208 (Observable Timing Discrepancy) |
| **Status** | Fixed — 2026-05-08 |
| **Fonte** | Hardening pré-pentest |

Três melhorias adjacentes documentadas juntas porque se reforçam mutuamente.

### 22a — Timing leak: banco vazio responde em ~5ms

**Problema**: o `login()` itera todos os usuários ativos com `argon2.verify` — quando há N usuários, qualquer login (sucesso ou falha) leva ≥ 1 × ~200ms. Mas se a tabela está vazia (instalação fresca, ou todos inativos), retorna em ~5ms. Atacante observando tempo identifica "instalação não populada" e pode tentar bypass via deploy hooks ou seed pré-população.

**Análise mais ampla**:
- PIN errado: sempre N × argon2.verify (constant-time razoável) ✓
- PIN correto, posição k na lista: (k+1) × argon2.verify (vaza posição, mas só explorável se atacante já tem PIN válido — improvável)
- Banco vazio: ~5ms (vaza estado do banco) ✗ ← este é o fix

**Fix**: [auth.service.ts](backend/src/modules/auth/auth.service.ts) — quando `usuarios.length === 0`, executa um `argon2.verify` contra hash dummy fixo antes de retornar 401, igualando o tempo a uma instalação real:

```ts
let dummyHashCache: string | null = null
async function getDummyHash() {
  if (!dummyHashCache) dummyHashCache = await argon2.hash('__dummy_never_a_valid_pin__', ARGON2_OPTIONS)
  return dummyHashCache
}

// no login:
if (usuarios.length === 0) {
  await argon2.verify(await getDummyHash(), pin).catch(() => false)
  throw new UnauthorizedError('PIN inválido')
}
```

Hash dummy é lazy + cached → custo apenas no primeiro login pós-deploy.

### 22b — Rate limit ausente em `POST /auth/refresh`

**Problema**: o endpoint de refresh validava o token via `jwt.verify` (rápido, ~1ms) e consultava o banco. Sem rate limit, atacante com lista de refresh tokens vazados (de banco comprometido, log mal configurado, etc.) podia testar centenas em loop até achar um ainda válido.

**Fix**: [auth.routes.ts](backend/src/modules/auth/auth.routes.ts) — limiter próprio para `/refresh`, mais permissivo que login (uso legítimo: ~1 refresh/hora por sessão; 30/15min cobre múltiplos dispositivos do mesmo usuário sem afetar UX):

```ts
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skip: () => process.env.NODE_ENV === 'test',
  message: { code: 'TOO_MANY_REQUESTS', message: 'Muitas tentativas de refresh. Tente em 15 minutos.' },
})
router.post('/refresh', refreshLimiter, refreshHandler)
```

### 22c — Tabela `LogAuditoria` sem índices

**Problema**: queries de auditoria em produção usam `acao`, `usuarioId`, `dataEvento` no WHERE. Sem índices, em 6–12 meses (dependendo do volume), cada query vira table-scan completa. Ainda mais grave para investigações pós-incidente, que costumam pedir agregações por `acao` em janelas de tempo.

**Fix**: [schema.prisma](backend/prisma/schema.prisma) — 4 índices adicionados:

```prisma
model LogAuditoria {
  // ... campos existentes
  @@index([dataEvento])
  @@index([usuarioId])
  @@index([acao])
  @@index([entidade, idReferencia])
}
```

- `dataEvento`: queries por janela temporal (`WHERE dataEvento > now() - interval '7 days'`)
- `usuarioId`: trilha de um operador específico
- `acao`: agregações por tipo de evento (LOGIN, MOVIMENTACAO_*, etc.)
- `(entidade, idReferencia)`: rastrear histórico de um recurso específico (ex: contagem id `xyz`)

Aplicado via `npx prisma db push --accept-data-loss`. Banco existente recebe os índices sem perda de dados.

### Validação

| Check | Resultado |
|---|---|
| TypeScript | ✅ 0 erros |
| Tests | ✅ 65/65 (24 security + 41 schema) |
| Schema push | ✅ Sem erros, índices criados |

---

## VULN-023 — Schemas Zod com gaps de validação (DoS + bypass de regra de PIN)

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-023 |
| **Título** | Hardening de schemas Zod — limites de tamanho, tipo enum em filtros, consistência de regra de PIN |
| **Severidade** | **Medium** |
| **OWASP**  | [API4:2023 — Unrestricted Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/) + [API8:2023 — Security Misconfiguration](https://owasp.org/API-Security/editions/2023/en/0xa8-security-misconfiguration/) |
| **Status** | Fixed — 2026-05-08 |
| **Fonte** | Auditoria interna pré-pentest |

### Problemas encontrados

Auditoria de todos os 10 schemas em `src/modules/**/*.schemas.ts` revelou 4 grupos de fragilidade:

**23a — Bypass de regra de PIN no fluxo Admin (High)**
[usuarios.schemas.ts:5](backend/src/modules/usuarios/usuarios.schemas.ts#L5) aceitava `pin: z.string().min(4).max(8)` enquanto [auth.schemas.ts](backend/src/modules/auth/auth.schemas.ts) (loginSchema) já exigia `regex(/^\d{6}$/)`. Inconsistência permitia Admin criar usuários com PIN em formato que NUNCA conseguiria logar (DoS auto-infligido) ou de tamanho/charset diferente do esperado.

**Fix**: regex unificado em ambos os schemas.

**23b — Pedidos sem teto no array (DoS)**
[pedidos.schemas.ts:12](backend/src/modules/pedidos/pedidos.schemas.ts#L12) — `itens: z.array(...).min(1)` sem `.max()`. Atacante pode mandar pedido com 100k itens, cada um virando uma row no Postgres em transação única → table-lock + memória. **Fix**: `.max(100)`.

**23c — Strings sem limite de tamanho em vários módulos (memory bloat)**
Schemas em `produtos`, `movimentacoes`, `turnos`, `contagem`, `pedidos`, `usuarios` aceitavam strings sem `max()`. Limites aplicados:

| Tipo de campo | Limite |
|---|---|
| Nome (produto, usuário) | 100–200 chars |
| Categoria, unidade, volume | 20–80 chars |
| Observação, motivo, justificativa | 500 chars |
| Imagem base64 | 1.500.000 chars (~1.1 MB de imagem real) |
| Quantidades numéricas | `.max(999999)` |

A primeira camada (Express `body-parser limit: 1mb` em `app.ts`) já barrava payloads enormes, mas Zod max em campos individuais bloqueia ataques mais sutis (ex: 100 campos de 10kB cada = 1MB total, passa pelo body-parser, mas cada campo individual seria absurdo).

**23d — Filtros de movimentação aceitavam strings genéricas em vez de enums**
[movimentacoes.schemas.ts](backend/src/modules/movimentacoes/movimentacoes.schemas.ts) — `tipoMov`, `local`, `produtoId`, `dataInicio`, `dataFim` eram `z.string().optional()`. Service fazia `new Date(filtros.dataInicio)` que aceita strings malformed silenciosamente, e o WHERE Prisma aceitava `tipoMov: "qualquer-coisa"` (Prisma silenciosamente ignora valores fora do enum).

**Fix**:
- `produtoId: z.string().uuid()`
- `tipoMov: z.enum([...])`
- `local: z.enum(['Bar', 'Delivery'])`
- `dataInicio/dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}/)`

Ajuste no controller [movimentacoes.controller.ts:9](backend/src/modules/movimentacoes/movimentacoes.controller.ts#L9): forçar `local` apenas quando `req.user.setor` é `'Bar'` ou `'Delivery'` (evita atribuição inválida ao tipo enum quando setor é Admin/Todos — caso patológico já bloqueado por isPrivileged).

### Validação

3 testes de regressão adicionados em [security.test.ts](backend/src/tests/security.test.ts):

- Admin tentando criar usuário com PIN de 4 dígitos → 422
- Pedido com 1000 itens → 422 com mensagem "Máximo 100"
- Movimentação com observação de 10kB → 422

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `usuarios.schemas.ts` | regex `/^\d{6}$/` no PIN, max(100) no nome |
| `produtos.schemas.ts` | max em todas as strings, max em números |
| `pedidos.schemas.ts` | max(100) no array itens, max nas strings |
| `movimentacoes.schemas.ts` | enums em filtros, max em strings |
| `movimentacoes.controller.ts` | guard explícito antes de atribuir local |
| `turnos.schemas.ts` | max em fotoEvidencia, justificativas, etc |
| `contagem.schemas.ts` | max em causaDivergencia, max em quantidade |
| `estoque.schemas.ts` | max(999999) na quantidade |

### Estado final

| Verificação | Resultado |
|---|---|
| TypeScript | ✅ 0 erros |
| Tests | ✅ **68/68** (era 65, +3 novos sobre VULN-023) |

---

---

## VULN-024 — Biometric bypass: login biométrico não validava sessão no servidor

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-024 |
| **Título** | `signInWithBiometric()` carregava token do cache sem chamada ao servidor — 2FA poderia ser bypassado |
| **Severidade** | **High** |
| **OWASP**  | [MASVS-AUTH-1 — Authentication](https://mas.owasp.org/MASVS/controls/MASVS-AUTH-1/) |
| **Status** | Fixed — 2026-05-14 |
| **Fonte** | Auditoria mobile pré-deploy |

### Descrição

`signInWithBiometric()` em `AuthContext.tsx` autenticava o hardware biométrico (local) e depois lia o `accessToken` e `usuario` diretamente do `SecureStore`, setando o estado sem confirmar com o servidor. Isso significava:

1. **2FA bypassado**: usuário Admin com TOTP ativo podia entrar via biometria sem fornecer o código TOTP
2. **Papel desatualizado**: se o nivelAcesso foi modificado pelo Admin (ex: promoção/rebaixamento), o app usava o papel do cache, não o atual do servidor
3. **Sessão revogada ignorada**: tokens deletados manualmente do banco (logout remoto) eram ignorados — o app entrava assim mesmo

### Fix Aplicado

`signInWithBiometric()` agora chama `GET /auth/me` após a autenticação biométrica:
- Valida que o JWT ainda é aceito pelo servidor (assinatura + expiração)
- Atualiza o `usuario` armazenado com dados frescos do payload JWT
- Em caso de falha (401 ou rede), lança erro e força login por PIN

O mesmo padrão foi aplicado em `init()` (startup do app): ao encontrar token no `SecureStore`, chama `/auth/me` antes de setar o usuário, caindo para o cache somente em erro de rede (offline graceful).

### Arquivos Alterados

| Arquivo | Mudança |
|---|---|
| [AuthContext.tsx](mobile/src/contexts/AuthContext.tsx#L39) | `init()`: chama `/auth/me`; fallback para cache só em erro de rede |
| [AuthContext.tsx](mobile/src/contexts/AuthContext.tsx#L61) | `signInWithBiometric()`: chama `/auth/me`; falha fecha sessão |

---

## VULN-025 — Client-side RBAC: nivelAcesso lido do cache sem verificação server-side

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-025 |
| **Título** | `nivelAcesso` armazenado no `SecureStore` nunca era sincronizado com o servidor no startup |
| **Severidade** | **Medium** |
| **OWASP**  | [MASVS-AUTH-2 — Authorization](https://mas.owasp.org/MASVS/controls/MASVS-AUTH-2/) |
| **Status** | Fixed — 2026-05-14 (coberto pelo fix do VULN-024) |
| **Fonte** | Auditoria mobile pré-deploy |

### Descrição

O hook `useLocalAcesso` e telas como `EstoqueScreen`, `AdminScreen`, `MovimentacaoScreen` liam `usuario.nivelAcesso` do contexto, que por sua vez vinha do JSON cacheado no `SecureStore`. Se o `SecureStore` fosse adulterado (dispositivo rooteado) ou o papel do usuário fosse alterado pelo Admin, o app exibia funcionalidades do nível errado até o próximo login completo.

**Nota**: o backend tem `requireNivel` em todos os endpoints sensíveis — um Operador com `nivelAcesso: 'Admin'` adulterado no cache veria a UI de Admin, mas qualquer mutação seria rejeitada com 403. O risco real é de **confusão de UI**, não de escalada de privilégio efetiva.

### Fix Aplicado

Coberto pelo VULN-024: ao chamar `/auth/me` no startup e no login biométrico, o `usuario.nivelAcesso` do contexto passa a vir do JWT (gerado pelo servidor), eliminando a dependência do JSON cacheado.

---

## VULN-026 — JWT_EXPIRES_IN padrão de 1h permite papel desatualizado por até 1 hora

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-026 |
| **Título** | Access token com expiração de 1h: usuário rebaixado mantém privilégios por até 1h |
| **Severidade** | **Low** |
| **OWASP**  | [API2:2023 — Broken Authentication](https://owasp.org/API-Security/editions/2023/en/0xa2-broken-authentication/) |
| **Status** | Fixed — 2026-05-14 |
| **Fonte** | Auditoria mobile pré-deploy |

### Descrição

O payload do JWT inclui `nivelAcesso`. O `requireNivel` do backend verifica esse campo do payload, não do banco. Se um Admin é rebaixado a Operador, seu JWT existente continua afirmando `nivelAcesso: 'Admin'` até expirar — até 1h de janela de privilégio residual.

### Fix Aplicado

`JWT_EXPIRES_IN` default reduzido de `'1h'` para `'15m'` em `env.ts`. O interceptor Axios do app já faz refresh transparente, então não há impacto de UX. A janela de papel desatualizado cai de 60min para no máximo 15min.

| Arquivo | Mudança |
|---|---|
| [env.ts](backend/src/config/env.ts#L9) | `JWT_EXPIRES_IN` default: `'1h'` → `'15m'` |

---

## VULN-027 — Token storage sem proteção contra root (risco aceito)

| Campo      | Valor |
|------------|-------|
| **ID**     | VULN-027 |
| **Título** | Tokens em `expo-secure-store` acessíveis em dispositivos rooteados |
| **Severidade** | **Low** |
| **OWASP**  | [MASVS-STORAGE-1](https://mas.owasp.org/MASVS/controls/MASVS-STORAGE-1/) |
| **Status** | **Accepted Risk** — 2026-05-14 |
| **Fonte** | Auditoria mobile pré-deploy |

### Descrição

Em dispositivos Android rooteados, o Android Keystore (onde `expo-secure-store` persiste os tokens) pode ser acessado por processos privilegiados. Um atacante com acesso root ao dispositivo pode extrair o `accessToken` e `refreshToken`.

### Análise de Risco

- **Vetor**: requer acesso físico + root — não é remoto
- **Impacto**: acesso à conta até refresh token expirar (30 dias)
- **Mitigação atual**: `expo-secure-store` é a melhor camada disponível sem módulo nativo customizado; o refresh token expirado já invalida a sessão; VULN-024 garante que tokens revogados são detectados no próximo startup

### Decisão

Risco aceito para v1. Contexto: app interno de gestão de bar, não app de banco/saúde. Mitigação futura: adicionar detecção de root via `expo-device.isRootedExperimentalAsync()` e bloquear biometria em dispositivos rooteados.

---

## Checklist de Revisão para Novos Endpoints

Ao criar qualquer rota mutante (`POST`, `PATCH`, `PUT`, `DELETE`) em APIs REST:

- [ ] O recurso pertence a um usuário? → verificar `recurso.userId === req.user.sub`
- [ ] Admin pode agir em recursos alheios? → bypass explícito com comentário
- [ ] O ID do dono vem do JWT (`req.user.sub`)? → **nunca** do body ou query param
- [ ] O 404 é retornado antes do 403? → não revelar existência de recurso a não-donos
- [ ] Endpoints de listagem filtram por dono? → `WHERE userId = req.user.sub` por padrão
