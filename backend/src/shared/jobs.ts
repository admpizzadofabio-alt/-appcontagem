import { prisma } from '../config/prisma.js'
import { logger } from '../config/logger.js'
import { env } from '../config/env.js'
import { fecharTurnosAbertosCron } from '../modules/turnos/turnos.service.js'
import { importarPendente, sincronizarCatalogo, recuperarColibriStartup } from '../modules/colibri/colibri.service.js'
import { formatLocalDate, localOntem, parseLocalDate } from './dateLocal.js'
import { criarBackup, rotacionarBackups } from './backup.js'
import { enviarAlerta } from './alertWebhook.js'
import { limparFotosAntigas } from './retencaoFotos.js'

async function limparTokensExpirados() {
  const { count } = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  if (count > 0) logger.info({ count }, 'Refresh tokens expirados removidos')
}

async function desbloquearUsuarios() {
  const { count } = await prisma.usuario.updateMany({
    where: { bloqueadoAte: { lt: new Date() } },
    data: { bloqueadoAte: null, loginAttempts: 0 },
  })
  if (count > 0) logger.info({ count }, 'Usuários desbloqueados automaticamente')
}

let ultimaSincCatalogo: string | null = null

async function checarSincCatalogo() {
  if (!env.COLIBRI_CLIENT_ID) return
  const agora = new Date()
  const hoje = formatLocalDate(agora)
  if (agora.getHours() !== 4) return
  if (ultimaSincCatalogo === hoje) return
  try {
    const res = await sincronizarCatalogo()
    ultimaSincCatalogo = hoje
    if (res.novos > 0) logger.info({ novos: res.novos }, 'Catálogo Colibri: novos produtos detectados')
  } catch (err) {
    logger.error({ err }, 'Erro ao sincronizar catálogo Colibri (cron)')
  }
}

let ultimoFechamentoExecutado: string | null = null

async function checarFechamentoTurnos() {
  const agora = new Date()
  const horaAtual = agora.getHours()
  const hoje = formatLocalDate(agora)

  // Roda apenas uma vez por dia, na hora configurada
  if (horaAtual !== env.HORARIO_FECHAMENTO_AUTO) return
  if (ultimoFechamentoExecutado === hoje) return

  try {
    const total = await fecharTurnosAbertosCron()
    ultimoFechamentoExecutado = hoje
    if (total > 0) logger.info({ total }, 'Turnos fechados automaticamente')
  } catch (err) {
    logger.error({ err }, 'Erro ao fechar turnos automaticamente')
  }
}

// Crons Colibri: 04h fecha a noite. 06/07/08h dão 3 tentativas antes do admin
// começar às 9h (Colibri pode demorar a processar a noite). 10/12/14/16h cobrem o dia
// para o operador ver dados frescos antes da contagem do turno noturno.
const HORARIOS_COLIBRI = [4, 6, 7, 8, 10, 12, 14, 16]
const ultimosCronsColibri = new Map<number, string>() // hora → diaJaExecutado (yyyy-MM-dd)

async function checarCronColibri() {
  if (!env.COLIBRI_CLIENT_ID) return // integração não configurada — silencioso

  const agora = new Date()
  const horaAtual = agora.getHours()
  const hoje = formatLocalDate(agora)

  if (!HORARIOS_COLIBRI.includes(horaAtual)) return
  if (ultimosCronsColibri.get(horaAtual) === hoje) return

  try {
    // Cron usa um "operador-sistema" — Bar como local padrão
    // (mesma convenção dos demais módulos para Admin/Todos)
    // ID fixo criado na seed — FK válida sem poluir histórico de Admin real
    const usuarioSistema = await prisma.usuario.findUnique({ where: { id: 'system-cron' } })
      ?? await prisma.usuario.findFirst({ where: { nivelAcesso: 'Admin', ativo: true }, orderBy: { criadoEm: 'asc' } })
    if (!usuarioSistema) {
      logger.warn('Cron Colibri: usuário de sistema não encontrado, pulando')
      return
    }

    const resultado = await importarPendente({
      local: 'Bar',
      usuarioId: usuarioSistema.id,
      usuarioNome: `SISTEMA/cron (${String(horaAtual).padStart(2, '0')}:00)`,
    })

    ultimosCronsColibri.set(horaAtual, hoje)
    logger.info({ hora: horaAtual, resultado }, 'Cron Colibri executado')
  } catch (err) {
    logger.error({ err, hora: horaAtual }, 'Erro no cron Colibri')
  }
}

// Rotação de LogAuditoria: apaga registros > 180 dias às 01h
// Backup de 90 dias garante cópia antes da remoção (janela de backup < janela de retenção de log)
let ultimaRotacaoLogs: string | null = null
async function checarRotacaoLogs() {
  const agora = new Date()
  const hora = agora.getHours()
  const hoje = formatLocalDate(agora)
  if (hora !== 1) return
  if (ultimaRotacaoLogs === hoje) return
  try {
    const corte = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
    const { count } = await prisma.logAuditoria.deleteMany({
      where: { dataEvento: { lt: corte } },
    })
    ultimaRotacaoLogs = hoje
    if (count > 0) logger.info({ count, corte }, 'LogAuditoria: registros antigos removidos')
  } catch (err) {
    logger.error({ err }, 'Erro na rotação de logs de auditoria')
  }
}

// Retenção de fotos: roda 1x/dia às 03h, apaga fotos de movs/contagens > 90 dias
let ultimaRetencao: string | null = null
async function checarRetencaoFotos() {
  const agora = new Date()
  const hora = agora.getHours()
  const hoje = formatLocalDate(agora)
  if (hora !== 3) return
  if (ultimaRetencao === hoje) return
  try {
    const total = await limparFotosAntigas()
    ultimaRetencao = hoje
    if (total > 0) logger.info({ total }, 'Retenção: fotos antigas removidas')
  } catch (err) {
    logger.error({ err }, 'Erro retenção de fotos')
  }
}

// Backup 4x/dia às 02h, 08h, 14h, 20h — envia ao Drive e rotaciona >30 dias locais
const HORARIOS_BACKUP = [2, 8, 14, 20]
const ultimosBackups = new Map<number, string>() // hora → diaJaExecutado
async function checarBackup() {
  const agora = new Date()
  const horaAtual = agora.getHours()
  const hoje = formatLocalDate(agora)

  if (!HORARIOS_BACKUP.includes(horaAtual)) return
  if (ultimosBackups.get(horaAtual) === hoje) return

  try {
    const arquivo = await criarBackup()
    const apagados = rotacionarBackups(30)
    ultimosBackups.set(horaAtual, hoje)
    logger.info({ arquivo, apagados, hora: horaAtual }, 'Backup criado e enviado ao Drive')
  } catch (err) {
    logger.error({ err }, 'Erro no backup agendado')
  }
}

// Monitor Colibri: alerta via webhook (durante horário ativo)
let ultimoAlertaColibri = 0
const ALERTA_COLIBRI_THROTTLE_MS = 4 * 60 * 60 * 1000 // re-alerta no máx a cada 4h
async function checarSaudeColibri() {
  if (!env.COLIBRI_CLIENT_ID || !env.ALERTA_WEBHOOK_URL) return
  const agora = new Date()
  const hora = agora.getHours()
  // Só alerta entre 06h e 23h (não acordar admin de madrugada)
  if (hora < 6 || hora > 23) return
  if (Date.now() - ultimoAlertaColibri < ALERTA_COLIBRI_THROTTLE_MS) return

  // Check 1: sem importação há >2h (cron parou de rodar / backend offline)
  const ultima = await prisma.colibriImportacao.findFirst({
    where: { status: { in: ['ok', 'parcial'] } },
    orderBy: { importadoEm: 'desc' },
    select: { importadoEm: true },
  })

  if (ultima) {
    const horasDesde = (Date.now() - ultima.importadoEm.getTime()) / (1000 * 60 * 60)
    if (horasDesde >= 2) {
      await enviarAlerta(
        `⚠️ APPCONTAGEM — Colibri sem importar há ${Math.floor(horasDesde)}h. ` +
        `Última: ${ultima.importadoEm.toISOString()}. Verifique conectividade e tokens.`,
      )
      ultimoAlertaColibri = Date.now()
      logger.warn({ horasDesde }, 'Alerta Colibri offline enviado')
      return
    }
  }

  // Check 2: ontem com 0 vendas (PDV local não está sincronizando com cloud)
  // Roda só a partir das 10h — antes disso, crons da manhã ainda podem estar processando
  if (hora < 10) return

  const ontemStr = localOntem()
  const ontemInicio = parseLocalDate(ontemStr, '00:00:00')
  const ontemFim = parseLocalDate(ontemStr, '23:59:59')

  const totalVendasOntem = await prisma.movimentacaoEstoque.count({
    where: {
      tipoMov: 'Saida',
      referenciaOrigem: { startsWith: 'colibri:' },
      dataMov: { gte: ontemInicio, lte: ontemFim },
    },
  })

  if (totalVendasOntem === 0) {
    await enviarAlerta(
      `⚠️ APPCONTAGEM — Nenhuma venda do Colibri registrada para ontem (${ontemStr}). ` +
      `Verifique se o PDV da pizzaria está sincronizando com o Colibri Cloud.`,
    )
    ultimoAlertaColibri = Date.now()
    logger.warn({ ontemStr }, 'Alerta: 0 vendas Colibri no dia anterior')
  }
}

async function fecharTurnosOrfaos() {
  // Ao iniciar o servidor, fecha turnos abertos há mais de 24h (caso servidor tenha ficado offline)
  const limite = new Date()
  limite.setHours(limite.getHours() - 24)

  const orfaos = await prisma.fechamentoTurno.findMany({
    where: { status: 'Aberto', abertoEm: { lt: limite } },
  })

  for (const t of orfaos) {
    await prisma.fechamentoTurno.update({
      where: { id: t.id },
      data: {
        status: 'Fechado',
        fechadoEm: new Date(),
        fechadoAutomatico: true,
        fechadoSemContagem: true,
      },
    })
    logger.warn({ id: t.id, local: t.local }, 'Turno órfão fechado na inicialização')
  }
}

export function iniciarJobs() {
  // Limpeza de tokens e desbloqueios
  const rodarLimpeza = async () => {
    try {
      await limparTokensExpirados()
      await desbloquearUsuarios()
    } catch (err) {
      logger.error({ err }, 'Erro nos jobs de limpeza')
    }
  }
  void rodarLimpeza()
  setInterval(rodarLimpeza, 6 * 60 * 60 * 1000)

  // Fechar turnos órfãos ao iniciar
  fecharTurnosOrfaos().catch((err) => logger.error({ err }, 'Erro ao fechar órfãos'))

  // Recuperação Colibri após backend offline (gap >6h dispara import de 7 dias)
  recuperarColibriStartup()
    .then((res) => { if (res) logger.warn({ res }, 'Recuperação Colibri startup executada') })
    .catch((err) => logger.error({ err }, 'Erro na recuperação Colibri startup'))

  // Fechamento automático: checa a cada 30 min
  void checarFechamentoTurnos()
  setInterval(checarFechamentoTurnos, 30 * 60 * 1000)

  // Crons Colibri (03:00, 12:00, 16:00): checa a cada 15 min
  void checarCronColibri()
  setInterval(checarCronColibri, 15 * 60 * 1000)

  // Sync catálogo Colibri: 04:00 — detecta produtos novos para o badge
  void checarSincCatalogo()
  setInterval(checarSincCatalogo, 30 * 60 * 1000)

  // Backup 4x/dia: 02h, 08h, 14h, 20h
  void checarBackup()
  setInterval(checarBackup, 30 * 60 * 1000)

  // Monitor saúde Colibri: checa a cada 30min, alerta se >2h sem importar (com throttle 4h)
  void checarSaudeColibri()
  setInterval(checarSaudeColibri, 30 * 60 * 1000)

  // Rotação de logs: apaga LogAuditoria > 180 dias às 01h
  void checarRotacaoLogs()
  setInterval(checarRotacaoLogs, 30 * 60 * 1000)

  // Retenção de fotos: roda diariamente às 03h
  void checarRetencaoFotos()
  setInterval(checarRetencaoFotos, 30 * 60 * 1000)
}
