import { z } from 'zod'

export const criarUsuarioSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  pin: z.string().min(4).max(8),
  setor: z.enum(['Bar', 'Delivery', 'Admin', 'Todos']),
  nivelAcesso: z.enum(['Operador', 'Supervisor', 'Admin']),
})

export const atualizarUsuarioSchema = criarUsuarioSchema.partial()

export type CriarUsuarioInput = z.infer<typeof criarUsuarioSchema>
export type AtualizarUsuarioInput = z.infer<typeof atualizarUsuarioSchema>
