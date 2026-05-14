import { baseApi } from '../../store/api/baseApi'

export type Movimentacao = {
  id: string
  produtoId: string
  dataMov: string
  tipoMov: string
  quantidade: number
  localOrigem?: string
  localDestino?: string
  observacao?: string
  motivoAjuste?: string
  aprovacaoStatus: string
  produto: { nomeBebida: string; unidadeMedida: string; perdaThreshold: number }
  usuario: { nome: string }
  aprovacao?: { status: string; motivo?: string }
}

export type CriarMovimentacaoInput = {
  produtoId: string
  tipoMov: 'Entrada' | 'Saida' | 'Transferencia' | 'AjustePerda' | 'AjusteContagem' | 'CargaInicial'
  quantidade: number
  localOrigem?: string
  localDestino?: string
  observacao?: string
  motivoAjuste?: string
  imagemComprovante?: string
  pendente?: boolean
  justificativaEntrada?: string
}

export type TransferenciaPendente = {
  id: string
  dataMov: string
  quantidade: number
  localOrigem: string
  localDestino: string
  produto: { nomeBebida: string; unidadeMedida: string; setorPadrao: string }
  usuario: { nome: string }
}

export type AprovacaoPendente = {
  id: string
  status: string
  criadoEm: string
  movimentacao: {
    id: string
    tipoMov: string
    quantidade: number
    motivoAjuste?: string
    observacao?: string
    produto: { nomeBebida: string; unidadeMedida: string }
    usuario: { nome: string }
  }
  solicitante: { nome: string; setor: string }
}

export const movimentacoesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listarMovimentacoes: build.query<Movimentacao[], { produtoId?: string; tipoMov?: string; local?: string; dataInicio?: string; dataFim?: string } | void>({
      query: (params) => ({ url: '/movimentacoes', params: params ?? {} }),
      providesTags: ['Movimentacoes'],
    }),
    criarMovimentacao: build.mutation<Movimentacao & { precisaAprovacao: boolean }, CriarMovimentacaoInput>({
      query: (data) => ({ url: '/movimentacoes', method: 'POST', data }),
      invalidatesTags: ['Movimentacoes', 'Estoque'],
    }),
    listarPendentes: build.query<AprovacaoPendente[], void>({
      query: () => ({ url: '/movimentacoes/pendentes' }),
      providesTags: ['Movimentacoes'],
    }),
    aprovarMovimentacao: build.mutation<void, { id: string; motivo?: string }>({
      query: ({ id, motivo }) => ({ url: `/movimentacoes/aprovacoes/${id}/aprovar`, method: 'PATCH', data: { motivo } }),
      invalidatesTags: ['Movimentacoes', 'Estoque'],
    }),
    rejeitarMovimentacao: build.mutation<void, { id: string; motivo: string }>({
      query: ({ id, motivo }) => ({ url: `/movimentacoes/aprovacoes/${id}/rejeitar`, method: 'PATCH', data: { motivo } }),
      invalidatesTags: ['Movimentacoes'],
    }),
    listarTransferenciasPendentes: build.query<TransferenciaPendente[], { local: string }>({
      query: (params) => ({ url: '/movimentacoes/transferencias/pendentes', params }),
      providesTags: ['Movimentacoes'],
    }),
    confirmarTransferencia: build.mutation<void, string>({
      query: (id) => ({ url: `/movimentacoes/transferencias/${id}/confirmar`, method: 'PATCH' }),
      invalidatesTags: ['Movimentacoes', 'Estoque'],
    }),
  }),
  overrideExisting: false,
})

export const {
  useListarMovimentacoesQuery,
  useCriarMovimentacaoMutation,
  useListarPendentesQuery,
  useAprovarMovimentacaoMutation,
  useRejeitarMovimentacaoMutation,
  useListarTransferenciasPendentesQuery,
  useConfirmarTransferenciaMutation,
} = movimentacoesApi
