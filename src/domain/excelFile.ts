// Archivo de carga inicial del Excel (`saria-excel`, v1) que se agrega desde
// Más → Respaldo. Valida todo antes de tocar la base.

import type { Account, InstallmentPlan } from '../db/schema'

export const EXCEL_FORMAT = 'saria-excel'
export const EXCEL_VERSION = 1

/** Plan listo para `repo.put`: sin metadatos de sincronización, con ID. */
export type PlanRow = Omit<
  InstallmentPlan,
  'user_id' | 'created_at' | 'updated_at' | 'deleted_at'
>

/** Solo estos campos de una cuenta se tocan; el resto se conserva. */
export const ACCOUNT_UPDATE_FIELDS = [
  'credit_limit_cents',
  'statement_day',
  'due_day',
  'yield_rate',
  'yield_cap_cents',
  'yield_rate_over_cap',
] as const

type AccountField = (typeof ACCOUNT_UPDATE_FIELDS)[number]

export type AccountUpdate = { id: string } & Partial<
  Pick<Account, AccountField>
>

export interface Retag {
  recurring_id: string
  installment_plan_id: string
}

export interface ExcelFile {
  plans: PlanRow[]
  accountUpdates: AccountUpdate[]
  deactivateRecurringIds: string[]
  retag: Retag[]
}

export interface ExcelLookups {
  accountIds: ReadonlySet<string>
  categoryIds: ReadonlySet<string>
}

export type ExcelFileCheck =
  { ok: true; file: ExcelFile } | { ok: false; error: string }

const NOT_FILE = 'El archivo no es de datos del Excel de Saria'
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && UUID_RE.test(v)
const isCents = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0
const isDay = (v: unknown) =>
  Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 31
const isRate = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100

const fail = (error: string): ExcelFileCheck => ({ ok: false, error })

export function parseExcelFile(
  text: string,
  lookups: ExcelLookups,
): ExcelFileCheck {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return fail(NOT_FILE)
  }
  if (!isRecord(data) || data.format !== EXCEL_FORMAT) return fail(NOT_FILE)
  const version = data.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1)
    return fail(NOT_FILE)
  if (version > EXCEL_VERSION)
    return fail('Este archivo es de una versión más nueva de Saria')
  const {
    installment_plans,
    account_updates,
    deactivate_recurring_ids,
    retag,
  } = data
  if (
    !Array.isArray(installment_plans) ||
    !Array.isArray(account_updates) ||
    !Array.isArray(deactivate_recurring_ids) ||
    !Array.isArray(retag)
  )
    return fail(NOT_FILE)

  const plans: PlanRow[] = []
  const planIds = new Set<string>()
  for (const raw of installment_plans) {
    if (!isRecord(raw)) return fail(NOT_FILE)
    if (!isUuid(raw.id) || planIds.has(raw.id))
      return fail('Hay un ID inválido en installment_plans')
    planIds.add(raw.id)
    if (typeof raw.concept !== 'string' || raw.concept.trim() === '')
      return fail('Hay una compra a meses sin nombre')
    if (
      !isCents(raw.total_cents) ||
      !isCents(raw.monthly_cents) ||
      !Number.isInteger(raw.months) ||
      (raw.months as number) < 1 ||
      !Number.isInteger(raw.paid_months) ||
      (raw.paid_months as number) < 0 ||
      (raw.paid_months as number) > (raw.months as number)
    )
      return fail('Hay una compra a meses con montos o meses inválidos')
    if (
      typeof raw.purchase_date !== 'string' ||
      !DATE_RE.test(raw.purchase_date) ||
      typeof raw.active !== 'boolean'
    )
      return fail('Hay una compra a meses con valores inválidos')
    const acc = raw.account_id
    const cat = raw.category_id
    if (
      (acc !== null &&
        !(typeof acc === 'string' && lookups.accountIds.has(acc))) ||
      (cat !== null &&
        !(typeof cat === 'string' && lookups.categoryIds.has(cat)))
    )
      return fail(
        'Una compra a meses apunta a una cuenta o categoría que no existe en este dispositivo',
      )
    plans.push({
      id: raw.id,
      concept: raw.concept,
      account_id: acc,
      purchase_date: raw.purchase_date,
      total_cents: raw.total_cents as number,
      months: raw.months as number,
      monthly_cents: raw.monthly_cents as number,
      paid_months: raw.paid_months as number,
      active: raw.active,
      category_id: cat,
    })
  }

  const accountUpdates: AccountUpdate[] = []
  for (const raw of account_updates) {
    if (!isRecord(raw)) return fail(NOT_FILE)
    if (!isUuid(raw.id) || !lookups.accountIds.has(raw.id))
      return fail('Una actualización apunta a una cuenta que no existe')
    const update: AccountUpdate = { id: raw.id }
    for (const key of Object.keys(raw)) {
      if (key === 'id') continue
      if (!(ACCOUNT_UPDATE_FIELDS as readonly string[]).includes(key))
        return fail(`Campo de cuenta no permitido: ${key}`)
    }
    for (const field of ACCOUNT_UPDATE_FIELDS) {
      if (!(field in raw)) continue
      const v = raw[field]
      const valid =
        field === 'statement_day' || field === 'due_day'
          ? isDay(v)
          : field === 'yield_rate' || field === 'yield_rate_over_cap'
            ? isRate(v)
            : isCents(v)
      if (!valid) return fail(`Valor inválido en ${field}`)
      ;(update as Record<string, unknown>)[field] = v
    }
    accountUpdates.push(update)
  }

  if (!deactivate_recurring_ids.every(isUuid))
    return fail('Hay un ID inválido en deactivate_recurring_ids')
  const retags: Retag[] = []
  for (const raw of retag) {
    if (
      !isRecord(raw) ||
      !isUuid(raw.recurring_id) ||
      !isUuid(raw.installment_plan_id) ||
      !planIds.has(raw.installment_plan_id)
    )
      return fail('Hay un re-etiquetado inválido')
    retags.push({
      recurring_id: raw.recurring_id,
      installment_plan_id: raw.installment_plan_id,
    })
  }

  return {
    ok: true,
    file: {
      plans,
      accountUpdates,
      deactivateRecurringIds: deactivate_recurring_ids as string[],
      retag: retags,
    },
  }
}

export function excelPreview(file: ExcelFile): string {
  return `Se agregarán ${file.plans.length} compras a meses, se actualizarán ${file.accountUpdates.length} cuentas y se desactivarán ${file.deactivateRecurringIds.length} pagos habituales`
}
