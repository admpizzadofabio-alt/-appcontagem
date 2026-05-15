import { Router } from 'express'
import { requireAuth, requireNivel } from '../../middlewares/auth.js'
import { listarHandler, criarHandler, listarPendentesHandler, aprovarHandler, rejeitarHandler, listarTransferenciasPendentesHandler, confirmarTransferenciaHandler, rejeitarTransferenciaHandler, deletarHandler } from './movimentacoes.controller.js'

const router = Router()
router.use(requireAuth)

router.get('/', listarHandler)
router.post('/', criarHandler)
router.get('/pendentes', requireNivel(['Supervisor', 'Admin']), listarPendentesHandler)
router.get('/transferencias/pendentes', listarTransferenciasPendentesHandler)
// Operador pode confirmar: recebimento de transferência é ação operacional.
// A proteção de setor está em confirmarTransferencia() no service (VULN-006).
router.patch('/transferencias/:id/confirmar', confirmarTransferenciaHandler)
router.patch('/transferencias/:id/rejeitar', rejeitarTransferenciaHandler)
router.patch('/aprovacoes/:id/aprovar', requireNivel(['Supervisor', 'Admin']), aprovarHandler)
router.patch('/aprovacoes/:id/rejeitar', requireNivel(['Supervisor', 'Admin']), rejeitarHandler)
router.delete('/:id', requireNivel(['Admin']), deletarHandler)

export { router as movimentacoesRouter }
