# Guia de Deploy — VPS Locaweb + Coolify

Guia baseado no deploy do **APPCONTAGEM**. Siga os mesmos passos para qualquer projeto novo (Proteína Controle, CMV, Estoque).

---

## 1. Informações da VPS

| Campo | Valor |
|---|---|
| Provedor | Locaweb |
| VPS ID | 185346 / vps66700 |
| IP Público | 191.252.93.209 |
| SO | Ubuntu 24.04 LTS |
| RAM / CPU / Disco | 4 GB / 2 vCPUs / 70 GB |
| Acesso SSH | `ssh root@191.252.93.209` |
| Painel Locaweb | painel.locaweb.com.br |
| Host Locaweb | vps66700.publiccloud.com.br |

**Portas planejadas por projeto:**
| Projeto | Subdomínio | Porta |
|---|---|---|
| APPCONTAGEM | contagem.sistemaspizzafabio.com | 3333 |
| Proteína Controle | proteina.sistemaspizzafabio.com | 3334 |
| CMV | cmv.sistemaspizzafabio.com | 3335 |
| Estoque | estoque.sistemaspizzafabio.com | 3336 |

---

## 2. Instalação do Coolify na VPS

Acesse a VPS via SSH e execute:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Após instalar, o Coolify fica acessível em: `http://191.252.93.209:8000`

> **Obs.:** O Coolify é gratuito e open-source (self-hosted). Gerencia deploys via Docker/Nixpacks automaticamente.

---

## 3. Configuração inicial do Coolify

1. Acesse `http://191.252.93.209:8000` e crie conta de admin
2. Em **Servers** → já aparece `localhost` (a própria VPS) — valide a conexão
3. Crie um **Project** (ex: "pizzafabio")
4. Dentro do project, crie um **Environment** (ex: "production")

---

## 4. Banco de Dados (PostgreSQL no Coolify)

Para cada projeto, crie um banco separado:

1. No project → **+ New Resource** → **Database** → **PostgreSQL 16**
2. Configure:
   - **Name:** `appcontagem-db` (ou `proteina-db`, etc.)
   - **PostgreSQL DB:** `appcontagem` (nome do banco)
   - **PostgreSQL User:** `postgres`
   - **PostgreSQL Password:** gere uma senha forte (sem `#` — causa problemas no terminal web)
3. Clique em **Start** e aguarde ficar **Running/Healthy**
4. Copie a **Internal DB URL** — será usada como `DATABASE_URL` na aplicação

Formato da URL interna do Coolify:
```
postgres://postgres:SENHA@NOME_CONTAINER:5432/NOME_BANCO
```

---

## 5. Repositório GitHub

O Coolify precisa acessar o código. A forma mais simples (sem domínio/HTTPS ainda):

1. Crie um repositório no GitHub
2. **Deixe o repositório público temporariamente** (enquanto não tiver domínio+HTTPS para configurar o GitHub App com webhook)
3. Faça push de todo o código do projeto para o repositório

> Depois de configurar o domínio e SSL, troque para privado e configure o GitHub App corretamente.

### Fazer push do projeto local para GitHub:

```bash
cd pasta-do-projeto
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/SEU_USUARIO/NOME_REPO.git
git push -u origin main
```

---

## 6. Configurar Aplicação no Coolify

1. No project → **+ New Resource** → **Application** → **Public Repository**
2. Cole a URL do repositório GitHub: `https://github.com/usuario/repo.git`
3. Configure:
   - **Branch:** `main`
   - **Base Directory:** `/backend` (pasta do backend dentro do repo)
   - **Port:** porta do projeto (3333, 3334, etc.)
   - **Build Pack:** Nixpacks (detecta Node.js automaticamente)

---

## 7. Variáveis de Ambiente no Coolify

Na aba **Environment Variables** da aplicação, adicione (modo Developer para colar tudo de uma vez):

```env
NODE_ENV=production
PORT=3333
DATABASE_URL=postgres://postgres:SENHA@CONTAINER:5432/BANCO
JWT_SECRET=gere-uma-chave-de-64-chars-aqui
JWT_REFRESH_SECRET=gere-outra-chave-de-64-chars-aqui
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=30d
CORS_ORIGIN=*
API_PREFIX=/api/v1
COLIBRI_BASE_URL=https://cloud.colibricloud.com
COLIBRI_CLIENT_ID=SEU_CLIENT_ID
COLIBRI_STORE_ID=SEU_STORE_ID
```

> Para gerar chaves JWT fortes:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

---

## 8. Correções obrigatórias no package.json do backend

Antes de fazer o primeiro deploy, verifique/corrija o `backend/package.json`:

### Build — deve gerar o Prisma Client antes do TypeScript:
```json
"build": "prisma generate && tsc"
```

### Start — deve usar `prisma db push` (NÃO `prisma migrate deploy`):
```json
"start": "prisma db push --accept-data-loss && node dist/server.js"
```

> **IMPORTANTE:** Não usar `prisma migrate deploy` em produção neste projeto. Os arquivos de migration foram gerados para SQLite (banco local de desenvolvimento) e contêm tipos incompatíveis com PostgreSQL (`DATETIME` em vez de `TIMESTAMP`, `REAL` em vez de `DOUBLE PRECISION`). O `prisma db push` lê o `schema.prisma` diretamente e cria as tabelas com os tipos corretos para PostgreSQL.

Sem essas correções, o deploy vai falhar ou o servidor vai subir com o banco sem tabelas.

---

## 9. Erros que apareceram e como resolver

### Erro 1 — Terminal web da Locaweb não aceita colar senha com caracteres especiais
**Sintoma:** Ao digitar senha com `#` no terminal web, o caractere é ignorado ou quebra o comando.  
**Solução:** Trocar a senha pelo painel da Locaweb para uma sem caracteres especiais (`@`, `!`, letras e números apenas). Depois usar SSH via CMD do Windows (`ssh root@IP`) — suporta colar com clique direito.

---

### Erro 2 — GitHub App falhou com erro 500 ao criar
**Sintoma:** Ao tentar configurar GitHub App no Coolify, o GitHub retorna erro 500.  
**Causa:** O GitHub exige HTTPS para configurar webhooks do GitHub App, mas o Coolify ainda está em HTTP (sem domínio/SSL configurado).  
**Solução:** Usar **Public Repository** em vez de GitHub App — funciona sem HTTPS. Deixar o repositório público temporariamente.

---

### Erro 3 — Deploy falha: `private_key on null`
**Sintoma:** Log do Coolify: `Attempt to read property private_key on null`  
**Causa:** GitHub App criado incompleto (sem private key, pois o setup automático falhou pelo erro 500).  
**Solução:** Deletar o GitHub App nas configurações do Coolify e recriar usando **Public Repository**.

---

### Erro 4 — TypeScript falha: propriedade não existe no tipo Prisma
**Sintoma:**
```
error TS2353: Object literal may only specify known properties, and 'estoqueAtual' does not exist in type 'ProdutoInclude'
```
**Causa raiz:** O script de build era `"build": "tsc"` sem gerar o Prisma Client antes. Sem o `prisma generate`, o TypeScript não conhece os tipos/relações do schema.  
**Solução:** Mudar para `"build": "prisma generate && tsc"` no `package.json`.

---

### Erro 5 — Nome de relação Prisma errado no código
**Sintoma:** Mesmo após corrigir o build, TypeScript ainda falha com o mesmo erro acima.  
**Causa:** O código usava `include: { estoqueAtual: ... }` mas o nome da relação no schema do Prisma era `estoque` (sem "Atual").  
**Solução:** Verificar o `schema.prisma` e corrigir o nome da relação no código para bater exatamente com o que está definido no schema.

> **Dica para evitar:** Sempre que mudar algo no schema ou usar uma nova relação, rodar `npx tsc --noEmit` localmente para verificar antes de fazer push.

---

### Erro 6 — Migration falha com P3018/P3009: tipos SQLite incompatíveis com PostgreSQL
**Sintoma:** O servidor fica em crash loop com erro:
```
Error: P3009 - migrate found failed migrations in the target database
The `20260422224129_init` migration started at ... failed
```
**Causa:** Os arquivos de migration foram gerados localmente com banco SQLite. O SQL gerado usa tipos SQLite (`DATETIME`, `REAL`) que não existem no PostgreSQL (que usa `TIMESTAMP`, `DOUBLE PRECISION`). O `prisma migrate deploy` tenta rodar esse SQL e falha.  
**Solução:** Usar `prisma db push --accept-data-loss` no script `start` em vez de `prisma migrate deploy`. O `db push` lê o `schema.prisma` e gera o SQL correto para o banco de destino (PostgreSQL).

Se o banco já tiver uma migration com status de falha registrada, é necessário limpar o banco antes de reiniciar:
```bash
# No SSH da VPS:
docker exec -it NOME_CONTAINER_POSTGRES psql -U postgres
# Dentro do psql:
DROP DATABASE nome_do_banco;
CREATE DATABASE nome_do_banco;
\q
```

---

### Erro 7 — Servidor rodando mas porta inacessível externamente
**Sintoma:** Deploy concluído, logs mostram "Servidor rodando em http://localhost:3333", mas o navegador retorna `ERR_CONNECTION_REFUSED` na porta 3333.  
**Causa:** O Coolify não expõe a porta do container para o host automaticamente — ele usa um proxy interno (Traefik).  
**Solução:** Em **Configuration → General → Ports Mappings**, adicionar `3333:3333` (formato `porta_host:porta_container`). Depois clicar em **Restart**.

---

## 10. Checklist de Deploy (ordem correta)

- [ ] 1. Fazer push do código para GitHub (repo público)
- [ ] 2. Criar banco PostgreSQL no Coolify e anotar a Internal DB URL
- [ ] 3. Verificar `package.json`: `build` com `prisma generate` e `start` com `prisma db push --accept-data-loss`
- [ ] 4. Criar Application no Coolify (Public Repository, Base Dir = `/backend`, porta correta)
- [ ] 5. Configurar todas as variáveis de ambiente
- [ ] 5a. Em **Ports Mappings** adicionar `PORTA:PORTA` (ex: `3334:3334`)
- [ ] 6. Clicar Deploy e acompanhar os logs
- [ ] 7. Quando aparecer **Running**, testar: `http://IP:PORTA/api/v1/health`
- [ ] 8. Se retornar `{"status":"ok","db":"connected"}` → deploy concluído
- [ ] 9. Rodar seed pelo Terminal do Coolify: `npm run prisma:seed`

---

## 11. Após o domínio estar ativo

> **Domínio:** `sistemaspizzafabio.com.br`  
> **DNS configurado na Locaweb** — todos os subdomínios apontam para `191.252.93.209`:
> - `contagem.sistemaspizzafabio.com.br` ✅
> - `proteina.sistemaspizzafabio.com.br` ✅
> - `cmv.sistemaspizzafabio.com.br` ✅
> - `estoque.sistemaspizzafabio.com.br` ✅
> 
> Propagação DNS pode levar até 48h (normalmente 15~30 min).

### Passos para ativar HTTPS no Coolify:
1. Na aplicação → **Configuration → General → Domains**
2. Substituir o domínio sslip.io pelo subdomínio real: `https://contagem.sistemaspizzafabio.com.br`
3. Coolify gera SSL Let's Encrypt automaticamente
4. Atualizar variável `CORS_ORIGIN` para o domínio real
5. Testar: `https://contagem.sistemaspizzafabio.com.br/api/v1/health`
6. Tornar o repositório GitHub privado
7. Atualizar URL no app mobile para o domínio com HTTPS

---

## 12. Estrutura final na VPS (quando todos os projetos estiverem rodando)

```
VPS 191.252.93.209
│
├── Coolify (porta 8000)
│
├── Nginx reverse proxy (portas 80/443)
│   ├── contagem.sistemaspizzafabio.com  → localhost:3333
│   ├── proteina.sistemaspizzafabio.com  → localhost:3334
│   ├── cmv.sistemaspizzafabio.com       → localhost:3335
│   └── estoque.sistemaspizzafabio.com   → localhost:3336
│
├── PostgreSQL (gerenciado pelo Coolify)
│   ├── banco: appcontagem
│   ├── banco: proteina
│   ├── banco: cmv
│   └── banco: estoque
│
└── Apps (Docker containers via Coolify)
    ├── appcontagem-backend   (porta 3333)
    ├── proteina-backend      (porta 3334)
    ├── cmv-backend           (porta 3335)
    └── estoque-backend       (porta 3336)
```
