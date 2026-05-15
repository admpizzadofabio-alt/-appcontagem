import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3333),
  API_PREFIX: z.string().default('/api/v1'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter no mínimo 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET deve ter no mínimo 32 caracteres'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  CORS_ORIGIN: z.string().default('http://localhost:8081'),
  PERDA_THRESHOLD: z.coerce.number().default(5),
  CONTAGEM_THRESHOLD: z.coerce.number().default(2),
  COLIBRI_BASE_URL: z.string().default('https://cloud.colibricloud.com'),
  COLIBRI_CLIENT_ID: z.string().default(''),
  COLIBRI_STORE_ID: z.string().default(''),
  HORARIO_INICIO_TURNO: z.coerce.number().min(0).max(23).default(17),
  HORARIO_FECHAMENTO_AUTO: z.coerce.number().min(0).max(23).default(4),
  DIVERGENCIA_LEVE_UNIDADES: z.coerce.number().default(2),
  DIVERGENCIA_LEVE_PERCENT: z.coerce.number().default(5),
  // Sentry: deixe vazio em dev pra desativar. DSN começa com https://xxx@oXXX.ingest.sentry.io/XXX
  SENTRY_DSN: z.string().default(''),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  // Alerta Colibri: webhook (Discord/Slack/Telegram) acionado quando Colibri offline >2h
  ALERTA_WEBHOOK_URL: z.string().default(''),
})

export const env = envSchema.parse(process.env)

// Hardening em produção: falha fast se config inseguro
if (env.NODE_ENV === 'production') {
  if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error('SEGURANÇA: JWT_SECRET e JWT_REFRESH_SECRET devem ser diferentes em produção')
  }
  if (env.CORS_ORIGIN === '*' || env.CORS_ORIGIN.includes('*')) {
    throw new Error('SEGURANÇA: CORS_ORIGIN não pode ser "*" em produção. Configure o domínio real.')
  }
  if (env.JWT_SECRET.length < 64 || env.JWT_REFRESH_SECRET.length < 64) {
    throw new Error('SEGURANÇA: em produção, JWT_SECRET e JWT_REFRESH_SECRET devem ter pelo menos 64 caracteres')
  }
}
