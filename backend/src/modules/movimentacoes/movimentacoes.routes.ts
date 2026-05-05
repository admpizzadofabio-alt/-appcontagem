import { Router } from 'express'
import { requireAuth, requireNivel } from '../../middlewares/auth.js'
import { listarHandler, criarHandler, listarPendentesHandler, aprovarHandler, rejeitarHandler, listarTransferenciasPendentesHandler, confirmarTransferenciaHandler } from './movimentacoes.controller.js'

const router = Router()
router.use(requireAuth)

router.get('/', listarHandler)
router.post('/', criarHandler)
router.get('/pendentes', requireNivel(['Supervisor', 'Admin']), listarPendentesHandler)
router.get('/transferencias/pendentes', listarTransferenciasPendentesHandler)
router.patch('/transferencias/:id/confirmar', confirmarTransferenciaHandler)
router.patch('/aprovacoes/:id/aprovar', requireNivel(['Supervisor', 'Admin']), aprovarHandler)
router.patch('/aprovacoes/:id/rejeitar', requireNivel(['Supervisor', 'Admin']), rejeitarHandler)

export { router as movimentacoesRouter }
