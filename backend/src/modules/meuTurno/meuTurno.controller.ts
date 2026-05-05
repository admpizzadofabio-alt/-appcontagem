import { Request, Response, NextFunction } from 'express'
import { getMeuTurno } from './meuTurno.service.js'

export async function getMeuTurnoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const usuarioId = (req as any).user.id
    const setor     = (req as any).user.setor ?? 'Bar'
    const data = await getMeuTurno(usuarioId, setor)
    res.json(data)
  } catch (err) {
    next(err)
  }
}
