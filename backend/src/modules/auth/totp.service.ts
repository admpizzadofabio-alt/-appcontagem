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
import crypto from 'crypto'
import { generateSecret, verify, generateURI } from 'otplib'
import { prisma } from '../../config/prisma.js'
import { env } from '../../config/env.js'
import { ForbiddenError, BusinessRuleError } from '../../shared/errors.js'

// Chave AES-256 derivada do JWT_SECRET — sem nova variável de ambiente necessária.
// Prefixo de domínio ':totp-aes256-gcm-v1' garante que a mesma string não reutiliza
// a chave em outros contextos (JWT, backup, etc.).
function _chaveAes(): Buffer {
  return crypto.createHash('sha256')
    .update(env.JWT_SECRET + ':totp-aes256-gcm-v1')
    .digest()
}

const PREFIXO_ENC = 'enc:v1:'

function _encriptar(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', _chaveAes(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIXO_ENC}${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

// Retrocompatibilidade: secrets sem prefixo (plaintext legado) continuam funcionando.
// Na próxima vez que o usuário reconfigurar o 2FA, o novo secret será gravado encriptado.
function _decriptar(stored: string): string {
  if (!stored.startsWith(PREFIXO_ENC)) return stored // plaintext legado
  const partes = stored.slice(PREFIXO_ENC.length).split(':')
  if (partes.length !== 3) throw new Error('Secret TOTP com formato inválido no banco')
  const [ivHex, tagHex, encHex] = partes
  const decipher = crypto.createDecipheriv('aes-256-gcm', _chaveAes(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8')
}

export async function setupTotp(usuarioId: string) {
  const user = await prisma.usuario.findUnique({ where: { id: usuarioId } })
  if (!user) throw new ForbiddenError('Usuário não encontrado')
  if (user.totpEnabled) throw new BusinessRuleError('2FA já está habilitado')

  const secret = generateSecret()
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { totpSecret: _encriptar(secret), totpEnabled: false },
  })

  const otpauthUrl = generateURI({ issuer: 'APPCONTAGEM', label: user.nome, secret })
  return { secret, otpauthUrl } // retorna plaintext ao frontend — nunca persiste sem encriptar
}

export async function enableTotp(usuarioId: string, code: string) {
  const user = await prisma.usuario.findUnique({ where: { id: usuarioId } })
  if (!user || !user.totpSecret) throw new BusinessRuleError('Setup TOTP não iniciado')

  const plainSecret = _decriptar(user.totpSecret)
  const result = await verify({ token: code, secret: plainSecret })
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

// storedSecret pode ser plaintext (legado) ou encriptado (enc:v1:...) — _decriptar lida com ambos
export async function verifyTotp(storedSecret: string, code: string): Promise<boolean> {
  const plainSecret = _decriptar(storedSecret)
  const result = await verify({ token: code, secret: plainSecret })
  return result.valid
}
