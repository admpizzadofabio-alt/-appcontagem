import { prisma } from '../../config/prisma.js'
import { env } from '../../config/env.js'
import { NotFoundError, ForbiddenError, BusinessRuleError } from '../../shared/errors.js'
import { TipoMovimentacao, StatusAprovacao } from '@prisma/client'

function _validarLocalAcesso(setorUsuario: string, nivelAcesso: string | undefined, localAlvo: string | undefined) {
  if (!localAlvo) return
  if (nivelAcesso === 'Admin' || nivelAcesso === 'Supervisor') return
  if (setorUsuario === 'Todos' || setorUsuario === 'Admin') return
  if (setorUsuario !== localAlvo) {
    throw new ForbiddenError(`Operador do setor "${setorUsuario}" não pode operar em "${localAlvo}".`)
  }
}

type CriarData = {
  produtoId: string
  tipoMov: string
  quantidade: number
  localOrigem?: string
  localDestino?: string
  usuarioId: string
  usuarioNome: string
  setor: string
  nivelAcesso?: string
  observacao?: string
  motivoAjuste?: string
  imagemComprovante?: string
  pendente?: boolean
  justificativaEntrada?: string
}

export async function criar(data: CriarData) {
  const produto = await prisma.produto.findUnique({ where: { id: data.produtoId } })
  if (!produto) throw new NotFoundError('Produto não encontrado')

  // Operador só pode operar no próprio setor (Admin/Supervisor liberados)
  if (data.tipoMov === 'Transferencia') {
    // Em transferência: origem deve ser o setor do operador
    _validarLocalAcesso(data.setor, data.nivelAcesso, data.localOrigem)
    if (data.localOrigem === data.localDestino) {
      throw new BusinessRuleError('Origem e destino da transferência devem ser diferentes.')
    }
  } else {
    // Entrada/Saida/Perda/CargaInicial: local deve ser o setor do operador
    _validarLocalAcesso(data.setor, data.nivelAcesso, data.localOrigem ?? data.localDestino)
  }

  const threshold = produto.perdaThreshold ?? env.PERDA_THRESHOLD
  const isGrandePerda = data.tipoMov === 'AjustePerda' && data.quantidade > threshold
  const tipoMov = data.tipoMov as TipoMovimentacao

  const isPendente = tipoMov === 'Transferencia' || data.pendente === true
  const obsCompleta = data.justificativaEntrada
    ? `[Justificativa: ${data.justificativaEntrada}]${data.observacao ? ' ' + data.observacao : ''}`
    : data.observacao

  const mov = await prisma.$transaction(async (tx) => {
    const movimentacao = await tx.movimentacaoEstoque.create({
      data: {
        produtoId: data.produtoId,
        tipoMov,
        quantidade: data.quantidade,
        localOrigem: data.localOrigem,
        localDestino: data.localDestino,
        usuarioId: data.usuarioId,
        observacao: obsCompleta,
        motivoAjuste: data.motivoAjuste,
        imagemComprovante: data.imagemComprovante,
        aprovacaoStatus: isPendente ? StatusAprovacao.Pendente : StatusAprovacao.Aprovado,
      },
    })

    if (!isPendente) await _atualizarEstoque(tx, data)

    if (isPendente && tipoMov !== 'Transferencia') {
      await tx.aprovacaoMovimentacao.create({
        data: { movimentacaoId: movimentacao.id, solicitanteId: data.usuarioId },
      })
    }

    await tx.logAuditoria.create({
      data: {
        usuarioId: data.usuarioId,
        usuarioNome: data.usuarioNome,
        setor: data.setor,
        acao: `MOVIMENTACAO_${data.tipoMov}`,
        entidade: 'MovimentacaoEstoque',
        idReferencia: movimentacao.id,
        detalhes: JSON.stringify({ produto: produto.nomeBebida, quantidade: data.quantidade, motivo: data.motivoAjuste }),
      },
    })

    return { ...movimentacao, precisaAprovacao: false, isGrandePerda }
  })

  return mov
}

async function _atualizarEstoque(tx: any, data: CriarData) {
  if (['Entrada', 'CargaInicial'].includes(data.tipoMov)) {
    await _upsertEstoque(tx, data.produtoId, data.localDestino ?? data.localOrigem ?? 'Bar', data.quantidade, data.usuarioId)
  } else if (['Saida', 'AjustePerda'].includes(data.tipoMov)) {
    await _upsertEstoque(tx, data.produtoId, data.localOrigem ?? 'Bar', -data.quantidade, data.usuarioId)
  } else if (data.tipoMov === 'Transferencia') {
    await _upsertEstoque(tx, data.produtoId, data.localOrigem!, -data.quantidade, data.usuarioId)
    await _upsertEstoque(tx, data.produtoId, data.localDestino!, data.quantidade, data.usuarioId)
  }
}

async function _upsertEstoque(tx: any, produtoId: string, local: string, delta: number, usuarioId: string) {
  const existing = await tx.estoqueAtual.findUnique({ where: { produtoId_local: { produtoId, local } } })
  const novaQtd = Math.max(0, (existing?.quantidadeAtual ?? 0) + delta)
  await tx.estoqueAtual.upsert({
    where: { produtoId_local: { produtoId, local } },
    create: { produtoId, local, quantidadeAtual: Math.max(0, delta), atualizadoPor: usuarioId },
    update: { quantidadeAtual: novaQtd, atualizadoPor: usuarioId },
  })
}

export async function listar(filtros: { produtoId?: string; tipoMov?: string; local?: string; dataInicio?: string; dataFim?: string }) {
  const where: any = {}
  if (filtros.produtoId) where.produtoId = filtros.produtoId
  if (filtros.tipoMov) where.tipoMov = filtros.tipoMov
  if (filtros.local) where.OR = [{ localOrigem: filtros.local }, { localDestino: filtros.local }]
  if (filtros.dataInicio || filtros.dataFim) {
    where.dataMov = {}
    if (filtros.dataInicio) where.dataMov.gte = new Date(filtros.dataInicio)
    if (filtros.dataFim) where.dataMov.lte = new Date(filtros.dataFim)
  }

  return prisma.movimentacaoEstoque.findMany({
    where,
    orderBy: { dataMov: 'desc' },
    take: 200,
    include: {
      produto: { select: { nomeBebida: true, unidadeMedida: true, perdaThreshold: true } },
      usuario: { select: { nome: true } },
      aprovacao: true,
    },
  })
}

export async function listarTransferenciasPendentes(localDestino: string) {
  return prisma.movimentacaoEstoque.findMany({
    where: { tipoMov: 'Transferencia', aprovacaoStatus: StatusAprovacao.Pendente, localDestino },
    orderBy: { dataMov: 'desc' },
    include: {
      produto: { select: { nomeBebida: true, unidadeMedida: true } },
      usuario: { select: { nome: true } },
    },
  })
}

export async function confirmarTransferencia(movId: string, confirmadorId: string, confirmadorNome: string, setor: string) {
  return prisma.$transaction(async (tx) => {
    const mov = await tx.movimentacaoEstoque.findUnique({ where: { id: movId } })
    if (!mov) throw new NotFoundError('Transferência não encontrada')
    if (mov.tipoMov !== 'Transferencia') throw new ForbiddenError('Movimentação não é uma transferência')
    if (mov.aprovacaoStatus !== StatusAprovacao.Pendente) throw new ForbiddenError('Transferência já foi confirmada ou rejeitada')

    await tx.movimentacaoEstoque.update({
      where: { id: movId },
      data: { aprovacaoStatus: StatusAprovacao.Aprovado },
    })

    await _upsertEstoque(tx, mov.produtoId, mov.localOrigem!, -mov.quantidade, confirmadorId)
    await _upsertEstoque(tx, mov.produtoId, mov.localDestino!, mov.quantidade, confirmadorId)

    await tx.logAuditoria.create({
      data: {
        usuarioId: confirmadorId,
        usuarioNome: confirmadorNome,
        setor,
        acao: 'TRANSFERENCIA_CONFIRMADA',
        entidade: 'MovimentacaoEstoque',
        idReferencia: movId,
        detalhes: JSON.stringify({ de: mov.localOrigem, para: mov.localDestino, quantidade: mov.quantidade }),
      },
    })
  })
}

export async function listarPendentes() {
  return prisma.aprovacaoMovimentacao.findMany({
    where: { status: StatusAprovacao.Pendente },
    include: {
      movimentacao: {
        include: {
          produto: { select: { nomeBebida: true, unidadeMedida: true } },
          usuario: { select: { nome: true } },
        },
      },
      solicitante: { select: { nome: true, setor: true } },
    },
    orderBy: { criadoEm: 'desc' },
  })
}

export async function aprovar(aprovacaoId: string, aprovadorId: string, aprovadorNome: string, motivo?: string) {
  return prisma.$transaction(async (tx) => {
    const aprovacao = await tx.aprovacaoMovimentacao.findUnique({
      where: { id: aprovacaoId },
      include: { movimentacao: true },
    })
    if (!aprovacao) throw new NotFoundError('Aprovação não encontrada')
    if (aprovacao.solicitanteId === aprovadorId) {
      throw new ForbiddenError('Você não pode aprovar sua própria solicitação')
    }

    await tx.aprovacaoMovimentacao.update({
      where: { id: aprovacaoId },
      data: { status: StatusAprovacao.Aprovado, aprovadorId, resolvidoEm: new Date(), motivo },
    })

    await tx.movimentacaoEstoque.update({
      where: { id: aprovacao.movimentacaoId },
      data: { aprovacaoStatus: StatusAprovacao.Aprovado },
    })

    const mov = aprovacao.movimentacao
    await _upsertEstoque(tx, mov.produtoId, mov.localOrigem ?? 'Bar', -mov.quantidade, aprovadorId)

    await tx.logAuditoria.create({
      data: {
        usuarioId: aprovadorId,
        usuarioNome: aprovadorNome,
        setor: 'Admin',
        acao: 'APROVACAO_PERDA',
        entidade: 'AprovacaoMovimentacao',
        idReferencia: aprovacaoId,
        detalhes: JSON.stringify({ motivo }),
      },
    })
  })
}

export async function rejeitar(aprovacaoId: string, aprovadorId: string, aprovadorNome: string, motivo: string) {
  return prisma.$transaction(async (tx) => {
    const aprovacao = await tx.aprovacaoMovimentacao.findUnique({ where: { id: aprovacaoId } })
    if (!aprovacao) throw new NotFoundError('Aprovação não encontrada')

    await tx.aprovacaoMovimentacao.update({
      where: { id: aprovacaoId },
      data: { status: StatusAprovacao.Rejeitado, aprovadorId, resolvidoEm: new Date(), motivo },
    })

    await tx.movimentacaoEstoque.update({
      where: { id: aprovacao.movimentacaoId },
      data: { aprovacaoStatus: StatusAprovacao.Rejeitado },
    })

    await tx.logAuditoria.create({
      data: {
        usuarioId: aprovadorId,
        usuarioNome: aprovadorNome,
        setor: 'Admin',
        acao: 'REJEICAO_PERDA',
        entidade: 'AprovacaoMovimentacao',
        idReferencia: aprovacaoId,
        detalhes: JSON.stringify({ motivo }),
      },
    })
  })
}
