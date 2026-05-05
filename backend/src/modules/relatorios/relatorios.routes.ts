import { Router } from 'express'
import { requireAuth, requireNivel } from '../../middlewares/auth.js'
import { macroHandler, saidasHandler, perdasHandler, divergenciasHandler, auditoriaHandler } from './relatorios.controller.js'

const router = Router()
router.use(requireAuth, requireNivel(['Supervisor', 'Admin']))

router.get('/macro', macroHandler)
router.get('/saidas', saidasHandler)
router.get('/perdas', perdasHandler)
router.get('/divergencias', divergenciasHandler)
router.get('/auditoria', auditoriaHandler)

export { router as relatoriosRouter }
