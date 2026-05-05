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
  }),
  overrideExisting: false,
})

export const { useMacroRelatorioQuery, useDivergenciasRelatorioQuery, usePerdasRelatorioQuery } = relatoriosApi
