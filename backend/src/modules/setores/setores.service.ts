import { prisma } from '../../config/prisma.js'
import { AppError, NotFoundError } from '../../shared/errors.js'

export async function listarSetores(apenasAtivos = false) {
  return prisma.setor.findMany({
    where: apenasAtivos ? { ativo: true } : undefined,
    orderBy: { nome: 'asc' },
  })
}

export async function buscarSetor(id: string) {
  const setor = await prisma.setor.findUnique({ where: { id } })
  if (!setor) throw new NotFoundError('Setor não encontrado')
  return setor
}

export async function criarSetor(nome: string, temEstoque: boolean, usuarioId: string, usuarioNome: string, setor: string) {
  const existente = await prisma.setor.findUnique({ where: { nome } })
  if (existente) throw new AppError('Já existe um setor com este nome', 409)

  const novo = await prisma.setor.create({ data: { nome, temEstoque } })

  await prisma.logAuditoria.create({
    data: {
      usuarioId,
      usuarioNome,
      setor,
      acao: 'CRIAR_SETOR',
      entidade: 'SETOR',
      idReferencia: novo.id,
      detalhes: `Setor "${nome}" criado. temEstoque=${temEstoque}`,
    },
  })

  return novo
}

export async function editarSetor(id: string, dados: { nome?: string; temEstoque?: boolean; ativo?: boolean }, usuarioId: string, usuarioNome: string, setor: string) {
  await buscarSetor(id)

  if (dados.nome) {
    const conflito = await prisma.setor.findFirst({ where: { nome: dados.nome, id: { not: id } } })
    if (conflito) throw new AppError('Já existe um setor com este nome', 409)
  }

  const atualizado = await prisma.setor.update({ where: { id }, data: dados })

  await prisma.logAuditoria.create({
    data: {
      usuarioId,
      usuarioNome,
      setor,
      acao: 'EDITAR_SETOR',
      entidade: 'SETOR',
      idReferencia: id,
      detalhes: `Setor atualizado: ${JSON.stringify(dados)}`,
    },
  })

  return atualizado
}

export async function excluirSetor(id: string, usuarioId: string, usuarioNome: string, setor: string) {
  const encontrado = await buscarSetor(id)

  const emUso = await prisma.usuario.count({ where: { setor: encontrado.nome } })
  if (emUso > 0) throw new AppError(`Setor em uso por ${emUso} usuário(s). Desative em vez de excluir.`, 409)

  await prisma.setor.delete({ where: { id } })

  await prisma.logAuditoria.create({
    data: {
      usuarioId,
      usuarioNome,
      setor,
      acao: 'EXCLUIR_SETOR',
      entidade: 'SETOR',
      idReferencia: id,
      detalhes: `Setor "${encontrado.nome}" excluído`,
    },
  })
}
