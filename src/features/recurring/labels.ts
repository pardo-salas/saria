import type { Frequency, RecurringPayment } from '@/db/schema'

export const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Diario' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Cada 2 semanas' },
  { value: 'semimonthly', label: 'Quincenal (dos días)' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'yearly', label: 'Anual' },
  { value: 'custom', label: 'Cada N días' },
]

export function describeFrequency(p: RecurringPayment): string {
  switch (p.frequency) {
    case 'daily':
      return 'Diario'
    case 'weekly':
      return 'Semanal'
    case 'biweekly':
      return 'Cada 2 semanas'
    case 'semimonthly':
      return `Días ${p.day_of_month ?? '?'} y ${p.second_day_of_month ?? '?'}`
    case 'monthly':
      return `Mensual, día ${p.day_of_month ?? '?'}`
    case 'yearly':
      return 'Anual'
    case 'custom':
      return `Cada ${p.interval_days ?? '?'} días`
  }
}

const MS_DIA = 86_400_000
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES = [
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

function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y!, m! - 1, d!) / MS_DIA
}

/** Suma `delta` días a una fecha `YYYY-MM-DD`. */
export function shiftDay(date: string, delta: number): string {
  return new Date((dayNumber(date) + delta) * MS_DIA).toISOString().slice(0, 10)
}

/** "vencido hace 2 días", "hoy", "mañana", "jue 27 nov". */
export function dueLabel(date: string, today: string): string {
  const diff = dayNumber(date) - dayNumber(today)
  if (diff === 0) return 'hoy'
  if (diff === -1) return 'vencido ayer'
  if (diff < 0) return `vencido hace ${-diff} días`
  if (diff === 1) return 'mañana'
  const [, m, d] = date.split('-').map(Number)
  const wd = DIAS[new Date(dayNumber(date) * MS_DIA).getUTCDay()]
  return `${wd} ${d} ${MESES[m! - 1]}`
}
