import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3333),
  API_PREFIX: z.string().default('/api/v1'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter no mínimo 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('1h'),
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
})

export const env = envSchema.parse(process.env)
