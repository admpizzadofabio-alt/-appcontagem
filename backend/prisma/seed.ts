import { PrismaClient } from '@prisma/client'
import argon2 from 'argon2'

const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 }

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  const hashAdmin = await argon2.hash('123456', ARGON2_OPTIONS)
  const hashBar = await argon2.hash('111111', ARGON2_OPTIONS)
  const hashDelivery = await argon2.hash('222222', ARGON2_OPTIONS)

  // upsert.update vazio: se o usuário já existir, NÃO sobrescreve o PIN.
  // O PIN só é setado na criação inicial. Re-rodar o seed é seguro pra PINs alterados.
  await prisma.usuario.upsert({
    where: { id: 'admin-master' },
    update: {},
    create: {
      id: 'admin-master',
      nome: 'Admin Master',
      pin: hashAdmin,
      pinFormat: 'argon2id',
      setor: 'Admin',
      nivelAcesso: 'Admin',
      ativo: true,
    },
  })

  await prisma.usuario.upsert({
    where: { id: 'operador-bar' },
    update: {},
    create: {
      id: 'operador-bar',
      nome: 'Operador Bar',
      pin: hashBar,
      pinFormat: 'argon2id',
      setor: 'Bar',
      nivelAcesso: 'Operador',
      ativo: true,
    },
  })

  await prisma.usuario.upsert({
    where: { id: 'operador-delivery' },
    update: {},
    create: {
      id: 'operador-delivery',
      nome: 'Operador Delivery',
      pin: hashDelivery,
      pinFormat: 'argon2id',
      setor: 'Delivery',
      nivelAcesso: 'Operador',
      ativo: true,
    },
  })

  console.log(`✅ Seed concluído!`)
  console.log(`   Admin:    PIN 123456`)
  console.log(`   Bar:      PIN 111111`)
  console.log(`   Delivery: PIN 222222`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
