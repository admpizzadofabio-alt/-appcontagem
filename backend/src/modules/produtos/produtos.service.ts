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

export async function resetarCargaInicial(id: string, local: string, usuarioId: string, usuarioNome: string) {
  const prod = await prisma.produto.findUnique({ where: { id } })
  if (!prod) throw new NotFoundError('Produto não encontrado')

  const jaExiste = await prisma.movimentacaoEstoque.count({
    where: { produtoId: id, tipoMov: 'CargaInicial', localOrigem: local },
  })
  if (jaExiste === 0) throw new BusinessRuleError(`Produto não possui carga inicial registrada para ${local}.`)

  await prisma.$transaction(async (tx) => {
    await tx.movimentacaoEstoque.deleteMany({ where: { produtoId: id, tipoMov: 'CargaInicial', localOrigem: local } })
    await tx.estoqueAtual.updateMany({ where: { produtoId: id, local }, data: { quantidadeAtual: 0, atualizadoPor: usuarioId } })
    // Limpa marcoInicialEm apenas quando não existem mais cargas em nenhum local
    const restantes = await tx.movimentacaoEstoque.count({ where: { produtoId: id, tipoMov: 'CargaInicial' } })
    if (restantes === 0) {
      await tx.produto.update({ where: { id }, data: { marcoInicialEm: null } })
    }
    await tx.logAuditoria.create({
      data: {
        usuarioId,
        usuarioNome,
        setor: 'Admin',
        acao: 'CARGA_INICIAL_RESET',
        entidade: 'Produto',
        idReferencia: id,
        detalhes: JSON.stringify({ produto: prod.nomeBebida, local }),
      },
    })
  })
}

export async function excluirFisico(id: string) {
  const prod = await prisma.produto.findUnique({ where: { id } })
  if (!prod) throw new NotFoundError('Produto não encontrado')

  await prisma.$transaction(async (tx) => {
    const [movs, contagensFechadas, pedidos] = await Promise.all([
      tx.movimentacaoEstoque.count({ where: { produtoId: id } }),
      tx.itemContagem.count({ where: { produtoId: id, contagem: { status: 'Fechada' } } }),
      tx.pedidoCompra.count({ where: { produtoId: id } }),
    ])

    if (movs + contagensFechadas + pedidos > 0) {
      throw new BusinessRuleError(
        'Produto possui histórico (movimentações ou contagens finalizadas) e não pode ser excluído. Use "Desativar" para ocultá-lo.'
      )
    }

    await tx.itemContagem.deleteMany({
      where: { produtoId: id, contagem: { status: { not: 'Fechada' } } },
    })
    await tx.estoqueAtual.deleteMany({ where: { produtoId: id } })
    await tx.colibriProduto.deleteMany({ where: { produtoId: id } })
    await tx.produto.delete({ where: { id } })
  })
}
