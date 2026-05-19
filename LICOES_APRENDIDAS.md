# Lições Aprendidas — Template para Novos Projetos

> Documento consolidado para aplicar em projetos novos (ex.: **Proteína Controle**, CMV, Estoque).
> Baseado em bugs reais encontrados no **APPCONTAGEM** após meses em produção.
> **Copie este arquivo para o novo projeto antes de começar a codar.**

---

## 📋 Stack padrão recomendada

- **Backend:** Node 20+ / TypeScript / Express ou Fastify / Prisma 5
- **Banco:** PostgreSQL 16
- **Mobile:** React Native / Expo + EAS Build (APK)
- **Deploy:** Coolify (Locaweb VPS) — auto-build via git push, mas precisa **Redeploy manual** (webhook só HTTPS)
- **Timezone:** Brasília (UTC-3) — Brasil aboliu horário de verão em 2019

---

## ⚠️ TIMEZONE — Erros mais comuns (40% dos bugs)

### Regra de ouro
> **NUNCA use `toISOString()` ou `new Date('YYYY-MM-DD')` para datas calendário.**
> Sempre use helpers `formatLocalDate()` e `parseLocalDate()`.

### Arquivo `dateLocal.ts` obrigatório

Crie em `backend/src/shared/dateLocal.ts` E `mobile/src/utils/dateLocal.ts`:

**Backend (Node, servidor pode ser UTC):**
```ts
const TZ = 'America/Sao_Paulo'

export function formatLocalDate(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function parseLocalDate(yyyymmdd: string, hms: '00:00:00' | '23:59:59' = '00:00:00'): Date {
  return new Date(`${yyyymmdd}T${hms}-03:00`)
}

export function localOntem(date: Date = new Date()): string {
  const d = new Date(date); d.setUTCDate(d.getUTCDate() - 1)
  return formatLocalDate(d)
}

export function localNextDay(dateStr: string): string {
  const d = parseLocalDate(dateStr)
  d.setUTCDate(d.getUTCDate() + 1)
  return formatLocalDate(d)
}
```

**Mobile (React Native, device é BRT):**
```ts
export function formatLocalDate(date: Date = new Date()): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function localOntem(): string {
  const d = new Date(); d.setDate(d.getDate() - 1)
  return formatLocalDate(d)
}
```

### Erros a evitar (checklist)

- [ ] **Filtro Prisma por data**: usar `parseLocalDate(data, '00:00:00')` e `parseLocalDate(data, '23:59:59')`. NUNCA `new Date(data + 'T00:00:00')`.
- [ ] **Salvar data calendário em DateTime**: usar `parseLocalDate()`. NUNCA `new Date('YYYY-MM-DD')` (vira UTC midnight = dia anterior BRT).
- [ ] **"Hoje" no app**: usar `formatLocalDate()`. NUNCA `toISOString().slice(0, 10)`.
- [ ] **Range de relatório**: filtros com `-03:00` no string (`'2026-05-19T00:00:00-03:00'`).

---

## 🔒 PRISMA — Patterns obrigatórios

### Stock writes: sempre `upsert`, nunca `updateMany`
```ts
// ❌ ERRADO — silenciosamente retorna count: 0 se linha não existir
await tx.estoqueAtual.updateMany({ where: { produtoId, local }, data: { quantidadeAtual: X } })

// ✅ CORRETO
await tx.estoqueAtual.upsert({
  where: { produtoId_local: { produtoId, local } },
  update: { quantidadeAtual: X },
  create: { produtoId, local, quantidadeAtual: X },
})
```

### Débitos atômicos: operador `decrement`, nunca `value - delta`
```ts
// ❌ ERRADO — race condition, lost update
const atual = await tx.estoque.findUnique(...)
data: { quantidade: atual.quantidade - 10 }

// ✅ CORRETO — DB aplica atomicamente
data: { quantidade: { decrement: 10 } }
```

### Transações com loops: 1 tx por iteração, NUNCA try-catch dentro
```ts
// ❌ ERRADO — tx aborta no primeiro erro, todas subsequentes falham
await prisma.$transaction(async (tx) => {
  for (const item of items) {
    try { await tx.model.create(...) }
    catch (e) { erros.push(...) }  // tx já está morta
  }
})

// ✅ CORRETO — falha isolada
for (const item of items) {
  try {
    await prisma.$transaction(async (tx) => { await tx.model.create(...) })
  } catch (e) { erros.push(...) }
}
```

### `db push --force-reset` nunca, em hipótese alguma
Em produção, APAGA TUDO. Use migrations versionadas (`prisma migrate dev` → `prisma migrate deploy`).

---

## 📅 Importação de dados externos (PDV, API terceiros)

### Importar SEMPRE dia a dia, NUNCA range multi-dia
Se importar de 16/05 a 18/05 num único range, todas as vendas vão pro dia 18.
Crie um loop:
```ts
const dias: string[] = []
let d = dataInicio
while (d <= dataFim) { dias.push(d); d = localNextDay(d) }
for (const dia of dias) {
  await importarVendas({ dataInicio: dia, dataFim: dia, ... })
}
```

### Sempre setar `dataMov` explicitamente em movimentações retroativas
```ts
await tx.movimentacaoEstoque.create({
  data: {
    produtoId, tipoMov: 'Saida', quantidade,
    dataMov: parseLocalDate(params.dataFim, '23:59:59'), // ← NÃO esquecer
  },
})
```

### Dedup via ID externo único
Salve o ID original (ex: `idItemVenda` do PDV) em `idItemExterno: string?`. Antes de importar, verifique se já existe.

### Sempre reimportar ontem nos crons
PDVs locais podem sincronizar tarde. Cron das 4h reprocessa ontem+hoje (com `substituir=true` que apaga registros antigos da mesma referência).

---

## 🚨 Alertas / Monitoramento

### Não confiar em "status: ok" para inferir saúde
Sistema pode importar com `totalVendas: 0` e marcar como sucesso. Adicione checagens específicas:
- Ontem teve >0 vendas?
- Última importação foi há <2h?
- Algum dia útil teve sales=0 inesperadamente?

### Webhook obrigatório em produção
- Discord (mais simples) ou Telegram
- Variável `ALERTA_WEBHOOK_URL` no Coolify
- Throttle de 4h pra não floodar
- Só dispara entre 6h e 23h (não acordar admin)

---

## 🚀 Deploy Coolify — Pegadinhas

### Webhook de auto-deploy NÃO funciona
Painel Coolify roda HTTP, GitHub exige HTTPS para webhooks. Após `git push`, precisa clicar **"Redeploy"** manualmente.

### Pre-deploy command obrigatório (migrations)
No Coolify, em "Pre-deployment command":
```
npx prisma migrate deploy
```

### Sempre teste TypeScript local antes do push
```bash
cd backend && npx tsc --noEmit
cd mobile && npx tsc --noEmit
```
Coolify só descobre erros no build remoto (15min de espera por nada).

### Env vars sensíveis
- `JWT_SECRET`, `JWT_REFRESH_SECRET` (256-bit random)
- `DATABASE_URL` (do próprio Coolify postgres)
- `COLIBRI_CLIENT_ID`, `COLIBRI_STORE_ID` (se integrar PDV)
- `ALERTA_WEBHOOK_URL`

### Recursos VPS Locaweb (mínimo)
- 2 vCPU, 4GB RAM (com folga p/ build npm)
- 40GB SSD
- Build pode falhar com exit 255 se falta memória — retry

---

## 📱 Mobile (Expo + EAS)

### Conta Expo dedicada por projeto
Não compartilhar conta entre projetos diferentes (limites de build separados).

### `eas.json` profile production
```json
{
  "production": {
    "distribution": "internal",
    "channel": "production",
    "env": { "EXPO_PUBLIC_API_URL": "https://SEU_DOMINIO/api/v1" },
    "android": { "buildType": "apk" }
  }
}
```

### EAS Build Windows precisa Node 18.13+
Nodes antigos no Windows criam tar com permissões zeradas → build falha "package.json does not exist".

### Distribuição
- Use `distribution: "internal"` (gera APK direto, sem Google Play)
- Compartilhe link do build (https://expo.dev/accounts/.../builds/...)

### Access Token Expo
- Para builds via CI ou agente, criar em https://expo.dev/accounts/USUARIO/settings/access-tokens
- **Revogar após uso** (especialmente se compartilhou em chat/log)

---

## 🗂️ Estrutura de pastas recomendada

```
PROJETO/
├── backend/
│   ├── src/
│   │   ├── modules/         # 1 pasta por módulo (auth, estoque, etc)
│   │   │   └── X/
│   │   │       ├── X.service.ts
│   │   │       ├── X.controller.ts
│   │   │       └── X.routes.ts
│   │   ├── shared/          # dateLocal.ts, errors.ts, logger.ts, jobs.ts
│   │   └── config/          # prisma.ts, env.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── .env.example
├── mobile/
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   ├── services/api/    # RTK Query slices
│   │   ├── utils/dateLocal.ts
│   │   └── theme/
│   ├── app.config.ts
│   └── eas.json
├── deploy/
│   ├── nginx-multi-projeto.conf
│   └── setup-vps.sh
├── .gitignore               # core/, memory/, sessions/, workflows/, backups/
├── CLAUDE.md                # instruções da IA
├── ERROR_DNA.md             # registro de bugs (copiar do APPCONTAGEM)
└── DEPLOY_GUIDE.md
```

---

## ✅ Checklist antes do primeiro deploy

- [ ] `dateLocal.ts` criado em backend E mobile
- [ ] Todos `toISOString().slice(0, 10)` substituídos por `formatLocalDate()`
- [ ] Todos `new Date('YYYY-MM-DD')` substituídos por `parseLocalDate()`
- [ ] Toda escrita em estoque usa `upsert` (nunca `updateMany`)
- [ ] Todo débito usa `{ decrement }` (nunca subtração manual)
- [ ] Nenhum `try-catch` dentro de `$transaction`
- [ ] `prisma migrate deploy` no pre-deployment do Coolify
- [ ] `ALERTA_WEBHOOK_URL` configurado
- [ ] `npx tsc --noEmit` passa em backend e mobile
- [ ] `.env.production` fora do git, valores no Coolify
- [ ] Backup diário configurado (job cron 2h da manhã)
- [ ] Senha root da VPS forte e única
- [ ] SSH key configurada (não usar senha)

---

## 🆘 Quando algo der errado

1. Consulte `ERROR_DNA.md` deste projeto — provavelmente já aconteceu antes
2. Pergunte "essa data está em UTC ou BRT?" antes de qualquer hipótese
3. Pergunte "essa operação é atômica?" antes de qualquer hipótese
4. Verifique `git log` do APPCONTAGEM — vários fixes prontos
