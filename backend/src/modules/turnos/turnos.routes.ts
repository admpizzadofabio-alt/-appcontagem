import { Router } from 'express'
import { requireAuth, requireNivel } from '../../middlewares/auth.js'
import {
  getDashboard,
  getAtual,
  postAbrir,
  postFechar,
  deleteTurno,
  getHistorico,
  getContagem,
  getContagemCega,
  postContagemItem,
  postContagemFoto,
  postContagemFinalizar,
  postVerificarEntrada,
  postRascunho,
  getRascunhosPendentes,
  postDecidirRascunho,
} from './turnos.controller.js'

export const turnosRouter = Router()

turnosRouter.use(requireAuth)

// Turno
turnosRouter.get('/atual', getAtual)
turnosRouter.post('/abrir', postAbrir)
turnosRouter.post('/:id/fechar', requireNivel(['Admin']), postFechar)
turnosRouter.delete('/:id', requireNivel(['Admin']), deleteTurno)
turnosRouter.get('/historico', getHistorico)

// Contagem
turnosRouter.get('/contagem/:id/cega', getContagemCega)   // modo cego — omite quantidadeSistema
turnosRouter.get('/contagem/:id', getContagem)             // resumo completo (após finalizar)
turnosRouter.post('/contagem/:id/item', postContagemItem)
turnosRouter.post('/contagem/:id/foto', postContagemFoto)
turnosRouter.post('/contagem/:id/finalizar', postContagemFinalizar)
turnosRouter.post('/contagem/:id/rascunho', postRascunho)

// Anti-duplicação de entrada
turnosRouter.post('/verificar-entrada', postVerificarEntrada)

// Dashboard admin
turnosRouter.get('/dashboard', requireNivel(['Admin', 'Supervisor']), getDashboard)

// Rascunhos (Admin)
turnosRouter.get('/rascunhos/pendentes', requireNivel(['Admin']), getRascunhosPendentes)
turnosRouter.post('/rascunhos/:id/decidir', requireNivel(['Admin']), postDecidirRascunho)
