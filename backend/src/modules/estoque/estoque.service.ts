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
  // Busca por data calendário (abertoEm). FechamentoTurno não tem relação Prisma
  // com ContagemEstoque, então buscamos contagem manualmente via contagemId.
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

  // Sem turno: usa dia calendário inteiro.
  // Com turno: usa janela [dataFechamento_da_contagem → fechadoEm_do_turno].
  // Importante: NÃO usar abertoEm — abertoEm dispara import Colibri pré-contagem que
  // já se reflete em quantidadeSistema (= abertura). Contar essas mesmas vendas aqui
  // seria double-count. Movements relevantes são os DEPOIS da contagem ser finalizada.
  const inicioMov = contagem?.dataFechamento ?? turno?.abertoEm ?? inicioDia
  const fimMov = turno?.fechadoEm ?? (turno ? new Date() : fimDia)
  const movs = await prisma.movimentacaoEstoque.findMany({
    where: {
      dataMov: { gte: inicioMov, lte: fimMov },
      OR: [{ localOrigem: local }, { localDestino: local }],
      aprovacaoStatus: 'Aprovado',
    },
    select: { produtoId: true, tipoMov: true, quantidade: true, localOrigem: true, referenciaOrigem: true },
  })

  // Sem turno e sem movimentos: realmente não houve atividade no dia
  if (!turno && movs.length === 0) {
    return { temDados: false, data, local, resumo: null, produtos: [] }
  }

  type ProdEntry = {
    produtoId: string; nomeBebida: string; categoria: string; unidadeMedida: string; custoUnitario: number
    abertura: number; contado: number; divergencia: number
    colibri: number; entradas: number; perdas: number; fechamento: number
  }
  const map = new Map<string, ProdEntry>()

  if (contagem) {
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
  }

  // Produtos que tiveram movimento mas não estavam na contagem (ex.: entrada no meio do turno)
  const produtoIdsMovsSemEntry = movs
    .map((m) => m.produtoId)
    .filter((id) => !map.has(id))
  if (produtoIdsMovsSemEntry.length > 0) {
    const extras = await prisma.produto.findMany({
      where: { id: { in: produtoIdsMovsSemEntry } },
      select: { id: true, nomeBebida: true, categoria: true, unidadeMedida: true, custoUnitario: true },
    })
    for (const p of extras) {
      map.set(p.id, {
        produtoId: p.id, nomeBebida: p.nomeBebida, categoria: p.categoria, unidadeMedida: p.unidadeMedida, custoUnitario: p.custoUnitario,
        abertura: 0, contado: 0, divergencia: 0,
        colibri: 0, entradas: 0, perdas: 0, fechamento: 0,
      })
    }
  }

  for (const m of movs) {
    const p = map.get(m.produtoId)
    if (!p) continue
    if (m.tipoMov === 'Saida' && m.referenciaOrigem?.startsWith('colibri:')) p.colibri += m.quantidade
    else if (m.tipoMov === 'Entrada') p.entradas += m.quantidade
    else if (m.tipoMov === 'AjustePerda') p.perdas += m.quantidade
  }

  const produtos = Array.from(map.values()).map((p) => ({
    ...p,
    fechamento: p.contado + p.entradas - p.colibri - p.perdas,
  })).sort((a, b) => a.nomeBebida.localeCompare(b.nomeBebida))

  return {
    temDados: true,
    data,
    local,
    turno: turno ? { abertoEm: turno.abertoEm, fechadoEm: turno.fechadoEm, status: turno.status } : null,
    resumo: {
      totalDivergencias: produtos.filter((p) => p.divergencia !== 0).length,
      totalColibri: produtos.reduce((a, p) => a + p.colibri, 0),
      totalEntradas: produtos.reduce((a, p) => a + p.entradas, 0),
      totalPerdas: produtos.reduce((a, p) => a + p.perdas, 0),
    },
    produtos,
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
