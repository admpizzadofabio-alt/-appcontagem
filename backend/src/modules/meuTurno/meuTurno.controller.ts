import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { getMeuTurno } from './meuTurno.service.js'

const localOverrideSchema = z.enum(['Bar', 'Delivery', 'Vinhos']).optional()

export async function getMeuTurnoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user
    const usuarioId = user.id
    const setor     = user.setor ?? 'Bar'
    // Admin/Supervisor podem inspecionar qualquer setor via ?local=. Operador ignora o param.
    const podeOverride = user.nivelAcesso === 'Admin' || user.nivelAcesso === 'Supervisor'
    const localOverride = podeOverride ? localOverrideSchema.parse(req.query.local) : undefined
    const data = await getMeuTurno(usuarioId, setor, localOverride)
    res.json(data)
  } catch (err) {
    next(err)
  }
}
