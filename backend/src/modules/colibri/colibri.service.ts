import { prisma } from '../../config/prisma.js'
import { NotFoundError } from '../../shared/errors.js'
import { fetchVendas, fetchCatalogo, testConexao, GRUPOS_BEBIDAS } from './colibriApiClient.js'

export async function listarMapeamentos() {
  return prisma.colibriProduto.findMany({
    include: { produto: { select: { nomeBebida: true, unidadeMedida: true } } },
    orderBy: { colibriNome: 'asc' },
  })
}

export async function criarMapeamento(data: {
  colibriCode: string
  colibriNome: string
  produtoId: string
  fatorConv: number
}) {
  const produto = await prisma.produto.findUnique({ where: { id: data.produtoId } })
  if (!produto) throw new NotFoundError('Produto não encontrado')

  return prisma.colibriProduto.create({
    data,
    include: { produto: { select: { nomeBebida: true, unidadeMedida: true } } },
  })
}

export async function atualizarMapeamento(
  id: string,
  data: { colibriNome?: string; produtoId?: string; fatorConv?: number; ativo?: boolean },
) {
  const existe = await prisma.colibriProduto.findUnique({ where: { id } })
  if (!existe) throw new NotFoundError('Mapeamento não encontrado')

  if (data.produtoId) {
    const produto = await prisma.produto.findUnique({ where: { id: data.produtoId } })
    if (!produto) throw new NotFoundError('Produto não encontrado')
  }

  return prisma.colibriProduto.update({
    where: { id },
    data,
    include: { produto: { select: { nomeBebida: true, unidadeMedida: true } } },
  })
}

export async function removerMapeamento(id: string) {
  const existe = await prisma.colibriProduto.findUnique({ where: { id } })
  if (!existe) throw new NotFoundError('Mapeamento não encontrado')
  await prisma.colibriProduto.delete({ where: { id } })
}

export async function importarVendas(params: {
  dataInicio: string
  dataFim: string
  local: string
  usuarioId: string
  usuarioNome: string
}) {
  const mapeamentos = await prisma.colibriProduto.findMany({
    where: { ativo: true },
  })

  if (mapeamentos.length === 0) {
    return { totalVendas: 0, totalImportados: 0, totalIgnorados: 0, erros: [], aviso: 'Nenhum mapeamento ativo configurado' }
  }

  const mapaCode = new Map(mapeamentos.map((m) => [m.colibriCode.toLowerCase(), m]))

  const vendas = await fetchVendas(params.dataInicio, params.dataFim)

  // Agrupa quantidades por produtoId usando resultado já agregado do fetchVendas
  const totaisPorProduto = new Map<string, { quantidade: number; produtoId: string }>()
  const erros: string[] = []
  let ignorados = 0

  for (const venda of vendas) {
    const mapeamento = mapaCode.get(venda.productCode.toLowerCase())
    if (!mapeamento) {
      ignorados++
      continue
    }
    const key = mapeamento.produtoId
    const qtd = venda.quantitySold * mapeamento.fatorConv
    const atual = totaisPorProduto.get(key)
    if (atual) {
      atual.quantidade += qtd
    } else {
      totaisPorProduto.set(key, { quantidade: qtd, produtoId: mapeamento.produtoId })
    }
  }

  let importados = 0

  await prisma.$transaction(async (tx) => {
    for (const [produtoId, info] of totaisPorProduto) {
      try {
        const produto = await tx.produto.findUnique({ where: { id: produtoId } })
        if (!produto) {
          erros.push(`Produto ${produtoId} não encontrado`)
          continue
        }

        const obs = `Importado do Colibri: ${params.dataInicio} a ${params.dataFim}`

        const mov = await tx.movimentacaoEstoque.create({
          data: {
            produtoId,
            tipoMov: 'Saida',
            quantidade: Math.round(info.quantidade * 100) / 100,
            localOrigem: params.local,
            usuarioId: params.usuarioId,
            observacao: obs,
            referenciaOrigem: `colibri:${params.dataInicio}:${params.dataFim}`,
            aprovacaoStatus: 'Aprovado',
          },
        })

        const qtdDecrement = Math.round(info.quantidade * 100) / 100
        const estoqueAtual = await tx.estoqueAtual.findUnique({
          where: { produtoId_local: { produtoId, local: params.local } },
        })
        const novaQtd = Math.max(0, (estoqueAtual?.quantidadeAtual ?? 0) - qtdDecrement)
        await tx.estoqueAtual.upsert({
          where: { produtoId_local: { produtoId, local: params.local } },
          create: { produtoId, local: params.local, quantidadeAtual: 0, atualizadoPor: params.usuarioId },
          update: { quantidadeAtual: novaQtd, atualizadoPor: params.usuarioId },
        })

        await tx.logAuditoria.create({
          data: {
            usuarioId: params.usuarioId,
            usuarioNome: params.usuarioNome,
            setor: 'Admin',
            acao: 'COLIBRI_IMPORTACAO',
            entidade: 'MovimentacaoEstoque',
            idReferencia: mov.id,
            detalhes: JSON.stringify({
              produto: produto.nomeBebida,
              quantidade: info.quantidade,
              periodo: `${params.dataInicio} a ${params.dataFim}`,
            }),
          },
        })

        importados++
      } catch (e: any) {
        erros.push(`Produto ${produtoId}: ${e.message}`)
      }
    }

    await tx.colibriImportacao.create({
      data: {
        dataInicio: new Date(params.dataInicio),
        dataFim: new Date(params.dataFim),
        usuarioId: params.usuarioId,
        usuarioNome: params.usuarioNome,
        totalVendas: vendas.length,
        totalImportados: importados,
        totalIgnorados: ignorados,
        status: erros.length > 0 ? 'parcial' : 'ok',
        erros: erros.length > 0 ? JSON.stringify(erros) : null,
      },
    })
  })

  return {
    totalVendas: vendas.length,
    totalImportados: importados,
    totalIgnorados: ignorados,
    erros,
  }
}

export async function listarImportacoes() {
  return prisma.colibriImportacao.findMany({
    orderBy: { importadoEm: 'desc' },
    take: 50,
  })
}

export async function sincronizarCatalogo() {
  const produtos = await fetchCatalogo()

  let novos = 0
  let atualizados = 0

  for (const p of produtos) {
    const existe = await prisma.colibriCatalogo.findUnique({ where: { colibriCode: p.codigo } })
    if (existe) {
      await prisma.colibriCatalogo.update({
        where: { colibriCode: p.codigo },
        data: { colibriNome: p.descricao, grupo: p.grupo, ativo: p.ativo, sincronizadoEm: new Date() },
      })
      atualizados++
    } else {
      await prisma.colibriCatalogo.create({
        data: { colibriCode: p.codigo, colibriNome: p.descricao, grupo: p.grupo, ativo: p.ativo },
      })
      novos++
    }
  }

  return { total: produtos.length, novos, atualizados, grupos: GRUPOS_BEBIDAS }
}

export async function listarCatalogo() {
  const [catalogo, mapeamentos] = await Promise.all([
    prisma.colibriCatalogo.findMany({ orderBy: [{ grupo: 'asc' }, { colibriNome: 'asc' }] }),
    prisma.colibriProduto.findMany({ include: { produto: { select: { nomeBebida: true } } } }),
  ])

  const mapaCode = new Map(mapeamentos.map((m) => [m.colibriCode.toLowerCase(), m]))

  return catalogo.map((item) => {
    const mapeamento = mapaCode.get(item.colibriCode.toLowerCase())
    return {
      ...item,
      mapeado: !!mapeamento,
      mapeamentoId: mapeamento?.id ?? null,
      produtoNome: mapeamento?.produto?.nomeBebida ?? null,
    }
  })
}

export async function removerCatalogo(id: string) {
  const item = await prisma.colibriCatalogo.findUnique({ where: { id } })
  if (!item) throw new NotFoundError('Item de catálogo não encontrado')
  await prisma.colibriCatalogo.delete({ where: { id } })
}

export async function importarProdutosDoColibri() {
  // Busca catálogo atualizado direto da API do Colibri
  const produtos = await fetchCatalogo()

  if (produtos.length === 0) {
    return { total: 0, criados: 0, ignorados: 0, detalhes: [] as string[] }
  }

  // Descobre quais colibriCodes já têm mapeamento para não duplicar
  const mapeamentosExistentes = await prisma.colibriProduto.findMany({
    select: { colibriCode: true },
  })
  const codesExistentes = new Set(mapeamentosExistentes.map((m) => m.colibriCode.toLowerCase()))

  const novos = produtos.filter((p) => !codesExistentes.has(p.codigo.toLowerCase()))
  const detalhes: string[] = []
  let criados = 0

  await prisma.$transaction(async (tx) => {
    for (const p of novos) {
      // Cria o produto interno
      const produto = await tx.produto.create({
        data: {
          nomeBebida: p.descricao,
          categoria: p.grupo,
          unidadeMedida: 'un',
          custoUnitario: 0,
          estoqueMinimo: 0,
          setorPadrao: 'Todos',
          ativo: true,
        },
      })

      // Cria o mapeamento Colibri → Produto interno automaticamente
      await tx.colibriProduto.create({
        data: {
          colibriCode: p.codigo,
          colibriNome: p.descricao,
          produtoId: produto.id,
          fatorConv: 1,
          ativo: true,
        },
      })

      detalhes.push(p.descricao)
      criados++
    }
  })

  return {
    total: produtos.length,
    criados,
    ignorados: produtos.length - criados,
    detalhes,
  }
}

export { testConexao }
