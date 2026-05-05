import { baseApi } from '../../store/api/baseApi'

export type EstoqueItem = {
  id: string
  produtoId: string
  local: string
  quantidadeAtual: number
  atualizadoEm: string
  produto: { nomeBebida: string; categoria: string; unidadeMedida: string; estoqueMinimo: number; custoUnitario: number }
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
  }),
  overrideExisting: false,
})

export const { useListarEstoqueQuery, useSummaryEstoqueQuery } = estoqueApi
