import { prisma } from '../../config/prisma.js'
import { AppError, NotFoundError } from '../../shared/errors.js'
import { StatusContagem, TipoMovimentacao } from '@prisma/client'

export async function iniciar(local: string, operadorId: string, modoCego = true, threshold = 2) {
  const aberta = await prisma.contagemEstoque.findFirst({ where: { local, status: StatusContagem.Aberta } })
  if (aberta) throw new AppError('Já existe uma contagem aberta para este local', 409, 'CONTAGEM_JA_ABERTA')

  // Busca todos os produtos ativos do setor (igual ao abrirTurno)
  const produtos = await prisma.produto.findMany({
    where: { ativo: true, OR: [{ setorPadrao: local }, { setorPadrao: 'Todos' }] },
    orderBy: { nomeBebida: 'asc' },
  })

  // Para cada produto, pega a quantidade atual em estoque (0 se ainda não tiver)
  const itensData = await Promise.all(
    produtos.map(async (p) => {
      const est = await prisma.estoqueAtual.findUnique({
        where: { produtoId_local: { produtoId: p.id, local } },
      })
      return { produtoId: p.id, quantidadeSistema: est?.quantidadeAtual ?? 0, quantidadeContada: 0, diferenca: 0, contadoPor: operadorId }
    })
  )

  const contagem = await prisma.contagemEstoque.create({
    data: {
      local,
      operadorId,
      status: StatusContagem.Aberta,
      modoCego,
      threshold,
      totalItens: itensData.length,
      itens: { create: itensData },
    },
    include: {
      itens: {
        include: { produto: { select: { nomeBebida: true, categoria: true, unidadeMedida: true, setorPadrao: true } } },
      },
    },
  })

  // No modo cego: oculta a quantidade do sistema para o operador
  if (modoCego) {
    contagem.itens = contagem.itens.map((item) => ({ ...item, quantidadeSistema: -1 })) as typeof contagem.itens
  }

  return contagem
}

export async function buscar(id: string, revelarSistema = false) {
  const c = await prisma.contagemEstoque.findUnique({
    where: { id },
    include: {
      itens: {
        include: { produto: { select: { nomeBebida: true, categoria: true, unidadeMedida: true, setorPadrao: true } } },
      },
      operador: { select: { nome: true } },
    },
  })
  if (!c) throw new NotFoundError('Contagem não encontrada')

  // Esconde quantidade do sistema se a contagem está aberta e em modo cego
  if (c.modoCego && c.status === StatusContagem.Aberta && !revelarSistema) {
    c.itens = c.itens.map((item) => ({ ...item, quantidadeSistema: -1 })) as typeof c.itens
  }

  return c
}

export async function listar(local?: string, operadorId?: string) {
  const where: any = {}
  if (local) where.local = local
  if (operadorId) where.operadorId = operadorId
  return prisma.contagemEstoque.findMany({
    where,
    orderBy: { dataContagem: 'desc' },
    take: 50,
    include: { operador: { select: { nome: true } } },
  })
}

export async function salvarItem(contagemId: string, operadorId: string, nivelAcesso: string, produtoId: string, quantidadeContada: number, causaDivergencia?: string) {
  const contagem = await prisma.contagemEstoque.findUnique({ where: { id: contagemId } })
  if (!contagem) throw new NotFoundError('Contagem não encontrada')
  if (!['Admin', 'Supervisor'].includes(nivelAcesso) && contagem.operadorId !== operadorId)
    throw new NotFoundError('Contagem não encontrada')
  if (contagem.status !== StatusContagem.Aberta) throw new AppError('Contagem não está aberta')

  const item = await prisma.itemContagem.findFirst({ where: { contagemId, produtoId } })
  if (!item) throw new NotFoundError('Item não encontrado na contagem')

  const diferenca = quantidadeContada - item.quantidadeSistema

  return prisma.itemContagem.update({
    where: { id: item.id },
    data: { quantidadeContada, diferenca, causaDivergencia },
  })
}

export async function processar(contagemId: string, operadorId: string, nivelAcesso: string, operadorNome: string, setor: string) {
  const contagem = await prisma.contagemEstoque.findUnique({
    where: { id: contagemId },
    include: { itens: { include: { produto: true } } },
  })
  if (!contagem) throw new NotFoundError('Contagem não encontrada')
  if (!['Admin', 'Supervisor'].includes(nivelAcesso) && contagem.operadorId !== operadorId)
    throw new NotFoundError('Contagem não encontrada')
  if (contagem.status !== StatusContagem.Aberta) throw new AppError('Contagem não está aberta')

  const divergencias = contagem.itens.filter((i) => i.diferenca !== 0)

  await prisma.$transaction(async (tx) => {
    for (const item of divergencias) {
      await tx.estoqueAtual.updateMany({
        where: { produtoId: item.produtoId, local: contagem.local },
        data: { quantidadeAtual: item.quantidadeContada, atualizadoPor: operadorId },
      })

      await tx.movimentacaoEstoque.create({
        data: {
          produtoId: item.produtoId,
          tipoMov: TipoMovimentacao.AjusteContagem,
          quantidade: Math.abs(item.diferenca),
          localDestino: contagem.local,
          usuarioId: operadorId,
          observacao: `Ajuste de contagem — ${item.causaDivergencia ?? 'sem causa'}`,
          referenciaOrigem: contagemId,
        },
      })
    }

    await tx.contagemEstoque.update({
      where: { id: contagemId },
      data: {
        status: StatusContagem.Fechada,
        dataFechamento: new Date(),
        totalDesvios: divergencias.length,
      },
    })

    await tx.logAuditoria.create({
      data: {
        usuarioId: operadorId,
        usuarioNome: operadorNome,
        setor,
        acao: 'CONTAGEM_FECHADA',
        entidade: 'ContagemEstoque',
        idReferencia: contagemId,
        detalhes: JSON.stringify({
          local: contagem.local,
          totalItens: contagem.itens.length,
          divergencias: divergencias.length,
        }),
      },
    })
  })

  return {
    divergencias: divergencias.length,
    totalItens: contagem.itens.length,
    itensComDesvio: divergencias.map((i) => ({
      produto: i.produto.nomeBebida,
      sistema: i.quantidadeSistema,
      contado: i.quantidadeContada,
      diferenca: i.diferenca,
      causa: i.causaDivergencia,
    })),
  }
}

export async function cancelar(contagemId: string, operadorId: string, nivelAcesso: string) {
  const c = await prisma.contagemEstoque.findUnique({ where: { id: contagemId } })
  if (!c) throw new NotFoundError('Contagem não encontrada')
  if (!['Admin', 'Supervisor'].includes(nivelAcesso) && c.operadorId !== operadorId)
    throw new NotFoundError('Contagem não encontrada')
  if (c.status !== StatusContagem.Aberta) throw new AppError('Apenas contagens abertas podem ser canceladas')
  return prisma.contagemEstoque.update({ where: { id: contagemId }, data: { status: StatusContagem.Cancelada } })
}
