import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as svc from './correcoes.service.js'

const registrarSchema = z.object({
  local: z.enum(['Bar', 'Delivery']),
  turnoId: z.string().uuid().optional().nullable(),
  produtoComandadoId: z.string().uuid(),
  produtoServidoId: z.string().uuid(),
  quantidade: z.number().positive(),
  fotoComanda: z.string().min(10),
  observacao: z.string().optional(),
})

export async function postRegistrar(req: Request, res: Response, next: NextFunction) {
  try {
    const data = registrarSchema.parse(req.body)
    res.status(201).json(await svc.registrarCorrecao({
      ...data,
      operadorId: req.user!.sub,
      operadorSetor: req.user!.setor,
      operadorNivel: req.user!.nivelAcesso,
    }))
  } catch (e) { next(e) }
}

export async function getListar(req: Request, res: Response, next: NextFunction) {
  try {
    const { diaOperacional, local, turnoId } = req.query as Record<string, string>
    res.json(await svc.listarCorrecoes({ diaOperacional, local, turnoId }))
  } catch (e) { next(e) }
}
