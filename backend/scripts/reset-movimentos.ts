/**
 * Reset cirúrgico: apaga histórico de movimentações e operações,
 * mas mantém cadastros (Usuários, Produtos, Mapeamentos Colibri).
 *
 * Após rodar: usuários precisam fazer NOVA carga inicial em cada produto.
 *
 * Uso: npx tsx scripts/reset-movimentos.ts --confirm
 */
import { prisma } from '../src/config/prisma.js'

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.log('⚠️  Este script APAGA todo o histórico de movimentações.')
    console.log('   Mantém: Usuários, Produtos (cadastro), Mapeamentos Colibri, Catálogo')
    console.log('   Apaga:  Movimentações, Estoques, Turnos, Contagens, Imports, Logs, Pedidos')
    console.log('   Reseta: produto.marcoInicialEm = null (exige nova carga inicial)')
    console.log('')
    console.log('Para executar de verdade, rode com --confirm')
    process.exit(0)
  }

  console.log('🗑️  Iniciando reset...')

  await prisma.$transaction(async (tx) => {
    // Ordem importante (foreign keys)
    const r1 = await tx.itemContagem.deleteMany()
    console.log(`  ItemContagem:           ${r1.count}`)

    const r2 = await tx.entradaRascunho.deleteMany()
    console.log(`  EntradaRascunho:        ${r2.count}`)

    const r3 = await tx.contagemEstoque.deleteMany()
    console.log(`  ContagemEstoque:        ${r3.count}`)

    const r4 = await tx.aprovacaoMovimentacao.deleteMany()
    console.log(`  AprovacaoMovimentacao:  ${r4.count}`)

    const r5 = await tx.movimentacaoEstoque.deleteMany()
    console.log(`  MovimentacaoEstoque:    ${r5.count}`)

    const r6 = await tx.estoqueAtual.deleteMany()
    console.log(`  EstoqueAtual:           ${r6.count}`)

    const r7 = await tx.fechamentoTurno.deleteMany()
    console.log(`  FechamentoTurno:        ${r7.count}`)

    const r8 = await tx.colibriImportacao.deleteMany()
    console.log(`  ColibriImportacao:      ${r8.count}`)

    const r9 = await tx.correcaoVenda.deleteMany()
    console.log(`  CorrecaoVenda:          ${r9.count}`)

    const r10 = await tx.pedidoCompra.deleteMany()
    console.log(`  PedidoCompra:           ${r10.count}`)

    const r11 = await tx.logAuditoria.deleteMany()
    console.log(`  LogAuditoria:           ${r11.count}`)

    const r12 = await tx.produto.updateMany({ data: { marcoInicialEm: null } })
    console.log(`  Produtos reset marco:   ${r12.count}`)
  })

  // Sanity check — mostra o que sobrou
  const counts = {
    usuarios: await prisma.usuario.count(),
    produtos: await prisma.produto.count(),
    mapeamentos: await prisma.colibriProduto.count(),
    catalogo: await prisma.colibriCatalogo.count(),
  }
  console.log('\n✅ Reset concluído. Mantidos:')
  console.log(`  Usuários:        ${counts.usuarios}`)
  console.log(`  Produtos:        ${counts.produtos}`)
  console.log(`  Mapeamentos:     ${counts.mapeamentos}`)
  console.log(`  Catálogo Colibri: ${counts.catalogo}`)

  await prisma.$disconnect()
}

main().catch((e) => { console.error('❌ Erro:', e); process.exit(1) })
