/**
 * Sentry — error tracking em produção.
 * Setup: configurar SENTRY_DSN no .env (free tier sentry.io serve até 5k/mês).
 * Sem DSN, todas as funções viram no-op (zero overhead em dev).
 */
import * as Sentry from '@sentry/node'
import { env } from './env.js'
import { logger } from './logger.js'

let initialized = false

export function initSentry() {
  if (!env.SENTRY_DSN) {
    logger.info('Sentry: SENTRY_DSN não configurado — error tracking desativado')
    return
  }
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  })
  initialized = true
  logger.info({ env: env.NODE_ENV }, 'Sentry inicializado')
}

export function captureException(error: unknown, context?: Record<string, any>) {
  if (!initialized) return
  Sentry.captureException(error, context ? { extra: context } : undefined)
}

export function captureMessage(msg: string, level: 'info' | 'warning' | 'error' = 'info') {
  if (!initialized) return
  Sentry.captureMessage(msg, level)
}

export { Sentry }
