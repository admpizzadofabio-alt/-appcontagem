import { baseApi } from '../../store/api/baseApi'

export type ItemContagemResumo = {
  produtoId: string
  nomeBebida: string
  unidadeMedida: string
  quantidadeSistema: number
  quantidadeContada: number
  diferenca: number
  divergenciaCategoria: string | null
  causaDivergencia: string | null
}

export type MovResumo = {
  id: string
  nomeBebida: string
  unidade: string
  quantidade: number
  local: string | null
  motivo: string | null
  observacao: string | null
  dataMov: string
  aprovacaoStatus: string
  operador: string | null
}

export type ErroComandaResumo = {
  id: string
  produtoComandado: string
  produtoServido: string
  quantidade: number
  criadoEm: string
  operador: string
}

export type MeuTurnoData = {
  diaOperacional: string
  setor: string
  turno: { id: string; status: string; abertoEm: string; fechadoEm: string | null }
  contagem: {
    id: string
    status: string
    local: string
    dataAbertura: string
    dataFechamento: string | null
    totalItens: number
    totalDesvios: number
    itens: ItemContagemResumo[]
  } | null
  movimentacoes: {
    entradas: MovResumo[]
    perdas: MovResumo[]
    transferencias: MovResumo[]
  }
  errosComanda: ErroComandaResumo[]
  totais: {
    entradas: number
    perdas: number
    transferencias: number
    errosComanda: number
  }
}

export const meuTurnoApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMeuTurno: build.query<MeuTurnoData, void>({
      query: () => ({ url: '/meu-turno' }),
      providesTags: ['Movimentacoes', 'Contagem'],
    }),
  }),
  overrideExisting: false,
})

export const { useGetMeuTurnoQuery } = meuTurnoApi
