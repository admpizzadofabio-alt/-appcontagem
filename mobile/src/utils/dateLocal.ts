/**
 * Helpers de data em timezone local do dispositivo (Brasília UTC-3).
 * Evita o bug clássico de `new Date().toISOString().slice(0, 10)` que devolve
 * data UTC — após 21h local Brasília a data já rolou pro dia seguinte UTC.
 */

/** Formata um Date como YYYY-MM-DD considerando timezone local. */
export function formatLocalDate(date: Date = new Date()): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** YYYY-MM-DD do dia anterior (timezone local). */
export function localOntem(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return formatLocalDate(d)
}
