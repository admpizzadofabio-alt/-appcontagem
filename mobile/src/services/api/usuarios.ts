import { baseApi } from '../../store/api/baseApi'

export type Usuario = {
  id: string
  nome: string
  setor: string
  nivelAcesso: string
  ativo: boolean
  criadoEm: string
}

export const usuariosApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listarUsuarios: build.query<Usuario[], void>({
      query: () => ({ url: '/usuarios' }),
      providesTags: ['Usuarios'],
    }),
    criarUsuario: build.mutation<Usuario, { nome: string; pin: string; setor: string; nivelAcesso: string }>({
      query: (data) => ({ url: '/usuarios', method: 'POST', data }),
      invalidatesTags: ['Usuarios'],
    }),
    atualizarUsuario: build.mutation<Usuario, { id: string; nome?: string; pin?: string; setor?: string; nivelAcesso?: string }>({
      query: ({ id, ...data }) => ({ url: `/usuarios/${id}`, method: 'PUT', data }),
      invalidatesTags: ['Usuarios'],
    }),
    toggleUsuario: build.mutation<{ id: string; nome: string; ativo: boolean }, string>({
      query: (id) => ({ url: `/usuarios/${id}/toggle`, method: 'PATCH' }),
      invalidatesTags: ['Usuarios'],
    }),
  }),
  overrideExisting: false,
})

export const { useListarUsuariosQuery, useCriarUsuarioMutation, useAtualizarUsuarioMutation, useToggleUsuarioMutation } = usuariosApi
