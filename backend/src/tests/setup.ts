// Carrega .env antes de qualquer import que dependa de env vars (env.ts, prisma)
import 'dotenv/config'

// Garante que validações de produção do env.ts não disparem nos testes
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test'
}
