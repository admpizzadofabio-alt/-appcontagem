import argon2 from 'argon2'
import { prisma } from '../src/config/prisma.js'

const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 }

const userId = process.argv[2]
const novoPin = process.argv[3]

if (!userId || !novoPin) {
  console.log('Uso: npx tsx scripts/set-pin.ts <userId> <novoPin>')
  console.log('Exemplo: npx tsx scripts/set-pin.ts operador-bar 9999')
  console.log('\nUsuários disponíveis:')
  const us = await prisma.usuario.findMany({ select: { id: true, nome: true, setor: true } })
  for (const u of us) console.log(`  - ${u.id}  (${u.nome} · ${u.setor})`)
  await prisma.$disconnect()
  process.exit(1)
}

const u = await prisma.usuario.findUnique({ where: { id: userId } })
if (!u) {
  console.error(`Usuário ${userId} não encontrado.`)
  await prisma.$disconnect()
  process.exit(1)
}

const hash = await argon2.hash(novoPin, ARGON2_OPTIONS)
await prisma.usuario.update({
  where: { id: userId },
  data: {
    pin: hash,
    pinFormat: 'argon2id',
    loginAttempts: 0,
    bloqueadoAte: null,
  },
})

console.log(`✓ PIN de "${u.nome}" definido para: ${novoPin}`)
await prisma.$disconnect()
