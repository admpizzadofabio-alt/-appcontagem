/**
 * Analytics avançado: CMV %, loss rate por turno, vendas por hora, transfer balance.
 */
import { prisma } from '../../config/prisma.js'
import { parseLocalDate } from '../../shared/dateLocal.js'

/**
 * #12 CMV % por produto = (custo das vendas) / (receita ou valor saídas).
 * Aqui usamos custoUnitario * qtd vendida no período como proxy de CMV.
 * Útil pra ranking de margem.
 */
export async function cmvPorProduto(dataInicio: string, dataFim: string) {
  const inicio = parseLocalDate(dataInicio, '00:00:00')
  const fim = parseLocalDate(dataFim, '23:59:59')

  const saidas = await prisma.movimentacaoEstoque.findMany({
    where: {
      tipoMov: 'Saida',
      dataMov: { gte: inicio, lte: fim },
      referenciaOrigem: { startsWith: 'colibri:' },
      aprovacaoStatus: 'Aprovado',
    },
    select: { produtoId: true, quantidade: true, produto: { select: { nomeBebida: true, custoUnitario: true } } },
  })

  const porProduto = new Map<string, { nome: string; qtd: number; cmv: number }>()
  for (const s of saidas) {
    const e = porProduto.get(s.produtoId)
    if (e) {
      e.qtd += s.quantidade
      e.cmv += s.quantidade * s.produto.custoUnitario
    } else {
      porProduto.set(s.produtoId, {
        nome: s.produto.nomeBebida,
        qtd: s.quantidade,
        cmv: s.quantidade * s.produto.custoUnitario,
      })
    }
  }

  const total = Array.from(porProduto.values()).reduce((a, p) => a + p.cmv, 0)
  return {
    periodo: { dataInicio, dataFim },
    total_cmv: Math.round(total * 100) / 100,
    produtos: Array.from(porProduto.entries())
      .map(([id, p]) => ({
        produtoId: id,
        nome: p.nome,
        quantidade_vendida: p.qtd,
        cmv: Math.round(p.cmv * 100) / 100,
        pct_total: total > 0 ? Math.round((p.cmv / total) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.cmv - a.cmv),
  }
}

/**
 * #13 Loss rate por turno: perdas / (perdas + vendas) % por turno.
 * Indicador chave de operação — turnos com alto loss rate merecem atenção.
 */
export async function lossRatePorTurno(dataInicio: string, dataFim: string) {
  const inicio = parseLocalDate(dataInicio, '00:00:00')
  const fim = parseLocalDate(dataFim, '23:59:59')

  const turnos = await prisma.fechamentoTurno.findMany({
    where: { abertoEm: { gte: inicio, lte: fim }, status: 'Fechado' },
    orderBy: { abertoEm: 'desc' },
  })

  const result = await Promise.all(turnos.map(async (t) => {
    const movs = await prisma.movimentacaoEstoque.findMany({
      where: {
        dataMov: { gte: t.abertoEm, lte: t.fechadoEm ?? new Date() },
        OR: [{ localOrigem: t.local }, { localDestino: t.local }],
        aprovacaoStatus: 'Aprovado',
      },
      select: { tipoMov: true, quantidade: true, referenciaOrigem: true, produto: { select: { custoUnitario: true } } },
    })
    let vendas = 0, perdas = 0, vendasVlr = 0, perdasVlr = 0
    for (const m of movs) {
      const vlr = m.quantidade * m.produto.custoUnitario
      if (m.tipoMov === 'Saida' && m.referenciaOrigem?.startsWith('colibri:')) { vendas += m.quantidade; vendasVlr += vlr }
      else if (m.tipoMov === 'AjustePerda') { perdas += m.quantidade; perdasVlr += vlr }
    }
    const total = vendas + perdas
    return {
      turnoId: t.id,
      diaOperacional: t.diaOperacional,
      local: t.local,
      vendas, perdas,
      valor_vendas: Math.round(vendasVlr * 100) / 100,
      valor_perdas: Math.round(perdasVlr * 100) / 100,
      loss_rate_pct: total > 0 ? Math.round((perdas / total) * 10000) / 100 : 0,
    }
  }))

  return { periodo: { dataInicio, dataFim }, turnos: result }
}

/**
 * #14 Vendas por hora — distribuição das vendas Colibri ao longo do dia.
 * Identifica picos de operação.
 */
export async function vendasPorHora(dataInicio: string, dataFim: string) {
  const inicio = parseLocalDate(dataInicio, '00:00:00')
  const fim = parseLocalDate(dataFim, '23:59:59')

  const saidas = await prisma.movimentacaoEstoque.findMany({
    where: {
      tipoMov: 'Saida',
      dataMov: { gte: inicio, lte: fim },
      referenciaOrigem: { startsWith: 'colibri:' },
    },
    select: { dataMov: true, quantidade: true, produto: { select: { custoUnitario: true } } },
  })

  const buckets = new Array(24).fill(0).map(() => ({ qtd: 0, valor: 0 }))
  for (const s of saidas) {
    // Hora local Brasília
    const horaBR = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false,
    }).format(s.dataMov)
    const h = parseInt(horaBR, 10) % 24
    buckets[h].qtd += s.quantidade
    buckets[h].valor += s.quantidade * s.produto.custoUnitario
  }

  return {
    periodo: { dataInicio, dataFim },
    horas: buckets.map((b, h) => ({
      hora: h,
      label: `${String(h).padStart(2, '0')}:00`,
      vendas: b.qtd,
      valor: Math.round(b.valor * 100) / 100,
    })),
  }
}

/**
 * #15 Transfer balance Bar↔Delivery — quanto saiu vs entrou em cada setor via transferência.
 */
export async function transferBalance(dataInicio: string, dataFim: string) {
  const inicio = parseLocalDate(dataInicio, '00:00:00')
  const fim = parseLocalDate(dataFim, '23:59:59')

  const transfs = await prisma.movimentacaoEstoque.findMany({
    where: {
      tipoMov: 'Transferencia',
      dataMov: { gte: inicio, lte: fim },
      aprovacaoStatus: 'Aprovado',
    },
    select: { localOrigem: true, localDestino: true, quantidade: true, produto: { select: { nomeBebida: true } } },
  })

  const fluxos: Record<string, { saiu: number; entrou: number; saldo: number }> = {
    Bar: { saiu: 0, entrou: 0, saldo: 0 },
    Delivery: { saiu: 0, entrou: 0, saldo: 0 },
  }
  for (const t of transfs) {
    if (t.localOrigem && fluxos[t.localOrigem]) {
      fluxos[t.localOrigem].saiu += t.quantidade
      fluxos[t.localOrigem].saldo -= t.quantidade
    }
    if (t.localDestino && fluxos[t.localDestino]) {
      fluxos[t.localDestino].entrou += t.quantidade
      fluxos[t.localDestino].saldo += t.quantidade
    }
  }

  return {
    periodo: { dataInicio, dataFim },
    total: transfs.length,
    fluxos,
    detalhes: transfs.map((t) => ({
      produto: t.produto.nomeBebida,
      origem: t.localOrigem,
      destino: t.localDestino,
      quantidade: t.quantidade,
    })),
  }
}
