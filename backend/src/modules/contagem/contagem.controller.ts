import { Request, Response, NextFunction } from 'express'
import { iniciarContagemSchema, salvarItemSchema } from './contagem.schemas.js'
import * as service from './contagem.service.js'

export async function listarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.listar(req.query.local as string))
  } catch (err) { next(err) }
}

export async function iniciarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { local, modoCego, threshold } = iniciarContagemSchema.parse(req.body)
    res.status(201).json(await service.iniciar(local, req.user!.sub, modoCego, threshold))
  } catch (err) { next(err) }
}

export async function buscarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const revelar = req.query.revelar === 'true' && ['Supervisor', 'Admin'].includes(req.user!.nivelAcesso)
    res.json(await service.buscar(String(req.params.id), revelar))
  } catch (err) { next(err) }
}

export async function salvarItemHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { produtoId, quantidadeContada, causaDivergencia } = salvarItemSchema.parse(req.body)
    res.json(await service.salvarItem(String(req.params.id), req.user!.sub, req.user!.nivelAcesso, produtoId, quantidadeContada, causaDivergencia))
  } catch (err) { next(err) }
}

export async function processarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.processar(String(req.params.id), req.user!.sub, req.user!.nivelAcesso, req.user!.nome, req.user!.setor))
  } catch (err) { next(err) }
}

export async function cancelarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.cancelar(String(req.params.id), req.user!.sub, req.user!.nivelAcesso))
  } catch (err) { next(err) }
}
