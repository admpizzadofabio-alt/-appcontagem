import { baseApi } from '../../store/api/baseApi'

export type EstoqueItem = {
  id: string
  produtoId: string
  local: string
  quantidadeAtual: number
  atualizadoEm: string
  produto: { nomeBebida: string; categoria: string; unidadeMedida: string; estoqueMinimo: number; custoUnitario: number }
}

export type EstoqueHistoricoItem = {
  produtoId: string
  nomeBebida: string
  categoria: string
  unidadeMedida: string
  custoUnitario: number
  abertura: number
  contado: number
  divergencia: number
  colibri: number
  entradas: number
  perdas: number
  fechamento: number
}

export type EstoqueHistorico = {
  temDados: boolean
  data: string
  local: string
  turno: { abertoEm: string; fechadoEm: string | null; status: string } | null
  resumo: { totalDivergencias: number; totalColibri: number; totalEntradas: number; totalPerdas: number } | null
  produtos: EstoqueHistoricoItem[]
}

export type EstoqueSummary = {
  totalValor: number
  totalItens: number
  alertas: number
  aprovacoesPendentes: number
}

export const estoqueApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listarEstoque: build.query<EstoqueItem[], { local?: string } | void>({
      query: (params) => ({ url: '/estoque', params: params ?? {} }),
      providesTags: ['Estoque'],
    }),
    summaryEstoque: build.query<EstoqueSummary, void>({
      query: () => ({ url: '/estoque/summary' }),
      providesTags: ['Estoque'],
    }),
    historicoEstoque: build.query<EstoqueHistorico, { data: string; local: string }>({
      query: (p) => ({ url: '/estoque/historico', params: p }),
      providesTags: ['Estoque'],
    }),
  }),
  overrideExisting: false,
})

export const { useListarEstoqueQuery, useSummaryEstoqueQuery, useHistoricoEstoqueQuery } = estoqueApi
