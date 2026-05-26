import { PrismaClient } from '@prisma/client'
import argon2 from 'argon2'
import crypto from 'crypto'

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

  // Usuário de sistema para jobs automáticos (Colibri cron, etc.)
  // PIN aleatório impossível de adivinhar; ativo: false = não aparece no login nem pode autenticar.
  // ID fixo 'system-cron' é referenciado em jobs.ts para FK válida em MovimentacaoEstoque.
  const pinSistema = await argon2.hash(crypto.randomBytes(32).toString('hex'), ARGON2_OPTIONS)
  await prisma.usuario.upsert({
    where: { id: 'system-cron' },
    update: {}, // nunca sobrescreve — apenas cria se não existir
    create: {
      id: 'system-cron',
      nome: 'SISTEMA (Automático)',
      pin: pinSistema,
      pinFormat: 'argon2id',
      setor: 'Admin',
      nivelAcesso: 'Admin',
      ativo: false, // inativo: não aparece na lista, não pode fazer login
    },
  })

  console.log(`✅ Seed concluído!`)
  console.log(`   Admin:    PIN 123456`)
  console.log(`   Bar:      PIN 111111`)
  console.log(`   Delivery: PIN 222222`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
