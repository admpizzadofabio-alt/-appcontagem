/**
 * Envia alerta para webhook configurado em ALERTA_WEBHOOK_URL.
 * Suporta formato Discord/Slack (string `content`) e Telegram Bot API.
 *
 * Discord/Slack webhook: cole URL completa do webhook → ALERTA_WEBHOOK_URL=https://discord.com/api/webhooks/...
 * Telegram: ALERTA_WEBHOOK_URL=https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>&text=
 */
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'

const ALLOWED_WEBHOOK_HOSTS = ['discord.com', 'slack.com', 'api.telegram.org']

export async function enviarAlerta(mensagem: string) {
  const url = env.ALERTA_WEBHOOK_URL
  if (!url) return

  try {
    const parsed = new URL(url)
    if (!ALLOWED_WEBHOOK_HOSTS.some(h => parsed.hostname.endsWith(h))) {
      logger.warn({ host: parsed.hostname }, 'Webhook URL não permitida — alerta ignorado')
      return
    }
  } catch {
    logger.warn({ url }, 'ALERTA_WEBHOOK_URL inválida — alerta ignorado')
    return
  }

  try {
    if (url.includes('discord.com') || url.includes('slack.com')) {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: mensagem }),
      })
    } else if (url.includes('api.telegram.org')) {
      // Espera URL com chat_id e text= já no template; só anexa a mensagem
      await fetch(`${url}${encodeURIComponent(mensagem)}`, { method: 'GET' })
    } else {
      // Fallback: POST JSON genérico
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: mensagem, timestamp: new Date().toISOString() }),
      })
    }
  } catch (err) {
    logger.error({ err, url }, 'Falha ao enviar alerta webhook')
  }
}
