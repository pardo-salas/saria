import type { SariaDB } from './dexie'
import type { RowOf, SyncedRow, SyncedTableName } from './schema'

export class NotSignedInError extends Error {
  constructor() {
    super('No hay sesión iniciada')
    this.name = 'NotSignedInError'
  }
}

export type NewRow<T extends SyncedTableName> = Omit<
  RowOf<T>,
  keyof SyncedRow
> & { id?: string }

/**
 * Única vía de escritura a Dexie: estampa metadatos de sincronización y
 * encola el cambio en `outbox` dentro de la misma transacción.
 */
export function createRepo(
  db: SariaDB,
  getUserId: () => string | null,
  now: () => string = () => new Date().toISOString(),
) {
  function requireUser(): string {
    const userId = getUserId()
    if (userId === null) throw new NotSignedInError()
    return userId
  }

  async function put<T extends SyncedTableName>(
    table: T,
    row: NewRow<T>,
  ): Promise<RowOf<T>> {
    const userId = requireUser()
    const stamp = now()
    const id = table === 'settings' ? userId : (row.id ?? crypto.randomUUID())
    return db.transaction('rw', db.table(table), db.outbox, async () => {
      const existing = (await db.table(table).get(id)) as RowOf<T> | undefined
      const saved = {
        ...row,
        id,
        user_id: userId,
        created_at: existing?.created_at ?? stamp,
        updated_at: stamp,
        deleted_at: existing?.deleted_at ?? null,
      } as RowOf<T>
      await db.table(table).put(saved)
      await db.outbox.add({
        table,
        row_id: id,
        op: 'upsert',
        payload: { ...saved },
        created_at: stamp,
        attempts: 0,
      })
      return saved
    })
  }

  async function softDelete(table: SyncedTableName, id: string): Promise<void> {
    requireUser()
    const stamp = now()
    await db.transaction('rw', db.table(table), db.outbox, async () => {
      const existing = (await db.table(table).get(id)) as SyncedRow | undefined
      if (!existing) throw new Error(`La fila ${id} no existe en ${table}`)
      const saved = { ...existing, deleted_at: stamp, updated_at: stamp }
      await db.table(table).put(saved)
      await db.outbox.add({
        table,
        row_id: id,
        op: 'delete',
        payload: { ...saved },
        created_at: stamp,
        attempts: 0,
      })
    })
  }

  return { put, softDelete }
}
