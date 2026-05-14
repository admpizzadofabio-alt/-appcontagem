import 'dotenv/config'
import { app } from './app.js'
import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { prisma } from './config/prisma.js'
import { iniciarJobs } from './shared/jobs.js'
import { initSentry } from './config/sentry.js'

async function main() {
  initSentry()
  await prisma.$connect()
  logger.info('Banco de dados conectado')

  iniciarJobs()

  const server = app.listen(env.PORT, () => {
    logger.info(`Servidor rodando em http://localhost:${env.PORT}${env.API_PREFIX}`)
    logger.info(`Docs disponíveis em http://localhost:${env.PORT}/api/docs`)
  })

  const shutdown = async (signal: string) => {
    logger.info(`Recebido ${signal}. Encerrando...`)
    server.close(async () => {
      await prisma.$disconnect()
      logger.info('Servidor encerrado')
      process.exit(0)
    })
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((err) => {
  logger.error(err, 'Erro ao iniciar servidor')
  process.exit(1)
})
