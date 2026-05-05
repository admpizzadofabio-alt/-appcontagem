import { prisma } from '../src/config/prisma.js'

const estoque = await prisma.estoqueAtual.findFirst({ where: { produto: { nomeBebida: { contains: 'TONICA' } } }, include: { produto: true } })
if (!estoque) { console.log('Não encontrado'); process.exit(1) }

const novaQtd = Math.max(0, estoque.quantidadeAtual - 30)
await prisma.estoqueAtual.update({
  where: { produtoId_local: { produtoId: estoque.produtoId, local: estoque.local } },
  data: { quantidadeAtual: novaQtd },
})
console.log(`${estoque.local}: ${estoque.quantidadeAtual} → ${novaQtd} (${estoque.produto.nomeBebida})`)
await prisma.$disconnect()
