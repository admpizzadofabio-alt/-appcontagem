import { prisma } from '../../config/prisma.js'
import { getDiaOperacional } from '../../shared/diaOperacional.js'

export async function getMeuTurno(usuarioId: string, setor: string) {
  const hoje = getDiaOperacional()

  // Setor 'Admin' / 'Todos' não tem turno próprio — usa Bar como fallback
  const local = (setor === 'Admin' || setor === 'Todos') ? 'Bar' : setor

  // ── 1. Turno ativo ou último turno do dia para o local do operador ──
  const turno = await prisma.fechamentoTurno.findFirst({
    where: { local, diaOperacional: hoje },
    orderBy: { abertoEm: 'desc' },
  })

  if (!turno) return null

  // ── 2. Contagem vinculada ao turno ──────────────────────────────────
  const contagem = turno.contagemId
    ? await prisma.contagemEstoque.findUnique({
        where: { id: turno.contagemId },
        include: {
          operador: { select: { nome: true } },
          itens: {
            include: {
              produto: { select: { nomeBebida: true, unidadeMedida: true } },
            },
            orderBy: { produto: { nomeBebida: 'asc' } },
          },
        },
      })
    : null

  // ── 3. Movimentações durante o turno ────────────────────────────────
  const fimTurno = turno.fechadoEm ?? new Date()
  const movimentacoes = await prisma.movimentacaoEstoque.findMany({
    where: {
      localOrigem: local,
      dataMov: { gte: turno.abertoEm, lte: fimTurno },
      tipoMov: { in: ['Entrada', 'AjustePerda', 'Transferencia'] },
    },
    include: {
      produto: { select: { nomeBebida: true, unidadeMedida: true } },
      usuario: { select: { nome: true } },
    },
    orderBy: { dataMov: 'desc' },
  })

  // ── 4. Erros de comanda do turno ────────────────────────────────────
  const errosComanda = await prisma.correcaoVenda.findMany({
    where: { turnoId: turno.id },
    include: {
      produtoComandado: { select: { nomeBebida: true } },
      produtoServido:   { select: { nomeBebida: true } },
      operador:         { select: { nome: true } },
    },
    orderBy: { criadoEm: 'desc' },
  })

  // ── 5. Resumo ────────────────────────────────────────────────────────
  const entradas       = movimentacoes.filter((m) => m.tipoMov === 'Entrada')
  const perdas         = movimentacoes.filter((m) => m.tipoMov === 'AjustePerda')
  const transferencias = movimentacoes.filter((m) => m.tipoMov === 'Transferencia')

  const contagemResumo = contagem ? {
    id:              contagem.id,
    status:          contagem.status,
    local:           contagem.local,
    dataAbertura:    contagem.dataAbertura,
    dataFechamento:  contagem.dataFechamento,
    totalItens:      contagem.totalItens,
    totalDesvios:    contagem.totalDesvios,
    operador:        contagem.operador?.nome ?? null,
    itens: contagem.itens.map((i) => ({
      produtoId:            i.produtoId,
      nomeBebida:           i.produto.nomeBebida,
      unidadeMedida:        i.produto.unidadeMedida,
      quantidadeSistema:    i.quantidadeSistema,
      quantidadeContada:    i.quantidadeContada,
      diferenca:            i.diferenca,
      divergenciaCategoria: i.divergenciaCategoria,
      causaDivergencia:     i.causaDivergencia,
    })),
  } : null

  return {
    diaOperacional: hoje,
    setor: local,
    turno: {
      id:     turno.id,
      status: turno.status,
      abertoEm:  turno.abertoEm,
      fechadoEm: turno.fechadoEm,
    },
    contagem: contagemResumo,
    movimentacoes: {
      entradas:       entradas.map(formatarMov),
      perdas:         perdas.map(formatarMov),
      transferencias: transferencias.map(formatarMov),
    },
    errosComanda: errosComanda.map((e) => ({
      id:               e.id,
      produtoComandado: e.produtoComandado.nomeBebida,
      produtoServido:   e.produtoServido.nomeBebida,
      quantidade:       e.quantidade,
      criadoEm:         e.criadoEm.toISOString(),
      operador:         e.operador.nome,
    })),
    totais: {
      entradas:       entradas.length,
      perdas:         perdas.length,
      transferencias: transferencias.length,
      errosComanda:   errosComanda.length,
    },
  }
}

function formatarMov(m: any) {
  return {
    id:          m.id,
    nomeBebida:  m.produto.nomeBebida,
    unidade:     m.produto.unidadeMedida,
    quantidade:  m.quantidade,
    local:       m.localOrigem ?? m.localDestino,
    motivo:      m.motivoAjuste,
    observacao:  m.observacao,
    dataMov:     m.dataMov.toISOString(),
    aprovacaoStatus: m.aprovacaoStatus,
    operador:    m.usuario?.nome,
  }
}
