import { baseApi } from '../../store/api/baseApi'

export type Produto = {
  id: string
  nomeBebida: string
  categoria: string
  unidadeMedida: string
  volumePadrao?: string
  custoUnitario: number
  estoqueMinimo: number
  perdaThreshold: number
  setorPadrao: string
  revisadoAdmin: boolean
  ativo: boolean
}

export const produtosApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listarProdutos: build.query<Produto[], { ativo?: boolean } | void>({
      query: (params) => ({ url: '/produtos', params: params ?? {} }),
      providesTags: ['Produtos'],
    }),
    criarProduto: build.mutation<Produto, Partial<Produto>>({
      query: (data) => ({ url: '/produtos', method: 'POST', data }),
      invalidatesTags: ['Produtos'],
    }),
    atualizarProduto: build.mutation<Produto, { id: string } & Partial<Produto>>({
      query: ({ id, ...data }) => ({ url: `/produtos/${id}`, method: 'PUT', data }),
      invalidatesTags: ['Produtos'],
    }),
    deletarProduto: build.mutation<void, string>({
      query: (id) => ({ url: `/produtos/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Produtos'],
    }),
    excluirProduto: build.mutation<void, string>({
      query: (id) => ({ url: `/produtos/${id}/excluir`, method: 'DELETE' }),
      invalidatesTags: ['Produtos'],
    }),
  }),
  overrideExisting: false,
})

export const { useListarProdutosQuery, useCriarProdutoMutation, useAtualizarProdutoMutation, useDeletarProdutoMutation, useExcluirProdutoMutation } = produtosApi
