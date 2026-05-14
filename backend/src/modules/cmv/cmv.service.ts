import { prisma } from '../../config/prisma.js'

const round2 = (n: number) => Math.round(n * 100) / 100

export async function getCmvBebidas(dataInicio: Date, dataFim: Date) {
  const [movimentacoes, estoqueAtual] = await Promise.all([
    prisma.movimentacaoEstoque.findMany({
      where: { dataMov: { gte: dataInicio, lte: dataFim } },
      include: { produto: { select: { nomeBebida: true, categoria: true, custoUnitario: true, unidadeMedida: true } } },
    }),
    prisma.estoqueAtual.findMany({
      include: { produto: { select: { nomeBebida: true, categoria: true, custoUnitario: true, unidadeMedida: true } } },
    }),
  ])

  type CatAcc = {
    categoria: string
    entradasQtd: number
    entradasValor: number
    saidasQtd: number
    saidasValor: number
    perdasQtd: number
    perdasValor: number
    efQtd: number
    efValor: number
  }

  const byCategoria: Record<string, CatAcc> = {}

  const get = (cat: string): CatAcc => {
    if (!byCategoria[cat]) {
      byCategoria[cat] = { categoria: cat, entradasQtd: 0, entradasValor: 0, saidasQtd: 0, saidasValor: 0, perdasQtd: 0, perdasValor: 0, efQtd: 0, efValor: 0 }
    }
    return byCategoria[cat]
  }

  for (const m of movimentacoes) {
    const cat = m.produto.categoria
    const valor = m.quantidade * m.produto.custoUnitario
    const acc = get(cat)
    if (m.tipoMov === 'Entrada') {
      acc.entradasQtd   += m.quantidade
      acc.entradasValor += valor
    } else if (m.tipoMov === 'Saida') {
      acc.saidasQtd   += m.quantidade
      acc.saidasValor += valor
    } else if (m.tipoMov === 'AjustePerda') {
      acc.perdasQtd   += m.quantidade
      acc.perdasValor += valor
    }
  }

  // EF = estoque atual agrupado por categoria
  for (const e of estoqueAtual) {
    const cat = e.produto.categoria
    const acc = get(cat)
    acc.efQtd   += e.quantidadeAtual
    acc.efValor += e.quantidadeAtual * e.produto.custoUnitario
  }

  const porCategoria = Object.values(byCategoria).map((c) => {
    // EI = EF + (Saídas + Perdas) − Entradas
    const cmvValor = round2(c.saidasValor + c.perdasValor)
    const eiValor  = round2(Math.max(0, c.efValor + cmvValor - c.entradasValor))
    return {
      categoria:     c.categoria,
      eiValor,
      entradasValor: round2(c.entradasValor),
      efValor:       round2(c.efValor),
      cmvValor,
      perdasValor:   round2(c.perdasValor),
    }
  }).sort((a, b) => b.cmvValor - a.cmvValor)

  return {
    periodo: {
      inicio: dataInicio.toISOString().slice(0, 10),
      fim:    dataFim.toISOString().slice(0, 10),
    },
    totais: {
      eiValor:       round2(porCategoria.reduce((s, c) => s + c.eiValor, 0)),
      entradasValor: round2(porCategoria.reduce((s, c) => s + c.entradasValor, 0)),
      efValor:       round2(porCategoria.reduce((s, c) => s + c.efValor, 0)),
      cmvValor:      round2(porCategoria.reduce((s, c) => s + c.cmvValor, 0)),
      perdasValor:   round2(porCategoria.reduce((s, c) => s + c.perdasValor, 0)),
    },
    porCategoria,
  }
}
