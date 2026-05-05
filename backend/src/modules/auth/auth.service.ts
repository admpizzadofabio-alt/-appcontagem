import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { prisma } from '../../config/prisma.js'
import { env } from '../../config/env.js'
import { UnauthorizedError } from '../../shared/errors.js'

const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

function buildTokens(usuarioId: string, nome: string, setor: string, nivelAcesso: string) {
  const payload = { sub: usuarioId, nome, setor, nivelAcesso }
  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any })
  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any })
  return { accessToken, refreshToken }
}

async function registrarFalha(usuarioId: string) {
  const u = await prisma.usuario.update({
    where: { id: usuarioId },
    data: { loginAttempts: { increment: 1 } },
    select: { loginAttempts: true },
  })
  if (u.loginAttempts >= MAX_ATTEMPTS) {
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { bloqueadoAte: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) },
    })
  }
}

export async function login(pin: string) {
  const pinSha256 = crypto.createHash('sha256').update(pin).digest('hex')

  // Busca por formato: plaintext e sha256 permitem lookup direto por valor
  let usuario =
    await prisma.usuario.findFirst({ where: { pinFormat: 'sha256', pin: pinSha256, ativo: true } }) ??
    await prisma.usuario.findFirst({ where: { pinFormat: 'plaintext', pin, ativo: true } })

  // Usuários bcrypt: precisa carregar e comparar (sem atalho possível)
  if (!usuario) {
    const bcryptUsers = await prisma.usuario.findMany({ where: { pinFormat: 'bcrypt', ativo: true } })
    for (const u of bcryptUsers) {
      if (await bcrypt.compare(pin, u.pin)) { usuario = u; break }
    }
  }

  if (!usuario) throw new UnauthorizedError('PIN inválido')

  // Verificar bloqueio
  if (usuario.bloqueadoAte && usuario.bloqueadoAte > new Date()) {
    const minutos = Math.ceil((usuario.bloqueadoAte.getTime() - Date.now()) / 60000)
    throw new UnauthorizedError(`Conta bloqueada. Tente novamente em ${minutos} minuto(s).`)
  }

  // PIN errado após encontrar usuário (bcrypt pode ter falso match — não acontece, mas garante reset)
  // Verifica se o PIN bate de verdade antes de prosseguir
  let pinValido = false
  if (usuario.pinFormat === 'bcrypt') {
    pinValido = await bcrypt.compare(pin, usuario.pin)
  } else if (usuario.pinFormat === 'sha256') {
    pinValido = usuario.pin === pinSha256
  } else {
    pinValido = usuario.pin === pin
  }

  if (!pinValido) {
    await registrarFalha(usuario.id)
    const restantes = MAX_ATTEMPTS - (usuario.loginAttempts + 1)
    if (restantes > 0) {
      throw new UnauthorizedError(`PIN inválido. ${restantes} tentativa(s) restante(s).`)
    }
    throw new UnauthorizedError(`Conta bloqueada por ${LOCKOUT_MINUTES} minutos.`)
  }

  // Login bem-sucedido — resetar contador
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { loginAttempts: 0, bloqueadoAte: null },
  })

  // Migração automática para bcrypt ao fazer login
  if (usuario.pinFormat !== 'bcrypt') {
    const bcryptHash = await bcrypt.hash(pin, 12)
    await prisma.usuario.update({ where: { id: usuario.id }, data: { pin: bcryptHash, pinFormat: 'bcrypt' } })
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
  let payload: any
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET)
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
