import { z } from 'zod'

export const loginSchema = z.object({
  pin: z.string().min(4, 'PIN deve ter no mínimo 4 dígitos').max(8),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token obrigatório'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RefreshInput = z.infer<typeof refreshSchema>
