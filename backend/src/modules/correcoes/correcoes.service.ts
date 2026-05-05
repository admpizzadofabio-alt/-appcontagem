import { prisma } from '../../config/prisma.js'
import { getDiaOperacional } from '../../shared/diaOperacional.js'
import { AppError } from '../../shared/errors.js'
import { validarBase64Imagem } from '../../shared/validarImagem.js'

export async function registrarCorrecao(data: {
  operadorId: string
  operadorSetor: string
  operadorNivel?: string
  local: string
  turnoId?: string | null
  produtoComandadoId: string
  produtoServidoId: string
  quantidade: number
  fotoComanda: string
  observacao?: string
}) {
  if (!data.turnoId) throw new AppError('Erro de comanda só pode ser registrado com turno aberto', 400)
  if (data.produtoComandadoId === data.produtoServidoId) {
    throw new AppError('Produto comandado e servido não podem ser o mesmo', 400)
  }
  // Operador só pode registrar erro de comanda no próprio setor
  const liberado = data.operadorNivel === 'Admin' || data.operadorNivel === 'Supervisor' || data.operadorSetor === 'Todos' || data.operadorSetor === 'Admin'
  if (!liberado && data.operadorSetor !== data.local) {
    throw new AppError(`Operador do setor "${data.operadorSetor}" não pode registrar erro de comanda em "${data.local}".`, 403)
  }
  validarBase64Imagem(data.fotoComanda, 'fotoComanda')

  const [prodC, prodS] = await Promise.all([
    prisma.produto.findUnique({ where: { id: data.produtoComandadoId } }),
    prisma.produto.findUnique({ where: { id: data.produtoServidoId } }),
  ])
  if (!prodC || !prodS) throw new AppError('Produto não encontrado', 404)

  const diaOperacional = getDiaOperacional()

  const operador = await prisma.usuario.findUnique({ where: { id: data.operadorId }, select: { nome: true } })
  const operadorNome = operador?.nome ?? data.operadorId

  const correcao = await prisma.$transaction(async (tx) => {
    const saida = await tx.movimentacaoEstoque.create({
      data: {
        produtoId: data.produtoServidoId,
        tipoMov: 'Saida',
        quantidade: data.quantidade,
        localOrigem: data.local,
        usuarioId: data.operadorId,
        observacao: `Correção de comanda: substituiu "${prodC.nomeBebida}"`,
        motivoAjuste: 'CorrecaoVenda',
        imagemComprovante: data.fotoComanda,
        diaOperacional,
        turnoId: data.turnoId ?? null,
        aprovacaoStatus: 'Aprovado',
      },
    })

    const estoqueServido = await tx.estoqueAtual.findUnique({
      where: { produtoId_local: { produtoId: data.produtoServidoId, local: data.local } },
    })
    const qtdAtual = estoqueServido?.quantidadeAtual ?? 0
    if (qtdAtual < data.quantidade) {
      throw new AppError(`Estoque insuficiente de ${prodS.nomeBebida} no ${data.local}. Disponível: ${qtdAtual}`, 400)
    }
    await tx.estoqueAtual.update({
      where: { produtoId_local: { produtoId: data.produtoServidoId, local: data.local } },
      data: { quantidadeAtual: qtdAtual - data.quantidade, atualizadoPor: data.operadorId },
    })

    await tx.logAuditoria.create({
      data: {
        usuarioId: data.operadorId,
        usuarioNome: operadorNome,
        setor: data.local,
        acao: 'CORRECAO_VENDA',
        entidade: 'CorrecaoVenda',
        detalhes: JSON.stringify({
          produtoComandado: prodC.nomeBebida,
          produtoServido: prodS.nomeBebida,
          quantidade: data.quantidade,
        }),
      },
    })

    return tx.correcaoVenda.create({
      data: {
        diaOperacional,
        turnoId: data.turnoId ?? null,
        local: data.local,
        operadorId: data.operadorId,
        produtoComandadoId: data.produtoComandadoId,
        produtoServidoId: data.produtoServidoId,
        quantidade: data.quantidade,
        fotoComanda: data.fotoComanda,
        observacao: data.observacao,
        movimentacaoId: saida.id,
      },
      include: {
        produtoComandado: { select: { nomeBebida: true, unidadeMedida: true } },
        produtoServido: { select: { nomeBebida: true, unidadeMedida: true } },
        operador: { select: { nome: true } },
      },
    })
  })

  return correcao
}

export async function listarCorrecoes(params: { diaOperacional?: string; local?: string; turnoId?: string }) {
  return prisma.correcaoVenda.findMany({
    where: {
      ...(params.diaOperacional && { diaOperacional: params.diaOperacional }),
      ...(params.local && { local: params.local }),
      ...(params.turnoId && { turnoId: params.turnoId }),
    },
    include: {
      produtoComandado: { select: { nomeBebida: true, unidadeMedida: true } },
      produtoServido: { select: { nomeBebida: true, unidadeMedida: true } },
      operador: { select: { nome: true } },
    },
    orderBy: { criadoEm: 'desc' },
  })
}
