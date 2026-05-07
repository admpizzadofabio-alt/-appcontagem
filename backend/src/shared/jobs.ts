import { prisma } from '../config/prisma.js'
import { logger } from '../config/logger.js'
import { env } from '../config/env.js'
import { fecharTurnosAbertosCron } from '../modules/turnos/turnos.service.js'
import { importarPendente } from '../modules/colibri/colibri.service.js'

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

let ultimoFechamentoExecutado: string | null = null

async function checarFechamentoTurnos() {
  const agora = new Date()
  const horaAtual = agora.getHours()
  const hoje = agora.toISOString().slice(0, 10)

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

// Crons Colibri: 03:00, 12:00, 16:00 — usa o mesmo padrão "checa a cada N min" do fechamento de turnos.
const HORARIOS_COLIBRI = [3, 12, 16]
const ultimosCronsColibri = new Map<number, string>() // hora → diaJaExecutado (yyyy-MM-dd)

async function checarCronColibri() {
  if (!env.COLIBRI_CLIENT_ID) return // integração não configurada — silencioso

  const agora = new Date()
  const horaAtual = agora.getHours()
  const hoje = agora.toISOString().slice(0, 10)

  if (!HORARIOS_COLIBRI.includes(horaAtual)) return
  if (ultimosCronsColibri.get(horaAtual) === hoje) return

  try {
    // Cron usa um "operador-sistema" — Bar como local padrão
    // (mesma convenção dos demais módulos para Admin/Todos)
    const usuarioSistema = await prisma.usuario.findFirst({
      where: { nivelAcesso: 'Admin', ativo: true },
      orderBy: { criadoEm: 'asc' },
    })
    if (!usuarioSistema) {
      logger.warn('Cron Colibri: nenhum usuário Admin ativo encontrado, pulando')
      return
    }

    const resultado = await importarPendente({
      local: 'Bar',
      usuarioId: usuarioSistema.id,
      usuarioNome: `${usuarioSistema.nome} (cron ${String(horaAtual).padStart(2, '0')}:00)`,
    })

    ultimosCronsColibri.set(horaAtual, hoje)
    logger.info({ hora: horaAtual, resultado }, 'Cron Colibri executado')
  } catch (err) {
    logger.error({ err, hora: horaAtual }, 'Erro no cron Colibri')
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
  rodarLimpeza()
  setInterval(rodarLimpeza, 24 * 60 * 60 * 1000)

  // Fechar turnos órfãos ao iniciar
  fecharTurnosOrfaos().catch((err) => logger.error({ err }, 'Erro ao fechar órfãos'))

  // Fechamento automático: checa a cada 30 min
  checarFechamentoTurnos()
  setInterval(checarFechamentoTurnos, 30 * 60 * 1000)

  // Crons Colibri (03:00, 12:00, 16:00): checa a cada 15 min
  checarCronColibri()
  setInterval(checarCronColibri, 15 * 60 * 1000)
}
