import { Router } from 'express'
import { requireAuth } from '../../middlewares/auth.js'
import { listarHandler, iniciarHandler, buscarHandler, salvarItemHandler, processarHandler, cancelarHandler } from './contagem.controller.js'

const router = Router()
router.use(requireAuth)

router.get('/', listarHandler)
router.post('/', iniciarHandler)
router.get('/:id', buscarHandler)
router.patch('/:id/item', salvarItemHandler)
router.post('/:id/processar', processarHandler)
router.delete('/:id', cancelarHandler)

export { router as contagemRouter }
