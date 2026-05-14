import { env } from '../config/env.js'
import { formatLocalDate } from './dateLocal.js'

/**
 * Calcula o dia operacional de uma data baseado no horário de início do turno.
 * Se o horário for menor que HORARIO_INICIO_TURNO, pertence ao dia anterior.
 * Ex: turno 17h-04h → 02h da terça pertence ao dia operacional segunda.
 *
 * Usa horário local Brasília (server pode ser UTC em produção).
 */
export function getDiaOperacional(data: Date = new Date()): string {
  // Pega hora local Brasília
  const horaBR = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false,
  }).format(data)
  const horaNum = parseInt(horaBR, 10)

  const d = new Date(data)
  if (horaNum < env.HORARIO_INICIO_TURNO) {
    d.setDate(d.getDate() - 1)
  }
  return formatLocalDate(d)
}

/**
 * Retorna a categoria de uma divergência baseada na regra:
 * leve = ≤ DIVERGENCIA_LEVE_UNIDADES OU ≤ DIVERGENCIA_LEVE_PERCENT% do esperado
 */
export function categorizarDivergencia(esperado: number, contado: number): 'ok' | 'leve' | 'grande' {
  const diff = Math.abs(contado - esperado)
  if (diff === 0) return 'ok'

  const limUnidades = env.DIVERGENCIA_LEVE_UNIDADES
  const limPercent = (env.DIVERGENCIA_LEVE_PERCENT / 100) * Math.abs(esperado)
  const limFinal = Math.max(limUnidades, limPercent)

  return diff <= limFinal ? 'leve' : 'grande'
}
