// Fechas locales de Ciudad de México. Las fechas se manejan como cadenas
// `YYYY-MM-DD` y los meses como `YYYY-MM`.

export const TIME_ZONE = 'America/Mexico_City'

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]
const MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Fecha local (YYYY-MM-DD) de un instante, en la zona de Ciudad de México. */
export function localDate(instant: Date): string {
  const parts = formatter.formatToParts(instant)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function isValidDate(date: string): boolean {
  const m = DATE_RE.exec(date)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d, 12))
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d
  )
}

export function monthKey(date: string): string {
  return date.slice(0, 7)
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  const ny = Math.floor(total / 12)
  const nm = (((total % 12) + 12) % 12) + 1
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}`
}

/** Días posteriores a `date` hasta el fin de mes (0 el último día). */
export function daysLeftInMonth(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  // Día 0 del mes siguiente = último día de este mes (UTC a mediodía).
  const last = new Date(Date.UTC(y, m, 0, 12)).getUTCDate()
  return last - d
}

export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const nombre = MESES[m - 1]
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${y}`
}

function addDays(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + delta, 12))
  return dt.toISOString().slice(0, 10)
}

export function formatDayLabel(date: string, today: string): string {
  if (date === today) return 'Hoy'
  const [y, m, d] = date.split('-').map(Number)
  const dia = `${d} ${MESES_CORTOS[m - 1]}`
  if (date === addDays(today, -1)) return `Ayer · ${dia}`
  const weekday = DIAS_CORTOS[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()]
  const base = `${weekday} ${dia}`
  return y === Number(today.slice(0, 4)) ? base : `${base} ${y}`
}

const shortDateFormat = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/** "5 mar 2027" a partir de YYYY-MM-DD. */
export function formatShortDate(date: string): string {
  return shortDateFormat.format(new Date(`${date}T00:00:00Z`))
}
