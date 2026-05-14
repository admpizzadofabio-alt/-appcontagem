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
  getRevisoesPendentes,
  postDecidirRevisao,
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
turnosRouter.get('/contagem/:id/cega', getContagemCega)
// VULN-009: resumo completo com quantidadeSistema permitido para Admin/Supervisor
// OU para o operador que criou a contagem (necessário para resolver divergências).
turnosRouter.get('/contagem/:id', getContagem)
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

// Revisões pós-contagem (Admin/Supervisor)
turnosRouter.get('/revisoes/pendentes', requireNivel(['Admin', 'Supervisor']), getRevisoesPendentes)
turnosRouter.post('/revisoes/:id/decidir', requireNivel(['Admin', 'Supervisor']), postDecidirRevisao)
