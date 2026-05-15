import { Router } from 'express'
import { requireAuth, requireNivel } from '../../middlewares/auth.js'
import { listarHandler, criarHandler, atualizarHandler, deletarHandler, excluirFisicoHandler, cargaInicialHandler, resetarCargaInicialHandler } from './produtos.controller.js'

const router = Router()
router.use(requireAuth)

router.get('/', listarHandler)
router.post('/', requireNivel(['Admin']), criarHandler)
router.put('/:id', requireNivel(['Admin']), atualizarHandler)
router.delete('/:id', requireNivel(['Admin']), deletarHandler)
router.delete('/:id/excluir', requireNivel(['Admin']), excluirFisicoHandler)
router.post('/:id/carga-inicial', requireNivel(['Admin']), cargaInicialHandler)
router.delete('/:id/carga-inicial', requireNivel(['Admin']), resetarCargaInicialHandler)

export { router as produtosRouter }
