import { prisma } from '../src/config/prisma.js'

const deletados = await prisma.estoqueAtual.deleteMany({
  where: { quantidadeAtual: 0 },
})
console.log(`Registros removidos: ${deletados.count}`)
await prisma.$disconnect()
