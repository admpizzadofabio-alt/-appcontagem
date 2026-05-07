import { Router } from 'express'
import { requireAuth, requireNivel } from '../../middlewares/auth.js'
import {
  getMapeamentos,
  postMapeamento,
  patchMapeamento,
  deleteMapeamento,
  postImportar,
  getImportacoes,
  getStatus,
  postSincronizarCatalogo,
  getCatalogo,
  deleteCatalogoItem,
  postImportarProdutos,
  postImportarPendente,
  getUltimaImportacaoCtrl,
} from './colibri.controller.js'

export const colibriRouter = Router()

colibriRouter.use(requireAuth)

// ── Acessíveis a qualquer operador autenticado ──
colibriRouter.post('/importar-pendente', postImportarPendente)
colibriRouter.get('/ultima-importacao', getUltimaImportacaoCtrl)

// ── A partir daqui, apenas Admin ──
colibriRouter.use(requireNivel(['Admin']))

colibriRouter.get('/status', getStatus)
colibriRouter.get('/mapeamentos', getMapeamentos)
colibriRouter.post('/mapeamentos', postMapeamento)
colibriRouter.patch('/mapeamentos/:id', patchMapeamento)
colibriRouter.delete('/mapeamentos/:id', deleteMapeamento)
colibriRouter.post('/importar', postImportar)
colibriRouter.get('/importacoes', getImportacoes)
colibriRouter.post('/catalogo/sincronizar', postSincronizarCatalogo)
colibriRouter.get('/catalogo', getCatalogo)
colibriRouter.delete('/catalogo/:id', deleteCatalogoItem)
colibriRouter.post('/produtos', postImportarProdutos)
