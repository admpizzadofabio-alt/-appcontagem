/**
 * Helpers de data em timezone local Brasília (America/Sao_Paulo, UTC-3).
 * Evita o bug clássico de `new Date().toISOString().slice(0, 10)` que devolve
 * data UTC — após 21h local Brasília a data já rolou pro dia seguinte UTC.
 */

const TZ = 'America/Sao_Paulo'

/**
 * Formata um Date como YYYY-MM-DD considerando timezone Brasília.
 * Ex: 2026-05-13T23:30:00Z (BRT 20:30) → '2026-05-13'
 *     2026-05-14T01:00:00Z (BRT 22:00 do dia 13) → '2026-05-13'
 */
export function formatLocalDate(date: Date = new Date()): string {
  // pt-BR retorna dd/MM/yyyy. Reorganiza para yyyy-MM-dd.
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** YYYY-MM-DD do dia anterior (timezone Brasília). */
export function localOntem(date: Date = new Date()): string {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() - 1)
  return formatLocalDate(d)
}

/**
 * Constrói um Date a partir de YYYY-MM-DD assumindo timezone Brasília.
 * Ex: '2026-05-13' + '00:00:00' → 2026-05-13T03:00:00Z (BRT 00:00 = UTC 03:00)
 */
export function parseLocalDate(yyyymmdd: string, hms: '00:00:00' | '23:59:59' = '00:00:00'): Date {
  return new Date(`${yyyymmdd}T${hms}-03:00`)
}
