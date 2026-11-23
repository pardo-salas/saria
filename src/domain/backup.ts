import { COLUMNS, type RowOf, type SyncedTableName } from '../db/schema'

export const BACKUP_FORMAT = 'saria-backup'
export const BACKUP_VERSION = 1

export type BackupTables = { [T in SyncedTableName]: RowOf<T>[] }

export interface Backup {
  format: typeof BACKUP_FORMAT
  version: number
  exported_at: string
  tables: BackupTables
}

export type BackupCheck =
  | { ok: true; backup: Backup; counts: Record<SyncedTableName, number> }
  | { ok: false; error: string }

const NOT_BACKUP = 'El archivo no es un respaldo de Saria'
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function buildBackup(tables: BackupTables, exportedAt: string): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported_at: exportedAt,
    tables,
  }
}

export function backupFileName(date: string): string {
  return `saria-respaldo-${date}.json`
}

/** Montos que el esquema no permite nulos. */
const REQUIRED_CENTS: Partial<Record<SyncedTableName, readonly string[]>> = {
  accounts: ['initial_balance_cents'],
  transactions: ['amount_cents'],
  transfers: ['amount_cents'],
  recurring_payments: ['amount_cents'],
  installment_plans: ['total_cents', 'monthly_cents'],
}

const TABLES = Object.keys(COLUMNS) as SyncedTableName[]

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function fail(error: string): BackupCheck {
  return { ok: false, error }
}

/** Valida el archivo completo y devuelve el primer error encontrado. */
export function parseBackup(text: string): BackupCheck {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return fail(NOT_BACKUP)
  }
  if (!isRecord(data) || data.format !== BACKUP_FORMAT) return fail(NOT_BACKUP)
  const tables = data.tables
  if (!isRecord(tables)) return fail(NOT_BACKUP)
  for (const table of TABLES) {
    if (!Array.isArray(tables[table])) return fail(NOT_BACKUP)
  }
  const version = data.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1)
    return fail(NOT_BACKUP)
  if (version > BACKUP_VERSION)
    return fail('Este respaldo es de una versión más nueva de Saria')

  const rowsOf = (table: SyncedTableName) =>
    tables[table] as Record<string, unknown>[]

  for (const table of TABLES) {
    for (const row of rowsOf(table)) {
      if (!isRecord(row)) return fail(NOT_BACKUP)
      for (const col of COLUMNS[table]) {
        if (!(col in row)) return fail(`Falta la columna ${col} en ${table}`)
      }
      for (const col of COLUMNS[table]) {
        if (!col.endsWith('_cents')) continue
        const value = row[col]
        const required = REQUIRED_CENTS[table]?.includes(col) ?? false
        if (value === null ? required : !Number.isSafeInteger(value))
          return fail(`Hay un monto inválido en ${table}`)
      }
      if (typeof row.id !== 'string' || !UUID_RE.test(row.id))
        return fail(`Hay un ID inválido en ${table}`)
    }
  }

  const ids = (table: SyncedTableName) =>
    new Set(rowsOf(table).map((r) => r.id))
  const accountIds = ids('accounts')
  const categoryIds = ids('categories')
  for (const t of rowsOf('transactions')) {
    const cat = t.category_id
    if (
      !accountIds.has(t.account_id) ||
      (cat !== null && !categoryIds.has(cat))
    )
      return fail(
        'Un movimiento apunta a una cuenta o categoría que no está en el respaldo',
      )
  }
  for (const t of rowsOf('transfers')) {
    if (!accountIds.has(t.from_account_id) || !accountIds.has(t.to_account_id))
      return fail(
        'Una transferencia apunta a una cuenta que no está en el respaldo',
      )
    if (t.from_account_id === t.to_account_id)
      return fail('Una transferencia tiene la misma cuenta de origen y destino')
  }

  const counts = Object.fromEntries(
    TABLES.map((t) => [t, rowsOf(t).length]),
  ) as Record<SyncedTableName, number>
  // Solo se conservan las columnas conocidas: las llaves extra no deben llegar
  // a Dexie ni al outbox (el upsert a Postgres fallaría con columnas ajenas).
  const clean = Object.fromEntries(
    TABLES.map((t) => [
      t,
      rowsOf(t).map((row) =>
        Object.fromEntries(COLUMNS[t].map((c) => [c, row[c]])),
      ),
    ]),
  ) as unknown as BackupTables
  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version,
      exported_at: String(data.exported_at ?? ''),
      tables: clean,
    },
    counts,
  }
}
