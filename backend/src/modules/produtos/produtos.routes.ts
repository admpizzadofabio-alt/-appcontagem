import { Router } from 'express'
import { requireAuth, requireNivel } from '../../middlewares/auth.js'
import { listarHandler, criarHandler, atualizarHandler, deletarHandler, excluirFisicoHandler } from './produtos.controller.js'

const router = Router()
router.use(requireAuth)

router.get('/', listarHandler)
router.post('/', requireNivel(['Admin']), criarHandler)
router.put('/:id', requireNivel(['Admin']), atualizarHandler)
router.delete('/:id', requireNivel(['Admin']), deletarHandler)
router.delete('/:id/excluir', requireNivel(['Admin']), excluirFisicoHandler)

export { router as produtosRouter }
