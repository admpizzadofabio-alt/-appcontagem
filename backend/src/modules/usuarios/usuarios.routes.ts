import { Router } from 'express'
import { requireAuth, requireNivel } from '../../middlewares/auth.js'
import { listarHandler, criarHandler, atualizarHandler, toggleAtivoHandler } from './usuarios.controller.js'

const router = Router()
router.use(requireAuth, requireNivel(['Admin']))

router.get('/', listarHandler)
router.post('/', criarHandler)
router.put('/:id', atualizarHandler)
router.patch('/:id/toggle', toggleAtivoHandler)

export { router as usuariosRouter }
