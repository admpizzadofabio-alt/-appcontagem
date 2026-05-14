import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { AppError } from '../shared/errors.js'
import { logger } from '../config/logger.js'
import { captureException } from '../config/sentry.js'

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      errors: err.flatten().fieldErrors,
    })
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
    })
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ code: 'DUPLICATE', message: 'Registro já existe com esses dados' })
    }
    if (err.code === 'P2003') {
      return res.status(409).json({ code: 'REFERENCE_ERROR', message: 'Referência inválida para outro registro' })
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Registro não encontrado' })
    }
  }

  logger.error({ err, path: req.path, method: req.method }, 'Erro não tratado')
  captureException(err, { path: req.path, method: req.method, userId: (req as any).user?.sub })

  return res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'Erro interno do servidor',
  })
}
