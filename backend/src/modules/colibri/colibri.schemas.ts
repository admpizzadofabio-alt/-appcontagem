import { z } from 'zod'

export const criarMapeamentoSchema = z.object({
  colibriCode: z.string().min(1).max(100).trim(),
  colibriNome: z.string().min(1).max(200).trim(),
  produtoId: z.string().uuid(),
  fatorConv: z.number().positive().max(9999).default(1),
})

export const atualizarMapeamentoSchema = z.object({
  colibriNome: z.string().min(1).max(200).trim().optional(),
  produtoId: z.string().uuid().optional(),
  fatorConv: z.number().positive().max(9999).optional(),
  ativo: z.boolean().optional(),
})

export const importarVendasSchema = z.object({
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  local: z.enum(['Bar', 'Delivery']).default('Bar'),
})
