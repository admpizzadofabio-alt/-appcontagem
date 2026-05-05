import { Router } from 'express'
import { requireAuth, requireNivel } from '../../middlewares/auth.js'
import { listarHandler, criarHandler, atualizarStatusHandler, editarHandler, excluirHandler } from './pedidos.controller.js'

const router = Router()
router.use(requireAuth)

router.get('/', listarHandler)
router.post('/', criarHandler)
router.patch('/:id/status', requireNivel(['Supervisor', 'Admin']), atualizarStatusHandler)
router.put('/:id', requireNivel(['Admin']), editarHandler)
router.delete('/:id', requireNivel(['Admin']), excluirHandler)

export { router as pedidosRouter }
