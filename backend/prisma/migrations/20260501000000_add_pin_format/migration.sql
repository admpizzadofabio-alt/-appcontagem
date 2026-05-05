-- CreateEnum
CREATE TYPE "PinFormat" AS ENUM ('plaintext', 'sha256', 'bcrypt');

-- AlterTable: adiciona coluna pinFormat com default sha256 para usuários existentes
ALTER TABLE "Usuario" ADD COLUMN "pinFormat" "PinFormat" NOT NULL DEFAULT 'sha256';

-- Marca usuários cujo pin começa com '$2' como bcrypt (migrados anteriormente)
UPDATE "Usuario" SET "pinFormat" = 'bcrypt' WHERE "pin" LIKE '$2%';

-- Marca usuários cujo pin NÃO é um hash sha256 de 64 chars hex como plaintext
UPDATE "Usuario"
SET "pinFormat" = 'plaintext'
WHERE length("pin") != 64
  AND "pin" NOT LIKE '$2%';
