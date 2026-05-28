/**
 * Aplica alterações de enum que exigem permissão de dono no PostgreSQL.
 * Executado antes do prisma db push para evitar falha no startup.
 * Usa IF NOT EXISTS para ser idempotente (seguro rodar várias vezes).
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixEnums() {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "NivelAcesso" ADD VALUE IF NOT EXISTS 'Comprador'`
    )
    console.log('✅ Enum NivelAcesso: Comprador verificado/adicionado')
  } catch (e: any) {
    // Permissão negada: enum já existe ou usuário não é owner — não é fatal
    if (e.message?.includes('already exists')) {
      console.log('✅ Enum NivelAcesso: Comprador já existe')
    } else {
      console.warn('⚠️  fix-enums: não foi possível alterar enum (permissão?). Continuando...', e.message)
    }
  } finally {
    await prisma.$disconnect()
  }
}

fixEnums()