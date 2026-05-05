import { z } from 'zod'

export const divergenciasQuerySchema = z.object({
  limite: z.coerce.number().int().min(1).max(100).default(10),
})

export const auditoriaQuerySchema = z.object({
  de: z.string().datetime({ offset: true }).optional(),
  ate: z.string().datetime({ offset: true }).optional(),
  usuarioId: z.string().uuid().optional(),
  tipo: z.enum(['Entrada', 'Saida', 'Transferencia', 'AjustePerda', 'AjusteContagem', 'CargaInicial']).optional(),
  local: z.enum(['Bar', 'Delivery']).optional(),
})

export type DivergenciasQuery = z.infer<typeof divergenciasQuerySchema>
export type AuditoriaQuery = z.infer<typeof auditoriaQuerySchema>
