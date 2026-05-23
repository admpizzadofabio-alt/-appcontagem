import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { UnauthorizedError, ForbiddenError } from '../shared/errors.js'

export interface TokenPayload {
  sub: string
  nome: string
  setor: string
  nivelAcesso: string
  tokenVersion?: number
}

// eslint-disable-next-line @typescript-eslint/no-namespace
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return next(new UnauthorizedError())

  try {
    const token = auth.split(' ')[1]
    const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload

    // Valida tokenVersion: garante revogação imediata após logout global ou bloqueio
    if (payload.tokenVersion !== undefined) {
      const usuario = await prisma.usuario.findUnique({
        where: { id: payload.sub },
        select: { tokenVersion: true, ativo: true },
      })
      if (!usuario || !usuario.ativo || usuario.tokenVersion !== payload.tokenVersion) {
        return next(new UnauthorizedError('Sessão revogada'))
      }
    }

    req.user = payload
    next()
  } catch (err) {
    if (err instanceof UnauthorizedError) return next(err)
    next(new UnauthorizedError('Token inválido ou expirado'))
  }
}

export function requireNivel(niveis: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new UnauthorizedError())
    const ordem = { Operador: 1, Supervisor: 2, Admin: 3 }
    const nivelUser = ordem[req.user.nivelAcesso as keyof typeof ordem] ?? 0
    const minNivel = Math.min(...niveis.map(n => ordem[n as keyof typeof ordem] ?? 0))
    if (nivelUser < minNivel) return next(new ForbiddenError())
    next()
  }
}
