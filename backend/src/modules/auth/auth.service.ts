import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { prisma } from '../../config/prisma.js'
import { env } from '../../config/env.js'
import { UnauthorizedError } from '../../shared/errors.js'
import { verifyTotp } from './totp.service.js'

function buildTokens(usuarioId: string, nome: string, setor: string, nivelAcesso: string) {
  const payload = { sub: usuarioId, nome, setor, nivelAcesso }
  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any })
  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any })
  return { accessToken, refreshToken }
}

// Hash dummy lazy: argon2id de string aleatória, gerado uma vez na primeira chamada.
// Usado em timing-equalization quando a lista de usuários ativos está vazia.
let dummyHashCache: string | null = null
async function getDummyHash(): Promise<string> {
  if (!dummyHashCache) {
    dummyHashCache = await argon2.hash('__dummy_never_a_valid_pin__', {
      type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1,
    })
  }
  return dummyHashCache
}

export async function login(pin: string, totpCode?: string) {
  const MAX_TOTP_ATTEMPTS = 5
  const LOCKOUT_MINUTES = 15

  const usuarios = await prisma.usuario.findMany({ where: { ativo: true } })

  if (usuarios.length === 0) {
    await argon2.verify(await getDummyHash(), pin).catch(() => false)
    throw new UnauthorizedError('PIN inválido')
  }

  let usuario = null
  for (const u of usuarios) {
    if (await argon2.verify(u.pin, pin)) { usuario = u; break }
  }
  if (!usuario) throw new UnauthorizedError('PIN inválido')

  // Verifica bloqueio (gerado por tentativas 2FA repetidas)
  if (usuario.bloqueadoAte && usuario.bloqueadoAte > new Date()) {
    const mins = Math.ceil((usuario.bloqueadoAte.getTime() - Date.now()) / 60000)
    throw new UnauthorizedError(`Conta bloqueada. Tente novamente em ${mins} minuto(s).`)
  }

  // Enforce 2FA se habilitado
  if (usuario.totpEnabled) {
    if (!totpCode) throw new UnauthorizedError('Código 2FA obrigatório')
    const valid = await verifyTotp(usuario.totpSecret!, totpCode)
    if (!valid) {
      const novasTentativas = (usuario.loginAttempts ?? 0) + 1
      const bloquear = novasTentativas >= MAX_TOTP_ATTEMPTS
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          loginAttempts: novasTentativas,
          ...(bloquear && { bloqueadoAte: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) }),
        },
      })
      throw new UnauthorizedError(
        bloquear
          ? `Conta bloqueada por ${LOCKOUT_MINUTES} minutos após múltiplas tentativas.`
          : 'Código 2FA inválido'
      )
    }
  }

  // Reset tentativas após login bem-sucedido
  if ((usuario.loginAttempts ?? 0) > 0 || usuario.bloqueadoAte) {
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { loginAttempts: 0, bloqueadoAte: null },
    })
  }

  const tokens = buildTokens(usuario.id, usuario.nome, usuario.setor, usuario.nivelAcesso)

  const tokenHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex')
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  await prisma.refreshToken.create({ data: { tokenHash, usuarioId: usuario.id, expiresAt } })

  await prisma.logAuditoria.create({
    data: {
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      setor: usuario.setor,
      acao: 'LOGIN',
      entidade: 'USUARIO',
      idReferencia: usuario.id,
      detalhes: 'Login realizado',
    },
  })

  return { ...tokens, usuario: { id: usuario.id, nome: usuario.nome, setor: usuario.setor, nivelAcesso: usuario.nivelAcesso } }
}

export async function refresh(refreshToken: string) {
  try {
    jwt.verify(refreshToken, env.JWT_REFRESH_SECRET)
  } catch {
    throw new UnauthorizedError('Refresh token inválido')
  }

  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } })
  if (!stored || stored.expiresAt < new Date()) throw new UnauthorizedError('Refresh token expirado')

  const usuario = await prisma.usuario.findUnique({ where: { id: stored.usuarioId } })
  if (!usuario || !usuario.ativo) throw new UnauthorizedError()

  await prisma.refreshToken.delete({ where: { tokenHash } })

  const tokens = buildTokens(usuario.id, usuario.nome, usuario.setor, usuario.nivelAcesso)
  const newHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex')
  await prisma.refreshToken.create({
    data: { tokenHash: newHash, usuarioId: usuario.id, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  })

  return tokens
}

export async function logout(usuarioId: string) {
  await prisma.refreshToken.deleteMany({ where: { usuarioId } })
  await prisma.logAuditoria.create({
    data: {
      usuarioId,
      usuarioNome: '',
      setor: '',
      acao: 'LOGOUT',
      entidade: 'USUARIO',
      idReferencia: usuarioId,
      detalhes: 'Logout realizado',
    },
  })
}
