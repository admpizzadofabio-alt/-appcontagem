import { prisma } from '../../config/prisma.js'
import { AppError, NotFoundError, BusinessRuleError, ForbiddenError } from '../../shared/errors.js'
import { getDiaOperacional, categorizarDivergencia } from '../../shared/diaOperacional.js'
import { formatLocalDate, localOntem, parseLocalDate } from '../../shared/dateLocal.js'
import { enviarAlerta } from '../../shared/alertWebhook.js'
import { validarBase64Imagem } from '../../shared/validarImagem.js'
import { logger } from '../../config/logger.js'
import { importarVendas } from '../colibri/colibri.service.js'

export async function getTurnoAtual(local: string) {
  const turno = await prisma.fechamentoTurno.findFirst({
    where: { local, status: 'Aberto' },
    orderBy: { abertoEm: 'desc' },
  })
  if (!turno) return null

  const [usuario, contagem, colibriRecente] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: turno.abertoPor }, select: { nome: true } }),
    turno.contagemId
      ? prisma.contagemEstoque.findUnique({
          where: { id: turno.contagemId },
          include: { itens: { include: { produto: { select: { nomeBebida: true, unidadeMedida: true, custoUnitario: true } } } } },
        })
      : Promise.resolve(null),
    prisma.colibriImportacao.findFirst({
      // diaOperacional é string 'YYYY-MM-DD' — converte para DateTime local (Brasília)
      where: { dataFim: { gte: parseLocalDate(turno.diaOperacional, '00:00:00') }, status: { in: ['ok', 'parcial'] } },
      orderBy: { dataFim: 'desc' },
    }),
  ])

  return { ...turno, abertoPorNome: usuario?.nome ?? null, contagem, colibriPendente: !colibriRecente }
}

export async function deletarTurno(turnoId: string, usuarioSetor?: string, nivelAcesso?: string) {
  const turno = await prisma.fechamentoTurno.findUnique({ where: { id: turnoId } })
  if (!turno) throw new NotFoundError('Turno não encontrado')
  // VULN-007: Supervisor só pode deletar turno do próprio setor
  if (nivelAcesso === 'Supervisor' && usuarioSetor && usuarioSetor !== 'Todos' && turno.local !== usuarioSetor) {
    throw new ForbiddenError(`Supervisor do setor "${usuarioSetor}" não pode deletar turno do setor "${turno.local}"`)
  }

  await prisma.$transaction(async (tx) => {
    if (turno.contagemId) {
      // Rollback completo (modo teste): reverte estoque, apaga movimento de ajuste e marco
      const itens = await tx.itemContagem.findMany({
        where: { contagemId: turno.contagemId, ajusteAprovado: true, diferenca: { not: 0 } },
      })
      for (const item of itens) {
        // Reverte EstoqueAtual: o ajuste fez estoque = contado; voltamos pra sistema
        const ea = await tx.estoqueAtual.findUnique({
          where: { produtoId_local: { produtoId: item.produtoId, local: turno.local } },
        })
        if (ea) {
          await tx.estoqueAtual.update({
            where: { produtoId_local: { produtoId: item.produtoId, local: turno.local } },
            data: { quantidadeAtual: ea.quantidadeAtual - item.diferenca },
          })
        }
        // Restaura marco para o do CargaInicial (a contagem havia avançado o marco)
        const cargaInicial = await tx.movimentacaoEstoque.findFirst({
          where: { produtoId: item.produtoId, tipoMov: 'CargaInicial' },
          orderBy: { dataMov: 'desc' },
        })
        if (cargaInicial) {
          await tx.produto.update({
            where: { id: item.produtoId },
            data: { marcoInicialEm: cargaInicial.dataMov },
          })
        }
      }
      // Apaga movimentos AjusteContagem dessa contagem
      await tx.movimentacaoEstoque.deleteMany({
        where: { referenciaOrigem: `contagem:${turno.contagemId}` },
      })

      // Estorna e apaga Saídas Colibri criadas DURANTE o turno (rollback completo modo teste).
      // Sem isso, ao apagar o turno o estoque ficaria "negativo" pelos descontos do Colibri.
      const fimWindow = turno.fechadoEm ?? new Date()
      const movsColibri = await tx.movimentacaoEstoque.findMany({
        where: {
          tipoMov: 'Saida',
          referenciaOrigem: { startsWith: 'colibri:' },
          dataMov: { gte: turno.abertoEm, lte: fimWindow },
          OR: [{ localOrigem: turno.local }, { localDestino: turno.local }],
        },
      })
      for (const m of movsColibri) {
        const local = m.localOrigem ?? turno.local
        const ea = await tx.estoqueAtual.findUnique({
          where: { produtoId_local: { produtoId: m.produtoId, local } },
        })
        if (ea) {
          await tx.estoqueAtual.update({
            where: { produtoId_local: { produtoId: m.produtoId, local } },
            data: { quantidadeAtual: ea.quantidadeAtual + m.quantidade },
          })
        }
      }
      if (movsColibri.length > 0) {
        await tx.movimentacaoEstoque.deleteMany({
          where: { id: { in: movsColibri.map((m) => m.id) } },
        })
      }

      await tx.itemContagem.deleteMany({ where: { contagemId: turno.contagemId } })
      await tx.entradaRascunho.deleteMany({ where: { contagemId: turno.contagemId } })
      await tx.correcaoVenda.updateMany({ where: { turnoId: turnoId }, data: { turnoId: null } })
      await tx.movimentacaoEstoque.updateMany({ where: { turnoId: turnoId }, data: { turnoId: null } })
      await tx.contagemEstoque.delete({ where: { id: turno.contagemId } })
    }
    await tx.fechamentoTurno.delete({ where: { id: turnoId } })
  })
}

export async function abrirTurno(local: string, operadorId: string, operadorSetor?: string, nivelAcesso?: string) {
  // VULN-001: Operador só pode abrir turno no próprio setor
  if (nivelAcesso !== 'Admin' && nivelAcesso !== 'Supervisor') {
    if (operadorSetor && operadorSetor !== 'Todos' && operadorSetor !== local) {
      throw new ForbiddenError(`Operador do setor "${operadorSetor}" não pode abrir turno em "${local}"`)
    }
  }

  const dia = getDiaOperacional()

  const existente = await prisma.fechamentoTurno.findFirst({
    where: { local, status: 'Aberto' },
  })
  if (existente) {
    throw new BusinessRuleError(`Já existe turno aberto no ${local} (aberto em ${existente.abertoEm.toISOString()})`)
  }

  // Importa vendas do Colibri antes do snapshot. Usa MESMO range do cron (ontem→hoje)
  // pra que o refOrigem coincida e substituir=true funcione corretamente — evita
  // duplicação de vendas entre cron e abertura de turno.
  const hojeStr = formatLocalDate()
  const ontemStr = localOntem()
  try {
    await importarVendas({ dataInicio: ontemStr, dataFim: hojeStr, local, usuarioId: operadorId, usuarioNome: operadorId, substituir: true })
    logger.info(`Colibri: importação pré-turno concluída (${ontemStr} → ${hojeStr})`)
  } catch (err) {
    logger.warn(`Colibri: falha na importação pré-turno — turno será aberto sem atualização: ${(err as Error).message}`)
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

    // Buscar produtos do local — só os que já têm carga inicial (Marco Inicial)
    // Produtos sem carga não entram na contagem porque Colibri não opera neles.
    const produtos = await tx.produto.findMany({
      where: {
        ativo: true,
        marcoInicialEm: { not: null },
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

    // Última contagem fechada deste local — usada para calcular vendas Colibri no intervalo
    const ultimaContagem = await tx.contagemEstoque.findFirst({
      where: { local, status: 'Fechada' },
      orderBy: { dataFechamento: 'desc' },
      select: { dataFechamento: true },
    })
    const desde = ultimaContagem?.dataFechamento ?? new Date(0)

    // Cria itens com quantidade esperada e total vendido no Colibri desde a última contagem
    for (const p of produtos) {
      const estoque = await tx.estoqueAtual.findUnique({
        where: { produtoId_local: { produtoId: p.id, local } },
      })
      const vendasColibri = await tx.movimentacaoEstoque.aggregate({
        where: {
          produtoId: p.id,
          tipoMov: 'Saida',
          referenciaOrigem: { startsWith: 'colibri:' },
          dataMov: { gte: desde },
          OR: [{ localOrigem: local }, { localDestino: local }],
        },
        _sum: { quantidade: true },
      })
      await tx.itemContagem.create({
        data: {
          contagemId: contagem.id,
          produtoId: p.id,
          quantidadeSistema: estoque?.quantidadeAtual ?? 0,
          vendidoColibri: vendasColibri._sum.quantidade ?? 0,
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
  // VULN-005: impede edição após contagem fechada
  if (contagem.status !== 'Aberta') throw new BusinessRuleError('Contagem já foi finalizada')

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
  // VULN-005: impede edição após contagem fechada
  if (contagem.status !== 'Aberta') throw new BusinessRuleError('Contagem já foi finalizada')

  if (fotoEvidencia) validarBase64Imagem(fotoEvidencia, 'fotoEvidencia')
  const item = await prisma.itemContagem.findFirst({ where: { contagemId, produtoId } })
  if (!item) throw new NotFoundError('Item não encontrado')
  // Aceita justificativa em leves (obrigatória no app) e grandes (com foto).
  // "ok" e "sem movimento" não têm divergência — bloqueia.
  if (item.divergenciaCategoria !== 'leve' && item.divergenciaCategoria !== 'grande') {
    throw new BusinessRuleError('Item sem divergência — não precisa justificativa')
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

  // Verifica que toda divergência grande tem justificativa (foto opcional em modo teste)
  const grandesSemJustif = contagem.itens.filter(
    (i) => i.divergenciaCategoria === 'grande' && !i.justificativa,
  )
  if (grandesSemJustif.length > 0) {
    throw new BusinessRuleError(`${grandesSemJustif.length} divergência(s) grande(s) sem justificativa`)
  }

  // Verifica vendas-sem-estoque: produto com vendas Colibri mas contado < vendido
  // Operador deve ter justificado (já foi feito junto com a divergência grande no modal)
  const vendasSemEstoque = contagem.itens.filter(
    (i) => i.vendidoColibri > 0 && i.quantidadeContada < i.vendidoColibri && !i.justificativa,
  )
  if (vendasSemEstoque.length > 0) {
    throw new BusinessRuleError(`${vendasSemEstoque.length} produto(s) com venda sem estoque sem justificativa`)
  }

  // Aplica ajuste de estoque para itens 'ok' e 'leve' (auto)
  // Itens 'grande' ficam pendentes (estoque não muda)
  let ajustadosLeve = 0
  let pendentesGrande = 0
  let revisaoAdmin = 0
  let valorDivergencias = 0

  await prisma.$transaction(async (tx) => {
    for (const item of contagem.itens) {
      const isVendaSemEstoque = item.vendidoColibri > 0 && item.quantidadeContada < item.vendidoColibri
      const precisaRevisao = item.divergenciaCategoria === 'grande' || isVendaSemEstoque

      // Sempre marca ultimaContagemEm + quantidade no estoqueAtual (POR LOCAL) — mesmo se bateu certo
      if (item.divergenciaCategoria === 'ok' && !precisaRevisao) {
        await tx.estoqueAtual.updateMany({
          where: { produtoId: item.produtoId, local: contagem.local },
          data: { ultimaContagemEm: new Date(), ultimaContagemQuantidade: item.quantidadeContada },
        })
      }

      if (item.divergenciaCategoria !== 'ok' || precisaRevisao) {
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
          // Registra movimento AjusteContagem para auditoria + timeline
          // diferenca = contado - sistema (negativo = perda, positivo = sobra)
          if (item.diferenca !== 0) {
            await tx.movimentacaoEstoque.create({
              data: {
                produtoId: item.produtoId,
                tipoMov: 'AjusteContagem',
                quantidade: Math.abs(item.diferenca),
                localOrigem: item.diferenca < 0 ? contagem.local : undefined,
                localDestino: item.diferenca > 0 ? contagem.local : undefined,
                usuarioId: operadorId,
                observacao: item.justificativa ?? 'Ajuste de contagem',
                referenciaOrigem: `contagem:${contagemId}`,
                aprovacaoStatus: 'Aprovado',
              },
            })
          }
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

        // Marca para revisão Admin (grande OU venda sem estoque)
        if (precisaRevisao) {
          await tx.itemContagem.update({
            where: { id: item.id },
            data: {
              precisaRevisaoAdmin: true,
              revisaoStatus: 'Pendente',
              divergenciaCategoria: isVendaSemEstoque && item.divergenciaCategoria !== 'grande'
                ? 'venda_sem_estoque'
                : item.divergenciaCategoria,
            },
          })
          revisaoAdmin++
        }

        // Marco inicial só avança quando contagem é confiável (ok ou leve).
        // Itens 'grande' / 'venda_sem_estoque' ficam pendentes na revisão Admin —
        // marco congela até decisão. Isso impede que divergências reais sumam do radar.
        const produtoMarco = await tx.produto.findUnique({ where: { id: item.produtoId }, select: { marcoInicialEm: true } })
        const podeAvancarMarco = !precisaRevisao && produtoMarco?.marcoInicialEm
        // ultimaContagem por local (estoqueAtual); marcoInicialEm continua por produto
        await tx.estoqueAtual.updateMany({
          where: { produtoId: item.produtoId, local: contagem.local },
          data: { ultimaContagemEm: new Date(), ultimaContagemQuantidade: item.quantidadeContada },
        })
        if (podeAvancarMarco) {
          await tx.produto.update({
            where: { id: item.produtoId },
            data: { marcoInicialEm: new Date() },
          })
        }
      }
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

  // Alerta admin por webhook quando há divergências grandes (fora da transaction)
  if (pendentesGrande > 0) {
    const grandes = contagem.itens.filter((i) => i.divergenciaCategoria === 'grande')
    const detalhes = await Promise.all(grandes.map(async (i) => {
      const p = await prisma.produto.findUnique({ where: { id: i.produtoId }, select: { nomeBebida: true } })
      return `   • ${p?.nomeBebida ?? i.produtoId}: ${i.diferenca > 0 ? '+' : ''}${i.diferenca}`
    }))
    enviarAlerta(
      `🚨 APPCONTAGEM — Divergência GRANDE na contagem (${contagem.local}):\n${detalhes.join('\n')}\n\nVerifique a fila de Revisão no app.`,
    ).catch(() => {})
  }

  return { ajustadosLeve, pendentesGrande, revisaoAdmin, valorDivergencias }
}

// === Revisão Admin: lista e decide casos pendentes ===

export async function listarRevisoesPendentes() {
  return prisma.itemContagem.findMany({
    where: { precisaRevisaoAdmin: true, revisaoStatus: 'Pendente' },
    include: {
      produto: { select: { nomeBebida: true, unidadeMedida: true, custoUnitario: true } },
      contagem: { select: { local: true, dataContagem: true, operadorId: true, diaOperacional: true } },
    },
    orderBy: { contagem: { dataContagem: 'desc' } },
  })
}

export async function decidirRevisao(itemId: string, acao: 'aceitar' | 'ajustar' | 'perda' | 'recontagem', revisorId: string, decisao?: string, novaQuantidade?: number) {
  const item = await prisma.itemContagem.findUnique({
    where: { id: itemId },
    include: { contagem: { select: { local: true } } },
  })
  if (!item) throw new NotFoundError('Item de contagem não encontrado')
  if (!item.precisaRevisaoAdmin || item.revisaoStatus !== 'Pendente') {
    throw new BusinessRuleError('Esta revisão já foi decidida')
  }

  const local = item.contagem.local

  return prisma.$transaction(async (tx) => {
    const estoqueAtualReg = await tx.estoqueAtual.findUnique({
      where: { produtoId_local: { produtoId: item.produtoId, local } },
    })
    const estoqueAtualQtd = estoqueAtualReg?.quantidadeAtual ?? 0

    if (acao === 'aceitar') {
      // Aceita o que o operador contou — cria AjusteContagem para auditoria
      const delta = item.quantidadeContada - estoqueAtualQtd
      if (delta !== 0) {
        await tx.movimentacaoEstoque.create({
          data: {
            produtoId: item.produtoId,
            tipoMov: 'AjusteContagem',
            quantidade: Math.abs(delta),
            localOrigem: local,
            usuarioId: revisorId,
            observacao: `Revisão Admin: aceitar contagem (${estoqueAtualQtd} → ${item.quantidadeContada}). ${decisao ?? ''}`.trim(),
            aprovacaoStatus: 'Aprovado',
            referenciaOrigem: `revisao:${itemId}:aceitar`,
          },
        })
      }
      await tx.estoqueAtual.upsert({
        where: { produtoId_local: { produtoId: item.produtoId, local } },
        create: { produtoId: item.produtoId, local, quantidadeAtual: item.quantidadeContada, atualizadoPor: revisorId },
        update: { quantidadeAtual: item.quantidadeContada, atualizadoPor: revisorId },
      })
      // Marco avança para a data da decisão
      await tx.produto.update({ where: { id: item.produtoId }, data: { marcoInicialEm: new Date() } })
    } else if (acao === 'ajustar' && novaQuantidade !== undefined) {
      // Admin define nova quantidade — cria AjusteContagem para auditoria
      const delta = novaQuantidade - estoqueAtualQtd
      if (delta !== 0) {
        await tx.movimentacaoEstoque.create({
          data: {
            produtoId: item.produtoId,
            tipoMov: 'AjusteContagem',
            quantidade: Math.abs(delta),
            localOrigem: local,
            usuarioId: revisorId,
            observacao: `Revisão Admin: ajuste manual (${estoqueAtualQtd} → ${novaQuantidade}). ${decisao ?? ''}`.trim(),
            aprovacaoStatus: 'Aprovado',
            referenciaOrigem: `revisao:${itemId}:ajustar`,
          },
        })
      }
      await tx.estoqueAtual.upsert({
        where: { produtoId_local: { produtoId: item.produtoId, local } },
        create: { produtoId: item.produtoId, local, quantidadeAtual: novaQuantidade, atualizadoPor: revisorId },
        update: { quantidadeAtual: novaQuantidade, atualizadoPor: revisorId },
      })
      await tx.produto.update({ where: { id: item.produtoId }, data: { marcoInicialEm: new Date() } })
    } else if (acao === 'perda') {
      // Registra a divergência como AjustePerda — usa diff entre estoque atual e contado
      const qtdPerda = Math.max(0, estoqueAtualQtd - item.quantidadeContada)
      if (qtdPerda > 0) {
        await tx.movimentacaoEstoque.create({
          data: {
            produtoId: item.produtoId,
            tipoMov: 'AjustePerda',
            quantidade: qtdPerda,
            localOrigem: local,
            usuarioId: revisorId,
            observacao: `Revisão Admin: perda (${estoqueAtualQtd} → ${item.quantidadeContada}). ${decisao ?? ''}`.trim(),
            aprovacaoStatus: 'Aprovado',
            referenciaOrigem: `revisao:${itemId}:perda`,
          },
        })
        await tx.estoqueAtual.upsert({
          where: { produtoId_local: { produtoId: item.produtoId, local } },
          create: { produtoId: item.produtoId, local, quantidadeAtual: item.quantidadeContada, atualizadoPor: revisorId },
          update: { quantidadeAtual: item.quantidadeContada, atualizadoPor: revisorId },
        })
        await tx.produto.update({ where: { id: item.produtoId }, data: { marcoInicialEm: new Date() } })
      }
    }
    // recontagem: não muda estoque nem marco — fica pendente próxima contagem

    // Log de auditoria geral da decisão
    await tx.logAuditoria.create({
      data: {
        usuarioId: revisorId,
        usuarioNome: revisorId,
        setor: local,
        acao: `REVISAO_${acao.toUpperCase()}`,
        entidade: 'ItemContagem',
        idReferencia: itemId,
        detalhes: JSON.stringify({
          produtoId: item.produtoId,
          estoqueAntes: estoqueAtualQtd,
          quantidadeContada: item.quantidadeContada,
          novaQuantidade,
          decisao,
        }),
      },
    })

    return tx.itemContagem.update({
      where: { id: itemId },
      data: {
        revisaoStatus: acao === 'aceitar' ? 'Aceita' : acao === 'ajustar' ? 'Ajustada' : acao === 'perda' ? 'Perda' : 'Recontagem',
        revisaoDecisao: decisao,
        revisadoPor: revisorId,
        revisadoEm: new Date(),
      },
    })
  })
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
        // VULN-006: fechamento manual bloqueia se contagem está em andamento
        if (!automatico) throw new BusinessRuleError('Há uma contagem em andamento. Finalize a contagem antes de fechar o turno.')
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
