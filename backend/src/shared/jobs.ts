import { prisma } from '../config/prisma.js'
import { logger } from '../config/logger.js'
import { env } from '../config/env.js'
import { fecharTurnosAbertosCron } from '../modules/turnos/turnos.service.js'

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
}
