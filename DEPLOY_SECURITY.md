# Guia de Segurança para Deploy em Produção

> Documento operacional. Aplica-se a **APPCONTAGEM** e serve de **template** para qualquer projeto Node.js + Prisma + PostgreSQL (incluindo **Proteína Controle**).
>
> Cada item é uma camada independente. Se uma camada falhar, as outras ainda protegem o sistema.

---

## 0. Antes de tudo — princípios

1. **Zero confiança no cliente.** Toda autorização deve estar no backend. Mobile/web é apenas UX.
2. **Falha fechada.** Em dúvida, negue acesso. Não há "deve estar OK, vou liberar".
3. **Logs auditáveis.** Toda ação relevante (login, perda, ajuste, exclusão) precisa deixar rastro.
4. **Defesa em profundidade.** Cada controle é independente — não dependa de um só.
5. **Fail-fast em produção.** Servidor não sobe se config inseguro. Melhor descobrir agora que durante um ataque.

---

## 1. Variáveis de ambiente (CRÍTICO)

### Gere secrets fortes
```bash
# Rode na própria VPS (não no seu PC)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Gere **dois valores diferentes** — um para `JWT_SECRET`, outro para `JWT_REFRESH_SECRET`. Nunca copie o mesmo valor.

### `.env.production` mínimo

```env
NODE_ENV=production
DATABASE_URL=postgresql://USUARIO:SENHA_FORTE@localhost:5432/banco
PORT=3333
API_PREFIX=/api/v1

# 64+ caracteres, valores diferentes
JWT_SECRET=<gerado com crypto.randomBytes(64)>
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=<outro valor diferente>
JWT_REFRESH_EXPIRES_IN=30d

# Domínio real, NUNCA *
CORS_ORIGIN=https://seuapp.com.br,https://admin.seuapp.com.br
```

### Validação no código (`config/env.ts`)

O backend deve travar o startup se em produção:
- `JWT_SECRET === JWT_REFRESH_SECRET`
- `CORS_ORIGIN` contém `*`
- Qualquer secret < 64 caracteres

Já implementado em [APPCONTAGEM/backend/src/config/env.ts:25-37](backend/src/config/env.ts#L25-L37). **Replique no Proteína Controle.**

### Proteção de arquivos
- `.env.production` em `.gitignore` (raiz e backend/)
- Permissão `chmod 600 .env.production` na VPS
- Backup do `.env.production` em local separado, criptografado

---

## 2. Hash de senhas / PINs

### Use argon2id, não bcrypt nem sha256

```bash
npm install argon2
# Linux: precisa de build-essential e python3 antes
apt install -y build-essential python3
```

Parâmetros recomendados:
```ts
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,  // 64 MB
  timeCost: 3,        // 3 passes
  parallelism: 1
}
```

**Por quê argon2id e não bcrypt:**
- Memory-hard: cada thread de crack precisa de 64 MB real de RAM → GPU/FPGA não escalam
- Para PINs de baixa entropia (4–8 dígitos), é a única defesa razoável contra dump de banco
- Vencedor do Password Hashing Competition; recomendação atual da OWASP

**Por quê NÃO sha256 puro:**
- Rápido demais, sem salt nativo, sem cost factor
- Banco vazado = todos os PINs quebrados em segundos

**Por quê NÃO armazenar PIN em texto plano:** Não precisa explicar.

---

## 3. JWT — access + refresh

### Configuração
- Algoritmo: **HS256** (assinatura simétrica HMAC-SHA256)
- Access token: **1h** de vida
- Refresh token: **30d** de vida
- Refresh armazenado no banco como **SHA-256 hash** (não plaintext) — se o banco vazar, atacante tem só hashes
- **Rotação no refresh**: quando o cliente usa o refresh, o token usado é deletado e um novo é emitido

### Não faça
- ❌ Armazenar refresh token plaintext no banco
- ❌ Aceitar JWT no query param ou body (só em `Authorization: Bearer`)
- ❌ JWT em `localStorage` no web (use httpOnly cookies para apps web; no React Native está OK em SecureStore)
- ❌ Reaproveitar `JWT_SECRET` entre ambientes (dev/prod com secrets diferentes)

---

## 4. Autorização — três camadas

### Camada 1 — `requireAuth` (token válido)
Todo endpoint mutante e a maioria dos GET.

### Camada 2 — `requireNivel(['Admin'])` (nível mínimo)
Operações administrativas: CRUD usuários/produtos, fechar turno, alterar status de pedido, ver CMV/relatórios, Swagger.

### Camada 3 — Ownership/scope check no service ou controller
- Recurso pertence a usuário? `recurso.userId === req.user.sub`
- Listagens: filtro forçado pelo backend (não opt-in pelo cliente)
- Bypass para Admin/Supervisor explícito e comentado

### Regra de ouro contra IDOR
Quando um Operador tenta acessar recurso alheio, retorne **404** (não 403). 403 confirma a existência do recurso e permite enumeração de IDs.

```ts
if (!isPrivileged && recurso.userId !== req.user!.sub)
  throw new NotFoundError('Recurso não encontrado')
// NÃO: throw new ForbiddenError('Não é seu recurso')
```

---

## 5. Rate limiting (anti-brute-force / anti-DoS)

| Camada | Limite | Onde |
|---|---|---|
| Global | 300 req / 15 min por IP | `app.ts` |
| Login | 10 req / 15 min por IP | `auth.routes.ts` |
| Endpoints custosos (importação, batch) | 3 req / 5 min por usuário | rota específica |

**Pré-requisito CRÍTICO atrás de Nginx/Coolify:**
```ts
app.set('trust proxy', 1)
```
Sem isso, o limiter vê o IP do proxy (`127.0.0.1`) em vez do cliente real → ineficaz.

---

## 6. Headers HTTP

```ts
import helmet from 'helmet'
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
```

Helmet ativa: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, etc.

```ts
import cors from 'cors'
const corsOrigins = env.CORS_ORIGIN.split(',').map(o => o.trim())
app.use(cors({ origin: corsOrigins, credentials: true }))
```

---

## 7. Validação de input — Zod em todo `req.body`

```ts
const data = criarUsuarioSchema.parse(req.body)
```

Zod valida tipos, formatos (UUID, email, enum), tamanhos. Strip de campos desconhecidos. Nunca confie em `req.body.*` direto.

Para imagens base64: validar tamanho (máx 1MB), magic bytes (JPEG `FF D8 FF` / PNG `89 50 4E 47`) — ver [APPCONTAGEM/backend/src/shared/validarImagem.ts](backend/src/shared/validarImagem.ts).

---

## 8. SQL Injection

Use **Prisma ORM** ou outro ORM com queries parametrizadas. Nunca concatene strings em SQL.

Se precisar de raw query, use template literal **sem interpolar variáveis de usuário**:
```ts
// OK — literal estático
await prisma.$queryRaw`SELECT 1`

// PROIBIDO — interpolação de input
await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE id = '${userId}'`)

// OK — Prisma parametriza
await prisma.$queryRaw`SELECT * FROM users WHERE id = ${userId}`
```

---

## 9. XSS / CSRF

### XSS
- **API REST não serve HTML** → vetor classic não existe
- React Native não tem DOM → sem `innerHTML`/`dangerouslySetInnerHTML`
- React (web) → não use `dangerouslySetInnerHTML` com input do usuário
- Helmet adiciona `X-Content-Type-Options: nosniff` e `X-XSS-Protection`

### CSRF
- Apps mobile com `Authorization: Bearer` não são vulneráveis (não há cookie automaticamente enviado)
- Web app com cookie httpOnly: usar `SameSite=Strict` ou `Lax` + validação de token CSRF

---

## 10. Sanitização de logs

Não logue payloads que contenham:
- Senhas / PINs (mesmo hashed)
- Tokens (access, refresh, API keys de terceiros)
- Imagens base64 (vai entupir disco)
- CPF, dados sensíveis

Exemplo de redator no `pino-http`:
```ts
const CAMPOS_FOTO = ['fotoEvidencia', 'imagemComprovante', 'base64']
serializers: {
  req(req) {
    const body = { ...req.raw?.body }
    for (const campo of CAMPOS_FOTO) if (body[campo]) body[campo] = '[OMITIDO]'
    return { method: req.method, url: req.url, body }
  }
}
```

---

## 11. Mensagens de erro — não vaze interno

```ts
// errorHandler — sempre genérico no statusCode 500
return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' })
```

Nunca retorne `String(err)`, `err.stack`, ou nomes de tabelas/colunas no JSON. O erro completo vai para `logger.error()` para debug interno.

---

## 12. PostgreSQL — fechar para internet

```conf
# postgresql.conf
listen_addresses = 'localhost'   # NÃO '*'
ssl = on                         # se possível, mesmo localhost
```

```conf
# pg_hba.conf — só conexões locais
host  all  all  127.0.0.1/32  scram-sha-256
```

```bash
# Firewall
ufw deny 5432
ufw allow 22       # SSH
ufw allow 80       # HTTP (redirect)
ufw allow 443      # HTTPS
ufw enable
```

Senha do banco: 32+ caracteres aleatórios.

---

## 13. HTTPS obrigatório

Sem TLS, JWT trafega em claro → qualquer um na rota intercepta.

### Nginx + Let's Encrypt
```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d seuapp.com.br
```

### Configuração Nginx
```nginx
server {
    listen 80;
    server_name seuapp.com.br;
    return 301 https://$host$request_uri;   # força HTTPS
}

server {
    listen 443 ssl http2;
    server_name seuapp.com.br;
    ssl_certificate /etc/letsencrypt/live/seuapp.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seuapp.com.br/privkey.pem;

    location / {
        proxy_pass http://localhost:3333;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Renovação automática de certificado: `certbot renew --dry-run` para testar.

---

## 14. PM2 — process manager

```bash
npm install -g pm2
pm2 start dist/server.js --name appcontagem
pm2 startup     # auto-start no boot
pm2 save        # salva o estado atual
pm2 logs        # tail de logs
pm2 monit       # dashboard
```

Crash → reinicia automático. Limite de memória (`--max-memory-restart 500M`) para evitar OOM kill.

---

## 15. Backup do banco

Cron diário:
```bash
# /etc/cron.d/backup-postgres
0 3 * * * postgres pg_dump -Fc banco > /var/backups/banco-$(date +\%Y\%m\%d).dump
```

Retenção 30 dias. Backup off-site (S3, Backblaze) com criptografia.

Teste restore mensalmente: `pg_restore -d banco_teste backup.dump`. Backup que nunca foi testado **não é** backup.

---

## 16. Atualizações

```bash
npm audit                      # ver vulnerabilidades conhecidas
npm audit fix                  # auto-fix non-breaking
npm outdated                   # ver pacotes desatualizados
```

Atualize a cada 30 dias. Especialmente: `helmet`, `express`, `prisma`, `argon2`, `jsonwebtoken`, `cors`.

---

## 17. Fluxo de subida de uma versão nova (passo a passo)

```bash
# 1. Local — testes passando
npm run lint
npm run test
npx tsc --noEmit

# 2. Build local
npm run build

# 3. Deploy — na VPS
git pull
npm ci --omit=dev          # instala produção apenas
npx prisma generate
npx prisma db push         # ou migrate deploy se você usa migrations
npm run build
pm2 restart appcontagem

# 4. Smoke test
curl https://seuapp.com.br/api/v1/health      # esperado: 200 + db connected
curl -X POST .../auth/login -d '{...}'        # login funciona
```

---

## 18. O que NÃO fazer

- ❌ `npm install --production` em servidor sem Git LTS (use `npm ci`)
- ❌ Subir `.env.production` para o Git, mesmo "só por uma horinha"
- ❌ Commitar `node_modules/`, `dist/`, ou qualquer arquivo gerado
- ❌ Rodar `npm audit fix --force` sem ler o que vai mudar (pode quebrar deps)
- ❌ Deixar o Postgres aceitando conexão externa "só pra debug"
- ❌ Servir API HTTP sem HTTPS
- ❌ Skipar pre-commit hooks com `--no-verify` "porque tá com pressa"
- ❌ Logar passwords/PINs/tokens, mesmo que "vai apagar depois"
- ❌ Usar o mesmo banco entre dev e prod
- ❌ Compartilhar o `JWT_SECRET` por chat/email/Slack

---

## 19. Checklist final pré-deploy

Imprima isso e marque cada item antes de subir:

- [ ] `JWT_SECRET` e `JWT_REFRESH_SECRET` gerados na VPS, **diferentes entre si**, 64+ chars
- [ ] `CORS_ORIGIN` aponta para o domínio real (sem `*`)
- [ ] `NODE_ENV=production` no `.env.production`
- [ ] `DATABASE_URL` usa `localhost`, senha forte
- [ ] `.env.production` no `.gitignore`, permissão `600` na VPS
- [ ] PostgreSQL só escuta em `localhost`, firewall bloqueia 5432
- [ ] `apt install build-essential python3` rodado antes do `npm install` (argon2 nativo)
- [ ] HTTPS via Nginx + Let's Encrypt funcionando, redirect 301 HTTP→HTTPS
- [ ] PM2 com `pm2 startup` configurado para auto-start
- [ ] Backup do banco em cron, testado pelo menos uma vez
- [ ] `app.set('trust proxy', 1)` ativo (rate limit funciona)
- [ ] Helmet aplicado globalmente
- [ ] Validações fail-fast no `env.ts` para produção
- [ ] Swagger restrito a Admin (ou desabilitado em prod, se preferir)
- [ ] Smoke test pós-deploy: health, login, endpoint mutante crítico

---

## 20. Pós-deploy — monitoramento

- **Logs**: `pm2 logs` ou exportar para Papertrail/Datadog/Better Stack
- **Uptime**: UptimeRobot, Healthchecks.io (gratuito)
- **Auditoria**: `SELECT acao, COUNT(*) FROM "LogAuditoria" WHERE criadoEm > now() - interval '24 hours' GROUP BY acao` — deve ter LOGIN, MOVIMENTACAO_*, etc. Anomalias = investigar.
- **Tentativas de login falhas**: query no log para detectar brute-force que escapou do rate limit

---

## 21. Adaptação ao Proteína Controle

Este documento foi escrito a partir do APPCONTAGEM. Para o Proteína Controle (ou qualquer projeto novo):

1. Replique [config/env.ts](backend/src/config/env.ts) com as mesmas validações fail-fast
2. Replique a estratégia de hash argon2id (mesmas opções)
3. Replique o padrão `requireAuth` + `requireNivel` + ownership check em três camadas
4. Replique os rate limiters (global + login + endpoints custosos)
5. Replique o errorHandler com mensagem genérica em 500
6. Replique a sanitização de logs

**O que muda entre projetos:**
- Domínios CORS
- Modelos de dados (Prisma schema)
- Lógica de negócio
- Endpoints específicos

**O que NÃO muda:**
- Princípios de segurança (este documento)
- Stack de hash, JWT, rate limit, helmet, validação

---

## Referências

- [OWASP API Security Top 10 — 2023](https://owasp.org/API-Security/editions/2023/en/0x00-header/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Argon2 — RFC 9106](https://datatracker.ietf.org/doc/rfc9106/)
- [Helmet docs](https://helmetjs.github.io/)
- [SECURITY_FINDINGS.md](SECURITY_FINDINGS.md) — vulnerabilidades históricas deste projeto, com causa raiz e fix
