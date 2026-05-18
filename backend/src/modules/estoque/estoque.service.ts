import { prisma } from '../../config/prisma.js'
import { NotFoundError, ForbiddenError } from '../../shared/errors.js'

export async function listar(local?: string) {
  // Filtro Marco Inicial: só exibe produtos que já tiveram carga inicial.
  // Produtos sem carga não operam — Admin é avisado pelo banner na Home + tela Produtos.
  if (local) {
    const produtos = await prisma.produto.findMany({
      where: {
        ativo: true,
        marcoInicialEm: { not: null },
        OR: [{ setorPadrao: local }, { setorPadrao: 'Todos' }],
      },
      include: { estoque: { where: { local } } },
      orderBy: { nomeBebida: 'asc' },
    })
    return produtos.map((p) => {
      const { estoque: estoqueList, ...produtoData } = p
      const estoque = estoqueList[0]
      return {
        id: estoque?.id ?? `virtual_${p.id}`,
        produtoId: p.id,
        local,
        quantidadeAtual: estoque?.quantidadeAtual ?? 0,
        atualizadoPor: estoque?.atualizadoPor ?? null,
        atualizadoEm: estoque?.atualizadoEm ?? null,
        ultimaContagemEm: estoque?.ultimaContagemEm ?? null,
        ultimaContagemQuantidade: estoque?.ultimaContagemQuantidade ?? null,
        produto: produtoData,
      }
    })
  }

  const locais = ['Bar', 'Delivery'] as const
  const produtos = await prisma.produto.findMany({
    where: { ativo: true, marcoInicialEm: { not: null } },
    include: { estoque: true },
    orderBy: { nomeBebida: 'asc' },
  })
  const result = []
  for (const p of produtos) {
    const { estoque: estoqueList, ...produtoData } = p
    for (const l of locais) {
      if (p.setorPadrao !== l && p.setorPadrao !== 'Todos') continue
      const estoque = estoqueList.find((e) => e.local === l)
      result.push({
        id: estoque?.id ?? `virtual_${p.id}_${l}`,
        produtoId: p.id,
        local: l,
        quantidadeAtual: estoque?.quantidadeAtual ?? 0,
        atualizadoPor: estoque?.atualizadoPor ?? null,
        atualizadoEm: estoque?.atualizadoEm ?? null,
        ultimaContagemEm: estoque?.ultimaContagemEm ?? null,
        ultimaContagemQuantidade: estoque?.ultimaContagemQuantidade ?? null,
        produto: produtoData,
      })
    }
  }
  return result
}

export async function summary() {
  type Item = Awaited<ReturnType<typeof prisma.estoqueAtual.findMany<{ include: { produto: true } }>>>[number]
  const itens: Item[] = await prisma.estoqueAtual.findMany({ where: { produto: { ativo: true, marcoInicialEm: { not: null } } }, include: { produto: true } })
  const totalValor = itens.reduce((acc: number, i: Item) => acc + i.quantidadeAtual * i.produto.custoUnitario, 0)
  const totalItens = itens.length
  const alertas = itens.filter((i: Item) => i.quantidadeAtual <= i.produto.estoqueMinimo && i.produto.estoqueMinimo > 0)
  return { totalValor, totalItens, alertas: alertas.length, itensAlerta: alertas.map((a: Item) => ({ ...a.produto, quantidadeAtual: a.quantidadeAtual, local: a.local })) }
}

export async function ajustar(id: string, quantidade: number, usuarioId: string, setor: string, nivelAcesso: string) {
  const registro = await prisma.estoqueAtual.findUnique({ where: { id } })
  if (!registro) throw new NotFoundError('Registro de estoque não encontrado')
  if (nivelAcesso !== 'Admin' && registro.local !== setor)
    throw new ForbiddenError(`Supervisor do setor "${setor}" não pode ajustar estoque de "${registro.local}"`)
  return prisma.estoqueAtual.update({ where: { id }, data: { quantidadeAtual: quantidade, atualizadoPor: usuarioId } })
}

export async function historico(data: string, local: string) {
  const inicioDia = new Date(data + 'T00:00:00')
  const fimDia = new Date(data + 'T23:59:59')
  const turno = await prisma.fechamentoTurno.findFirst({
    where: { local, abertoEm: { gte: inicioDia, lte: fimDia } },
    orderBy: { abertoEm: 'asc' },
  })

  const contagem = turno?.contagemId
    ? await prisma.contagemEstoque.findUnique({
        where: { id: turno.contagemId },
        include: {
          itens: {
            include: { produto: { select: { nomeBebida: true, categoria: true, unidadeMedida: true, custoUnitario: true } } },
          },
        },
      })
    : null

  // CASO 1: turno com contagem — lógica original intacta
  // Movimentos contam apenas APÓS a contagem (evita double-count com quantidadeSistema)
  if (turno && contagem) {
    const inicioMov = contagem.dataFechamento ?? turno.abertoEm
    const fimMov = turno.fechadoEm ?? new Date()
    const movs = await prisma.movimentacaoEstoque.findMany({
      where: {
        dataMov: { gte: inicioMov, lte: fimMov },
        OR: [{ localOrigem: local }, { localDestino: local }],
        aprovacaoStatus: 'Aprovado',
      },
      select: { produtoId: true, tipoMov: true, quantidade: true, localOrigem: true, referenciaOrigem: true },
    })

    type ProdEntry = {
      produtoId: string; nomeBebida: string; categoria: string; unidadeMedida: string; custoUnitario: number
      abertura: number; contado: number; divergencia: number
      colibri: number; entradas: number; perdas: number; fechamento: number
    }
    const map = new Map<string, ProdEntry>()
    for (const item of contagem.itens) {
      map.set(item.produtoId, {
        produtoId: item.produtoId,
        nomeBebida: item.produto.nomeBebida,
        categoria: item.produto.categoria,
        unidadeMedida: item.produto.unidadeMedida,
        custoUnitario: item.produto.custoUnitario,
        abertura: item.quantidadeSistema,
        contado: item.quantidadeContada,
        divergencia: item.diferenca,
        colibri: 0, entradas: 0, perdas: 0, fechamento: 0,
      })
    }
    const semEntry = movs.map((m) => m.produtoId).filter((id) => !map.has(id))
    if (semEntry.length > 0) {
      const extras = await prisma.produto.findMany({
        where: { id: { in: semEntry } },
        select: { id: true, nomeBebida: true, categoria: true, unidadeMedida: true, custoUnitario: true },
      })
      for (const p of extras) {
        map.set(p.id, { produtoId: p.id, nomeBebida: p.nomeBebida, categoria: p.categoria, unidadeMedida: p.unidadeMedida, custoUnitario: p.custoUnitario, abertura: 0, contado: 0, divergencia: 0, colibri: 0, entradas: 0, perdas: 0, fechamento: 0 })
      }
    }
    for (const m of movs) {
      const p = map.get(m.produtoId)
      if (!p) continue
      if (m.tipoMov === 'Saida' && m.referenciaOrigem?.startsWith('colibri:')) p.colibri += m.quantidade
      else if (m.tipoMov === 'Entrada') p.entradas += m.quantidade
      else if (m.tipoMov === 'AjustePerda') p.perdas += m.quantidade
    }
    const produtos = Array.from(map.values())
      .map((p) => ({ ...p, fechamento: p.contado + p.entradas - p.colibri - p.perdas }))
      .sort((a, b) => a.nomeBebida.localeCompare(b.nomeBebida))
    return {
      temDados: true, data, local,
      turno: { abertoEm: turno.abertoEm, fechadoEm: turno.fechadoEm, status: turno.status },
      resumo: {
        totalDivergencias: produtos.filter((p) => p.divergencia !== 0).length,
        totalColibri: produtos.reduce((a, p) => a + p.colibri, 0),
        totalEntradas: produtos.reduce((a, p) => a + p.entradas, 0),
        totalPerdas: produtos.reduce((a, p) => a + p.perdas, 0),
      },
      produtos,
    }
  }

  // CASO 2: sem turno ou turno sem contagem — snapshot retroativo via walk-forward
  // Query única ordenada por data; passagem única calcula abertura (snapshot no limite do dia) e fechamento
  const movsTodos = await prisma.movimentacaoEstoque.findMany({
    where: {
      dataMov: { lte: fimDia },
      OR: [{ localOrigem: local }, { localDestino: local }],
      aprovacaoStatus: 'Aprovado',
    },
    orderBy: { dataMov: 'asc' },
    select: { produtoId: true, tipoMov: true, quantidade: true, localOrigem: true, localDestino: true, dataMov: true, referenciaOrigem: true },
  })

  const workMap = new Map<string, number>()
  const aberturaMap = new Map<string, number>()
  let aberturaSnapped = false

  for (const m of movsTodos) {
    if (!aberturaSnapped && m.dataMov >= inicioDia) {
      for (const [k, v] of workMap) aberturaMap.set(k, v)
      aberturaSnapped = true
    }
    const cur = workMap.get(m.produtoId) ?? 0
    switch (m.tipoMov) {
      case 'CargaInicial':
        workMap.set(m.produtoId, m.quantidade)
        break
      case 'Entrada':
        if (m.localDestino === local) workMap.set(m.produtoId, cur + m.quantidade)
        break
      case 'Saida':
      case 'AjustePerda':
        if (m.localOrigem === local) workMap.set(m.produtoId, cur - m.quantidade)
        break
      case 'Transferencia':
        if (m.localOrigem === local)  workMap.set(m.produtoId, cur - m.quantidade)
        if (m.localDestino === local) workMap.set(m.produtoId, (workMap.get(m.produtoId) ?? 0) + m.quantidade)
        break
      case 'AjusteContagem':
        if (m.localDestino === local) workMap.set(m.produtoId, cur + m.quantidade)
        if (m.localOrigem  === local) workMap.set(m.produtoId, cur - m.quantidade)
        break
    }
  }
  if (!aberturaSnapped) {
    for (const [k, v] of workMap) aberturaMap.set(k, v)
  }

  if (workMap.size === 0) {
    return { temDados: false, data, local, resumo: null, produtos: [] }
  }

  const produtosInfo = await prisma.produto.findMany({
    where: { id: { in: [...workMap.keys()] } },
    select: { id: true, nomeBebida: true, categoria: true, unidadeMedida: true, custoUnitario: true },
  })

  const movsDoDia = movsTodos.filter((m) => m.dataMov >= inicioDia)
  const resumo = { totalDivergencias: 0, totalColibri: 0, totalEntradas: 0, totalPerdas: 0 }
  for (const m of movsDoDia) {
    if (m.tipoMov === 'Saida' && m.referenciaOrigem?.startsWith('colibri:') && m.localOrigem === local)
      resumo.totalColibri += m.quantidade
    else if (m.tipoMov === 'Entrada' && m.localDestino === local) resumo.totalEntradas += m.quantidade
    else if (m.tipoMov === 'AjustePerda' && m.localOrigem === local) resumo.totalPerdas += m.quantidade
  }

  const produtos = produtosInfo
    .map((p) => ({
      produtoId: p.id,
      nomeBebida: p.nomeBebida,
      categoria: p.categoria,
      unidadeMedida: p.unidadeMedida,
      custoUnitario: p.custoUnitario,
      abertura: aberturaMap.get(p.id) ?? 0,
      contado: 0,
      divergencia: 0,
      colibri: 0, entradas: 0, perdas: 0,
      fechamento: workMap.get(p.id) ?? 0,
    }))
    .filter((p) => p.fechamento > 0)
    .sort((a, b) => a.nomeBebida.localeCompare(b.nomeBebida))

  if (produtos.length === 0) {
    return { temDados: false, data, local, resumo: null, produtos: [] }
  }

  return {
    temDados: true, data, local,
    turno: turno ? { abertoEm: turno.abertoEm, fechadoEm: turno.fechadoEm, status: turno.status } : null,
    resumo,
    produtos,
    semAtividade: movsDoDia.length === 0,
  }
}

// Função interna — usada por movimentações
export async function upsertEstoque(produtoId: string, local: string, delta: number, usuarioId: string) {
  const existing = await prisma.estoqueAtual.findUnique({ where: { produtoId_local: { produtoId, local } } })
  if (existing) {
    return prisma.estoqueAtual.update({
      where: { produtoId_local: { produtoId, local } },
      data: { quantidadeAtual: Math.max(0, existing.quantidadeAtual + delta), atualizadoPor: usuarioId },
    })
  }
  return prisma.estoqueAtual.create({ data: { produtoId, local, quantidadeAtual: Math.max(0, delta), atualizadoPor: usuarioId } })
}
