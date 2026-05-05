import { Request, Response, NextFunction } from 'express'
import * as service from './relatorios.service.js'

export async function macroHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { dataInicio, dataFim } = req.query as Record<string, string>
    res.json(await service.macro(dataInicio, dataFim))
  } catch (err) { next(err) }
}

export async function saidasHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { dataInicio, dataFim, local } = req.query as Record<string, string>
    res.json(await service.saidas({ dataInicio, dataFim, local }))
  } catch (err) { next(err) }
}

export async function perdasHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { dataInicio, dataFim } = req.query as Record<string, string>
    res.json(await service.perdas({ dataInicio, dataFim }))
  } catch (err) { next(err) }
}

export async function divergenciasHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { dataInicio, dataFim } = req.query as Record<string, string>
    res.json(await service.divergencias(dataInicio, dataFim))
  } catch (err) { next(err) }
}

export async function auditoriaHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.auditoria())
  } catch (err) { next(err) }
}
