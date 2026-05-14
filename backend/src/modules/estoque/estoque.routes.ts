import { Router } from 'express'
import { requireAuth, requireNivel } from '../../middlewares/auth.js'
import { listarHandler, summaryHandler, ajustarHandler, historicoHandler } from './estoque.controller.js'

const router = Router()
router.use(requireAuth)

router.get('/', listarHandler)
router.get('/summary', summaryHandler)
router.get('/historico', requireNivel(['Admin', 'Supervisor']), historicoHandler)
router.patch('/:id/ajustar', requireNivel(['Admin', 'Supervisor']), ajustarHandler)

export { router as estoqueRouter }
