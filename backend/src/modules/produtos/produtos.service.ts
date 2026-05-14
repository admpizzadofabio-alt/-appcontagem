import { prisma } from '../../config/prisma.js'
import { NotFoundError, BusinessRuleError } from '../../shared/errors.js'
import { validarBase64Imagem } from '../../shared/validarImagem.js'

export async function listar(filtroAtivo?: boolean) {
  const where = filtroAtivo !== undefined ? { ativo: filtroAtivo } : {}
  return prisma.produto.findMany({
    where,
    orderBy: { nomeBebida: 'asc' },
  })
}

export async function criar(data: { nomeBebida: string; categoria: string; unidadeMedida: string; volumePadrao?: string; custoUnitario?: number; estoqueMinimo?: number; setorPadrao?: string; imagem?: string }) {
  if (data.imagem) validarBase64Imagem(data.imagem, 'imagem')
  return prisma.produto.create({ data })
}

export async function atualizar(id: string, data: Partial<{ nomeBebida: string; categoria: string; unidadeMedida: string; volumePadrao: string; custoUnitario: number; estoqueMinimo: number; perdaThreshold: number; setorPadrao: string; imagem: string; ativo: boolean }>) {
  const prod = await prisma.produto.findUnique({ where: { id } })
  if (!prod) throw new NotFoundError('Produto não encontrado')
  if (data.imagem) validarBase64Imagem(data.imagem, 'imagem')
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

  const [movs, contagensFechadas, pedidos] = await Promise.all([
    prisma.movimentacaoEstoque.count({ where: { produtoId: id } }),
    prisma.itemContagem.count({
      where: { produtoId: id, contagem: { status: 'Fechada' } },
    }),
    prisma.pedidoCompra.count({ where: { produtoId: id } }),
  ])

  if (movs + contagensFechadas + pedidos > 0) {
    throw new BusinessRuleError(
      'Produto possui histórico (movimentações ou contagens finalizadas) e não pode ser excluído. Use "Desativar" para ocultá-lo.'
    )
  }

  // Remove todos os registros dependentes sem histórico real antes de deletar
  await prisma.$transaction([
    // Itens de contagens canceladas/abertas (as fechadas já bloquearam acima)
    prisma.itemContagem.deleteMany({
      where: { produtoId: id, contagem: { status: { not: 'Fechada' } } },
    }),
    prisma.estoqueAtual.deleteMany({ where: { produtoId: id } }),
    prisma.colibriProduto.deleteMany({ where: { produtoId: id } }),
    prisma.produto.delete({ where: { id } }),
  ])
}
