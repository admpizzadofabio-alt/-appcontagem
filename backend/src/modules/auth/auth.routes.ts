import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../../middlewares/auth.js'
import { loginHandler, refreshHandler, logoutHandler, meHandler } from './auth.controller.js'

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { code: 'TOO_MANY_REQUESTS', message: 'Muitas tentativas. Tente em 15 minutos.' } })

const router = Router()

router.post('/login', limiter, loginHandler)
router.post('/refresh', refreshHandler)
router.post('/logout', requireAuth, logoutHandler)
router.get('/me', requireAuth, meHandler)

export { router as authRouter }
