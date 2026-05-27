import { Request, Response, NextFunction } from 'express'
import { ajustarEstoqueSchema } from './estoque.schemas.js'
import * as service from './estoque.service.js'

export async function listarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const local = req.query.local as string | undefined
    const user = req.user!
    if (user.nivelAcesso === 'Comprador' && user.setoresPermitidos) {
      if (local && !user.setoresPermitidos.includes(local)) return res.json([])
    }
    res.json(await service.listar(local))
  } catch (err) { next(err) }
}

export async function summaryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.summary())
  } catch (err) { next(err) }
}

export async function historicoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, local } = req.query
    if (!data || !local) return res.status(400).json({ message: 'data e local são obrigatórios' })
    const user = req.user!
    if (user.nivelAcesso === 'Comprador' && user.setoresPermitidos && !user.setoresPermitidos.includes(String(local))) {
      return res.json({ temDados: false })
    }
    res.json(await service.historico(String(data), String(local)))
  } catch (err) { next(err) }
}

export async function ajustarHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { quantidade } = ajustarEstoqueSchema.parse(req.body)
    res.json(await service.ajustar(String(req.params.id), quantidade, req.user!.sub, req.user!.nome, req.user!.setor, req.user!.nivelAcesso))
  } catch (err) { next(err) }
}
