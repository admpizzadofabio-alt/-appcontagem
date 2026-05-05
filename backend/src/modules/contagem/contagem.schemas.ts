import { z } from 'zod'

export const iniciarContagemSchema = z.object({
  local: z.enum(['Bar', 'Delivery']),
  modoCego: z.boolean().default(true),
  threshold: z.coerce.number().int().min(0).default(2),
})

export const salvarItemSchema = z.object({
  produtoId: z.string().uuid(),
  quantidadeContada: z.coerce.number().min(0),
  causaDivergencia: z.string().optional(),
})

export const processarSchema = z.object({
  itens: z.array(z.object({
    produtoId: z.string().uuid(),
    causaDivergencia: z.string().optional(),
  })).optional(),
})

export type IniciarContagemInput = z.infer<typeof iniciarContagemSchema>
export type SalvarItemInput = z.infer<typeof salvarItemSchema>
