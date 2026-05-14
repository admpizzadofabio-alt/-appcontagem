import { prisma } from '../../config/prisma.js'

export async function macro(dataInicio?: string, dataFim?: string) {
  const whereData: any = {}
  if (dataInicio || dataFim) {
    whereData.dataMov = {}
    if (dataInicio) whereData.dataMov.gte = new Date(dataInicio)
    if (dataFim) whereData.dataMov.lte = new Date(dataFim)
  }

  const [estoque, movimentacoes, contagens, aprovacoesPendentes] = await Promise.all([
    prisma.estoqueAtual.findMany({ include: { produto: true } }),
    prisma.movimentacaoEstoque.findMany({ where: whereData, include: { produto: true } }),
    prisma.contagemEstoque.count({ where: { status: 'Fechada' } }),
    prisma.aprovacaoMovimentacao.count({ where: { status: 'Pendente' } }),
  ])

  const valorAtivo = estoque.reduce((acc, e) => acc + e.quantidadeAtual * e.produto.custoUnitario, 0)
  const totalEntradas = movimentacoes.filter((m) => m.tipoMov === 'Entrada').reduce((acc, m) => acc + m.quantidade * m.produto.custoUnitario, 0)
  const totalSaidas = movimentacoes.filter((m) => m.tipoMov === 'Saida').reduce((acc, m) => acc + m.quantidade * m.produto.custoUnitario, 0)
  const totalPerdas = movimentacoes.filter((m) => m.tipoMov === 'AjustePerda').reduce((acc, m) => acc + m.quantidade * m.produto.custoUnitario, 0)

  return { valorAtivo, totalEntradas, totalSaidas, totalPerdas, contagens, aprovacoesPendentes }
}

export async function saidas(filtros: { dataInicio?: string; dataFim?: string; local?: string }) {
  const where: any = { tipoMov: 'Saida' }
  if (filtros.local) where.OR = [{ localOrigem: filtros.local }, { localDestino: filtros.local }]
  if (filtros.dataInicio || filtros.dataFim) {
    where.dataMov = {}
    if (filtros.dataInicio) where.dataMov.gte = new Date(filtros.dataInicio)
    if (filtros.dataFim) where.dataMov.lte = new Date(filtros.dataFim)
  }

  return prisma.movimentacaoEstoque.findMany({
    where,
    include: {
      produto: { select: { nomeBebida: true, unidadeMedida: true } },
      usuario: { select: { nome: true } },
    },
    orderBy: { dataMov: 'desc' },
  })
}

export async function perdas(filtros: { dataInicio?: string; dataFim?: string }) {
  const where: any = { tipoMov: 'AjustePerda' }
  if (filtros.dataInicio || filtros.dataFim) {
    where.dataMov = {}
    if (filtros.dataInicio) where.dataMov.gte = new Date(filtros.dataInicio)
    if (filtros.dataFim) where.dataMov.lte = new Date(filtros.dataFim)
  }

  return prisma.movimentacaoEstoque.findMany({
    where,
    include: {
      produto: { select: { nomeBebida: true, unidadeMedida: true } },
      usuario: { select: { nome: true } },
      aprovacao: true,
    },
    orderBy: { dataMov: 'desc' },
  })
}

export async function divergencias(dataInicio?: string, dataFim?: string) {
  const where: any = { status: 'Fechada', totalDesvios: { gt: 0 } }
  if (dataInicio || dataFim) {
    where.dataFechamento = {}
    if (dataInicio) where.dataFechamento.gte = new Date(dataInicio)
    if (dataFim) where.dataFechamento.lte = new Date(dataFim)
  }

  return prisma.contagemEstoque.findMany({
    where,
    include: {
      operador: { select: { nome: true } },
      itens: {
        where: { diferenca: { not: 0 } },
        include: { produto: { select: { nomeBebida: true, unidadeMedida: true } } },
      },
    },
    orderBy: { dataFechamento: 'desc' },
    take: 30,
  })
}

export async function auditoria(filtros: {
  take?: number; skip?: number
  usuarioId?: string; acao?: string; entidade?: string
  dataInicio?: string; dataFim?: string; busca?: string
} = {}) {
  const where: any = {}
  if (filtros.usuarioId) where.usuarioId = filtros.usuarioId
  if (filtros.acao) where.acao = { contains: filtros.acao, mode: 'insensitive' }
  if (filtros.entidade) where.entidade = filtros.entidade
  if (filtros.dataInicio || filtros.dataFim) {
    where.dataEvento = {}
    if (filtros.dataInicio) where.dataEvento.gte = new Date(filtros.dataInicio + 'T00:00:00-03:00')
    if (filtros.dataFim) where.dataEvento.lte = new Date(filtros.dataFim + 'T23:59:59-03:00')
  }
  if (filtros.busca) {
    where.OR = [
      { usuarioNome: { contains: filtros.busca, mode: 'insensitive' } },
      { detalhes: { contains: filtros.busca, mode: 'insensitive' } },
      { idReferencia: { equals: filtros.busca } },
    ]
  }

  const [total, items] = await Promise.all([
    prisma.logAuditoria.count({ where }),
    prisma.logAuditoria.findMany({
      where,
      orderBy: { dataEvento: 'desc' },
      take: filtros.take ?? 200,
      skip: filtros.skip ?? 0,
    }),
  ])
  return { total, items, take: filtros.take ?? 200, skip: filtros.skip ?? 0 }
}
