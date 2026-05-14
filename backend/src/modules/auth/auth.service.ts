import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { prisma } from '../../config/prisma.js'
import { env } from '../../config/env.js'
import { UnauthorizedError } from '../../shared/errors.js'

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

export async function login(pin: string) {
  // Modelo PIN-only: itera todos os usuários ativos e verifica argon2id.
  // Proteção contra brute-force: rate limit por IP (10/15min) + global (300/15min) — em app.ts e auth.routes.ts.
  //
  // Notas de timing:
  // - PIN errado: itera todos os N usuários (sempre roda N argon2.verify) — tempo previsível
  // - PIN correto: itera até encontrar (1..N argon2.verify) — pode revelar posição na lista,
  //   mas explorável só se atacante já conhece um PIN válido (cenário improvável neste modelo)
  // - Banco vazio (0 usuários): rodaria em ~5ms, vazando "instalação fresca"
  //   → mitigado abaixo com 1 argon2.verify dummy para igualar ao tempo mínimo de uma instalação real
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
