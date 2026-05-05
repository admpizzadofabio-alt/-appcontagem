import { Router } from 'express'
import { requireAuth, requireNivel } from '../../middlewares/auth.js'
import { postRegistrar, getListar } from './correcoes.controller.js'

export const correcoesRouter = Router()

correcoesRouter.use(requireAuth)

correcoesRouter.post('/', postRegistrar)
correcoesRouter.get('/', requireNivel(['Admin', 'Supervisor']), getListar)
