-- CreateTable
CREATE TABLE "Setor" (
    "id"         TEXT NOT NULL,
    "nome"       TEXT NOT NULL,
    "temEstoque" BOOLEAN NOT NULL DEFAULT false,
    "ativo"      BOOLEAN NOT NULL DEFAULT true,
    "criadoEm"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Setor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Setor_nome_key" ON "Setor"("nome");

-- Seed setores padrão
INSERT INTO "Setor" ("id", "nome", "temEstoque", "ativo", "criadoEm") VALUES
  (gen_random_uuid(), 'Bar',      true,  true, NOW()),
  (gen_random_uuid(), 'Delivery', true,  true, NOW()),
  (gen_random_uuid(), 'Cozinha',  false, true, NOW()),
  (gen_random_uuid(), 'Salão',    false, true, NOW());
