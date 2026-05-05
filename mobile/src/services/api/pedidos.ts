import { baseApi } from '../../store/api/baseApi'

export type Pedido = {
  id: string
  idGrupo: string
  dataPedido: string
  nomeProduto: string
  quantidade: number
  setorSolicitante: string
  urgente: boolean
  status: 'Pendente' | 'EmAnalise' | 'Atendido' | 'Cancelado'
  observacao?: string
  produto?: { nomeBebida: string }
  usuario: { nome: string }
}

export const pedidosApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listarPedidos: build.query<Pedido[], { status?: string; setor?: string } | void>({
      query: (params) => ({ url: '/pedidos', params: params ?? {} }),
      providesTags: ['Pedidos'],
    }),
    criarPedido: build.mutation<Pedido[], { itens: Array<{ produtoId?: string; nomeProduto: string; quantidade: number; observacao?: string; urgente?: boolean }> }>({
      query: (data) => ({ url: '/pedidos', method: 'POST', data }),
      invalidatesTags: ['Pedidos'],
    }),
    atualizarStatusPedido: build.mutation<Pedido, { id: string; status: string }>({
      query: ({ id, status }) => ({ url: `/pedidos/${id}/status`, method: 'PATCH', data: { status } }),
      invalidatesTags: ['Pedidos'],
    }),
    editarPedido: build.mutation<Pedido, { id: string; nomeProduto?: string; quantidade?: number; observacao?: string; urgente?: boolean }>({
      query: ({ id, ...data }) => ({ url: `/pedidos/${id}`, method: 'PUT', data }),
      invalidatesTags: ['Pedidos'],
    }),
    excluirPedido: build.mutation<void, string>({
      query: (id) => ({ url: `/pedidos/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Pedidos'],
    }),
  }),
  overrideExisting: false,
})

export const { useListarPedidosQuery, useCriarPedidoMutation, useAtualizarStatusPedidoMutation, useEditarPedidoMutation, useExcluirPedidoMutation } = pedidosApi
