import { prisma } from '../../config/prisma.js'
import { NotFoundError, ForbiddenError } from '../../shared/errors.js'
import { StatusPedido } from '@prisma/client'
import { v4 as uuid } from 'uuid'

export async function listar(filtros: { status?: string; setor?: string; nivelAcesso?: string }) {
  const where: any = {}
  if (filtros.status) where.status = filtros.status
  if (filtros.setor) where.setorSolicitante = filtros.setor

  return prisma.pedidoCompra.findMany({
    where,
    orderBy: [{ urgente: 'desc' }, { dataPedido: 'desc' }],
    include: { produto: { select: { nomeBebida: true } }, usuario: { select: { nome: true } } },
  })
}

export async function criar(itens: Array<{ produtoId?: string; nomeProduto: string; quantidade: number; observacao?: string; urgente?: boolean }>, usuarioId: string, setor: string) {
  const idGrupo = uuid()
  return Promise.all(
    itens.map((item) =>
      prisma.pedidoCompra.create({
        data: { ...item, idGrupo, setorSolicitante: setor, usuarioId },
      })
    )
  )
}

export async function atualizarStatus(id: string, status: string, setor: string, nivelAcesso: string) {
  const pedido = await prisma.pedidoCompra.findUnique({ where: { id } })
  if (!pedido) throw new NotFoundError('Pedido não encontrado')
  if (nivelAcesso !== 'Admin' && pedido.setorSolicitante !== setor)
    throw new ForbiddenError(`Supervisor do setor "${setor}" não pode alterar pedidos de "${pedido.setorSolicitante}"`)
  return prisma.pedidoCompra.update({ where: { id }, data: { status: status as StatusPedido } })
}

export async function editar(id: string, data: { nomeProduto?: string; quantidade?: number; observacao?: string; urgente?: boolean }) {
  const pedido = await prisma.pedidoCompra.findUnique({ where: { id } })
  if (!pedido) throw new NotFoundError('Pedido não encontrado')
  return prisma.pedidoCompra.update({ where: { id }, data })
}

export async function excluir(id: string) {
  const pedido = await prisma.pedidoCompra.findUnique({ where: { id } })
  if (!pedido) throw new NotFoundError('Pedido não encontrado')
  await prisma.pedidoCompra.delete({ where: { id } })
}
