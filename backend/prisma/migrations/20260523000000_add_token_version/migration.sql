-- AlterTable: adiciona tokenVersion para revogação imediata de sessões
ALTER TABLE "Usuario" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
