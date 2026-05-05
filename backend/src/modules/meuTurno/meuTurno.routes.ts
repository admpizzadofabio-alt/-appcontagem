import { Router } from 'express'
import { requireAuth } from '../../middlewares/auth.js'
import { getMeuTurnoHandler } from './meuTurno.controller.js'

export const meuTurnoRouter = Router()

meuTurnoRouter.use(requireAuth)
meuTurnoRouter.get('/', getMeuTurnoHandler)
