import { Request, Response, NextFunction } from 'express'
import * as service from './relatorios.service.js'

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/
function vData(d: string | undefined): string | undefined {
  if (!d) return undefined
  if (!DATA_RE.test(d)) throw Object.assign(new Error('Formato de data inválido. Use YYYY-MM-DD.'), { status: 400 })
  return d
}

export async function macroHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as Record<string, string>
    res.json(await service.macro(vData(q.dataInicio), vData(q.dataFim)))
  } catch (err) { next(err) }
}

export async function saidasHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as Record<string, string>
    res.json(await service.saidas({ dataInicio: vData(q.dataInicio), dataFim: vData(q.dataFim), local: q.local }))
  } catch (err) { next(err) }
}

export async function perdasHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as Record<string, string>
    res.json(await service.perdas({ dataInicio: vData(q.dataInicio), dataFim: vData(q.dataFim) }))
  } catch (err) { next(err) }
}

export async function divergenciasHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as Record<string, string>
    res.json(await service.divergencias(vData(q.dataInicio), vData(q.dataFim)))
  } catch (err) { next(err) }
}

export async function auditoriaHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as Record<string, string>
    const take = q.take ? Math.min(Math.max(parseInt(q.take, 10) || 50, 1), 500) : undefined
    const skip = q.skip ? Math.max(parseInt(q.skip, 10) || 0, 0) : undefined
    res.json(await service.auditoria({
      take, skip,
      usuarioId: q.usuarioId,
      acao: q.acao,
      entidade: q.entidade,
      dataInicio: vData(q.dataInicio),
      dataFim: vData(q.dataFim),
      busca: q.busca,
    }))
  } catch (err) { next(err) }
}
