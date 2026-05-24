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

const LOCAIS_VALIDOS = ['Bar', 'Delivery', 'Vinhos'] as const

export async function criar(data: CriarData) {
  const produto = await prisma.produto.findUnique({ where: { id: data.produtoId } })
  if (!produto) throw new NotFoundError('Produto não encontrado')

  // Defense in depth: Zod já valida na entrada, mas garantimos no service também.
  if (data.localOrigem && !LOCAIS_VALIDOS.includes(data.localOrigem as typeof LOCAIS_VALIDOS[number])) {
    throw new BusinessRuleError(`Local de origem inválido: ${data.localOrigem}`)
  }
  if (data.localDestino && !LOCAIS_VALIDOS.includes(data.localDestino as typeof LOCAIS_VALIDOS[number])) {
    throw new BusinessRuleError(`Local de destino inválido: ${data.localDestino}`)
  }

  // VULN-002: CargaInicial exige Admin ou Supervisor
  if (data.tipoMov === 'CargaInicial' && data.nivelAcesso !== 'Admin' && data.nivelAcesso !== 'Supervisor') {
    throw new ForbiddenError('Apenas Admin ou Supervisor podem registrar Carga Inicial')
  }

  if (data.tipoMov === 'CargaInicial') {
    const local = data.localOrigem ?? data.localDestino
    const jaExiste = await prisma.movimentacaoEstoque.count({
      where: { produtoId: data.produtoId, tipoMov: 'CargaInicial', localOrigem: local },
    })
    if (jaExiste > 0) throw new BusinessRuleError(`Produto já possui carga inicial registrada para ${local}.`)
  }

  // Bloqueia Saida e AjustePerda sem turno aberto no local de origem.
  // Sem turno aberto não há operador responsável — mesmo Admin não pode registrar saída.
  if (['Saida', 'AjustePerda'].includes(data.tipoMov)) {
    const local = data.localOrigem ?? 'Bar'
    const turnoAberto = await prisma.fechamentoTurno.findFirst({ where: { local, status: 'Aberto' } })
    if (!turnoAberto) {
      throw new BusinessRuleError(
        `Não há turno aberto em "${local}". Abra um turno antes de registrar saída ou perda.`
      )
    }
  }

  // Bloqueia saídas/perdas/transferências para produtos sem carga inicial.
  // Sem marcoInicialEm o produto não está sendo controlado — qualquer saída
  // produz estoque negativo "fantasma" e quebra a continuidade contábil.
  // Entrada e CargaInicial passam (são necessárias para iniciar o controle).
  const tiposBloqueadosSemCarga = ['Saida', 'AjustePerda', 'Transferencia']
  if (tiposBloqueadosSemCarga.includes(data.tipoMov) && !produto.marcoInicialEm) {
    throw new BusinessRuleError(
      `Produto "${produto.nomeBebida}" ainda não tem Carga Inicial. ` +
      `Admin/Supervisor precisa registrar a carga antes de qualquer ${data.tipoMov === 'Transferencia' ? 'transferência' : 'saída/perda'}.`
    )
  }

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

  const isPendente = tipoMov === 'Transferencia' || isGrandePerda || data.pendente === true
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

    return { ...movimentacao, precisaAprovacao: isPendente, isGrandePerda }
  })

  return mov
}

async function _atualizarEstoque(tx: any, data: CriarData) {
  if (data.tipoMov === 'CargaInicial') {
    // Carga Inicial = marco zero do produto: substitui estoque no local especificado,
    // ZERA estoque em outros locais (marco é por produto, não por local) e arquiva
    // Saídas Colibri anteriores. Movimentações antigas ficam no banco (auditoria),
    // mas não impactam mais o estoque atual.
    const local = data.localDestino ?? data.localOrigem ?? 'Bar'
    const agora = new Date()
    const existing = await tx.estoqueAtual.findUnique({ where: { produtoId_local: { produtoId: data.produtoId, local } } })
    const estoqueAnterior = existing?.quantidadeAtual ?? 0

    // Estoque em outros locais antes da limpeza (snapshot p/ auditoria)
    const outrosLocais = await tx.estoqueAtual.findMany({
      where: { produtoId: data.produtoId, local: { not: local }, quantidadeAtual: { gt: 0 } },
      select: { local: true, quantidadeAtual: true },
    })

    await tx.estoqueAtual.upsert({
      where: { produtoId_local: { produtoId: data.produtoId, local } },
      create: { produtoId: data.produtoId, local, quantidadeAtual: data.quantidade, atualizadoPor: data.usuarioId },
      update: { quantidadeAtual: data.quantidade, atualizadoPor: data.usuarioId },
    })

    // marcoInicialEm: define apenas na primeira carga (qualquer local); updateMany garante idempotência
    await tx.produto.updateMany({
      where: { id: data.produtoId, marcoInicialEm: null },
      data: { marcoInicialEm: agora },
    })

    // Conta e registra Saídas Colibri arquivadas (auditoria), depois remove
    const saidasArquivar = await tx.movimentacaoEstoque.findMany({
      where: {
        produtoId: data.produtoId,
        tipoMov: 'Saida',
        referenciaOrigem: { startsWith: 'colibri:' },
        dataMov: { lt: agora },
      },
      select: { id: true, quantidade: true, dataMov: true, referenciaOrigem: true },
    })

    if (saidasArquivar.length > 0 || outrosLocais.length > 0) {
      await tx.logAuditoria.create({
        data: {
          usuarioId: data.usuarioId,
          usuarioNome: data.usuarioNome,
          setor: data.setor,
          acao: 'CARGA_INICIAL_LIMPEZA',
          entidade: 'MovimentacaoEstoque',
          idReferencia: data.produtoId,
          detalhes: JSON.stringify({
            localCarga: local,
            estoqueAnterior, estoqueNovo: data.quantidade,
            outrosLocaisZerados: outrosLocais,
            saidasColibriRemovidas: saidasArquivar.length,
            quantidadeTotalSaidasRemovidas: saidasArquivar.reduce((a: number, s: any) => a + s.quantidade, 0),
            saidasIds: saidasArquivar.map((s: any) => s.id),
          }),
        },
      })
      if (saidasArquivar.length > 0) {
        await tx.movimentacaoEstoque.deleteMany({
          where: { id: { in: saidasArquivar.map((s: any) => s.id) } },
        })
      }
    }
    return
  }

  if (data.tipoMov === 'Entrada') {
    await _upsertEstoque(tx, data.produtoId, data.localDestino ?? data.localOrigem ?? 'Bar', data.quantidade, data.usuarioId)
  } else if (['Saida', 'AjustePerda'].includes(data.tipoMov)) {
    await _upsertEstoque(tx, data.produtoId, data.localOrigem ?? 'Bar', -data.quantidade, data.usuarioId)
  } else if (data.tipoMov === 'Transferencia') {
    await _upsertEstoque(tx, data.produtoId, data.localOrigem!, -data.quantidade, data.usuarioId)
    await _upsertEstoque(tx, data.produtoId, data.localDestino!, data.quantidade, data.usuarioId)
  }
}

// Admin-only: apaga uma movimentação e reverte o impacto no estoque.
// CargaInicial não é deletável aqui (usar resetarCargaInicial).
// Movimentações pendentes (não aplicadas) não mexem no estoque, só deletam.
export async function deletarMovimentacao(id: string, usuarioId: string, usuarioNome: string) {
  const mov = await prisma.movimentacaoEstoque.findUnique({ where: { id }, include: { produto: { select: { nomeBebida: true } } } })
  if (!mov) throw new NotFoundError('Movimentação não encontrada')
  if (mov.tipoMov === 'CargaInicial') {
    throw new BusinessRuleError('Use "Resetar Carga Inicial" no produto em vez de deletar.')
  }

  await prisma.$transaction(async (tx) => {
    // Só reverte estoque se foi aplicada (Aprovado). Pendente/Rejeitado nunca mexeram no estoque.
    if (mov.aprovacaoStatus === 'Aprovado') {
      if (mov.tipoMov === 'Entrada') {
        await _upsertEstoque(tx, mov.produtoId, mov.localDestino ?? mov.localOrigem ?? 'Bar', -mov.quantidade, usuarioId)
      } else if (['Saida', 'AjustePerda'].includes(mov.tipoMov)) {
        await _upsertEstoque(tx, mov.produtoId, mov.localOrigem ?? 'Bar', mov.quantidade, usuarioId)
      } else if (mov.tipoMov === 'Transferencia') {
        const [firstLocal, secondLocal] = [mov.localOrigem!, mov.localDestino!].sort()
        await _upsertEstoque(tx, mov.produtoId, firstLocal, firstLocal === mov.localOrigem ? mov.quantidade : -mov.quantidade, usuarioId)
        await _upsertEstoque(tx, mov.produtoId, secondLocal, secondLocal === mov.localOrigem ? mov.quantidade : -mov.quantidade, usuarioId)
      } else if (mov.tipoMov === 'AjusteContagem') {
        if (mov.localDestino) {
          // diferenca foi positiva → produto entrou → reverter removendo
          await _upsertEstoque(tx, mov.produtoId, mov.localDestino, -mov.quantidade, usuarioId)
        } else if (mov.localOrigem) {
          // diferenca foi negativa → produto saiu → reverter restaurando
          await _upsertEstoque(tx, mov.produtoId, mov.localOrigem, mov.quantidade, usuarioId)
        }
      }
    }

    // Apaga aprovação relacionada (FK cascade não está definido)
    await tx.aprovacaoMovimentacao.deleteMany({ where: { movimentacaoId: id } })
    await tx.movimentacaoEstoque.delete({ where: { id } })

    await tx.logAuditoria.create({
      data: {
        usuarioId, usuarioNome, setor: 'Admin',
        acao: 'MOVIMENTACAO_DELETADA',
        entidade: 'MovimentacaoEstoque',
        idReferencia: id,
        detalhes: JSON.stringify({
          produto: mov.produto.nomeBebida, tipoMov: mov.tipoMov,
          quantidade: mov.quantidade, localOrigem: mov.localOrigem, localDestino: mov.localDestino,
          eraAprovada: mov.aprovacaoStatus === 'Aprovado',
        }),
      },
    })
  })
}

async function _upsertEstoque(tx: any, produtoId: string, local: string, delta: number, usuarioId: string) {
  // True atomic upsert — INSERT ON CONFLICT elimina race condition entre UPDATE+INSERT
  await tx.$executeRaw`
    INSERT INTO "EstoqueAtual" ("id", "produtoId", "local", "quantidadeAtual", "atualizadoPor", "atualizadoEm")
    VALUES (gen_random_uuid(), ${produtoId}, ${local}, GREATEST(0, ${delta}::numeric), ${usuarioId}, NOW())
    ON CONFLICT ("produtoId", "local") DO UPDATE
    SET "quantidadeAtual" = GREATEST(0, "EstoqueAtual"."quantidadeAtual" + ${delta}::numeric),
        "atualizadoPor"   = ${usuarioId},
        "atualizadoEm"    = NOW()
  `
}

export async function listar(filtros: {
  produtoId?: string; tipoMov?: string; local?: string
  dataInicio?: string; dataFim?: string
  take?: number; skip?: number
}) {
  const where: any = {}
  if (filtros.produtoId) where.produtoId = filtros.produtoId
  if (filtros.tipoMov) where.tipoMov = filtros.tipoMov
  if (filtros.local) where.OR = [{ localOrigem: filtros.local }, { localDestino: filtros.local }]
  if (filtros.dataInicio || filtros.dataFim) {
    where.dataMov = {}
    if (filtros.dataInicio) where.dataMov.gte = new Date(filtros.dataInicio + 'T00:00:00-03:00')
    if (filtros.dataFim) where.dataMov.lte = new Date(filtros.dataFim + 'T23:59:59-03:00')
  }

  const take = Math.min(filtros.take ?? 200, 500)
  const skip = filtros.skip ?? 0

  return prisma.movimentacaoEstoque.findMany({
    where,
    orderBy: { dataMov: 'desc' },
    take,
    skip,
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
      produto: { select: { nomeBebida: true, unidadeMedida: true, setorPadrao: true } },
      usuario: { select: { nome: true } },
    },
  })
}

export async function confirmarTransferencia(movId: string, confirmadorId: string, confirmadorNome: string, setor: string, nivelAcesso: string) {
  return prisma.$transaction(async (tx) => {
    // VULN-003: atualização atômica garante que apenas uma confirmação simultânea vence
    const updated = await tx.movimentacaoEstoque.updateMany({
      where: { id: movId, tipoMov: 'Transferencia', aprovacaoStatus: StatusAprovacao.Pendente },
      data: { aprovacaoStatus: StatusAprovacao.Aprovado },
    })
    if (updated.count === 0) throw new ForbiddenError('Transferência não encontrada, não é transferência ou já foi confirmada')

    const mov = await tx.movimentacaoEstoque.findUnique({ where: { id: movId } })
    if (!mov) throw new NotFoundError('Transferência não encontrada')
    if (!['Admin', 'Supervisor'].includes(nivelAcesso) && mov.localDestino !== setor)
      throw new ForbiddenError(`Apenas o setor destinatário ("${mov.localDestino}") pode confirmar esta transferência`)

    // Canonical lock order prevents deadlock when two transfers cross opposite directions
    const [firstLocal, secondLocal] = [mov.localOrigem!, mov.localDestino!].sort()
    await _upsertEstoque(tx, mov.produtoId, firstLocal, firstLocal === mov.localOrigem ? -mov.quantidade : mov.quantidade, confirmadorId)
    await _upsertEstoque(tx, mov.produtoId, secondLocal, secondLocal === mov.localOrigem ? -mov.quantidade : mov.quantidade, confirmadorId)

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

export async function rejeitarTransferencia(movId: string, rejeitadorId: string, rejeitadorNome: string, setor: string, nivelAcesso: string) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.movimentacaoEstoque.updateMany({
      where: { id: movId, tipoMov: 'Transferencia', aprovacaoStatus: StatusAprovacao.Pendente },
      data: { aprovacaoStatus: StatusAprovacao.Rejeitado },
    })
    if (updated.count === 0) throw new ForbiddenError('Transferência não encontrada ou já resolvida')

    const mov = await tx.movimentacaoEstoque.findUnique({ where: { id: movId } })
    if (!mov) throw new NotFoundError('Transferência não encontrada')
    if (!['Admin', 'Supervisor'].includes(nivelAcesso) && mov.localDestino !== setor)
      throw new ForbiddenError(`Apenas o setor destinatário ("${mov.localDestino}") pode rejeitar esta transferência`)

    await tx.logAuditoria.create({
      data: {
        usuarioId: rejeitadorId,
        usuarioNome: rejeitadorNome,
        setor,
        acao: 'TRANSFERENCIA_REJEITADA',
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
      include: { movimentacao: true, solicitante: { select: { nivelAcesso: true } } },
    })
    if (!aprovacao) throw new NotFoundError('Aprovação não encontrada')
    if (aprovacao.status !== StatusAprovacao.Pendente) throw new BusinessRuleError('Esta aprovação já foi resolvida')
    // VULN-008: auto-aprovação bloqueada + Supervisor não aprova outro Supervisor
    if (aprovacao.solicitanteId === aprovadorId) {
      throw new ForbiddenError('Você não pode aprovar sua própria solicitação')
    }
    const aprovador = await tx.usuario.findUnique({ where: { id: aprovadorId }, select: { nivelAcesso: true } })
    if (aprovador?.nivelAcesso === 'Supervisor' && aprovacao.solicitante?.nivelAcesso === 'Supervisor') {
      throw new ForbiddenError('Supervisor não pode aprovar solicitação de outro Supervisor')
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
    const estoqueLocal = mov.tipoMov === 'Entrada' ? (mov.localDestino ?? 'Bar') : (mov.localOrigem ?? 'Bar')
    const estoqueDelta = mov.tipoMov === 'Entrada' ? mov.quantidade : -mov.quantidade
    await _upsertEstoque(tx, mov.produtoId, estoqueLocal, estoqueDelta, aprovadorId)

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
    if (aprovacao.status !== StatusAprovacao.Pendente) throw new BusinessRuleError('Esta aprovação já foi resolvida')
    if (aprovacao.solicitanteId === aprovadorId) {
      throw new ForbiddenError('Você não pode rejeitar sua própria solicitação')
    }

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
