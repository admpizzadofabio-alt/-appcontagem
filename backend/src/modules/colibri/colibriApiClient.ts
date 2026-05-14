import { env } from '../../config/env.js'

type ColibriSaleItem = {
  idItemVenda: number | string // ID único da venda no Colibri — usado para dedup
  codMaterial: number | string
  codMaterialStr: string
  descricao: string
  quantidade: number
  cancelado: boolean
  codGrupo: number | null
  grupoNome: string | null
  atendenteNome: string | null
  timestampLancamento: string | null // "YYYY-MM-DD HH:MM:SS" hora local Brasília
}

type ColibriPageResponse = {
  totalItens: number
  totalPaginas: number
  paginaAtual: number
  proximaPagina: number | null
  data: ColibriSaleItem[]
}

export interface ColibriItemVenda {
  idItemVenda: string // ID único — usado para dedupe entre imports
  productCode: string
  productName: string
  quantitySold: number
  groupName: string
  timestamp: Date | null // momento exato da venda (hora local Brasília → UTC)
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
  // Token Colibri expira em 5min (doc oficial). Renovamos aos 4min para margem.
  tokenExpiry = Date.now() + 4 * 60 * 1000
  return cachedToken
}

export type StatusPeriodoResult = {
  pronto: boolean
  pendentes: number
  detalhes: any[]
}

// Checa se todos os dados do período já subiram pro Colibri Cloud antes de importar.
// Endpoint /api/v1/status-periodo retorna lista — se vier itens com status pendente,
// significa que ainda há dia em processamento.
export async function verificarStatusPeriodo(
  dataInicio: string,
  dataFim: string,
): Promise<StatusPeriodoResult> {
  if (!env.COLIBRI_CLIENT_ID || !env.COLIBRI_STORE_ID) {
    throw new Error('Integração Colibri não configurada')
  }

  const token = await getToken()
  const params = new URLSearchParams({
    lojas: env.COLIBRI_STORE_ID,
    dtinicio: dataInicio,
    dtfim: dataFim,
    pagina: '1',
  })

  const res = await fetch(`${env.COLIBRI_BASE_URL}/api/v1/status-periodo?${params}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Colibri status-periodo falhou (${res.status}): ${text}`)
  }

  const json = (await res.json()) as { data?: any[] }
  const lista = json.data ?? []

  // Conservador: qualquer item com flag explícita de pendência conta como pendente.
  // Se a Colibri retornar lista vazia, assumimos que não há dado a sincronizar (pronto).
  const pendentes = lista.filter((it: any) => {
    const status = String(it?.status ?? it?.situacao ?? '').toLowerCase()
    return status.includes('pendente') || status.includes('processando') || it?.processado === false
  })

  return { pronto: pendentes.length === 0, pendentes: pendentes.length, detalhes: lista }
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

  // Retorna 1 entrada POR VENDA (não agrupa) — preserva timestamp para
  // filtragem por marco inicial. Agregação fica para a camada de service.
  const result: ColibriItemVenda[] = []
  for (const i of items) {
    if (!i.grupoNome) continue
    if (!GRUPOS_BEBIDAS_NORM.has(normalizeGroup(i.grupoNome))) continue

    result.push({
      idItemVenda: String(i.idItemVenda),
      productCode: String(i.codMaterial),
      productName: i.descricao,
      quantitySold: i.quantidade,
      groupName: i.grupoNome,
      timestamp: i.timestampLancamento ? new Date(i.timestampLancamento.replace(' ', 'T') + '-03:00') : null,
    })
  }
  return result
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
