import { baseApi } from '../../store/api/baseApi'

export type Turno = {
  id: string
  diaOperacional: string
  local: 'Bar' | 'Delivery'
  abertoEm: string
  fechadoEm?: string | null
  status: 'Aberto' | 'Fechado'
  abertoPor: string
  contagemId?: string | null
  totalDivergencias: number
  divergenciasGrandes: number
  valorDivergencias: number
  fechadoSemContagem: boolean
  abertoPorNome?: string | null
  contagem?: ContagemDetalhe | null
  // Indica se Colibri está com importação atrasada para o diaOperacional desse turno
  colibriPendente?: boolean
}

export type ItemContagem = {
  id: string
  produtoId: string
  quantidadeSistema: number
  quantidadeContada: number
  diferenca: number
  divergenciaCategoria?: 'ok' | 'leve' | 'grande' | 'venda_sem_estoque' | null
  fotoEvidencia?: string | null
  justificativa?: string | null
  justificativaCategoria?: 'erro_contagem' | 'venda_sem_estoque' | 'possivel_desvio' | 'quebra_perda' | 'outro' | null
  vendidoColibri?: number
  precisaRevisaoAdmin?: boolean
  revisaoStatus?: 'Pendente' | 'Aceita' | 'Ajustada' | 'Perda' | 'Recontagem' | null
  ajusteAprovado: boolean
  contadoPor?: string | null
  produto: { id: string; nomeBebida: string; categoria: string; unidadeMedida: string; custoUnitario: number }
}

export type RevisaoPendente = ItemContagem & {
  contagem: { local: string; dataContagem: string; operadorId: string; diaOperacional: string }
  produto: { nomeBebida: string; unidadeMedida: string; custoUnitario: number }
}

// Versão sem quantidadeSistema — usada durante a contagem para garantir modo cego
export type ItemContagemCego = {
  id: string
  produtoId: string
  quantidadeContada: number
  contadoPor?: string | null
  produto: { id: string; nomeBebida: string; categoria: string; unidadeMedida: string; custoUnitario: number; imagem?: string | null }
}

export type ContagemDetalheCega = Omit<ContagemDetalhe, 'itens'> & { itens: ItemContagemCego[] }

export type ContagemDetalhe = {
  id: string
  local: string
  status: string
  modoCego: boolean
  totalItens: number
  itens: ItemContagem[]
}

export type EntradaRecente = {
  id: string
  quantidade: number
  dataMov: string
  produto: { nomeBebida: string; unidadeMedida: string }
  usuario: { nome: string; nivelAcesso: string }
}

export type VerificarEntradaResult = {
  tipo: 'ok' | 'aviso' | 'bloqueado'
  duplicata?: EntradaRecente
  recentes?: EntradaRecente[]
}

export type DashboardAdmin = {
  rascunhosPendentes: number
  correcoesRecentes: number
  turnos: {
    id: string
    diaOperacional: string
    local: string
    abertoEm: string
    fechadoEm?: string | null
    status: string
    abertoPor: string
    divergenciasGrandes: number
    totalDivergencias: number
    valorDivergencias: number
    gapNaoExplicado: number
    fechadoSemContagem: boolean
  }[]
  operadores: {
    id: string
    nome: string
    turnos: number
    divergenciasGrandes: number
    valorGap: number
  }[]
}

export type RascunhoEntrada = {
  id: string
  quantidade: number
  origemTexto: string
  observacao?: string | null
  fotoEvidencia: string
  status: string
  criadoEm: string
  local: string
  produto: { nomeBebida: string; unidadeMedida: string; custoUnitario: number }
  operador: { nome: string }
}

export const turnosApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    turnoAtual: build.query<Turno | null, { local: 'Bar' | 'Delivery' }>({
      query: (params) => ({ url: '/turnos/atual', params }),
      providesTags: ['Turno'],
    }),
    abrirTurno: build.mutation<Turno, { local: 'Bar' | 'Delivery' }>({
      query: (data) => ({ url: '/turnos/abrir', method: 'POST', data }),
      invalidatesTags: ['Turno'],
    }),
    historicoTurnos: build.query<Turno[], { local?: string } | void>({
      query: (params) => ({ url: '/turnos/historico', params: params ?? {} }),
      providesTags: ['Turno'],
    }),

    contagemCega: build.query<ContagemDetalheCega, string>({
      query: (id) => ({ url: `/turnos/contagem/${id}/cega` }),
      providesTags: ['Contagem'],
    }),
    contagem: build.query<ContagemDetalhe, string>({
      query: (id) => ({ url: `/turnos/contagem/${id}` }),
      providesTags: ['Contagem'],
    }),
    registrarItemContagem: build.mutation<ItemContagem, { contagemId: string; produtoId: string; quantidadeContada: number }>({
      query: ({ contagemId, ...data }) => ({ url: `/turnos/contagem/${contagemId}/item`, method: 'POST', data }),
      invalidatesTags: ['Contagem'],
    }),
    registrarFotoContagem: build.mutation<ItemContagem, { contagemId: string; produtoId: string; fotoEvidencia: string; justificativa: string }>({
      query: ({ contagemId, ...data }) => ({ url: `/turnos/contagem/${contagemId}/foto`, method: 'POST', data }),
      invalidatesTags: ['Contagem'],
    }),
    finalizarContagem: build.mutation<{ ajustadosLeve: number; pendentesGrande: number; valorDivergencias: number }, string>({
      query: (contagemId) => ({ url: `/turnos/contagem/${contagemId}/finalizar`, method: 'POST' }),
      invalidatesTags: ['Contagem', 'Turno', 'Estoque'],
    }),

    verificarEntrada: build.mutation<VerificarEntradaResult, { produtoId: string; quantidade: number }>({
      query: (data) => ({ url: '/turnos/verificar-entrada', method: 'POST', data }),
    }),

    criarRascunhoEntrada: build.mutation<RascunhoEntrada, { contagemId: string; produtoId: string; quantidade: number; origemTexto: string; observacao?: string; fotoEvidencia: string }>({
      query: ({ contagemId, ...data }) => ({ url: `/turnos/contagem/${contagemId}/rascunho`, method: 'POST', data }),
      invalidatesTags: ['Contagem', 'Rascunhos'],
    }),

    rascunhosPendentes: build.query<RascunhoEntrada[], void>({
      query: () => ({ url: '/turnos/rascunhos/pendentes' }),
      providesTags: ['Rascunhos'],
    }),
    decidirRascunho: build.mutation<void, { id: string; acao: 'aprovar' | 'vincular' | 'rejeitar'; vinculadoA?: string; motivoDecisao?: string }>({
      query: ({ id, ...data }) => ({ url: `/turnos/rascunhos/${id}/decidir`, method: 'POST', data }),
      invalidatesTags: ['Rascunhos', 'Estoque'],
    }),
    dashboardAdmin: build.query<DashboardAdmin, void>({
      query: () => ({ url: '/turnos/dashboard' }),
      providesTags: ['Turno', 'Rascunhos'],
    }),
    fecharTurno: build.mutation<void, string>({
      query: (id) => ({ url: `/turnos/${id}/fechar`, method: 'POST' }),
      invalidatesTags: ['Turno'],
    }),
    deletarTurno: build.mutation<void, string>({
      query: (id) => ({ url: `/turnos/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Turno', 'Contagem', 'Estoque', 'Movimentacoes'],
    }),

    revisoesPendentes: build.query<RevisaoPendente[], void>({
      query: () => ({ url: '/turnos/revisoes/pendentes' }),
      providesTags: ['Revisoes'],
    }),
    decidirRevisao: build.mutation<void, { id: string; acao: 'aceitar' | 'ajustar' | 'perda' | 'recontagem'; decisao?: string; novaQuantidade?: number }>({
      query: ({ id, ...data }) => ({ url: `/turnos/revisoes/${id}/decidir`, method: 'POST', data }),
      invalidatesTags: ['Revisoes', 'Estoque', 'Movimentacoes'],
    }),
  }),
  overrideExisting: false,
})

export const {
  useTurnoAtualQuery,
  useAbrirTurnoMutation,
  useHistoricoTurnosQuery,
  useContagemCegaQuery,
  useContagemQuery,
  useRegistrarItemContagemMutation,
  useRegistrarFotoContagemMutation,
  useFinalizarContagemMutation,
  useVerificarEntradaMutation,
  useCriarRascunhoEntradaMutation,
  useRascunhosPendentesQuery,
  useDecidirRascunhoMutation,
  useDashboardAdminQuery,
  useFecharTurnoMutation,
  useDeletarTurnoMutation,
  useRevisoesPendentesQuery,
  useDecidirRevisaoMutation,
} = turnosApi
