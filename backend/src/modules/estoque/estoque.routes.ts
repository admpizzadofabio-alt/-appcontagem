import { Router } from 'express'
import { requireAuth, requireNivel } from '../../middlewares/auth.js'
import { ForbiddenError } from '../../shared/errors.js'
import { listarHandler, summaryHandler, ajustarHandler, historicoHandler } from './estoque.controller.js'

const router = Router()
router.use(requireAuth)

router.get('/', listarHandler)
router.get('/summary', summaryHandler)
router.get('/historico', (req, res, next) => {
  if (req.user?.nivelAcesso === 'Comprador') {
    return req.user.verHistoricoEstoque ? next() : next(new ForbiddenError())
  }
  return requireNivel(['Admin', 'Supervisor'])(req, res, next)
}, historicoHandler)
router.patch('/:id/ajustar', requireNivel(['Admin', 'Supervisor']), ajustarHandler)

export { router as estoqueRouter }
