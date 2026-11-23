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
  if (typeof data.version !== 'number') return fail(NOT_BACKUP)
  if (data.version > BACKUP_VERSION)
    return fail('Este respaldo es de una versión más nueva de Saria')

  const rowsOf = (table: SyncedTableName) =>
    tables[table] as Record<string, unknown>[]

  for (const table of TABLES) {
    for (const row of rowsOf(table)) {
      if (!isRecord(row)) return fail(NOT_BACKUP)
      for (const col of COLUMNS[table]) {
        if (!(col in row)) return fail(`Falta la columna ${col} en ${table}`)
      }
      for (const [key, value] of Object.entries(row)) {
        if (
          key.endsWith('_cents') &&
          value !== null &&
          !Number.isSafeInteger(value)
        )
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
  return { ok: true, backup: data as unknown as Backup, counts }
}
