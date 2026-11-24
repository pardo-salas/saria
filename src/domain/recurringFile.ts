// Archivo de pagos habituales (`saria-recurring`, v1) que se agrega desde
// Más → Respaldo. Valida todo antes de tocar la base.

import { COLUMNS, type RecurringPayment } from '../db/schema'

export const RECURRING_FORMAT = 'saria-recurring'
export const RECURRING_VERSION = 1

/** Fila lista para `repo.put`: sin metadatos de sincronización, con ID. */
export type RecurringRow = Omit<
  RecurringPayment,
  'user_id' | 'created_at' | 'updated_at' | 'deleted_at'
>

export interface RecurringLookups {
  accountIds: ReadonlySet<string>
  categoryIds: ReadonlySet<string>
}

export type RecurringFileCheck =
  | { ok: true; rows: RecurringRow[]; nuevos: number; existentes: number }
  | { ok: false; error: string }

const NOT_FILE = 'El archivo no es de pagos habituales de Saria'
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const FREQUENCIES = [
  'daily',
  'weekly',
  'biweekly',
  'semimonthly',
  'monthly',
  'yearly',
  'custom',
]

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isDate = (v: unknown) =>
  v === null || (typeof v === 'string' && DATE_RE.test(v))
const isDay = (v: unknown) =>
  v === null ||
  (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 31)

const fail = (error: string): RecurringFileCheck => ({ ok: false, error })

export function parseRecurringFile(
  text: string,
  lookups: RecurringLookups,
  existingIds: ReadonlySet<string>,
): RecurringFileCheck {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return fail(NOT_FILE)
  }
  if (!isRecord(data) || data.format !== RECURRING_FORMAT) return fail(NOT_FILE)
  const version = data.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1)
    return fail(NOT_FILE)
  if (version > RECURRING_VERSION)
    return fail('Este archivo es de una versión más nueva de Saria')
  const list = data.recurring_payments
  if (!Array.isArray(list)) return fail(NOT_FILE)

  const rows: RecurringRow[] = []
  const seen = new Set<string>()
  for (const raw of list) {
    if (!isRecord(raw)) return fail(NOT_FILE)
    for (const col of COLUMNS.recurring_payments) {
      if (!(col in raw))
        return fail(`Falta la columna ${col} en recurring_payments`)
    }
    if (typeof raw.id !== 'string' || !UUID_RE.test(raw.id) || seen.has(raw.id))
      return fail('Hay un ID inválido en recurring_payments')
    seen.add(raw.id)
    if (typeof raw.name !== 'string' || raw.name.trim() === '')
      return fail('Hay un pago habitual sin nombre')
    if (
      !Number.isSafeInteger(raw.amount_cents) ||
      (raw.amount_cents as number) < 0
    )
      return fail('Hay un monto inválido en recurring_payments')
    if (raw.kind !== 'expense' && raw.kind !== 'income')
      return fail('Hay un pago habitual con tipo inválido')
    if (!FREQUENCIES.includes(raw.frequency as string))
      return fail('Hay un pago habitual con frecuencia inválida')
    if (
      !isDay(raw.day_of_month) ||
      !isDay(raw.second_day_of_month) ||
      !(
        raw.interval_days === null ||
        (Number.isInteger(raw.interval_days) &&
          (raw.interval_days as number) >= 1)
      )
    )
      return fail('Hay un pago habitual con día o intervalo inválido')
    if (
      !isDate(raw.start_date) ||
      !isDate(raw.end_date) ||
      !isDate(raw.next_due_date)
    )
      return fail('Hay un pago habitual con una fecha inválida')
    if (typeof raw.auto_create !== 'boolean' || typeof raw.active !== 'boolean')
      return fail('Hay un pago habitual con valores inválidos')
    const acc = raw.account_id
    const cat = raw.category_id
    if (
      (acc !== null &&
        !(typeof acc === 'string' && lookups.accountIds.has(acc))) ||
      (cat !== null &&
        !(typeof cat === 'string' && lookups.categoryIds.has(cat)))
    )
      return fail(
        'Un pago habitual apunta a una cuenta o categoría que no existe en este dispositivo',
      )
    // Solo columnas conocidas y sin los metadatos que pone el repositorio.
    const row = Object.fromEntries(
      COLUMNS.recurring_payments
        .filter(
          (c) =>
            c !== 'user_id' &&
            c !== 'created_at' &&
            c !== 'updated_at' &&
            c !== 'deleted_at',
        )
        .map((c) => [c, raw[c]]),
    ) as unknown as RecurringRow
    rows.push(row)
  }
  const existentes = rows.filter((r) => existingIds.has(r.id)).length
  return { ok: true, rows, nuevos: rows.length - existentes, existentes }
}
