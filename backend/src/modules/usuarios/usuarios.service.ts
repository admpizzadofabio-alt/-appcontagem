import argon2 from 'argon2'
import { prisma } from '../../config/prisma.js'
import { NotFoundError } from '../../shared/errors.js'
import { NivelAcesso } from '@prisma/client'

const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 }

export async function listar() {
  return prisma.usuario.findMany({ select: { id: true, nome: true, setor: true, nivelAcesso: true, ativo: true, criadoEm: true }, orderBy: { nome: 'asc' } })
}

export async function criar(data: { nome: string; pin: string; setor: string; nivelAcesso: NivelAcesso }) {
  const pinHash = await argon2.hash(data.pin, ARGON2_OPTIONS)
  return prisma.usuario.create({ data: { ...data, pin: pinHash, pinFormat: 'argon2id' } })
}

export async function atualizar(id: string, data: { nome?: string; pin?: string; setor?: string; nivelAcesso?: string }) {
  const usuario = await prisma.usuario.findUnique({ where: { id } })
  if (!usuario) throw new NotFoundError('Usuário não encontrado')
  const update: any = { ...data }
  if (data.pin) {
    update.pin = await argon2.hash(data.pin, ARGON2_OPTIONS)
    update.pinFormat = 'argon2id'
  }
  return prisma.usuario.update({ where: { id }, data: update, select: { id: true, nome: true, setor: true, nivelAcesso: true, ativo: true } })
}

export async function toggleAtivo(id: string) {
  const usuario = await prisma.usuario.findUnique({ where: { id } })
  if (!usuario) throw new NotFoundError('Usuário não encontrado')
  return prisma.usuario.update({ where: { id }, data: { ativo: !usuario.ativo }, select: { id: true, nome: true, ativo: true } })
}
