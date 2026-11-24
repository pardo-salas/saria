import type { SupabaseClient } from '@supabase/supabase-js'
import type { SariaDB } from '../db/dexie'
import type { OutboxEntry, SyncedRow, SyncedTableName } from '../db/schema'

export const TABLE_ORDER = [
  'settings',
  'accounts',
  'categories',
  'recurring_payments',
  'installment_plans',
  'transactions',
  'transfers',
  'reminders',
] as const satisfies readonly SyncedTableName[]

export type SyncStatus = {
  state:
    'sincronizado' | 'pendiente' | 'sin-conexion' | 'error' | 'sincronizando'
  pending: number
  lastSyncedAt: string | null
  message: string | null
}

export interface SyncEngineDeps {
  db: SariaDB
  supabase: SupabaseClient
  getUserId(): string | null
  now?(): string
  isOnline?(): boolean
}

const PUSH_BATCH = 500
const PULL_PAGE = 1000
const MAX_ATTEMPTS = 5
const BACKOFF_MS = [1, 2, 5, 10].map((m) => m * 60_000)
const AUTH_MESSAGE =
  'Tu sesión venció; vuelve a iniciar sesión para sincronizar'
const GENERIC_MESSAGE = 'No se pudo sincronizar; se reintentará más tarde'

function isAuthError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as { status?: unknown; message?: unknown }
  return (
    e.status === 401 ||
    (typeof e.message === 'string' &&
      /jwt expired|invalid jwt/i.test(e.message))
  )
}

/** El servidor rechazó los datos (RLS, check, FK...), no es red ni sesión. */
function isRowError(err: unknown): boolean {
  if (isAuthError(err) || typeof err !== 'object' || err === null) return false
  const e = err as { code?: unknown; status?: unknown }
  if (typeof e.code === 'string' && e.code !== '') return true
  return (
    typeof e.status === 'number' &&
    e.status >= 400 &&
    e.status < 500 &&
    e.status !== 408 &&
    e.status !== 429
  )
}

export function createSyncEngine(deps: SyncEngineDeps) {
  const { db, supabase, getUserId } = deps
  const now = deps.now ?? (() => new Date().toISOString())
  const isOnline =
    deps.isOnline ??
    (() => typeof navigator === 'undefined' || navigator.onLine !== false)

  let status: SyncStatus = {
    state: 'sincronizado',
    pending: 0,
    lastSyncedAt: null,
    message: null,
  }
  const listeners = new Set<(s: SyncStatus) => void>()
  let inFlight: Promise<void> | null = null
  let failures = 0
  let retryAt = 0

  function setStatus(patch: Partial<SyncStatus>): void {
    status = { ...status, ...patch }
    for (const fn of [...listeners]) fn(status)
  }

  async function refreshPending(): Promise<void> {
    const pending = await db.outbox.count()
    const idle = status.state === 'sincronizado' || status.state === 'pendiente'
    setStatus({
      pending,
      ...(idle ? { state: pending > 0 ? 'pendiente' : 'sincronizado' } : {}),
    })
  }

  // --- Subir ---------------------------------------------------------------

  async function push(): Promise<void> {
    const entries = await db.outbox.orderBy('seq').toArray()
    if (entries.length === 0) return
    // Colapsa por (tabla, fila): gana la última; recuerda todos los seq leídos.
    const groups = new Map<string, { last: OutboxEntry; seqs: number[] }>()
    for (const e of entries) {
      const key = `${e.table}\u0000${e.row_id}`
      const g = groups.get(key)
      if (g) {
        g.last = e
        g.seqs.push(e.seq!)
      } else groups.set(key, { last: e, seqs: [e.seq!] })
    }
    for (const table of TABLE_ORDER) {
      const items = [...groups.values()].filter(
        (g) => g.last.table === table && g.last.attempts < MAX_ATTEMPTS,
      )
      for (let i = 0; i < items.length; i += PUSH_BATCH) {
        const batch = items.slice(i, i + PUSH_BATCH)
        // El servidor asigna updated_at (default en insert, trigger en update),
        // así el pull incremental de otros dispositivos nunca lo pasa por alto.
        const rows = batch.map((g) => {
          const rest: Partial<SyncedRow> = { ...g.last.payload }
          delete rest.updated_at
          return rest
        })
        const { error } = await upsertRows(table, rows)
        if (!error) {
          await db.outbox.bulkDelete(batch.flatMap((g) => g.seqs))
          continue
        }
        // Error de red o de sesión: aborta el push sin tocar `attempts`.
        if (!isRowError(error)) throw error
        // Una fila rechazada hace fallar todo el lote: reintenta una por una.
        for (let j = 0; j < batch.length; j++) {
          const single = await upsertRows(table, [rows[j]!])
          if (!single.error) {
            await db.outbox.bulkDelete(batch[j]!.seqs)
            continue
          }
          if (!isRowError(single.error)) throw single.error
          // Se queda en la outbox (nunca se borran datos del usuario).
          await db.outbox
            .where('seq')
            .anyOf(batch[j]!.seqs)
            .modify((e) => {
              e.attempts += 1
            })
        }
      }
    }
  }

  /** Cambios que agotaron los reintentos automáticos (se conservan en la outbox). */
  async function countStuck(): Promise<number> {
    const last = new Map<string, OutboxEntry>()
    for (const e of await db.outbox.orderBy('seq').toArray())
      last.set(`${e.table}\u0000${e.row_id}`, e)
    return [...last.values()].filter((e) => e.attempts >= MAX_ATTEMPTS).length
  }

  function upsertRows(table: SyncedTableName, rows: Partial<SyncedRow>[]) {
    return supabase.from(table).upsert(rows, { onConflict: 'id' })
  }

  // --- Bajar ---------------------------------------------------------------

  async function pull(userId: string): Promise<void> {
    for (const table of TABLE_ORDER) {
      const state = await db.sync_state.get(table)
      const since = state?.last_pulled_at ?? null
      let maxSeen = since
      let cursor: { at: string; id: string } | null = null
      for (;;) {
        let q = supabase.from(table).select('*').eq('user_id', userId)
        if (cursor !== null)
          q = q.or(
            `updated_at.gt.${cursor.at},and(updated_at.eq.${cursor.at},id.gt.${cursor.id})`,
          )
        else if (since !== null) q = q.gte('updated_at', since)
        const { data, error } = await q
          .order('updated_at')
          .order('id')
          .limit(PULL_PAGE)
        if (error) throw error
        const rows = (data ?? []) as SyncedRow[]
        if (rows.length > 0) {
          await db.transaction('rw', db.table(table), db.outbox, async () => {
            const pending = new Set(
              (
                await db.outbox
                  .where('row_id')
                  .anyOf(rows.map((r) => r.id))
                  .toArray()
              )
                .filter((e) => e.table === table)
                .map((e) => e.row_id),
            )
            await db
              .table(table)
              .bulkPut(rows.filter((r) => !pending.has(r.id)))
          })
          for (const r of rows) {
            if (maxSeen === null || r.updated_at > maxSeen)
              maxSeen = r.updated_at
          }
        }
        if (rows.length < PULL_PAGE) break
        const lastRow = rows[rows.length - 1]!
        cursor = { at: lastRow.updated_at, id: lastRow.id }
      }
      await db.sync_state.put({ table, last_pulled_at: maxSeen })
    }
  }

  /** Primera sincronización: descarta datos locales del usuario y la cola. */
  async function discardLocal(userId: string): Promise<void> {
    const tables = TABLE_ORDER.map((t) => db.table(t))
    await db.transaction(
      'rw',
      [...tables, db.outbox, db.sync_state],
      async () => {
        for (const t of tables)
          await t.filter((r) => r.user_id === userId).delete()
        await db.outbox.clear()
        // Marca el dispositivo como ya sincronizado; el pull completo parte de null.
        await db.sync_state.bulkPut(
          TABLE_ORDER.map((table) => ({ table, last_pulled_at: null })),
        )
      },
    )
  }

  async function run(): Promise<void> {
    const userId = getUserId()
    if (userId === null) return
    if (!isOnline()) {
      await refreshPending()
      setStatus({ state: 'sin-conexion', message: null })
      return
    }
    setStatus({ state: 'sincronizando', message: null })
    try {
      const first = (await db.sync_state.count()) === 0
      if (first) await discardLocal(userId)
      else await push()
      await pull(userId)
      failures = 0
      retryAt = 0
      const pending = await db.outbox.count()
      const stuck = await countStuck()
      setStatus({
        state: stuck > 0 ? 'error' : pending > 0 ? 'pendiente' : 'sincronizado',
        pending,
        lastSyncedAt: now(),
        message: stuck > 0 ? `${stuck} cambios no se pudieron subir` : null,
      })
    } catch (err) {
      failures += 1
      retryAt =
        Date.now() + BACKOFF_MS[Math.min(failures, BACKOFF_MS.length) - 1]
      const pending = await db.outbox.count()
      setStatus({
        state: 'error',
        pending,
        message: isAuthError(err) ? AUTH_MESSAGE : GENERIC_MESSAGE,
      })
    }
  }

  function syncNow(opts?: { force?: boolean }): Promise<void> {
    if (inFlight) return inFlight
    if (!opts?.force && Date.now() < retryAt) return Promise.resolve()
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
    const p = (
      locks ? locks.request('saria-sync', () => run()) : run()
    ).finally(() => {
      inFlight = null
    })
    inFlight = p
    return p
  }

  return {
    syncNow,
    getStatus: (): SyncStatus => status,
    subscribe(fn: (s: SyncStatus) => void): () => void {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    /** Recalcula `pending` desde la outbox (para disparadores de escritura). */
    refreshPending,
  }
}

export type SyncEngine = ReturnType<typeof createSyncEngine>
