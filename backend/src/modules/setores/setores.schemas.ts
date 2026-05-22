import { z } from 'zod'

const nome = z.string()
  .trim()
  .min(2, 'Nome deve ter ao menos 2 caracteres')
  .max(50, 'Nome deve ter no máximo 50 caracteres')
  .regex(/^[a-zA-ZÀ-ÿ0-9 _-]+$/, 'Nome contém caracteres inválidos')

export const criarSetorSchema = z.object({
  nome,
  temEstoque: z.boolean().default(false),
})

export const editarSetorSchema = z.object({
  nome: nome.optional(),
  temEstoque: z.boolean().optional(),
  ativo: z.boolean().optional(),
})
