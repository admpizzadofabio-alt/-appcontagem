import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuth, requireNivel } from '../../middlewares/auth.js'

const importarLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.user?.sub ?? req.ip ?? 'anon',
  skip: () => process.env.NODE_ENV === 'test',
  message: { code: 'TOO_MANY_REQUESTS', message: 'Aguarde alguns minutos antes de importar novamente.' },
})

// Guard global: vários operadores logados podem bypassar o limit por-usuário (3*N).
// Este teto previne sobrecarga real do Colibri (6 disparos a cada 5min, todos juntos).
const importarLimiterGlobal = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 6,
  keyGenerator: () => 'colibri-importar-pendente-global',
  skip: () => process.env.NODE_ENV === 'test',
  message: { code: 'TOO_MANY_REQUESTS', message: 'Muitas importações em andamento. Aguarde alguns minutos.' },
})
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
  getNovosColibri,
  patchMarcarVisto,
} from './colibri.controller.js'

export const colibriRouter = Router()

colibriRouter.use(requireAuth)

// ── Acessíveis a qualquer operador autenticado ──
colibriRouter.get('/ultima-importacao', getUltimaImportacaoCtrl)
colibriRouter.get('/novos', getNovosColibri)
colibriRouter.patch('/novos/marcar-vistos', patchMarcarVisto)

// importar-pendente: aberto a operadores. Operação idempotente (substituir=true
// re-aplica o mesmo período — disparar várias vezes dá o mesmo resultado).
// Rate limit (3/5min por usuário) impede abuso.
colibriRouter.post('/importar-pendente', importarLimiterGlobal, importarLimiter, postImportarPendente)

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
