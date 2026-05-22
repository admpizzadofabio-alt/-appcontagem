import { Router, Request, Response, NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuth, requireNivel } from '../../middlewares/auth.js'
import { criarSetorSchema, editarSetorSchema } from './setores.schemas.js'
import * as service from './setores.service.js'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  keyGenerator: (req: any) => req.user?.sub ?? req.ip ?? 'anon',
  skip: () => process.env.NODE_ENV === 'test',
  message: { code: 'TOO_MANY_REQUESTS', message: 'Muitas requisições. Tente em 15 minutos.' },
})

const router = Router()
router.use(requireAuth, limiter)

// Qualquer autenticado pode listar (para preencher dropdowns)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apenasAtivos = req.query.ativos === 'true'
    res.json(await service.listarSetores(apenasAtivos))
  } catch (e) { next(e) }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await service.buscarSetor(String(req.params.id)))
  } catch (e) { next(e) }
})

// Apenas Admin pode criar, editar, excluir
router.post('/', requireNivel(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nome, temEstoque } = criarSetorSchema.parse(req.body)
    const { sub, nome: uNome, setor } = req.user!
    res.status(201).json(await service.criarSetor(nome, temEstoque, sub, uNome, String(setor)))
  } catch (e) { next(e) }
})

router.patch('/:id', requireNivel(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dados = editarSetorSchema.parse(req.body)
    const { sub, nome: uNome, setor } = req.user!
    res.json(await service.editarSetor(String(req.params.id), dados, sub, uNome, String(setor)))
  } catch (e) { next(e) }
})

router.delete('/:id', requireNivel(['Admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sub, nome: uNome, setor } = req.user!
    await service.excluirSetor(String(req.params.id), sub, uNome, String(setor))
    res.status(204).send()
  } catch (e) { next(e) }
})

export { router as setoresRouter }
