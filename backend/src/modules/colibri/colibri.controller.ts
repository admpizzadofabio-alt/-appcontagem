import type { Request, Response, NextFunction } from 'express'
import {
  listarMapeamentos,
  criarMapeamento,
  atualizarMapeamento,
  removerMapeamento,
  importarVendas,
  importarPendente,
  getUltimaImportacao,
  listarImportacoes,
  sincronizarCatalogo,
  listarCatalogo,
  removerCatalogo,
  testConexao,
  importarProdutosDoColibri,
} from './colibri.service.js'
import { criarMapeamentoSchema, atualizarMapeamentoSchema, importarVendasSchema } from './colibri.schemas.js'

export async function getMapeamentos(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await listarMapeamentos())
  } catch (e) { next(e) }
}

export async function postMapeamento(req: Request, res: Response, next: NextFunction) {
  try {
    const data = criarMapeamentoSchema.parse(req.body)
    res.status(201).json(await criarMapeamento(data))
  } catch (e) { next(e) }
}

export async function patchMapeamento(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id)
    const data = atualizarMapeamentoSchema.parse(req.body)
    res.json(await atualizarMapeamento(id, data))
  } catch (e) { next(e) }
}

export async function deleteMapeamento(req: Request, res: Response, next: NextFunction) {
  try {
    await removerMapeamento(String(req.params.id))
    res.status(204).end()
  } catch (e) { next(e) }
}

export async function postImportar(req: Request, res: Response, next: NextFunction) {
  try {
    const { dataInicio, dataFim, local } = importarVendasSchema.parse(req.body)
    const usuario = req.user!
    const resultado = await importarVendas({
      dataInicio,
      dataFim,
      local,
      usuarioId: usuario.sub,
      usuarioNome: usuario.nome,
    })
    res.json(resultado)
  } catch (e) { next(e) }
}

export async function getImportacoes(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await listarImportacoes())
  } catch (e) { next(e) }
}

export async function getStatus(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await testConexao())
  } catch (e) { next(e) }
}

export async function postSincronizarCatalogo(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await sincronizarCatalogo())
  } catch (e) { next(e) }
}

export async function getCatalogo(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await listarCatalogo())
  } catch (e) { next(e) }
}

export async function deleteCatalogoItem(req: Request, res: Response, next: NextFunction) {
  try {
    await removerCatalogo(String(req.params.id))
    res.status(204).end()
  } catch (e) { next(e) }
}

export async function postImportarProdutos(_req: Request, res: Response, next: NextFunction) {
  try {
    const resultado = await importarProdutosDoColibri()
    res.status(201).json(resultado)
  } catch (e) { next(e) }
}

// ── Endpoints acessíveis a qualquer operador autenticado ──────────────────────

export async function postImportarPendente(req: Request, res: Response, next: NextFunction) {
  try {
    const usuario = req.user!
    const local = usuario.setor === 'Delivery' ? 'Delivery' : 'Bar'
    const resultado = await importarPendente({
      local,
      usuarioId: usuario.sub,
      usuarioNome: usuario.nome,
    })
    res.json(resultado)
  } catch (e) { next(e) }
}

export async function getUltimaImportacaoCtrl(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await getUltimaImportacao())
  } catch (e) { next(e) }
}
