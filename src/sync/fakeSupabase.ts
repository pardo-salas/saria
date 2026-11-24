import type { SupabaseClient } from '@supabase/supabase-js'

type Row = Record<string, unknown> & { id: string; updated_at: string }
type Result = {
  data: Row[] | null
  error: { message: string; status?: number; code?: string } | null
}

/**
 * Supabase simulado en memoria (solo el subconjunto que usa el motor).
 * Imita el SQL real: en insert se conserva el `updated_at` enviado si viene
 * (si no, default now()); en update el trigger lo fija a la hora del servidor.
 * La hora del servidor es un reloj monotónico que avanza 1 s por escritura.
 */
export function createFakeSupabase() {
  const tables = new Map<string, Map<string, Row>>()
  const upsertLog: string[] = []
  let tick = 0
  const hooks = {
    /** Se ejecuta durante un upsert, antes de confirmarlo. */
    onUpsert: null as null | ((table: string, rows: Row[]) => Promise<void>),
    failWith: null as null | { message: string; status?: number },
    /** Ids que el servidor rechaza (como un check/RLS/FK): falla todo el lote. */
    rejectIds: new Set<string>(),
  }
  const serverNow = () =>
    new Date(Date.UTC(2026, 0, 1) + ++tick * 1000).toISOString()
  const tableOf = (t: string) => {
    let m = tables.get(t)
    if (!m) tables.set(t, (m = new Map()))
    return m
  }

  function from(table: string) {
    return {
      upsert(rows: Record<string, unknown>[], opts?: { onConflict?: string }) {
        void opts
        return (async (): Promise<Result> => {
          if (hooks.failWith) return { data: null, error: hooks.failWith }
          if (rows.some((r) => hooks.rejectIds.has(r.id as string)))
            return {
              data: null,
              error: {
                message: 'violates check constraint',
                status: 400,
                code: '23514',
              },
            }
          upsertLog.push(table)
          if (hooks.onUpsert) await hooks.onUpsert(table, rows as Row[])
          const t = tableOf(table)
          for (const r of rows) {
            const id = r.id as string
            const existing = t.get(id)
            const updated_at = existing
              ? serverNow()
              : ((r.updated_at as string | undefined) ?? serverNow())
            t.set(id, { ...existing, ...r, id, updated_at })
          }
          return { data: null, error: null }
        })()
      },
      select(columns: string) {
        void columns
        const filters: ((r: Row) => boolean)[] = []
        const orders: string[] = []
        let first = 0
        let last = Infinity
        const b = {
          eq(col: string, v: unknown) {
            filters.push((r) => r[col] === v)
            return b
          },
          gte(col: string, v: string) {
            filters.push((r) => (r[col] as string) >= v)
            return b
          },
          or(expr: string) {
            const m =
              /^updated_at\.gt\.(.+),and\(updated_at\.eq\.(.+),id\.gt\.(.+)\)$/.exec(
                expr,
              )
            if (!m) throw new Error('or() no soportado: ' + expr)
            const gt = m[1]!
            const eq = m[2]!
            const id = m[3]!
            filters.push(
              (r) => r.updated_at > gt || (r.updated_at === eq && r.id > id),
            )
            return b
          },
          limit(n: number) {
            first = 0
            last = n - 1
            return b
          },
          order(col: string) {
            orders.push(col)
            return b
          },
          range(from: number, to: number) {
            first = from
            last = to
            return b
          },
          then<T>(res: (r: Result) => T, rej?: (e: unknown) => T): Promise<T> {
            return (async (): Promise<Result> => {
              if (hooks.failWith) return { data: null, error: hooks.failWith }
              const out = [...tableOf(table).values()]
                .filter((r) => filters.every((f) => f(r)))
                .sort((x, y) => {
                  for (const c of orders) {
                    const p = String(x[c])
                    const q = String(y[c])
                    if (p !== q) return p < q ? -1 : 1
                  }
                  return 0
                })
                .slice(first, last + 1)
                .map((r) => ({ ...r }))
              return { data: out, error: null }
            })().then(res, rej)
          },
        }
        return b
      },
    }
  }

  return {
    client: { from } as unknown as SupabaseClient,
    rows: (table: string) => [...tableOf(table).values()],
    upsertLog,
    hooks,
  }
}
