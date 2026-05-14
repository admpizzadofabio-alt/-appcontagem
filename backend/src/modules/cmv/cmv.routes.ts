import { Router } from 'express'
import { requireAuth, requireNivel } from '../../middlewares/auth.js'
import { getCmv } from './cmv.controller.js'

export const cmvRouter = Router()
cmvRouter.use(requireAuth)
cmvRouter.get('/', requireNivel(['Admin', 'Supervisor']), getCmv)
