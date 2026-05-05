import { z } from 'zod'

export const ajustarEstoqueSchema = z.object({
  quantidade: z.coerce.number().min(0, 'Quantidade deve ser maior ou igual a zero'),
})

export type AjustarEstoqueInput = z.infer<typeof ajustarEstoqueSchema>
