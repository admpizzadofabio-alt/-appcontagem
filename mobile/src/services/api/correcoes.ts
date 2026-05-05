import { baseApi } from '../../store/api/baseApi'

export type CorrecaoVenda = {
  id: string
  diaOperacional: string
  turnoId?: string | null
  local: string
  quantidade: number
  fotoComanda: string
  observacao?: string | null
  criadoEm: string
  produtoComandado: { nomeBebida: string; unidadeMedida: string }
  produtoServido: { nomeBebida: string; unidadeMedida: string }
  operador: { nome: string }
}

export const correcoesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    registrarCorrecao: build.mutation<CorrecaoVenda, {
      local: 'Bar' | 'Delivery'
      turnoId?: string | null
      produtoComandadoId: string
      produtoServidoId: string
      quantidade: number
      fotoComanda: string
      observacao?: string
    }>({
      query: (data) => ({ url: '/correcoes', method: 'POST', data }),
      invalidatesTags: ['Estoque', 'Correcoes'],
    }),
    listarCorrecoes: build.query<CorrecaoVenda[], { diaOperacional?: string; local?: string; turnoId?: string }>({
      query: (params) => ({ url: '/correcoes', params }),
      providesTags: ['Correcoes'],
    }),
  }),
  overrideExisting: false,
})

export const {
  useRegistrarCorrecaoMutation,
  useListarCorrecoesQuery,
} = correcoesApi
