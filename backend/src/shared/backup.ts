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
import { Readable } from 'stream'
import { google } from 'googleapis'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKUP_DIR = path.join(__dirname, '..', '..', '..', 'backups')

async function uploadarParaDrive(arquivoPath: string, nomeArquivo: string): Promise<void> {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  const folderId     = process.env.GOOGLE_DRIVE_FOLDER_ID
  if (!clientId || !clientSecret || !refreshToken || !folderId) return

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost:8080')
  oauth2.setCredentials({ refresh_token: refreshToken })
  const drive = google.drive({ version: 'v3', auth: oauth2 })
  const conteudo = fs.readFileSync(arquivoPath, 'utf-8')
  await drive.files.create({
    requestBody: { name: nomeArquivo, parents: [folderId], mimeType: 'application/json' },
    media: { mimeType: 'application/json', body: Readable.from([conteudo]) },
  })
}

export async function criarBackup(): Promise<string> {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })

  // Janela de 90 dias para movimentações e logs — equilíbrio entre tamanho e rastreabilidade
  const noventaDiasAtras = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  const [
    usuarios, produtos, estoqueAtual, colibriProduto, colibriCatalogo,
    movimentacoes, contagens, fechamentosTurnos, logAuditoria, pedidos,
  ] = await Promise.all([
    prisma.usuario.findMany({
      select: { id: true, nome: true, setor: true, nivelAcesso: true, ativo: true, criadoEm: true },
    }),
    prisma.produto.findMany(),
    prisma.estoqueAtual.findMany(),
    prisma.colibriProduto.findMany(),
    prisma.colibriCatalogo.findMany(),
    // Movimentações: últimos 90 dias (histórico contábil crítico)
    prisma.movimentacaoEstoque.findMany({
      where: { dataMov: { gte: noventaDiasAtras } },
      orderBy: { dataMov: 'asc' },
    }),
    // Contagens: últimas 90 dias com itens
    prisma.contagemEstoque.findMany({
      where: { dataContagem: { gte: noventaDiasAtras } },
      include: { itens: true },
    }),
    // Turnos: últimos 90 dias
    prisma.fechamentoTurno.findMany({
      where: { abertoEm: { gte: noventaDiasAtras } },
    }),
    // Logs de auditoria: últimos 90 dias
    prisma.logAuditoria.findMany({
      where: { dataEvento: { gte: noventaDiasAtras } },
      orderBy: { dataEvento: 'asc' },
    }),
    // Pedidos de compra
    prisma.pedidoCompra.findMany({
      where: { dataPedido: { gte: noventaDiasAtras } },
    }),
  ])

  const backup = {
    versao: '2.0',
    geradoEm: new Date().toISOString(),
    janela: { inicio: noventaDiasAtras.toISOString(), fim: new Date().toISOString() },
    contagens: {
      usuarios: usuarios.length, produtos: produtos.length,
      estoqueAtual: estoqueAtual.length,
      colibriProduto: colibriProduto.length, colibriCatalogo: colibriCatalogo.length,
      movimentacoes: movimentacoes.length, contagens: contagens.length,
      fechamentosTurnos: fechamentosTurnos.length, logAuditoria: logAuditoria.length,
      pedidos: pedidos.length,
    },
    dados: {
      usuarios, produtos, estoqueAtual, colibriProduto, colibriCatalogo,
      movimentacoes, contagens, fechamentosTurnos, logAuditoria, pedidos,
    },
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const arquivo = path.join(BACKUP_DIR, `backup-${ts}.json`)
  fs.writeFileSync(arquivo, JSON.stringify(backup, null, 2), 'utf-8')
  fs.chmodSync(arquivo, 0o600)
  logger.info({ arquivo, contagens: backup.contagens }, 'Backup criado')

  try {
    await uploadarParaDrive(arquivo, path.basename(arquivo))
    logger.info({ arquivo }, 'Backup enviado ao Google Drive')
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Drive upload falhou (backup local preservado)')
  }

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
