import { baseApi } from '../../store/api/baseApi'

export type ColibriMapeamento = {
  id: string
  colibriCode: string
  colibriNome: string
  produtoId: string
  fatorConv: number
  ativo: boolean
  produto: { nomeBebida: string; unidadeMedida: string }
}

export type ColibriImportacao = {
  id: string
  dataInicio: string
  dataFim: string
  importadoEm: string
  usuarioNome: string
  totalVendas: number
  totalImportados: number
  totalIgnorados: number
  status: string
  erros?: string | null
}

export type ImportarVendasInput = {
  dataInicio: string
  dataFim: string
  local: 'Bar' | 'Delivery'
}

export type ImportarVendasResult = {
  totalVendas: number
  totalImportados: number
  totalIgnorados: number
  erros: string[]
  aviso?: string
}

export type ColibriStatus = {
  ok: boolean
  mensagem: string
}

export type ColibriCatalogoItem = {
  id: string
  colibriCode: string
  colibriNome: string
  grupo: string
  ativo: boolean
  sincronizadoEm: string
  mapeado: boolean
  mapeamentoId: string | null
  produtoNome: string | null
}

export type SincronizarResult = {
  total: number
  novos: number
  atualizados: number
  grupos: string[]
}

export type ImportarProdutosResult = {
  total: number
  criados: number
  ignorados: number
  detalhes: string[]
}

export const colibriApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    colibriStatus: build.query<ColibriStatus, void>({
      query: () => ({ url: '/colibri/status' }),
    }),
    listarMapeamentos: build.query<ColibriMapeamento[], void>({
      query: () => ({ url: '/colibri/mapeamentos' }),
      providesTags: ['ColibriMapeamentos'],
    }),
    criarMapeamento: build.mutation<ColibriMapeamento, { colibriCode: string; colibriNome: string; produtoId: string; fatorConv?: number }>({
      query: (data) => ({ url: '/colibri/mapeamentos', method: 'POST', data }),
      invalidatesTags: ['ColibriMapeamentos'],
    }),
    atualizarMapeamento: build.mutation<ColibriMapeamento, { id: string; colibriNome?: string; produtoId?: string; fatorConv?: number; ativo?: boolean }>({
      query: ({ id, ...data }) => ({ url: `/colibri/mapeamentos/${id}`, method: 'PATCH', data }),
      invalidatesTags: ['ColibriMapeamentos'],
    }),
    removerMapeamento: build.mutation<void, string>({
      query: (id) => ({ url: `/colibri/mapeamentos/${id}`, method: 'DELETE' }),
      invalidatesTags: ['ColibriMapeamentos'],
    }),
    importarVendas: build.mutation<ImportarVendasResult, ImportarVendasInput>({
      query: (data) => ({ url: '/colibri/importar', method: 'POST', data }),
      invalidatesTags: ['Estoque', 'Movimentacoes'],
    }),
    listarImportacoes: build.query<ColibriImportacao[], void>({
      query: () => ({ url: '/colibri/importacoes' }),
    }),
    listarCatalogo: build.query<ColibriCatalogoItem[], void>({
      query: () => ({ url: '/colibri/catalogo' }),
      providesTags: ['ColibriCatalogo'],
    }),
    sincronizarCatalogo: build.mutation<SincronizarResult, void>({
      query: () => ({ url: '/colibri/catalogo/sincronizar', method: 'POST' }),
      invalidatesTags: ['ColibriCatalogo'],
    }),
    removerCatalogoItem: build.mutation<void, string>({
      query: (id) => ({ url: `/colibri/catalogo/${id}`, method: 'DELETE' }),
      invalidatesTags: ['ColibriCatalogo'],
    }),
    importarProdutosColibri: build.mutation<ImportarProdutosResult, void>({
      query: () => ({ url: '/colibri/produtos', method: 'POST' }),
      invalidatesTags: ['Produtos', 'ColibriMapeamentos'],
    }),
  }),
  overrideExisting: false,
})

export const {
  useColibriStatusQuery,
  useListarMapeamentosQuery,
  useCriarMapeamentoMutation,
  useAtualizarMapeamentoMutation,
  useRemoverMapeamentoMutation,
  useImportarVendasMutation,
  useListarImportacoesQuery,
  useListarCatalogoQuery,
  useSincronizarCatalogoMutation,
  useRemoverCatalogoItemMutation,
  useImportarProdutosColibriMutation,
} = colibriApi
