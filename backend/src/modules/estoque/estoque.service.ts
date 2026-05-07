import { prisma } from '../../config/prisma.js'
import { NotFoundError, ForbiddenError } from '../../shared/errors.js'

export async function listar(local?: string) {
  if (local) {
    const produtos = await prisma.produto.findMany({
      where: {
        ativo: true,
        OR: [{ setorPadrao: local }, { setorPadrao: 'Todos' }],
      },
      include: { estoque: { where: { local } } },
      orderBy: { nomeBebida: 'asc' },
    })
    return produtos.map((p) => {
      const { estoque: estoqueList, ...produtoData } = p
      const estoque = estoqueList[0]
      return {
        id: estoque?.id ?? `virtual_${p.id}`,
        produtoId: p.id,
        local,
        quantidadeAtual: estoque?.quantidadeAtual ?? 0,
        atualizadoPor: estoque?.atualizadoPor ?? null,
        atualizadoEm: estoque?.atualizadoEm ?? null,
        produto: produtoData,
      }
    })
  }

  return prisma.estoqueAtual.findMany({
    where: { produto: { ativo: true } },
    include: { produto: true },
    orderBy: { produto: { nomeBebida: 'asc' } },
  })
}

export async function summary() {
  type Item = Awaited<ReturnType<typeof prisma.estoqueAtual.findMany<{ include: { produto: true } }>>>[number]
  const itens: Item[] = await prisma.estoqueAtual.findMany({ where: { produto: { ativo: true } }, include: { produto: true } })
  const totalValor = itens.reduce((acc: number, i: Item) => acc + i.quantidadeAtual * i.produto.custoUnitario, 0)
  const totalItens = itens.length
  const alertas = itens.filter((i: Item) => i.quantidadeAtual <= i.produto.estoqueMinimo && i.produto.estoqueMinimo > 0)
  return { totalValor, totalItens, alertas: alertas.length, itensAlerta: alertas.map((a: Item) => ({ ...a.produto, quantidadeAtual: a.quantidadeAtual, local: a.local })) }
}

export async function ajustar(id: string, quantidade: number, usuarioId: string, setor: string, nivelAcesso: string) {
  const registro = await prisma.estoqueAtual.findUnique({ where: { id } })
  if (!registro) throw new NotFoundError('Registro de estoque não encontrado')
  if (nivelAcesso !== 'Admin' && registro.local !== setor)
    throw new ForbiddenError(`Supervisor do setor "${setor}" não pode ajustar estoque de "${registro.local}"`)
  return prisma.estoqueAtual.update({ where: { id }, data: { quantidadeAtual: quantidade, atualizadoPor: usuarioId } })
}

// Função interna — usada por movimentações
export async function upsertEstoque(produtoId: string, local: string, delta: number, usuarioId: string) {
  const existing = await prisma.estoqueAtual.findUnique({ where: { produtoId_local: { produtoId, local } } })
  if (existing) {
    return prisma.estoqueAtual.update({
      where: { produtoId_local: { produtoId, local } },
      data: { quantidadeAtual: Math.max(0, existing.quantidadeAtual + delta), atualizadoPor: usuarioId },
    })
  }
  return prisma.estoqueAtual.create({ data: { produtoId, local, quantidadeAtual: Math.max(0, delta), atualizadoPor: usuarioId } })
}
