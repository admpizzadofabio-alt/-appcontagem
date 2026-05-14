import { z } from 'zod'

// Mesmo regex usado em auth.schemas.ts — garante que admin não consegue criar
// usuário com PIN em formato diferente do que o login aceita.
export const criarUsuarioSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100),
  pin: z.string().regex(/^\d{6}$/, 'PIN deve ter exatamente 6 dígitos'),
  setor: z.enum(['Bar', 'Delivery', 'Admin', 'Todos']),
  nivelAcesso: z.enum(['Operador', 'Supervisor', 'Admin']),
})

export const atualizarUsuarioSchema = criarUsuarioSchema.partial()

export type CriarUsuarioInput = z.infer<typeof criarUsuarioSchema>
export type AtualizarUsuarioInput = z.infer<typeof atualizarUsuarioSchema>
