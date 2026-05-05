import { prisma } from '../../config/prisma.js'
import { NotFoundError, BusinessRuleError } from '../../shared/errors.js'

export async function criarRascunho(data: {
  contagemId: string
  produtoId: string
  quantidade: number
  origemTexto: string
  observacao?: string
  fotoEvidencia: string
  operadorId: string
  local: string
}) {
  const produto = await prisma.produto.findUnique({ where: { id: data.produtoId } })
  if (!produto) throw new NotFoundError('Produto não encontrado')

  return prisma.entradaRascunho.create({ data })
}

export async function listarRascunhosPendentes() {
  const rascunhos = await prisma.entradaRascunho.findMany({
    where: { status: 'Pendente' },
    orderBy: { criadoEm: 'desc' },
  })

  // Hidrata produto e operador
  const result: any[] = []
  for (const r of rascunhos) {
    const [produto, operador] = await Promise.all([
      prisma.produto.findUnique({ where: { id: r.produtoId }, select: { nomeBebida: true, unidadeMedida: true, custoUnitario: true } }),
      prisma.usuario.findUnique({ where: { id: r.operadorId }, select: { nome: true } }),
    ])
    result.push({ ...r, produto, operador })
  }
  return result
}

export async function decidirRascunho(
  rascunhoId: string,
  acao: 'aprovar' | 'vincular' | 'rejeitar',
  decididoPor: string,
  decididoNome: string,
  vinculadoA?: string,
  motivoDecisao?: string,
) {
  const rascunho = await prisma.entradaRascunho.findUnique({ where: { id: rascunhoId } })
  if (!rascunho) throw new NotFoundError('Rascunho não encontrado')
  if (rascunho.status !== 'Pendente') throw new BusinessRuleError('Rascunho já decidido')

  return prisma.$transaction(async (tx) => {
    if (acao === 'aprovar') {
      const mov = await tx.movimentacaoEstoque.create({
        data: {
          produtoId: rascunho.produtoId,
          tipoMov: 'Entrada',
          quantidade: rascunho.quantidade,
          localDestino: rascunho.local,
          usuarioId: decididoPor,
          observacao: `Aprovado de rascunho: ${rascunho.origemTexto}`,
          imagemComprovante: rascunho.fotoEvidencia,
          origemRascunho: rascunho.id,
        },
      })

      await tx.estoqueAtual.upsert({
        where: { produtoId_local: { produtoId: rascunho.produtoId, local: rascunho.local } },
        create: {
          produtoId: rascunho.produtoId,
          local: rascunho.local,
          quantidadeAtual: rascunho.quantidade,
          atualizadoPor: decididoPor,
        },
        update: {
          quantidadeAtual: { increment: rascunho.quantidade },
          atualizadoPor: decididoPor,
        },
      })

      await tx.logAuditoria.create({
        data: {
          usuarioId: decididoPor,
          usuarioNome: decididoNome,
          setor: 'Admin',
          acao: 'RASCUNHO_APROVADO',
          entidade: 'EntradaRascunho',
          idReferencia: rascunho.id,
          detalhes: JSON.stringify({ produtoId: rascunho.produtoId, quantidade: rascunho.quantidade }),
        },
      })

      return tx.entradaRascunho.update({
        where: { id: rascunhoId },
        data: {
          status: 'AprovadoComoEntrada',
          movimentacaoId: mov.id,
          decididoPor,
          decididoEm: new Date(),
          motivoDecisao,
        },
      })
    }

    if (acao === 'vincular') {
      if (!vinculadoA) throw new BusinessRuleError('Informe a movimentação a vincular')
      const movExistente = await tx.movimentacaoEstoque.findUnique({ where: { id: vinculadoA } })
      if (!movExistente) throw new NotFoundError('Movimentação para vincular não encontrada')

      await tx.logAuditoria.create({
        data: {
          usuarioId: decididoPor,
          usuarioNome: decididoNome,
          setor: 'Admin',
          acao: 'RASCUNHO_VINCULADO',
          entidade: 'EntradaRascunho',
          idReferencia: rascunho.id,
          detalhes: JSON.stringify({ vinculadoA, produtoId: rascunho.produtoId }),
        },
      })

      return tx.entradaRascunho.update({
        where: { id: rascunhoId },
        data: {
          status: 'VinculadoExistente',
          vinculadoA,
          decididoPor,
          decididoEm: new Date(),
          motivoDecisao,
        },
      })
    }

    // rejeitar
    await tx.logAuditoria.create({
      data: {
        usuarioId: decididoPor,
        usuarioNome: decididoNome,
        setor: 'Admin',
        acao: 'RASCUNHO_REJEITADO',
        entidade: 'EntradaRascunho',
        idReferencia: rascunho.id,
        detalhes: JSON.stringify({ motivo: motivoDecisao }),
      },
    })

    return tx.entradaRascunho.update({
      where: { id: rascunhoId },
      data: {
        status: 'Rejeitado',
        decididoPor,
        decididoEm: new Date(),
        motivoDecisao,
      },
    })
  })
}
