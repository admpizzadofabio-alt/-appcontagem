import { createApi, BaseQueryFn } from '@reduxjs/toolkit/query/react'
import { AxiosRequestConfig, AxiosError } from 'axios'
import { api } from '../../config/api'

const axiosBaseQuery: BaseQueryFn<
  { url: string; method?: AxiosRequestConfig['method']; data?: unknown; params?: unknown },
  unknown,
  { status?: number; message: string }
> = async ({ url, method = 'GET', data, params }) => {
  try {
    const result = await api({ url, method, data, params })
    return { data: result.data }
  } catch (err) {
    const axiosErr = err as AxiosError<{ message?: string }>
    return {
      error: {
        status: axiosErr.response?.status,
        message: axiosErr.response?.data?.message ?? axiosErr.message,
      },
    }
  }
}

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: axiosBaseQuery,
  keepUnusedDataFor: 60,
  tagTypes: ['Estoque', 'Movimentacoes', 'Contagem', 'Pedidos', 'Produtos', 'Usuarios', 'Relatorios', 'ColibriMapeamentos', 'ColibriCatalogo', 'ColibriUltimaImportacao', 'Turno', 'Rascunhos', 'Correcoes'],
  endpoints: () => ({}),
})
