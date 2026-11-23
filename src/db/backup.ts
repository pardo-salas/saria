import type { Backup, BackupTables } from '../domain/backup'
import type { SariaDB } from './dexie'
import type { Repo } from './repo'
import { COLUMNS, type SyncedRow, type SyncedTableName } from './schema'

const TABLES = Object.keys(COLUMNS) as SyncedTableName[]

/** Filas vivas del usuario, como objetos planos con todas las columnas. */
export async function readLiveTables(
  db: SariaDB,
  userId: string,
): Promise<BackupTables> {
  const out: Record<string, unknown[]> = {}
  for (const table of TABLES) {
    const rows = (await db
      .table(table)
      .filter((r: SyncedRow) => r.user_id === userId && r.deleted_at === null)
      .toArray()) as Record<string, unknown>[]
    out[table] = rows.map((row) =>
      Object.fromEntries(COLUMNS[table].map((col) => [col, row[col]])),
    )
  }
  return out as unknown as BackupTables
}

/**
 * Reemplaza los datos vivos del usuario por los del respaldo, todo en una
 * transacción: si algo falla, no cambia nada. Lo que no está en el archivo se
 * borra lógicamente (excepto settings, que solo se sobrescribe).
 */
export async function restoreBackup(
  db: SariaDB,
  repo: Repo,
  userId: string,
  backup: Backup,
): Promise<void> {
  const stores = [...TABLES.map((t) => db.table(t)), db.outbox]
  await db.transaction('rw', stores, async () => {
    for (const table of TABLES) {
      const rows = backup.tables[table] as unknown as (Record<string, unknown> &
        SyncedRow)[]
      for (const row of rows) {
        // El repo reescribe user_id, updated_at y (en settings) el id.
        await repo.put(table, row as never, {
          created_at: row.created_at,
          revive: true,
        })
      }
      if (table === 'settings') continue
      const inFile = new Set(rows.map((r) => r.id))
      const stale = (await db
        .table(table)
        .filter(
          (r: SyncedRow) =>
            r.user_id === userId && r.deleted_at === null && !inFile.has(r.id),
        )
        .toArray()) as SyncedRow[]
      for (const row of stale) await repo.softDelete(table, row.id)
    }
  })
}
