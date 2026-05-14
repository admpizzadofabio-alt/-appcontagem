# Deploy — Novas features (Sessão 2026-05-14)

Suplemento ao `DEPLOY_GUIDE.md`. Lista features adicionadas nesta sessão e como configurar.

## Checklist pré-deploy

- [ ] Build backend: `cd backend && npx tsc --noEmit` → sem erros
- [ ] Build mobile: `cd mobile && npx tsc --noEmit` → sem erros
- [ ] Migration aplicada: `prisma db push` (campos novos: `MovimentacaoEstoque.idItemVendasColibri`, `Usuario.totpSecret`, `Usuario.totpEnabled`)
- [ ] Backup recente em `backend/backups/`

## Variáveis novas no `.env` (produção)

```bash
# Sentry — error tracking. Free tier sentry.io (5k erros/mês).
# Sem DSN, captura vira no-op (zero overhead).
SENTRY_DSN=https://xxx@oXXX.ingest.sentry.io/XXX
SENTRY_TRACES_SAMPLE_RATE=0.1

# Alerta webhook — Colibri offline >2h, divergência grande
# Discord (mais simples): cria webhook em Server Settings → Integrations
ALERTA_WEBHOOK_URL=https://discord.com/api/webhooks/...
# Alternativa Slack: https://hooks.slack.com/services/...
# Alternativa Telegram: https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>&text=
```

## Endpoints novos (todos requerem auth Admin/Supervisor)

| Endpoint | O que faz |
|---|---|
| `GET /api/v1/health` | Health check com checks DB + Colibri (use no monitor Locaweb) |
| `GET /api/v1/relatorios/cmv?dataInicio=&dataFim=` | CMV por produto |
| `GET /api/v1/relatorios/loss-rate?dataInicio=&dataFim=` | % perda por turno |
| `GET /api/v1/relatorios/vendas-por-hora?dataInicio=&dataFim=` | Picos por hora |
| `GET /api/v1/relatorios/transferencias?dataInicio=&dataFim=` | Saldo Bar↔Delivery |
| `GET /api/v1/relatorios/auditoria?busca=&acao=&take=&skip=` | Logs filtrados |
| `GET /api/v1/relatorios/export/movimentacoes?dataInicio=&dataFim=` | CSV |
| `GET /api/v1/relatorios/export/estoque` | CSV |
| `GET /api/v1/relatorios/export/contagens?dataInicio=&dataFim=` | CSV |
| `POST /api/v1/auth/totp/setup` | Inicia 2FA (Admin) |
| `POST /api/v1/auth/totp/enable {code}` | Confirma código 2FA |
| `POST /api/v1/auth/totp/disable` | Desativa 2FA |

## Jobs internos novos (cron via `setInterval`)

| Job | Horário | Função |
|---|---|---|
| Backup diário | 02h | `criarBackup()` + rotaciona >30 dias |
| Retenção fotos | 03h | Apaga base64 de movs >90 dias (não deleta o registro, só zera foto) |
| Monitor Colibri | a cada 30min | Alerta webhook se sem importar >2h (com throttle 4h, só entre 6h-23h) |
| Recuperação Colibri startup | ao iniciar | Se última importação >6h, importa 7 dias |

## Mudanças críticas que afetam dados

1. **Timezone correto em datas** — todo `toISOString().slice(0,10)` foi substituído por helper `formatLocalDate` (Brasília). Em produção (servidor UTC), datas finalmente fecham certo após 21h BRT.

2. **Dedup Colibri por `idItemVenda`** — campo novo na tabela. Movimentos antigos (sem o ID) continuam funcionando; novos preservam IDs pra evitar duplicação.

3. **`abrirTurno` usa range padronizado** (ontem→hoje, igual cron) — refOrigem coincide → substituir funciona corretamente.

4. **Advisory lock Postgres** em imports — protege contra race com PM2 cluster.

## Setup 2FA (após deploy)

1. Admin loga no app
2. Mais → **Autenticação 2 Fatores**
3. Toca **Iniciar configuração** → QR code aparece
4. No celular, abre Google Authenticator / Authy → Adicionar conta → Escanear QR
5. Digita o código de 6 dígitos no app pra confirmar
6. A partir do próximo login, app pedirá o código TOTP

⚠️ **Importante**: sem 2FA ativo, o admin loga só com PIN como antes. Compatível com o sistema atual.

## Webhooks de alerta — exemplos rápidos

**Discord** (recomendado):
1. Server Settings → Integrations → Webhooks → New Webhook
2. Escolhe canal (ex.: `#alertas-bar`)
3. Copy URL → cola em `ALERTA_WEBHOOK_URL` do `.env`

**Telegram**:
1. Cria bot via `@BotFather` → recebe TOKEN
2. Manda mensagem pro bot, depois acessa `https://api.telegram.org/bot<TOKEN>/getUpdates` → vê seu `chat_id`
3. URL: `https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>&text=`

## Testes pós-deploy

```bash
# Health check
curl https://contagem.sistemaspizzafabio.com/api/v1/health
# Esperado: {"status":"ok","db":"ok","colibri":{...},"uptime_s":N}

# Trigger Colibri manual (precisa token Admin)
curl -X POST https://contagem.sistemaspizzafabio.com/api/v1/colibri/importar-pendente \
  -H "Authorization: Bearer SEU_TOKEN"

# Webhook test (forçar alerta)
# 1. Para o backend por 3h
# 2. Sobe → o cron de saúde Colibri vai disparar
```

## Rollback se algo der errado

```bash
# Na VPS
cd /var/www/appcontagem/backend
npm run prisma:restore  # restaura último backup automatizado
pm2 restart appcontagem-prod
```
