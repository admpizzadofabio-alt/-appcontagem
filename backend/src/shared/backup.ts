/**
 * Wrapper que importa as funções de backup. Existe pra contornar o tsconfig
 * rootDir=src — não pode importar prisma/backup.ts diretamente do código fonte.
 *
 * Em runtime o import dinâmico funciona porque é arquivo .ts compilado via tsx.
 */
import { logger } from '../config/logger.js'
import { prisma } from '../config/prisma.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKUP_DIR = path.join(__dirname, '..', '..', '..', 'backups')

export async function criarBackup(): Promise<string> {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })

  const [usuarios, produtos, estoqueAtual, colibriProduto, colibriCatalogo] = await Promise.all([
    prisma.usuario.findMany({
      select: { id: true, nome: true, setor: true, nivelAcesso: true, ativo: true, criadoEm: true },
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
      usuarios: usuarios.length, produtos: produtos.length,
      estoqueAtual: estoqueAtual.length,
      colibriProduto: colibriProduto.length, colibriCatalogo: colibriCatalogo.length,
    },
    dados: { usuarios, produtos, estoqueAtual, colibriProduto, colibriCatalogo },
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const arquivo = path.join(BACKUP_DIR, `backup-${ts}.json`)
  fs.writeFileSync(arquivo, JSON.stringify(backup, null, 2), 'utf-8')
  logger.info({ arquivo }, 'Backup criado')
  return arquivo
}

export function rotacionarBackups(diasRetencao = 30): number {
  if (!fs.existsSync(BACKUP_DIR)) return 0
  const limite = Date.now() - diasRetencao * 24 * 60 * 60 * 1000
  let apagados = 0
  for (const f of fs.readdirSync(BACKUP_DIR)) {
    if (!f.startsWith('backup-') || !f.endsWith('.json')) continue
    const full = path.join(BACKUP_DIR, f)
    if (fs.statSync(full).mtimeMs < limite) {
      fs.unlinkSync(full)
      apagados++
    }
  }
  return apagados
}
