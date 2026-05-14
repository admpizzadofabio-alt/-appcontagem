import { prisma } from '../../config/prisma.js'
import { env } from '../../config/env.js'
import { NotFoundError } from '../../shared/errors.js'
import { formatLocalDate, localOntem, parseLocalDate } from '../../shared/dateLocal.js'
import {
  fetchVendas,
  fetchCatalogo,
  testConexao,
  verificarStatusPeriodo,
  GRUPOS_BEBIDAS,
} from './colibriApiClient.js'

let importacaoEmAndamento = false

export type ImportarVendasResult = {
  totalVendas: number
  totalImportados: number
  totalIgnorados: number
  erros: string[]
  aviso?: string
  status: 'ok' | 'parcial' | 'aguardando' | 'em_andamento' | 'sem_periodo'
  dataInicio?: string
  dataFim?: string
  produtosAtualizados?: Array<{ nome: string; quantidade: number; local: string }>
}

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
  /** Verifica status-periodo no Colibri antes de importar. Default: true. */
  verificarStatus?: boolean
  /** Remove Saídas Colibri anteriores no período antes de inserir as novas (idempotente). Default: true. */
  substituir?: boolean
}): Promise<ImportarVendasResult> {
  if (importacaoEmAndamento) {
    return {
      totalVendas: 0, totalImportados: 0, totalIgnorados: 0, erros: [],
      status: 'em_andamento',
      aviso: 'Já existe uma importação em andamento. Aguarde alguns segundos.',
    }
  }
  // Advisory lock Postgres: cross-process (cluster PM2) garante 1 import por vez.
  // Key fixa derivada de hashtext('colibri-import') — qualquer worker que tente lockar
  // ao mesmo tempo recebe false e desiste.
  const COLIBRI_LOCK_KEY = 7341234567 // valor arbitrário fixo
  const lockResult = await prisma.$queryRaw<Array<{ pg_try_advisory_lock: boolean }>>`
    SELECT pg_try_advisory_lock(${COLIBRI_LOCK_KEY}::bigint) as pg_try_advisory_lock
  `
  if (!lockResult[0]?.pg_try_advisory_lock) {
    return {
      totalVendas: 0, totalImportados: 0, totalIgnorados: 0, erros: [],
      status: 'em_andamento',
      aviso: 'Outro worker está executando import. Aguarde.',
    }
  }
  importacaoEmAndamento = true

  try {
    // 1. Pré-checagem: a Colibri já fechou o período?
    if (params.verificarStatus !== false) {
      try {
        const status = await verificarStatusPeriodo(params.dataInicio, params.dataFim)
        if (!status.pronto) {
          return {
            totalVendas: 0, totalImportados: 0, totalIgnorados: 0, erros: [],
            status: 'aguardando',
            aviso: `Colibri ainda processando ${status.pendentes} dia(s). Tente novamente em alguns minutos.`,
            dataInicio: params.dataInicio,
            dataFim: params.dataFim,
          }
        }
      } catch (e: any) {
        // status-periodo falhou: 404 (endpoint não existe) seguimos.
        // Outros erros (timeout/5xx): seguro retornar aguardando — não importar com dado parcial.
        const status = e?.message?.match(/\((\d+)\)/)?.[1]
        if (status && status !== '404' && status !== '405') {
          return {
            totalVendas: 0, totalImportados: 0, totalIgnorados: 0, erros: [`status-periodo falhou: ${e.message}`],
            status: 'aguardando',
            aviso: 'Não foi possível confirmar com Colibri se o período está fechado. Tente novamente.',
            dataInicio: params.dataInicio,
            dataFim: params.dataFim,
          }
        }
        console.warn('verificarStatusPeriodo retornou 404/405 (endpoint indisponível), prosseguindo:', e?.message)
      }
    }

    const mapeamentos = await prisma.colibriProduto.findMany({
      where: { ativo: true },
    })

    if (mapeamentos.length === 0) {
      return {
        totalVendas: 0, totalImportados: 0, totalIgnorados: 0, erros: [],
        status: 'parcial',
        aviso: 'Nenhum mapeamento ativo configurado',
      }
    }

    const mapaCode = new Map(mapeamentos.map((m) => [m.colibriCode.toLowerCase(), m]))

    const vendas = await fetchVendas(params.dataInicio, params.dataFim)

    // Carrega marcoInicialEm dos produtos mapeados — Colibri só conta vendas a partir do marco
    const produtosMarco = await prisma.produto.findMany({
      where: { id: { in: mapeamentos.map((m) => m.produtoId) } },
      select: { id: true, marcoInicialEm: true, setorPadrao: true },
    })
    const marcoPorProduto = new Map(produtosMarco.map((p) => [p.id, p.marcoInicialEm]))
    const setorPorProduto = new Map(produtosMarco.map((p) => [p.id, p.setorPadrao]))

    const erros: string[] = []
    let ignorados = 0
    let semMarco = 0
    let antesDoMarco = 0
    let dedupSkip = 0

    // Pré-filtro de marco (não depende do banco) — reduz vendas antes da transação
    const vendasAposMarco = vendas.filter((venda) => {
      const mapeamento = mapaCode.get(venda.productCode.toLowerCase())
      if (!mapeamento) { ignorados++; return false }
      const marco = marcoPorProduto.get(mapeamento.produtoId)
      if (!marco) { semMarco++; return false }
      const dataVenda = venda.timestamp ?? parseLocalDate(params.dataFim, '23:59:59')
      if (dataVenda < marco) { antesDoMarco++; return false }
      return true
    })

    let importados = 0
    const produtosAtualizados: Array<{ nome: string; quantidade: number; local: string }> = []
    const substituir = params.substituir !== false

    await prisma.$transaction(async (tx) => {
      // Modo idempotente: remove Saídas Colibri anteriores com MESMO refOrigem
      if (substituir) {
        const refLike = `colibri:${params.dataInicio}:${params.dataFim}`
        const movsAntigos = await tx.movimentacaoEstoque.findMany({
          where: {
            tipoMov: 'Saida',
            referenciaOrigem: refLike,
          },
        })

        // Estorna estoque dos movimentos antigos (agrupado por produtoId+local)
        const estornoPorChave = new Map<string, { produtoId: string; local: string; qtd: number }>()
        for (const m of movsAntigos) {
          const chave = `${m.produtoId}:${m.localOrigem}`
          const atual = estornoPorChave.get(chave)
          if (atual) { atual.qtd += m.quantidade } else {
            estornoPorChave.set(chave, { produtoId: m.produtoId, local: m.localOrigem ?? 'Bar', qtd: m.quantidade })
          }
        }
        for (const { produtoId, local, qtd } of estornoPorChave.values()) {
          const ea = await tx.estoqueAtual.findUnique({ where: { produtoId_local: { produtoId, local } } })
          if (ea) {
            await tx.estoqueAtual.update({
              where: { produtoId_local: { produtoId, local } },
              data: { quantidadeAtual: ea.quantidadeAtual + qtd, atualizadoPor: params.usuarioId },
            })
          }
        }

        // Remove os movimentos antigos
        if (movsAntigos.length > 0) {
          await tx.movimentacaoEstoque.deleteMany({
            where: { id: { in: movsAntigos.map((m) => m.id) } },
          })
        }
      }

      // DEDUP — carrega idItemVendas já processados em qualquer movimento Colibri restante.
      // Evita duplicação quando 2 imports cobrem ranges diferentes que tocam a mesma venda
      // (ex.: cron usa "ontem→hoje", manual usou "hoje→hoje").
      const movsRestantes = await tx.movimentacaoEstoque.findMany({
        where: {
          tipoMov: 'Saida',
          referenciaOrigem: { startsWith: 'colibri:' },
          idItemVendasColibri: { not: null },
        },
        select: { idItemVendasColibri: true },
      })
      const idsProcessados = new Set<string>()
      for (const m of movsRestantes) {
        if (!m.idItemVendasColibri) continue
        try {
          const arr: string[] = JSON.parse(m.idItemVendasColibri)
          for (const id of arr) idsProcessados.add(id)
        } catch {}
      }

      // Agrega vendas após dedup e marco, mantendo lista de idItemVendas por produto
      const totaisPorProduto = new Map<string, {
        quantidade: number; produtoId: string; local: string; ids: string[]
      }>()
      for (const venda of vendasAposMarco) {
        if (venda.idItemVenda && idsProcessados.has(venda.idItemVenda)) {
          dedupSkip++
          continue
        }
        const mapeamento = mapaCode.get(venda.productCode.toLowerCase())!
        const key = mapeamento.produtoId
        const qtd = venda.quantitySold * mapeamento.fatorConv
        const setor = setorPorProduto.get(mapeamento.produtoId) ?? 'Bar'
        const localProduto = setor === 'Delivery' ? 'Delivery' : 'Bar'
        const atual = totaisPorProduto.get(key)
        if (atual) {
          atual.quantidade += qtd
          if (venda.idItemVenda) atual.ids.push(venda.idItemVenda)
        } else {
          totaisPorProduto.set(key, {
            quantidade: qtd,
            produtoId: mapeamento.produtoId,
            local: localProduto,
            ids: venda.idItemVenda ? [venda.idItemVenda] : [],
          })
        }
      }

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
              localOrigem: info.local,
              usuarioId: params.usuarioId,
              observacao: obs,
              referenciaOrigem: `colibri:${params.dataInicio}:${params.dataFim}`,
              aprovacaoStatus: 'Aprovado',
              idItemVendasColibri: info.ids.length > 0 ? JSON.stringify(info.ids) : null,
            },
          })

          const qtdDecrement = Math.round(info.quantidade * 100) / 100
          const estoqueAtual = await tx.estoqueAtual.findUnique({
            where: { produtoId_local: { produtoId, local: info.local } },
          })
          const novaQtd = Math.max(0, (estoqueAtual?.quantidadeAtual ?? 0) - qtdDecrement)
          await tx.estoqueAtual.upsert({
            where: { produtoId_local: { produtoId, local: info.local } },
            create: { produtoId, local: info.local, quantidadeAtual: 0, atualizadoPor: params.usuarioId },
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
          produtosAtualizados.push({
            nome: produto.nomeBebida,
            quantidade: Math.round(info.quantidade * 100) / 100,
            local: info.local,
          })
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
          totalIgnorados: ignorados + semMarco + antesDoMarco + dedupSkip,
          status: erros.length > 0 ? 'parcial' : 'ok',
          erros: erros.length > 0 ? JSON.stringify(erros) : null,
        },
      })
    })

    return {
      totalVendas: vendas.length,
      totalImportados: importados,
      totalIgnorados: ignorados + semMarco + antesDoMarco + dedupSkip,
      erros,
      status: erros.length > 0 ? 'parcial' : 'ok',
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
      produtosAtualizados,
    }
  } finally {
    importacaoEmAndamento = false
    // Libera advisory lock para outros workers (PM2 cluster)
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${7341234567}::bigint)`.catch(() => {})
  }
}

/**
 * Importa vendas desde o último período já importado até hoje.
 * Usado pelos crons (03:00/12:00/16:00) e pelo botão manual do operador.
 *
 * Lógica:
 * - Se nunca importou: importa apenas o dia anterior.
 * - Se a última importação cobre dias anteriores: importa do dia seguinte ao último até hoje.
 * - Se a última importação já cobre hoje: re-importa hoje (substitui — pega vendas novas do dia).
 */
export async function importarPendente(params: {
  local: string
  usuarioId: string
  usuarioNome: string
}): Promise<ImportarVendasResult> {
  const ultima = await prisma.colibriImportacao.findFirst({
    where: { status: { in: ['ok', 'parcial'] } },
    orderBy: { dataFim: 'desc' },
  })

  // Usa timezone local Brasília — toISOString seria UTC e quebra após 21h BRT.
  const hojeStr = formatLocalDate()
  const ontemStr = localOntem()

  let dataInicio: string
  let dataFim: string = hojeStr

  if (!ultima) {
    // Nunca importou: começa pelo dia anterior (já fechado, dados completos no Colibri)
    dataInicio = ontemStr
    dataFim = ontemStr
  } else {
    // Sempre cobre últimos 2 dias — captura vendas tardias do dia anterior
    // (noite após 16h cron, backend offline, etc) sem duplicar (substituir:true).
    dataInicio = ontemStr
  }

  if (dataInicio > dataFim) {
    return {
      totalVendas: 0, totalImportados: 0, totalIgnorados: 0, erros: [],
      status: 'sem_periodo',
      aviso: 'Nenhum período pendente para importar.',
    }
  }

  return importarVendas({
    dataInicio,
    dataFim,
    local: params.local,
    usuarioId: params.usuarioId,
    usuarioNome: params.usuarioNome,
  })
}

export async function getUltimaImportacao() {
  const ultima = await prisma.colibriImportacao.findFirst({
    orderBy: { importadoEm: 'desc' },
    select: {
      id: true,
      dataInicio: true,
      dataFim: true,
      importadoEm: true,
      usuarioNome: true,
      totalVendas: true,
      totalImportados: true,
      totalIgnorados: true,
      status: true,
    },
  })
  if (!ultima) return null

  const horasDesde = Math.floor((Date.now() - ultima.importadoEm.getTime()) / (1000 * 60 * 60))
  // Stale = mais de 6h sem importar (último cron deveria ter rodado entre 04-16h)
  const stale = horasDesde > 6
  return { ...ultima, stale, horasDesde }
}

/**
 * Recuperação automática no startup: se última importação tem >6h, importa
 * janela maior (últimos 7 dias) para fechar gap após backend ficar offline.
 */
export async function recuperarColibriStartup() {
  if (!env.COLIBRI_CLIENT_ID) return
  const ultima = await prisma.colibriImportacao.findFirst({
    where: { status: { in: ['ok', 'parcial'] } },
    orderBy: { dataFim: 'desc' },
  })
  if (!ultima) return // nunca importou — deixa o cron normal cuidar

  const horasDesde = (Date.now() - ultima.importadoEm.getTime()) / (1000 * 60 * 60)
  if (horasDesde < 6) return // recente, nada a recuperar

  const usuarioSistema = await prisma.usuario.findFirst({
    where: { nivelAcesso: 'Admin', ativo: true },
    orderBy: { criadoEm: 'asc' },
  })
  if (!usuarioSistema) return

  // Janela: últimos 7 dias até hoje (timezone local Brasília)
  const seteDiasAtras = new Date()
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7)

  return importarVendas({
    dataInicio: formatLocalDate(seteDiasAtras),
    dataFim: formatLocalDate(),
    local: 'Bar',
    usuarioId: usuarioSistema.id,
    usuarioNome: `${usuarioSistema.nome} (recuperação startup, ${Math.floor(horasDesde)}h sem cron)`,
    substituir: true,
  })
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
      // Não altera `visto` — item já foi visto pelo usuário anteriormente
      await prisma.colibriCatalogo.update({
        where: { colibriCode: p.codigo },
        data: { colibriNome: p.descricao, grupo: p.grupo, ativo: p.ativo, sincronizadoEm: new Date() },
      })
      atualizados++
    } else {
      // Item novo: visto = false → aparece no badge até o usuário abrir a aba
      await prisma.colibriCatalogo.create({
        data: { colibriCode: p.codigo, colibriNome: p.descricao, grupo: p.grupo, ativo: p.ativo, visto: false },
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

export async function contarNovosColibri() {
  // Só conta itens que o usuário ainda não viu (visto = false) E que não foram importados
  const [naoVistos, mapeamentos] = await Promise.all([
    prisma.colibriCatalogo.findMany({
      where: { visto: false },
      select: { colibriCode: true, colibriNome: true, grupo: true },
    }),
    prisma.colibriProduto.findMany({ select: { colibriCode: true } }),
  ])
  const mapeados = new Set(mapeamentos.map((m) => m.colibriCode.toLowerCase()))
  const novos = naoVistos.filter((c) => !mapeados.has(c.colibriCode.toLowerCase()))
  return { count: novos.length, itens: novos.slice(0, 20) }
}

export async function marcarCatalogoVisto() {
  await prisma.colibriCatalogo.updateMany({ where: { visto: false }, data: { visto: true } })
}

export async function removerCatalogo(id: string) {
  const item = await prisma.colibriCatalogo.findUnique({ where: { id } })
  if (!item) throw new NotFoundError('Item de catálogo não encontrado')
  await prisma.colibriCatalogo.delete({ where: { id } })
}

export async function importarProdutosDoColibri(colibriCodes?: string[]) {
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

  // Se vieram códigos selecionados, filtra apenas esses; senão importa todos os não mapeados
  const selecionados = colibriCodes && colibriCodes.length > 0
    ? new Set(colibriCodes.map((c) => c.toLowerCase()))
    : null

  const novos = produtos.filter((p) => {
    if (codesExistentes.has(p.codigo.toLowerCase())) return false
    if (selecionados) return selecionados.has(p.codigo.toLowerCase())
    return true
  })
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
