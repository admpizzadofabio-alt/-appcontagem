import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuth, requireNivel } from '../../middlewares/auth.js'
import { loginHandler, refreshHandler, logoutHandler, meHandler } from './auth.controller.js'
import { setupTotp, enableTotp, disableTotp } from './totp.service.js'

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: () => process.env.NODE_ENV === 'test',
  message: { code: 'TOO_MANY_REQUESTS', message: 'Muitas tentativas. Tente em 15 minutos.' },
})

// Refresh tem janela mais ampla (uso legítimo: 1 refresh/hora por sessão).
// 30/15min cobre múltiplos dispositivos do mesmo usuário sem afetar UX,
// mas bloqueia atacante tentando refresh tokens vazados em loop.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skip: () => process.env.NODE_ENV === 'test',
  message: { code: 'TOO_MANY_REQUESTS', message: 'Muitas tentativas de refresh. Tente em 15 minutos.' },
})

const router = Router()

router.post('/login', loginLimiter, loginHandler)
router.post('/refresh', refreshLimiter, refreshHandler)
router.post('/logout', requireAuth, logoutHandler)
router.get('/me', requireAuth, meHandler)

// 2FA TOTP — apenas Admin pode ativar (segurança crítica de operações sensíveis)
router.post('/totp/setup', requireAuth, requireNivel(['Admin']), async (req, res, next) => {
  try { res.json(await setupTotp(req.user!.sub)) } catch (e) { next(e) }
})
router.post('/totp/enable', requireAuth, requireNivel(['Admin']), async (req, res, next) => {
  try { res.json(await enableTotp(req.user!.sub, String(req.body?.code ?? ''))) } catch (e) { next(e) }
})
router.post('/totp/disable', requireAuth, requireNivel(['Admin']), async (req, res, next) => {
  try { res.json(await disableTotp(req.user!.sub)) } catch (e) { next(e) }
})

export { router as authRouter }
