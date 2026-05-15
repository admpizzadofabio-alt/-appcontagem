import { z } from 'zod'

export const loginSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, 'PIN deve ter exatamente 6 dígitos'),
  totpCode: z.string().regex(/^\d{6}$/).optional(),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token obrigatório'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RefreshInput = z.infer<typeof refreshSchema>
