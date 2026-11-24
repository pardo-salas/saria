// Reglas de los pagos habituales: próxima fecha, grupos de "Por pagar" e ID
// determinista del movimiento generado por cada ocurrencia.

import type { RecurringPayment } from '../db/schema'
import { SARIA_NAMESPACE } from './seedCategories'
import { uuidV5 } from './uuid'

const MS_DIA = 86_400_000

/** Fecha `YYYY-MM-DD` → número de día (UTC, sin horario de verano). */
function toDay(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y!, m! - 1, d!) / MS_DIA
}

function fromDay(day: number): string {
  return new Date(day * MS_DIA).toISOString().slice(0, 10)
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

function ymd(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Fecha con día `d` en el mes `m`; si el mes es más corto cae en su último día. */
function clamped(y: number, m: number, d: number): string {
  return ymd(y, m, Math.min(d, daysInMonth(y, m)))
}

/** Primera fecha >= `from` que cumple la regla de periodicidad del pago. */
function firstOnOrAfter(
  p: RecurringPayment,
  from: string,
  anchor: string,
): string | null {
  const fromDayN = toDay(from)
  switch (p.frequency) {
    case 'daily':
      return from
    case 'weekly':
    case 'biweekly':
    case 'custom': {
      const step =
        p.frequency === 'weekly'
          ? 7
          : p.frequency === 'biweekly'
            ? 14
            : (p.interval_days ?? 0)
      if (!Number.isInteger(step) || step < 1) return null
      const a = toDay(anchor)
      if (fromDayN <= a) return fromDay(a)
      return fromDay(a + Math.ceil((fromDayN - a) / step) * step)
    }
    case 'monthly':
    case 'semimonthly': {
      const base = p.day_of_month ?? Number(anchor.slice(8, 10))
      const days =
        p.frequency === 'semimonthly'
          ? [base, p.second_day_of_month ?? base]
          : [base]
      let y = Number(from.slice(0, 4))
      let m = Number(from.slice(5, 7))
      for (let i = 0; i < 3; i++) {
        const found = days
          .map((d) => clamped(y, m, d))
          .sort()
          .find((c) => c >= from)
        if (found) return found
        m += 1
        if (m > 12) {
          m = 1
          y += 1
        }
      }
      return null
    }
    case 'yearly': {
      const mo = Number(anchor.slice(5, 7))
      const d = Number(anchor.slice(8, 10))
      let y = Number(from.slice(0, 4))
      for (let i = 0; i < 9; i++, y++) {
        // 29 feb cae en 28 feb en años no bisiestos (clamped).
        const c = clamped(y, mo, d)
        if (c >= from) return c
      }
      return null
    }
  }
}

/**
 * Primera fecha posterior a `after` en que toca el pago (o desde `start_date`
 * si `after` es anterior). `null` si ya pasó de `end_date`.
 */
export function nextOccurrence(
  p: RecurringPayment,
  after: string,
): string | null {
  let from = fromDay(toDay(after) + 1)
  if (p.start_date && from < p.start_date) from = p.start_date
  const found = firstOnOrAfter(p, from, p.start_date ?? after)
  if (found === null) return null
  if (p.end_date && found > p.end_date) return null
  return found
}

export type DueGroup = {
  overdue: RecurringPayment[]
  today: RecurringPayment[]
  week: RecurringPayment[]
}

/** Agrupa lo pendiente en Vencidos, Hoy y Esta semana (hoy+1 a hoy+6). */
export function dueGroups(
  payments: RecurringPayment[],
  today: string,
): DueGroup {
  const limit = fromDay(toDay(today) + 6)
  const groups: DueGroup = { overdue: [], today: [], week: [] }
  for (const p of payments) {
    const d = p.next_due_date
    if (!p.active || p.deleted_at !== null || d === null) continue
    if (d < today) groups.overdue.push(p)
    else if (d === today) groups.today.push(p)
    else if (d <= limit) groups.week.push(p)
  }
  const byDateName = (a: RecurringPayment, b: RecurringPayment) =>
    (a.next_due_date ?? '').localeCompare(b.next_due_date ?? '') ||
    a.name.localeCompare(b.name)
  groups.overdue.sort(byDateName)
  groups.today.sort(byDateName)
  groups.week.sort(byDateName)
  return groups
}

/** ID del movimiento de una ocurrencia: igual en cualquier dispositivo. */
export function occurrenceTransactionId(
  recurringId: string,
  date: string,
): Promise<string> {
  return uuidV5(`${recurringId}:${date}`, SARIA_NAMESPACE)
}
