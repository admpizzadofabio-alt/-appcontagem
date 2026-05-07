import { Request, Response, NextFunction } from 'express'
import { ajustarEstoqueSchema } from './estoque.schemas.js'
import * as service from './estoque.service.js'

export async function listarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.listar(req.query.local as string))
  } catch (err) { next(err) }
}

export async function summaryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.summary())
  } catch (err) { next(err) }
}

export async function ajustarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { quantidade } = ajustarEstoqueSchema.parse(req.body)
    res.json(await service.ajustar(String(req.params.id), quantidade, req.user!.sub, req.user!.setor, req.user!.nivelAcesso))
  } catch (err) { next(err) }
}
