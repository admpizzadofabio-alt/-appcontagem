import { env } from '../../config/env.js'

type ColibriSaleItem = {
  codMaterial: number | string
  codMaterialStr: string
  descricao: string
  quantidade: number
  cancelado: boolean
  codGrupo: number | null
  grupoNome: string | null
  atendenteNome: string | null
}

type ColibriPageResponse = {
  totalItens: number
  totalPaginas: number
  paginaAtual: number
  proximaPagina: number | null
  data: ColibriSaleItem[]
}

export interface ColibriItemVenda {
  productCode: string
  productName: string
  quantitySold: number
  groupName: string
}

export interface ColibriProdutoCatalogo {
  codigo: string
  descricao: string
  grupo: string
  ativo: boolean
}

const GRUPOS_BEBIDAS_NORM = new Set([
  'cervejas e chopps',
  'cervejas e drinks',
  'coqueteis',
  'licores',
  'aguas',
  'refris',
  'sucos',
  'bebidas quentes',
  'bebidas sem alcool',
])

export const GRUPOS_BEBIDAS = [
  'CERVEJAS E CHOPPS',
  'CERVEJAS E DRINKS',
  'COQUETÉIS',
  'LICORES',
  'AGUAS',
  'REFRIS',
  'SUCOS',
  'BEBIDAS QUENTES',
  'BEBIDAS SEM ÁLCOOL',
]

function normalizeGroup(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

let cachedToken: string | null = null
let tokenExpiry = 0

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken

  if (!env.COLIBRI_CLIENT_ID) throw new Error('COLIBRI_CLIENT_ID não configurado')

  const url = `${env.COLIBRI_BASE_URL}/oauth/authenticate?client_id=${encodeURIComponent(env.COLIBRI_CLIENT_ID)}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Colibri auth falhou (${res.status}): ${text}`)
  }

  const json = await res.json() as { access_token?: string }
  if (!json.access_token) throw new Error('Token não encontrado na resposta do Colibri')

  cachedToken = String(json.access_token)
  tokenExpiry = Date.now() + 13 * 60 * 1000 // token expira em 15 min, renova aos 13
  return cachedToken
}

async function fetchAllItems(dtinicio: string, dtfim: string): Promise<ColibriSaleItem[]> {
  if (!env.COLIBRI_CLIENT_ID || !env.COLIBRI_STORE_ID) {
    throw new Error('Integração Colibri não configurada (CLIENT_ID e STORE_ID obrigatórios)')
  }

  const token = await getToken()
  const allItems: ColibriSaleItem[] = []
  let page = 1

  while (true) {
    const params = new URLSearchParams({
      lojas: env.COLIBRI_STORE_ID,
      dtinicio,
      dtfim,
      pagina: String(page),
    })

    const res = await fetch(`${env.COLIBRI_BASE_URL}/api/v1/itemvenda?${params}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Colibri itemvenda falhou (${res.status}): ${text}`)
    }

    const json = (await res.json()) as ColibriPageResponse
    allItems.push(...(json.data ?? []))
    if (!json.proximaPagina) break
    page++
  }

  return allItems.filter((i) => !i.cancelado)
}

export async function fetchVendas(dataInicio: string, dataFim: string): Promise<ColibriItemVenda[]> {
  const items = await fetchAllItems(dataInicio, dataFim)

  // Filtra só bebidas e agrupa por código
  const grouped = new Map<string, ColibriItemVenda>()

  for (const i of items) {
    if (!i.grupoNome) continue
    if (!GRUPOS_BEBIDAS_NORM.has(normalizeGroup(i.grupoNome))) continue

    const code = String(i.codMaterial)
    const existing = grouped.get(code)
    if (existing) {
      existing.quantitySold += i.quantidade
    } else {
      grouped.set(code, {
        productCode: code,
        productName: i.descricao,
        quantitySold: i.quantidade,
        groupName: i.grupoNome,
      })
    }
  }

  return Array.from(grouped.values())
}

export async function fetchCatalogo(): Promise<ColibriProdutoCatalogo[]> {
  const hoje = new Date()
  const dtfim = hoje.toISOString().split('T')[0]
  const dt30 = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000)
  const dtinicio = dt30.toISOString().split('T')[0]

  const items = await fetchAllItems(dtinicio, dtfim)

  const seen = new Map<string, ColibriProdutoCatalogo>()
  for (const i of items) {
    if (!i.grupoNome) continue
    if (!GRUPOS_BEBIDAS_NORM.has(normalizeGroup(i.grupoNome))) continue

    const code = String(i.codMaterial)
    if (!seen.has(code)) {
      seen.set(code, {
        codigo: code,
        descricao: i.descricao,
        grupo: i.grupoNome,
        ativo: true,
      })
    }
  }

  return Array.from(seen.values())
}

export async function testConexao(): Promise<{ ok: boolean; mensagem: string }> {
  try {
    if (!env.COLIBRI_CLIENT_ID || !env.COLIBRI_STORE_ID) {
      return { ok: false, mensagem: 'COLIBRI_CLIENT_ID e COLIBRI_STORE_ID não configurados' }
    }
    await getToken()
    return { ok: true, mensagem: 'Conexão com Colibri estabelecida' }
  } catch (e: any) {
    return { ok: false, mensagem: e.message }
  }
}
