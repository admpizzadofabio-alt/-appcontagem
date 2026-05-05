import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { getCmvBebidas } from './cmv.service.js'

const querySchema = z.object({
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dataFim:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function getCmv(req: Request, res: Response, next: NextFunction) {
  try {
    const { dataInicio, dataFim } = querySchema.parse(req.query)
    const inicio = new Date(`${dataInicio}T00:00:00.000Z`)
    const fim    = new Date(`${dataFim}T23:59:59.999Z`)
    const result = await getCmvBebidas(inicio, fim)
    res.json(result)
  } catch (err) {
    next(err)
  }
}
