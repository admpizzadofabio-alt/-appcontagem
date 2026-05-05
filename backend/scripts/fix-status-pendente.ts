import { prisma } from '../src/config/prisma.js'

const result = await prisma.movimentacaoEstoque.updateMany({
  where: { tipoMov: 'AjustePerda', aprovacaoStatus: 'Pendente' },
  data: { aprovacaoStatus: 'Aprovado' },
})
console.log(`Registros atualizados: ${result.count}`)
await prisma.$disconnect()
