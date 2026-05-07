import { prisma } from '../src/config/prisma.js'

console.log('Destravando todas as contas (reset loginAttempts + bloqueadoAte)...')

const r = await prisma.usuario.updateMany({
  data: {
    loginAttempts: 0,
    bloqueadoAte: null,
  },
})

console.log(`✓ ${r.count} usuário(s) destravado(s).`)

const usuarios = await prisma.usuario.findMany({
  select: { nome: true, setor: true, nivelAcesso: true, ativo: true },
  orderBy: { nome: 'asc' },
})
console.log('\nUsuários no banco:')
for (const u of usuarios) {
  console.log(`  - ${u.nome} (${u.setor} · ${u.nivelAcesso}) ${u.ativo ? '' : '[INATIVO]'}`)
}

await prisma.$disconnect()
console.log('\nPronto. PINs do seed: Admin=1234, Bar=1111, Delivery=2222')
