import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import pinoHttp from 'pino-http'
import rateLimit from 'express-rate-limit'
import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { swaggerMiddleware, swaggerSetup } from './config/swagger.js'
import { requireAuth } from './middlewares/auth.js'
import { errorHandler } from './middlewares/error-handler.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { usuariosRouter } from './modules/usuarios/usuarios.routes.js'
import { produtosRouter } from './modules/produtos/produtos.routes.js'
import { estoqueRouter } from './modules/estoque/estoque.routes.js'
import { movimentacoesRouter } from './modules/movimentacoes/movimentacoes.routes.js'
import { contagemRouter } from './modules/contagem/contagem.routes.js'
import { pedidosRouter } from './modules/pedidos/pedidos.routes.js'
import { relatoriosRouter } from './modules/relatorios/relatorios.routes.js'
import { cmvRouter } from './modules/cmv/cmv.routes.js'
import { colibriRouter } from './modules/colibri/colibri.routes.js'
import { turnosRouter } from './modules/turnos/turnos.routes.js'
import { correcoesRouter } from './modules/correcoes/correcoes.routes.js'
import { meuTurnoRouter } from './modules/meuTurno/meuTurno.routes.js'
import { prisma } from './config/prisma.js'

const app = express()

// trust proxy = 1: necessário para rate limiter funcionar corretamente atrás do Nginx
app.set('trust proxy', 1)

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'TOO_MANY_REQUESTS', message: 'Muitas requisições. Tente em 15 minutos.' },
})

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
const corsOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim())
app.use(cors({ origin: corsOrigins, credentials: true }))
app.use(compression() as any)
app.use(express.json({ limit: '1mb' }))
const CAMPOS_FOTO = ['fotoEvidencia', 'fotoComanda', 'imagemComprovante', 'base64']
app.use((pinoHttp as any)({
  logger,
  serializers: {
    req(req: any) {
      const body = req.raw?.body ? { ...req.raw.body } : undefined
      if (body) {
        for (const campo of CAMPOS_FOTO) {
          if (body[campo]) body[campo] = '[IMAGEM_OMITIDA]'
        }
      }
      return { method: req.method, url: req.url, body }
    },
  },
}))
app.use(globalLimiter)

app.use('/uploads', requireAuth, express.static('uploads'))

const prefix = env.API_PREFIX

app.get(`${prefix}/health`, async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', timestamp: new Date(), db: 'connected' })
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' })
  }
})

app.use('/api/docs', requireAuth, swaggerMiddleware, swaggerSetup)

app.use(`${prefix}/auth`, authRouter)
app.use(`${prefix}/usuarios`, usuariosRouter)
app.use(`${prefix}/produtos`, produtosRouter)
app.use(`${prefix}/estoque`, estoqueRouter)
app.use(`${prefix}/movimentacoes`, movimentacoesRouter)
app.use(`${prefix}/contagem`, contagemRouter)
app.use(`${prefix}/pedidos`, pedidosRouter)
app.use(`${prefix}/relatorios`, relatoriosRouter)
app.use(`${prefix}/cmv`, cmvRouter)
app.use(`${prefix}/colibri`, colibriRouter)
app.use(`${prefix}/turnos`, turnosRouter)
app.use(`${prefix}/correcoes`, correcoesRouter)
app.use(`${prefix}/meu-turno`, meuTurnoRouter)

app.use(errorHandler)

export { app }
