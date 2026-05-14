/**
 * 2FA TOTP (RFC 6238) — Google Authenticator, Authy, etc.
 * Apenas Admin pode habilitar (segurança crítica para revisão de divergências).
 *
 * Fluxo:
 *  1. Admin chama POST /auth/totp/setup → recebe { secret, otpauthUrl }
 *  2. Admin escaneia QR (gerar a partir de otpauthUrl no front) e confirma com código:
 *     POST /auth/totp/enable { code }
 *  3. Login passa a exigir code TOTP além do PIN.
 */
import { generateSecret, verify, generateURI } from 'otplib'
import { prisma } from '../../config/prisma.js'
import { ForbiddenError, BusinessRuleError } from '../../shared/errors.js'

export async function setupTotp(usuarioId: string) {
  const user = await prisma.usuario.findUnique({ where: { id: usuarioId } })
  if (!user) throw new ForbiddenError('Usuário não encontrado')
  if (user.totpEnabled) throw new BusinessRuleError('2FA já está habilitado')

  const secret = generateSecret()
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { totpSecret: secret, totpEnabled: false }, // habilitado só após confirmar
  })

  const otpauthUrl = generateURI({ issuer: 'APPCONTAGEM', label: user.nome, secret })
  return { secret, otpauthUrl }
}

export async function enableTotp(usuarioId: string, code: string) {
  const user = await prisma.usuario.findUnique({ where: { id: usuarioId } })
  if (!user || !user.totpSecret) throw new BusinessRuleError('Setup TOTP não iniciado')

  const result = await verify({ token: code, secret: user.totpSecret })
  if (!result.valid) throw new BusinessRuleError('Código inválido')

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { totpEnabled: true },
  })
  return { ok: true }
}

export async function disableTotp(usuarioId: string) {
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { totpEnabled: false, totpSecret: null },
  })
  return { ok: true }
}

export async function verifyTotp(secret: string, code: string): Promise<boolean> {
  const result = await verify({ token: code, secret })
  return result.valid
}
