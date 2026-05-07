import { prisma } from '../../config/prisma.js'
import { AppError, NotFoundError, BusinessRuleError } from '../../shared/errors.js'
import { getDiaOperacional, categorizarDivergencia } from '../../shared/diaOperacional.js'
import { validarBase64Imagem } from '../../shared/validarImagem.js'
import { logger } from '../../config/logger.js'

export async function getTurnoAtual(local: string) {
  const turno = await prisma.fechamentoTurno.findFirst({
    where: { local, status: 'Aberto' },
    orderBy: { abertoEm: 'desc' },
  })
  if (!turno) return null

  const [usuario, contagem] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: turno.abertoPor }, select: { nome: true } }),
    turno.contagemId
      ? prisma.contagemEstoque.findUnique({
          where: { id: turno.contagemId },
          include: { itens: { include: { produto: { select: { nomeBebida: true, unidadeMedida: true, custoUnitario: true } } } } },
        })
      : Promise.resolve(null),
  ])

  return { ...turno, abertoPorNome: usuario?.nome ?? null, contagem }
}

export async function deletarTurno(turnoId: string) {
  const turno = await prisma.fechamentoTurno.findUnique({ where: { id: turnoId } })
  if (!turno) throw new NotFoundError('Turno não encontrado')

  await prisma.$transaction(async (tx) => {
    if (turno.contagemId) {
      await tx.itemContagem.deleteMany({ where: { contagemId: turno.contagemId } })
      await tx.entradaRascunho.deleteMany({ where: { contagemId: turno.contagemId } })
      await tx.correcaoVenda.updateMany({ where: { turnoId: turnoId }, data: { turnoId: null } })
      await tx.movimentacaoEstoque.updateMany({ where: { turnoId: turnoId }, data: { turnoId: null } })
      await tx.contagemEstoque.delete({ where: { id: turno.contagemId } })
    }
    await tx.fechamentoTurno.delete({ where: { id: turnoId } })
  })
}

export async function abrirTurno(local: string, operadorId: string) {
  const dia = getDiaOperacional()

  const existente = await prisma.fechamentoTurno.findFirst({
    where: { local, status: 'Aberto' },
  })
  if (existente) {
    throw new BusinessRuleError(`Já existe turno aberto no ${local} (aberto em ${existente.abertoEm.toISOString()})`)
  }

  // Cria contagem vazia atrelada ao turno
  const turno = await prisma.$transaction(async (tx) => {
    const t = await tx.fechamentoTurno.create({
      data: {
        diaOperacional: dia,
        local,
        abertoEm: new Date(),
        abertoPor: operadorId,
        status: 'Aberto',
      },
    })

    // Buscar produtos do local
    const produtos = await tx.produto.findMany({
      where: {
        ativo: true,
        OR: [{ setorPadrao: local }, { setorPadrao: 'Todos' }],
      },
      orderBy: { nomeBebida: 'asc' },
    })

    const contagem = await tx.contagemEstoque.create({
      data: {
        local,
        operadorId,
        modoCego: true,
        diaOperacional: dia,
        turnoId: t.id,
        tipoContagem: 'AberturaTurno',
        totalItens: produtos.length,
      },
    })

    // Cria itens com quantidade esperada
    for (const p of produtos) {
      const estoque = await tx.estoqueAtual.findUnique({
        where: { produtoId_local: { produtoId: p.id, local } },
      })
      await tx.itemContagem.create({
        data: {
          contagemId: contagem.id,
          produtoId: p.id,
          quantidadeSistema: estoque?.quantidadeAtual ?? 0,
        },
      })
    }

    await tx.fechamentoTurno.update({
      where: { id: t.id },
      data: { contagemId: contagem.id },
    })

    await tx.logAuditoria.create({
      data: {
        usuarioId: operadorId,
        usuarioNome: operadorId,
        setor: local,
        acao: 'TURNO_ABERTO',
        entidade: 'FechamentoTurno',
        idReferencia: t.id,
        detalhes: JSON.stringify({ diaOperacional: dia, local, totalItens: produtos.length }),
      },
    })

    return { ...t, contagemId: contagem.id }
  })

  return turno
}

export async function listarItensContagem(contagemId: string) {
  const contagem = await prisma.contagemEstoque.findUnique({
    where: { id: contagemId },
    include: {
      itens: {
        include: { produto: { select: { id: true, nomeBebida: true, categoria: true, unidadeMedida: true, custoUnitario: true } } },
        orderBy: { id: 'asc' },
      },
    },
  })
  if (!contagem) throw new NotFoundError('Contagem não encontrada')
  return contagem
}

// Versão cega: omite quantidadeSistema para garantir integridade da contagem
export async function listarItensContagemCega(contagemId: string) {
  const contagem = await listarItensContagem(contagemId)
  if (contagem.status !== 'Aberta') throw new BusinessRuleError('Contagem já finalizada')
  const itensCegos = contagem.itens.map(({ quantidadeSistema: _qs, diferenca: _d, divergenciaCategoria: _dc, fotoEvidencia: _fe, justificativa: _j, ajusteAprovado: _aa, ajusteAprovadoPor: _aap, ajusteDecidoEm: _ade, ...item }) => item)
  return { ...contagem, itens: itensCegos }
}

export async function registrarItem(contagemId: string, operadorId: string, nivelAcesso: string, produtoId: string, quantidadeContada: number) {
  const contagem = await prisma.contagemEstoque.findUnique({ where: { id: contagemId } })
  if (!contagem) throw new NotFoundError('Contagem não encontrada')
  if (!['Admin', 'Supervisor'].includes(nivelAcesso) && contagem.operadorId !== operadorId)
    throw new AppError('Acesso negado: contagem pertence a outro operador', 403, 'FORBIDDEN')

  const item = await prisma.itemContagem.findFirst({ where: { contagemId, produtoId } })
  if (!item) throw new NotFoundError('Item não encontrado na contagem')

  const diferenca = quantidadeContada - item.quantidadeSistema
  const categoria = categorizarDivergencia(item.quantidadeSistema, quantidadeContada)

  return prisma.itemContagem.update({
    where: { id: item.id },
    data: { quantidadeContada, diferenca, divergenciaCategoria: categoria, contadoPor: operadorId },
  })
}

export async function registrarFotoEvidencia(contagemId: string, operadorId: string, nivelAcesso: string, produtoId: string, fotoEvidencia: string, justificativa: string) {
  const contagem = await prisma.contagemEstoque.findUnique({ where: { id: contagemId } })
  if (!contagem) throw new NotFoundError('Contagem não encontrada')
  if (!['Admin', 'Supervisor'].includes(nivelAcesso) && contagem.operadorId !== operadorId)
    throw new AppError('Acesso negado: contagem pertence a outro operador', 403, 'FORBIDDEN')

  validarBase64Imagem(fotoEvidencia, 'fotoEvidencia')
  const item = await prisma.itemContagem.findFirst({ where: { contagemId, produtoId } })
  if (!item) throw new NotFoundError('Item não encontrado')
  if (item.divergenciaCategoria !== 'grande') {
    throw new BusinessRuleError('Foto só é exigida para divergências grandes')
  }
  return prisma.itemContagem.update({
    where: { id: item.id },
    data: { fotoEvidencia, justificativa },
  })
}

export async function finalizarContagem(contagemId: string, operadorId: string, nivelAcesso: string) {
  const contagem = await prisma.contagemEstoque.findUnique({
    where: { id: contagemId },
    include: { itens: true },
  })
  if (!contagem) throw new NotFoundError('Contagem não encontrada')
  if (!['Admin', 'Supervisor'].includes(nivelAcesso) && contagem.operadorId !== operadorId)
    throw new AppError('Acesso negado: contagem pertence a outro operador', 403, 'FORBIDDEN')
  if (contagem.status !== 'Aberta') throw new BusinessRuleError('Contagem já finalizada')

  const naoContados = contagem.itens.filter((i) => i.quantidadeContada === null)
  if (naoContados.length > 0) {
    throw new BusinessRuleError(`${naoContados.length} produto(s) ainda não foram contados. Registre ao menos 0 para cada produto.`)
  }

  // Verifica que toda divergência grande tem foto e justificativa
  const grandesSemFoto = contagem.itens.filter(
    (i) => i.divergenciaCategoria === 'grande' && (!i.fotoEvidencia || !i.justificativa),
  )
  if (grandesSemFoto.length > 0) {
    throw new BusinessRuleError(`${grandesSemFoto.length} divergência(s) grande(s) sem foto/justificativa`)
  }

  // Aplica ajuste de estoque para itens 'ok' e 'leve' (auto)
  // Itens 'grande' ficam pendentes (estoque não muda)
  let ajustadosLeve = 0
  let pendentesGrande = 0
  let valorDivergencias = 0

  await prisma.$transaction(async (tx) => {
    for (const item of contagem.itens) {
      if (item.divergenciaCategoria === 'ok') continue

      const produto = await tx.produto.findUnique({ where: { id: item.produtoId } })
      const valor = Math.abs(item.diferenca) * (produto?.custoUnitario ?? 0)

      if (item.divergenciaCategoria === 'leve') {
        // Ajusta estoque automático
        await tx.estoqueAtual.upsert({
          where: { produtoId_local: { produtoId: item.produtoId, local: contagem.local } },
          create: {
            produtoId: item.produtoId,
            local: contagem.local,
            quantidadeAtual: item.quantidadeContada,
            atualizadoPor: operadorId,
          },
          update: { quantidadeAtual: item.quantidadeContada, atualizadoPor: operadorId },
        })
        await tx.itemContagem.update({
          where: { id: item.id },
          data: { ajusteAprovado: true, ajusteDecidoEm: new Date(), ajusteAprovadoPor: operadorId },
        })
        ajustadosLeve++
        valorDivergencias += valor
      } else if (item.divergenciaCategoria === 'grande') {
        pendentesGrande++
        valorDivergencias += valor
      }

      await tx.produto.update({
        where: { id: item.produtoId },
        data: { ultimaContagemEm: new Date() },
      })
    }

    await tx.contagemEstoque.update({
      where: { id: contagemId },
      data: {
        status: 'Fechada',
        dataFechamento: new Date(),
        totalDesvios: ajustadosLeve + pendentesGrande,
      },
    })

    if (contagem.turnoId) {
      await tx.fechamentoTurno.update({
        where: { id: contagem.turnoId },
        data: {
          totalDivergencias: ajustadosLeve + pendentesGrande,
          divergenciasGrandes: pendentesGrande,
          valorDivergencias,
        },
      })
    }
  })

  return { ajustadosLeve, pendentesGrande, valorDivergencias }
}

export async function fecharTurno(turnoId: string, automatico = false) {
  const turno = await prisma.fechamentoTurno.findUnique({ where: { id: turnoId } })
  if (!turno) throw new NotFoundError('Turno não encontrado')
  if (turno.status === 'Fechado') return turno

  return prisma.$transaction(async (tx) => {
    let contagemFeita = false

    if (turno.contagemId) {
      const contagem = await tx.contagemEstoque.findUnique({ where: { id: turno.contagemId } })
      if (contagem?.status === 'Fechada') {
        contagemFeita = true
      } else if (contagem?.status === 'Aberta') {
        await tx.contagemEstoque.update({
          where: { id: turno.contagemId },
          data: { status: 'Fechada', dataFechamento: new Date() },
        })
      }
    }

    return tx.fechamentoTurno.update({
      where: { id: turnoId },
      data: {
        status: 'Fechado',
        fechadoEm: new Date(),
        fechadoAutomatico: automatico,
        fechadoSemContagem: !contagemFeita,
      },
    })
  })
}

export async function verificarEntradaRecente(produtoId: string, quantidade: number) {
  const limite = new Date()
  limite.setHours(limite.getHours() - 12)

  const recentes = await prisma.movimentacaoEstoque.findMany({
    where: {
      produtoId,
      tipoMov: 'Entrada',
      dataMov: { gte: limite },
    },
    include: {
      produto: { select: { nomeBebida: true, unidadeMedida: true } },
      usuario: { select: { nome: true, nivelAcesso: true } },
    },
    orderBy: { dataMov: 'desc' },
  })

  if (recentes.length === 0) return { tipo: 'ok' as const, recentes: [] }

  const duplicataExata = recentes.find((m) => m.quantidade === quantidade)
  if (duplicataExata) {
    return { tipo: 'bloqueado' as const, duplicata: duplicataExata, recentes }
  }

  return { tipo: 'aviso' as const, recentes }
}

export async function listarHistoricoTurnos(local?: string, limit = 30) {
  return prisma.fechamentoTurno.findMany({
    where: local ? { local } : {},
    orderBy: { abertoEm: 'desc' },
    take: limit,
  })
}

export async function getDashboardAdmin() {
  const hoje = new Date()
  const ha14Dias = new Date(hoje)
  ha14Dias.setDate(hoje.getDate() - 14)

  const [turnos, rascunhosPendentes, correcoesRecentes] = await Promise.all([
    prisma.fechamentoTurno.findMany({
      where: { abertoEm: { gte: ha14Dias } },
      orderBy: { abertoEm: 'desc' },
      take: 30,
    }),
    prisma.entradaRascunho.count({ where: { status: 'Pendente' } }),
    prisma.correcaoVenda.count({ where: { criadoEm: { gte: ha14Dias } } }),
  ])

  // Calcula gap e divergências por operador nos últimos 14 dias
  const contagensRecentes = await prisma.contagemEstoque.findMany({
    where: { dataAbertura: { gte: ha14Dias }, status: 'Fechada' },
    include: { itens: { include: { produto: { select: { custoUnitario: true } } } } },
  })

  const operadorMap: Record<string, { nome: string; turnos: number; divergenciasGrandes: number; valorGap: number }> = {}
  for (const turno of turnos) {
    const op = turno.abertoPor
    if (!operadorMap[op]) {
      const u = await prisma.usuario.findUnique({ where: { id: op }, select: { nome: true } })
      operadorMap[op] = { nome: u?.nome ?? op, turnos: 0, divergenciasGrandes: 0, valorGap: 0 }
    }
    operadorMap[op].turnos++
    operadorMap[op].divergenciasGrandes += turno.divergenciasGrandes
    operadorMap[op].valorGap += turno.gapNaoExplicado
  }

  const operadores = Object.entries(operadorMap)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.valorGap - a.valorGap)

  return {
    rascunhosPendentes,
    correcoesRecentes,
    turnos: turnos.map((t) => ({
      id: t.id,
      diaOperacional: t.diaOperacional,
      local: t.local,
      abertoEm: t.abertoEm,
      fechadoEm: t.fechadoEm,
      status: t.status,
      abertoPor: t.abertoPor,
      divergenciasGrandes: t.divergenciasGrandes,
      totalDivergencias: t.totalDivergencias,
      valorDivergencias: t.valorDivergencias,
      gapNaoExplicado: t.gapNaoExplicado,
      fechadoSemContagem: t.fechadoSemContagem,
    })),
    operadores,
  }
}

export async function fecharTurnosAbertosCron() {
  const turnosAbertos = await prisma.fechamentoTurno.findMany({
    where: { status: 'Aberto' },
  })

  for (const turno of turnosAbertos) {
    try {
      await fecharTurno(turno.id, true)
      logger.info(`Turno ${turno.local} ${turno.diaOperacional} fechado automaticamente`)
    } catch (e: any) {
      logger.error(`Falha ao fechar turno ${turno.id}: ${e.message}`)
    }
  }

  return turnosAbertos.length
}
