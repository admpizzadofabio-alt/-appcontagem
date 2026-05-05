import { Request, Response, NextFunction } from 'express'
import { loginSchema, refreshSchema } from './auth.schemas.js'
import * as service from './auth.service.js'

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { pin } = loginSchema.parse(req.body)
    const result = await service.login(pin)
    res.status(200).json(result)
  } catch (err) { next(err) }
}

export async function refreshHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body)
    const tokens = await service.refresh(refreshToken)
    res.status(200).json(tokens)
  } catch (err) { next(err) }
}

export async function logoutHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await service.logout(req.user!.sub)
    res.status(204).send()
  } catch (err) { next(err) }
}

export function meHandler(req: Request, res: Response) {
  res.json(req.user)
}
