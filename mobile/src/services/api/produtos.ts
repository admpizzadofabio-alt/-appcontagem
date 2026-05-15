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
  marcoInicialEm?: string | null
  imagem?: string | null // base64 ou URL — exibir thumbnail em contagem/cadastro
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
    cargaInicial: build.mutation<{ ok: boolean; mensagem: string }, { id: string; quantidade: number; local: 'Bar' | 'Delivery'; observacao?: string }>({
      query: ({ id, ...data }) => ({ url: `/produtos/${id}/carga-inicial`, method: 'POST', data }),
      invalidatesTags: ['Produtos', 'Estoque', 'Movimentacoes'],
    }),
    resetarCargaInicial: build.mutation<{ ok: boolean; mensagem: string }, { id: string; local: 'Bar' | 'Delivery' }>({
      query: ({ id, local }) => ({ url: `/produtos/${id}/carga-inicial`, method: 'DELETE', data: { local } }),
      invalidatesTags: ['Produtos', 'Estoque', 'Movimentacoes'],
    }),
  }),
  overrideExisting: false,
})

export const { useListarProdutosQuery, useCriarProdutoMutation, useAtualizarProdutoMutation, useDeletarProdutoMutation, useExcluirProdutoMutation, useCargaInicialMutation, useResetarCargaInicialMutation } = produtosApi
