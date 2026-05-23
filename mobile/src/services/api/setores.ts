import { baseApi } from '../../store/api/baseApi'

export type Setor = {
  id: string
  nome: string
  temEstoque: boolean
  ativo: boolean
  criadoEm: string
}

export const setoresApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listarSetores: build.query<Setor[], { apenasAtivos?: boolean } | void>({
      query: (params) => ({
        url: '/setores',
        params: params?.apenasAtivos ? { ativos: 'true' } : undefined,
      }),
      providesTags: ['Setores'],
    }),
    criarSetor: build.mutation<Setor, { nome: string; temEstoque: boolean }>({
      query: (body) => ({ url: '/setores', method: 'POST', body }),
      invalidatesTags: ['Setores'],
    }),
    editarSetor: build.mutation<Setor, { id: string; nome?: string; temEstoque?: boolean; ativo?: boolean }>({
      query: ({ id, ...body }) => ({ url: `/setores/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Setores'],
    }),
    excluirSetor: build.mutation<void, string>({
      query: (id) => ({ url: `/setores/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Setores'],
    }),
  }),
  overrideExisting: false,
})

export const {
  useListarSetoresQuery,
  useCriarSetorMutation,
  useEditarSetorMutation,
  useExcluirSetorMutation,
} = setoresApi
