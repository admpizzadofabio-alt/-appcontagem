-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "setor" TEXT NOT NULL,
    "nivelAcesso" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nomeBebida" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "unidadeMedida" TEXT NOT NULL,
    "volumePadrao" TEXT,
    "custoUnitario" REAL NOT NULL DEFAULT 0,
    "estoqueMinimo" REAL NOT NULL DEFAULT 0,
    "setorPadrao" TEXT NOT NULL DEFAULT 'Todos',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "imagem" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EstoqueAtual" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "produtoId" TEXT NOT NULL,
    "local" TEXT NOT NULL,
    "quantidadeAtual" REAL NOT NULL DEFAULT 0,
    "atualizadoEm" DATETIME NOT NULL,
    "atualizadoPor" TEXT,
    CONSTRAINT "EstoqueAtual_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MovimentacaoEstoque" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dataMov" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "produtoId" TEXT NOT NULL,
    "tipoMov" TEXT NOT NULL,
    "quantidade" REAL NOT NULL,
    "localOrigem" TEXT,
    "localDestino" TEXT,
    "usuarioId" TEXT NOT NULL,
    "observacao" TEXT,
    "imagemComprovante" TEXT,
    "referenciaOrigem" TEXT,
    CONSTRAINT "MovimentacaoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovimentacaoEstoque_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContagemEstoque" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dataContagem" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "local" TEXT NOT NULL,
    "responsavelId" TEXT,
    "operadorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Aberta',
    "dataAbertura" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataFechamento" DATETIME,
    CONSTRAINT "ContagemEstoque_operadorId_fkey" FOREIGN KEY ("operadorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemContagem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contagemId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidadeSistema" REAL NOT NULL,
    "quantidadeContada" REAL NOT NULL,
    "diferenca" REAL NOT NULL,
    CONSTRAINT "ItemContagem_contagemId_fkey" FOREIGN KEY ("contagemId") REFERENCES "ContagemEstoque" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItemContagem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PedidoCompra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "idGrupo" TEXT NOT NULL,
    "dataPedido" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "produtoId" TEXT,
    "nomeProduto" TEXT NOT NULL,
    "quantidade" REAL NOT NULL,
    "setorSolicitante" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "observacao" TEXT,
    "urgente" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'Pendente',
    CONSTRAINT "PedidoCompra_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PedidoCompra_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dataEvento" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT,
    "usuarioNome" TEXT NOT NULL,
    "setor" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "idReferencia" TEXT,
    "detalhes" TEXT,
    CONSTRAINT "LogAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "EstoqueAtual_produtoId_local_key" ON "EstoqueAtual"("produtoId", "local");
