import { z } from 'zod'

export const ajustarEstoqueSchema = z.object({
  quantidade: z.coerce.number().min(0, 'Quantidade deve ser maior ou igual a zero').max(999999),
})

export type AjustarEstoqueInput = z.infer<typeof ajustarEstoqueSchema>
