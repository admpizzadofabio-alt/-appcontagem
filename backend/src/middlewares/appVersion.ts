import { Request, Response, NextFunction } from 'express'
import { env } from '../config/env.js'

function parseSemver(v: string): number[] {
  return v.split('.').map(n => parseInt(n, 10) || 0)
}

function isVersionBelow(sent: string, minimum: string): boolean {
  const a = parseSemver(sent)
  const b = parseSemver(minimum)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff < 0
  }
  return false
}

export function checkAppVersion(req: Request, res: Response, next: NextFunction) {
  const min = env.APP_MIN_VERSION
  if (!min) return next()

  const sent = req.headers['x-app-version'] as string | undefined
  if (!sent) return next() // app antigo sem header: não bloquear agora

  if (isVersionBelow(sent, min)) {
    res.status(426).json({
      code: 'APP_VERSION_OUTDATED',
      message: `Atualize o aplicativo. Versão mínima: ${min}`,
    })
    return
  }

  next()
}
