import bcrypt from 'bcryptjs'
import { prisma } from '../../config/prisma.js'
import { NotFoundError } from '../../shared/errors.js'
import { NivelAcesso } from '@prisma/client'

export async function listar() {
  return prisma.usuario.findMany({ select: { id: true, nome: true, setor: true, nivelAcesso: true, ativo: true, criadoEm: true }, orderBy: { nome: 'asc' } })
}

export async function criar(data: { nome: string; pin: string; setor: string; nivelAcesso: NivelAcesso }) {
  const pinHash = await bcrypt.hash(data.pin, 12)
  return prisma.usuario.create({ data: { ...data, pin: pinHash, pinFormat: 'bcrypt' } })
}

export async function atualizar(id: string, data: { nome?: string; pin?: string; setor?: string; nivelAcesso?: string }) {
  const usuario = await prisma.usuario.findUnique({ where: { id } })
  if (!usuario) throw new NotFoundError('Usuário não encontrado')
  const update: any = { ...data }
  if (data.pin) {
    update.pin = await bcrypt.hash(data.pin, 12)
    update.pinFormat = 'bcrypt'
  }
  return prisma.usuario.update({ where: { id }, data: update, select: { id: true, nome: true, setor: true, nivelAcesso: true, ativo: true } })
}

export async function toggleAtivo(id: string) {
  const usuario = await prisma.usuario.findUnique({ where: { id } })
  if (!usuario) throw new NotFoundError('Usuário não encontrado')
  return prisma.usuario.update({ where: { id }, data: { ativo: !usuario.ativo }, select: { id: true, nome: true, ativo: true } })
}
