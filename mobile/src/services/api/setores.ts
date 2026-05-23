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
    }),
  }),
  overrideExisting: false,
})

export const { useListarSetoresQuery } = setoresApi
