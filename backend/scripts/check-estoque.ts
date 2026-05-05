import { prisma } from '../src/config/prisma.js'

const estoque = await prisma.estoqueAtual.findMany({ include: { produto: true } })
estoque.forEach((e) => console.log(e.local, e.quantidadeAtual, e.produto.nomeBebida))
await prisma.$disconnect()
