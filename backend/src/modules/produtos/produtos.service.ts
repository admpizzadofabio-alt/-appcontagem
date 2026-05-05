import { prisma } from '../../config/prisma.js'
import { NotFoundError, BusinessRuleError } from '../../shared/errors.js'

export async function listar(filtroAtivo?: boolean) {
  const where = filtroAtivo !== undefined ? { ativo: filtroAtivo } : {}
  return prisma.produto.findMany({
    where,
    orderBy: { nomeBebida: 'asc' },
  })
}

export async function criar(data: { nomeBebida: string; categoria: string; unidadeMedida: string; volumePadrao?: string; custoUnitario?: number; estoqueMinimo?: number; setorPadrao?: string; imagem?: string }) {
  return prisma.produto.create({ data })
}

export async function atualizar(id: string, data: Partial<{ nomeBebida: string; categoria: string; unidadeMedida: string; volumePadrao: string; custoUnitario: number; estoqueMinimo: number; perdaThreshold: number; setorPadrao: string; imagem: string; ativo: boolean }>) {
  const prod = await prisma.produto.findUnique({ where: { id } })
  if (!prod) throw new NotFoundError('Produto não encontrado')
  return prisma.produto.update({ where: { id }, data: { ...data, revisadoAdmin: true } })
}

export async function deletar(id: string) {
  const prod = await prisma.produto.findUnique({ where: { id } })
  if (!prod) throw new NotFoundError('Produto não encontrado')
  return prisma.produto.update({ where: { id }, data: { ativo: false } })
}

export async function excluirFisico(id: string) {
  const prod = await prisma.produto.findUnique({ where: { id } })
  if (!prod) throw new NotFoundError('Produto não encontrado')

  const [movs, estoque, contagens, pedidos] = await Promise.all([
    prisma.movimentacaoEstoque.count({ where: { produtoId: id } }),
    prisma.estoqueAtual.count({ where: { produtoId: id } }),
    prisma.itemContagem.count({ where: { produtoId: id } }),
    prisma.pedidoCompra.count({ where: { produtoId: id } }),
  ])

  const total = movs + estoque + contagens + pedidos
  if (total > 0) {
    throw new BusinessRuleError(
      'Produto possui histórico (movimentações, estoque ou contagens) e não pode ser excluído. Use "Desativar" para ocultá-lo.'
    )
  }

  // Remove mapeamentos Colibri associados antes de deletar
  await prisma.colibriProduto.deleteMany({ where: { produtoId: id } })
  await prisma.produto.delete({ where: { id } })
}
