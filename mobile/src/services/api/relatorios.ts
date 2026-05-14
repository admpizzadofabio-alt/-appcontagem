import { baseApi } from '../../store/api/baseApi'

export type MacroRelatorio = {
  valorAtivo: number
  totalEntradas: number
  totalSaidas: number
  totalPerdas: number
  contagens: number
  aprovacoesPendentes: number
}

export type DivergenciaRelatorio = {
  id: string
  local: string
  dataFechamento: string
  totalDesvios: number
  operador: { nome: string }
  itens: Array<{
    diferenca: number
    causaDivergencia?: string
    produto: { nomeBebida: string; unidadeMedida: string }
  }>
}

export type CmvResult = {
  periodo: { dataInicio: string; dataFim: string }
  total_cmv: number
  produtos: Array<{ produtoId: string; nome: string; quantidade_vendida: number; cmv: number; pct_total: number }>
}

export type LossRateResult = {
  periodo: { dataInicio: string; dataFim: string }
  turnos: Array<{
    turnoId: string; diaOperacional: string; local: string
    vendas: number; perdas: number
    valor_vendas: number; valor_perdas: number
    loss_rate_pct: number
  }>
}

export type VendasPorHoraResult = {
  periodo: { dataInicio: string; dataFim: string }
  horas: Array<{ hora: number; label: string; vendas: number; valor: number }>
}

export type TransferBalanceResult = {
  periodo: { dataInicio: string; dataFim: string }
  total: number
  fluxos: Record<string, { saiu: number; entrou: number; saldo: number }>
  detalhes: Array<{ produto: string; origem: string; destino: string; quantidade: number }>
}

export type AuditoriaItem = {
  id: string; dataEvento: string; usuarioId: string | null
  usuarioNome: string; setor: string; acao: string
  entidade: string; idReferencia: string | null; detalhes: string | null
}
export type AuditoriaResult = { total: number; items: AuditoriaItem[]; take: number; skip: number }

export const relatoriosApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    macroRelatorio: build.query<MacroRelatorio, { dataInicio?: string; dataFim?: string } | void>({
      query: (params) => ({ url: '/relatorios/macro', params: params ?? {} }),
      providesTags: ['Relatorios'],
    }),
    divergenciasRelatorio: build.query<DivergenciaRelatorio[], { dataInicio?: string; dataFim?: string } | void>({
      query: (params) => ({ url: '/relatorios/divergencias', params: params ?? {} }),
      providesTags: ['Relatorios'],
    }),
    perdasRelatorio: build.query<any[], { dataInicio?: string; dataFim?: string } | void>({
      query: (params) => ({ url: '/relatorios/perdas', params: params ?? {} }),
      providesTags: ['Relatorios'],
    }),
    cmvRelatorio: build.query<CmvResult, { dataInicio: string; dataFim: string }>({
      query: (params) => ({ url: '/relatorios/cmv', params }),
      providesTags: ['Relatorios'],
    }),
    lossRate: build.query<LossRateResult, { dataInicio: string; dataFim: string }>({
      query: (params) => ({ url: '/relatorios/loss-rate', params }),
      providesTags: ['Relatorios'],
    }),
    vendasPorHora: build.query<VendasPorHoraResult, { dataInicio: string; dataFim: string }>({
      query: (params) => ({ url: '/relatorios/vendas-por-hora', params }),
      providesTags: ['Relatorios'],
    }),
    transferBalance: build.query<TransferBalanceResult, { dataInicio: string; dataFim: string }>({
      query: (params) => ({ url: '/relatorios/transferencias', params }),
      providesTags: ['Relatorios'],
    }),
    auditoria: build.query<AuditoriaResult, {
      take?: number; skip?: number
      usuarioId?: string; acao?: string; entidade?: string
      dataInicio?: string; dataFim?: string; busca?: string
    } | void>({
      query: (params) => ({ url: '/relatorios/auditoria', params: params ?? {} }),
      providesTags: ['Relatorios'],
    }),
  }),
  overrideExisting: false,
})

export const {
  useMacroRelatorioQuery, useDivergenciasRelatorioQuery, usePerdasRelatorioQuery,
  useCmvRelatorioQuery, useLossRateQuery, useVendasPorHoraQuery, useTransferBalanceQuery,
  useAuditoriaQuery,
} = relatoriosApi
