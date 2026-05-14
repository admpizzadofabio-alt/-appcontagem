/**
 * Export de relatórios em CSV (Excel abre nativo).
 * Para PDF, recomendo usar serviço externo (puppeteer pesado) ou implementação cliente.
 */
import { prisma } from '../../config/prisma.js'
import { parseLocalDate } from '../../shared/dateLocal.js'

function csvEscape(v: any): string {
  if (v == null) return ''
  const s = String(v)
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function toCsv(rows: any[][]): string {
  return rows.map((r) => r.map(csvEscape).join(';')).join('\n')
}

export async function exportMovimentacoes(dataInicio: string, dataFim: string): Promise<string> {
  const inicio = parseLocalDate(dataInicio, '00:00:00')
  const fim = parseLocalDate(dataFim, '23:59:59')
  const movs = await prisma.movimentacaoEstoque.findMany({
    where: { dataMov: { gte: inicio, lte: fim } },
    orderBy: { dataMov: 'asc' },
    include: { produto: { select: { nomeBebida: true, unidadeMedida: true } }, usuario: { select: { nome: true } } },
  })
  const header = ['Data', 'Produto', 'Unidade', 'Tipo', 'Quantidade', 'Origem', 'Destino', 'Usuário', 'Observação', 'Ref']
  const rows: any[][] = [header]
  for (const m of movs) {
    rows.push([
      m.dataMov.toISOString(),
      m.produto.nomeBebida,
      m.produto.unidadeMedida,
      m.tipoMov,
      m.quantidade,
      m.localOrigem ?? '',
      m.localDestino ?? '',
      m.usuario.nome,
      m.observacao ?? '',
      m.referenciaOrigem ?? '',
    ])
  }
  return toCsv(rows)
}

export async function exportEstoqueAtual(): Promise<string> {
  const itens = await prisma.estoqueAtual.findMany({
    include: { produto: { select: { nomeBebida: true, categoria: true, unidadeMedida: true, custoUnitario: true, estoqueMinimo: true } } },
    orderBy: [{ produto: { nomeBebida: 'asc' } }, { local: 'asc' }],
  })
  const header = ['Produto', 'Categoria', 'Local', 'Quantidade', 'Unidade', 'Custo Unit.', 'Valor Total', 'Mínimo', 'Atualizado']
  const rows: any[][] = [header]
  for (const i of itens) {
    rows.push([
      i.produto.nomeBebida,
      i.produto.categoria,
      i.local,
      i.quantidadeAtual,
      i.produto.unidadeMedida,
      i.produto.custoUnitario,
      Math.round(i.quantidadeAtual * i.produto.custoUnitario * 100) / 100,
      i.produto.estoqueMinimo,
      i.atualizadoEm.toISOString(),
    ])
  }
  return toCsv(rows)
}

export async function exportContagens(dataInicio: string, dataFim: string): Promise<string> {
  const inicio = parseLocalDate(dataInicio, '00:00:00')
  const fim = parseLocalDate(dataFim, '23:59:59')
  const itens = await prisma.itemContagem.findMany({
    where: { contagem: { dataFechamento: { gte: inicio, lte: fim } } },
    include: {
      produto: { select: { nomeBebida: true, unidadeMedida: true } },
      contagem: { select: { local: true, diaOperacional: true, dataFechamento: true } },
    },
    orderBy: { contagem: { dataFechamento: 'desc' } },
  })
  const header = ['Dia Op.', 'Fechado em', 'Local', 'Produto', 'Sistema', 'Contado', 'Diferença', 'Categoria', 'Justificativa']
  const rows: any[][] = [header]
  for (const i of itens) {
    rows.push([
      i.contagem.diaOperacional ?? '',
      i.contagem.dataFechamento?.toISOString() ?? '',
      i.contagem.local,
      i.produto.nomeBebida,
      i.quantidadeSistema,
      i.quantidadeContada,
      i.diferenca,
      i.divergenciaCategoria ?? '',
      i.justificativa ?? '',
    ])
  }
  return toCsv(rows)
}
