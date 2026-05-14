/**
 * Restaura um backup gerado por backup.ts.
 * Uso: tsx prisma/restore.ts                    (último backup)
 *      tsx prisma/restore.ts backups/backup-X.json  (backup específico)
 *
 * Estratégia: upsert em tudo para ser idempotente.
 * Usuários canônicos (admin-master / operador-bar / operador-delivery) são ignorados
 * pois o seed já os recria com PINs corretos.
 */
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const prisma = new PrismaClient()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKUP_DIR = path.join(__dirname, '..', 'backups')

const SEED_USER_IDS = new Set(['admin-master', 'operador-bar', 'operador-delivery'])

function ultimoBackup(): string {
  const arquivos = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('backup-') && f.endsWith('.json'))
    .sort()
    .reverse()
  if (arquivos.length === 0) throw new Error('Nenhum backup encontrado em backups/')
  return path.join(BACKUP_DIR, arquivos[0])
}

async function restaurar(arquivo: string) {
  console.log('📂 Lendo backup:', arquivo)
  const raw = fs.readFileSync(arquivo, 'utf-8')
  const backup = JSON.parse(raw)
  const { dados, contagens, geradoEm } = backup

  console.log(`\n🗓️  Backup gerado em: ${geradoEm}`)
  console.log('📊 Itens no backup:')
  for (const [k, v] of Object.entries(contagens)) {
    console.log(`   ${k}: ${v}`)
  }
  console.log()

  // ── 1. Produtos (restaurar antes do estoque e mapeamentos) ──────────────────
  let produtosRestaurados = 0
  for (const p of dados.produtos) {
    await prisma.produto.upsert({
      where: { id: p.id },
      update: {
        nomeBebida: p.nomeBebida,
        categoria: p.categoria,
        unidadeMedida: p.unidadeMedida,
        volumePadrao: p.volumePadrao,
        custoUnitario: p.custoUnitario,
        estoqueMinimo: p.estoqueMinimo,
        perdaThreshold: p.perdaThreshold,
        setorPadrao: p.setorPadrao,
        revisadoAdmin: p.revisadoAdmin,
        ativo: p.ativo,
        imagem: p.imagem,
      },
      create: p,
    })
    produtosRestaurados++
  }
  console.log(`✅ Produtos restaurados: ${produtosRestaurados}`)

  // ── 2. Estoque Atual ────────────────────────────────────────────────────────
  let estoqueRestaurado = 0
  for (const e of dados.estoqueAtual) {
    await prisma.estoqueAtual.upsert({
      where: { produtoId_local: { produtoId: e.produtoId, local: e.local } },
      update: { quantidadeAtual: e.quantidadeAtual, atualizadoPor: e.atualizadoPor },
      create: {
        id: e.id,
        produtoId: e.produtoId,
        local: e.local,
        quantidadeAtual: e.quantidadeAtual,
        atualizadoPor: e.atualizadoPor,
      },
    })
    estoqueRestaurado++
  }
  console.log(`✅ Estoque restaurado: ${estoqueRestaurado} registros`)

  // ── 3. Catálogo Colibri ────────────────────────────────────────────────────
  let catalogoRestaurado = 0
  for (const c of dados.colibriCatalogo) {
    await prisma.colibriCatalogo.upsert({
      where: { colibriCode: c.colibriCode },
      update: { colibriNome: c.colibriNome, grupo: c.grupo, ativo: c.ativo },
      create: c,
    })
    catalogoRestaurado++
  }
  console.log(`✅ Catálogo Colibri restaurado: ${catalogoRestaurado} itens`)

  // ── 4. Mapeamentos Colibri → Produto ────────────────────────────────────────
  let mapeamentosRestaurados = 0
  for (const m of dados.colibriProduto) {
    // Só restaura se o produto existe (pode ter sido filtrado)
    const produtoExiste = await prisma.produto.findUnique({ where: { id: m.produtoId } })
    if (!produtoExiste) continue
    await prisma.colibriProduto.upsert({
      where: { colibriCode: m.colibriCode },
      update: { colibriNome: m.colibriNome, fatorConv: m.fatorConv, ativo: m.ativo },
      create: m,
    })
    mapeamentosRestaurados++
  }
  console.log(`✅ Mapeamentos Colibri restaurados: ${mapeamentosRestaurados}`)

  // ── 5. Usuários extras (não canônicos) ──────────────────────────────────────
  const usuariosExtras = dados.usuarios.filter((u: { id: string }) => !SEED_USER_IDS.has(u.id))
  console.log(`ℹ️  Usuários extras (sem PIN — precisarão de novo PIN): ${usuariosExtras.length}`)
  for (const u of usuariosExtras) {
    const existe = await prisma.usuario.findUnique({ where: { id: u.id } })
    if (!existe) {
      console.log(`   ⚠️  ${u.nome} (${u.setor}) — crie um novo PIN via Admin`)
    }
  }
}

export { restaurar, ultimoBackup }

// Execução direta: tsx prisma/restore.ts [arquivo]
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arquivoArg = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : ultimoBackup()

  restaurar(arquivoArg)
    .then(() => {
      console.log('\n🎉 Restore concluído com sucesso!')
      prisma.$disconnect()
    })
    .catch((err) => {
      console.error('\n❌ Falha no restore:', err.message)
      prisma.$disconnect()
      process.exit(1)
    })
}
