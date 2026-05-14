/**
 * Exporta dados críticos do banco para um arquivo JSON em backups/.
 * Preserva: usuarios, produtos, estoque atual, mapeamentos Colibri, catálogo Colibri.
 * PINs dos usuários NÃO são exportados (hash irreversível; seed recria os canônicos).
 */
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const prisma = new PrismaClient()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKUP_DIR = path.join(__dirname, '..', 'backups')

export async function criarBackup(): Promise<string> {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })

  const [usuarios, produtos, estoqueAtual, colibriProduto, colibriCatalogo] = await Promise.all([
    prisma.usuario.findMany({
      select: {
        id: true, nome: true, setor: true, nivelAcesso: true,
        ativo: true, criadoEm: true,
        // PIN omitido intencionalmente — hash argon2id não é portável sem re-hash
      },
    }),
    prisma.produto.findMany(),
    prisma.estoqueAtual.findMany(),
    prisma.colibriProduto.findMany(),
    prisma.colibriCatalogo.findMany(),
  ])

  const backup = {
    versao: '1.0',
    geradoEm: new Date().toISOString(),
    contagens: {
      usuarios: usuarios.length,
      produtos: produtos.length,
      estoqueAtual: estoqueAtual.length,
      colibriProduto: colibriProduto.length,
      colibriCatalogo: colibriCatalogo.length,
    },
    dados: { usuarios, produtos, estoqueAtual, colibriProduto, colibriCatalogo },
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const arquivo = path.join(BACKUP_DIR, `backup-${ts}.json`)
  fs.writeFileSync(arquivo, JSON.stringify(backup, null, 2), 'utf-8')

  return arquivo
}

/**
 * Apaga backups com mais de N dias (retenção). Default 30 dias.
 */
export function rotacionarBackups(diasRetencao = 30): number {
  if (!fs.existsSync(BACKUP_DIR)) return 0
  const limite = Date.now() - diasRetencao * 24 * 60 * 60 * 1000
  let apagados = 0
  for (const f of fs.readdirSync(BACKUP_DIR)) {
    if (!f.startsWith('backup-') || !f.endsWith('.json')) continue
    const full = path.join(BACKUP_DIR, f)
    const stat = fs.statSync(full)
    if (stat.mtimeMs < limite) {
      fs.unlinkSync(full)
      apagados++
    }
  }
  return apagados
}

// Execução direta: tsx prisma/backup.ts
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  criarBackup()
    .then((arquivo) => {
      console.log('✅ Backup criado:', arquivo)
      prisma.$disconnect()
    })
    .catch((err) => {
      console.error('❌ Falha no backup:', err)
      prisma.$disconnect()
      process.exit(1)
    })
}
