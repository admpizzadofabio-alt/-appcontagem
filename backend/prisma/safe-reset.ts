/**
 * Substituto seguro para `prisma db push --force-reset`.
 *
 * Fluxo:
 *   1. Faz backup automático de todos os dados críticos
 *   2. Exibe resumo e exige confirmação digitada ("CONFIRMAR")
 *   3. Executa force-reset + seed
 *   4. Restaura automaticamente produtos, estoque e mapeamentos Colibri
 *
 * Uso: tsx prisma/safe-reset.ts
 */
import { execSync } from 'child_process'
import readline from 'readline'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function perguntar(pergunta: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(pergunta, (ans) => { rl.close(); resolve(ans.trim()) }))
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║          SAFE RESET — APPCONTAGEM BACKEND            ║')
  console.log('╚══════════════════════════════════════════════════════╝\n')

  // ── 1. Backup ───────────────────────────────────────────────────────────────
  console.log('🔒 Etapa 1/4 — Criando backup antes de qualquer alteração...\n')
  const { criarBackup } = await import('./backup.js')
  let arquivoBackup: string
  try {
    arquivoBackup = await criarBackup()
    console.log('✅ Backup salvo em:', arquivoBackup, '\n')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('❌ BACKUP FALHOU — reset abortado por segurança.')
    console.error('   Erro:', msg)
    process.exit(1)
  }

  // ── 2. Confirmação ─────────────────────────────────────────────────────────
  console.log('⚠️  ATENÇÃO: O force-reset apaga TODOS os dados do banco.')
  console.log('   Os dados foram salvos em:', arquivoBackup)
  console.log('   Produtos, estoque e mapeamentos Colibri serão restaurados automaticamente.')
  console.log('   PINs personalizados de usuários extras precisarão ser recriados.\n')

  const resposta = await perguntar('   Digite CONFIRMAR para prosseguir (qualquer outra coisa cancela): ')

  if (resposta !== 'CONFIRMAR') {
    console.log('\n🚫 Reset cancelado. Nenhum dado foi alterado.')
    console.log('   Backup preservado em:', arquivoBackup)
    process.exit(0)
  }

  // ── 3. Force-reset + seed ──────────────────────────────────────────────────
  console.log('\n🔄 Etapa 2/4 — Executando force-reset...')
  try {
    execSync('npx prisma db push --force-reset', { stdio: 'inherit', cwd: path.join(__dirname, '..') })
    console.log('✅ Force-reset concluído\n')
  } catch {
    console.error('❌ Force-reset falhou. Seus dados originais estão em:', arquivoBackup)
    process.exit(1)
  }

  console.log('🌱 Etapa 3/4 — Rodando seed (usuários canônicos)...')
  try {
    execSync('npx tsx prisma/seed.ts', { stdio: 'inherit', cwd: path.join(__dirname, '..') })
    console.log('✅ Seed concluído\n')
  } catch {
    console.error('❌ Seed falhou. Restaure manualmente com: npm run prisma:restore')
    process.exit(1)
  }

  // ── 4. Restore ─────────────────────────────────────────────────────────────
  console.log('♻️  Etapa 4/4 — Restaurando dados (produtos, estoque, Colibri)...\n')
  try {
    const { restaurar } = await import('./restore.js')
    await restaurar(arquivoBackup)
    console.log('\n🎉 Restore concluído com sucesso!')
  } catch {
    console.log('\n⚠️  Restauração automática falhou. Rode manualmente:')
    console.log('   npm run prisma:restore', arquivoBackup)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Erro inesperado:', err)
  process.exit(1)
})
