import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const inicio = new Date('2026-05-16T00:00:00-03:00')
  const fim    = new Date('2026-05-18T23:59:59-03:00')

  // 1. Carga inicial do dia 16
  const cargas = await prisma.movimentacaoEstoque.findMany({
    where: {
      tipoMov: 'CargaInicial',
      dataMov: { gte: inicio, lte: new Date('2026-05-16T23:59:59-03:00') },
    },
    include: { produto: { select: { nomeBebida: true, unidadeMedida: true } } },
    orderBy: { dataMov: 'asc' },
  })

  console.log('\n=== CARGA INICIAL — 16/05/2026 ===')
  if (cargas.length === 0) {
    console.log('Nenhuma carga inicial registrada neste dia.')
  } else {
    for (const m of cargas) {
      console.log(`  ${m.dataMov.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} | ${m.produto.nomeBebida} | ${m.quantidade} ${m.produto.unidadeMedida} | local: ${m.localDestino ?? '-'}`)
    }
  }

  // 2. Todos os movimentos 16→18
  const movimentos = await prisma.movimentacaoEstoque.findMany({
    where: { dataMov: { gte: inicio, lte: fim } },
    include: {
      produto: { select: { nomeBebida: true, unidadeMedida: true } },
      usuario: { select: { nome: true } },
    },
    orderBy: { dataMov: 'asc' },
  })

  console.log(`\n=== MOVIMENTOS 16/05 → 18/05 (${movimentos.length} registros) ===`)
  for (const m of movimentos) {
    const data = m.dataMov.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const local = [m.localOrigem, m.localDestino].filter(Boolean).join('→') || '-'
    console.log(`  ${data} | ${m.tipoMov.padEnd(16)} | ${m.produto.nomeBebida.padEnd(30)} | ${m.quantidade} ${m.produto.unidadeMedida} | ${local} | ${m.usuario?.nome ?? 'sistema'}`)
  }

  // 3. Resumo por tipo
  console.log('\n=== RESUMO POR TIPO ===')
  const resumo = movimentos.reduce((acc, m) => {
    acc[m.tipoMov] = (acc[m.tipoMov] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
  for (const [tipo, qtd] of Object.entries(resumo)) {
    console.log(`  ${tipo}: ${qtd} registros`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
