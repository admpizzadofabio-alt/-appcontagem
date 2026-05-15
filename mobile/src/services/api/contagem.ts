import { baseApi } from '../../store/api/baseApi'

export type ContagemItem = {
  id: string
  produtoId: string
  quantidadeSistema: number
  quantidadeContada: number
  diferenca: number
  causaDivergencia?: string
  produto: { nomeBebida: string; categoria: string; unidadeMedida: string; setorPadrao?: string }
}

export type Contagem = {
  id: string
  local: string
  status: 'Aberta' | 'Fechada' | 'Cancelada'
  modoCego: boolean
  threshold: number
  dataAbertura: string
  dataFechamento?: string
  totalItens: number
  totalDesvios: number
  operador: { nome: string }
  itens: ContagemItem[]
}

export type ResultadoProcessamento = {
  divergencias: number
  totalItens: number
  itensComDesvio: Array<{
    produto: string
    sistema: number
    contado: number
    diferenca: number
    causa?: string
  }>
}

export const contagemApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listarContagens: build.query<Omit<Contagem, 'itens'>[], { local?: string } | void>({
      query: (params) => ({ url: '/contagem', params: params ?? {} }),
      providesTags: ['Contagem'],
    }),
    buscarContagem: build.query<Contagem, { id: string; revelar?: boolean }>({
      query: ({ id, revelar }) => ({ url: `/contagem/${id}`, params: { revelar } }),
      providesTags: ['Contagem'],
    }),
    iniciarContagem: build.mutation<Contagem, { local: string; modoCego?: boolean; threshold?: number }>({
      query: (data) => ({ url: '/contagem', method: 'POST', data }),
      invalidatesTags: ['Contagem'],
    }),
    salvarItemContagem: build.mutation<ContagemItem, { contagemId: string; produtoId: string; quantidadeContada: number; causaDivergencia?: string }>({
      query: ({ contagemId, ...data }) => ({ url: `/contagem/${contagemId}/item`, method: 'PATCH', data }),
    }),
    processarContagem: build.mutation<ResultadoProcessamento, string>({
      query: (id) => ({ url: `/contagem/${id}/processar`, method: 'POST' }),
      invalidatesTags: ['Contagem', 'Estoque', 'Movimentacoes'],
    }),
    cancelarContagem: build.mutation<void, string>({
      query: (id) => ({ url: `/contagem/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Contagem'],
    }),
  }),
  overrideExisting: false,
})

export const {
  useListarContagensQuery,
  useBuscarContagemQuery,
  useIniciarContagemMutation,
  useSalvarItemContagemMutation,
  useProcessarContagemMutation,
  useCancelarContagemMutation,
} = contagemApi
