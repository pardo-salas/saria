import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { useSessionContext } from '../app/SessionProvider'
import { balancesByAccount } from '../domain/balances'
import { localDate } from '../domain/dates'
import { buildFeed, type FeedEntry } from '../domain/feed'
import { pendingInstallmentsByAccount } from '../domain/installments'
import type { Lookups } from '../domain/search'
import { db } from './dexie'
import type {
  Account,
  Category,
  RowOf,
  Settings,
  SyncedTableName,
  Transaction,
  Transfer,
} from './schema'

/**
 * Filas vivas del usuario en sesión. `undefined` mientras carga; `[]` sin
 * sesión. El filtro es en memoria: no hay índice por user_id y con este
 * volumen no hace falta.
 */
export function useLiveRows<T extends SyncedTableName>(
  table: T,
): RowOf<T>[] | undefined {
  const { userId } = useSessionContext()
  return useLiveQuery(async () => {
    if (userId === null) return [] as RowOf<T>[]
    const rows = (await db.table(table).toArray()) as RowOf<T>[]
    return rows.filter((r) => r.user_id === userId && r.deleted_at === null)
  }, [table, userId])
}

/** Ajustes del usuario; `null` si no existen o están borrados; `undefined` al cargar. */
export function useSettings(): Settings | null | undefined {
  const { userId } = useSessionContext()
  return useLiveQuery(async () => {
    if (userId === null) return null
    const row = await db.settings.get(userId)
    return row && row.deleted_at === null ? row : null
  }, [userId])
}

/** Milisegundos hasta la siguiente medianoche local de Ciudad de México. */
function msUntilNextMidnight(now: Date): number {
  const today = localDate(now)
  // La medianoche está a lo más 24 h adelante; se avanza por minutos hasta que
  // cambie la fecha local y luego se afina por segundos (robusto ante DST).
  let low = 0
  let high = 25 * 60 * 60 * 1000
  while (high - low > 1000) {
    const mid = Math.floor((low + high) / 2)
    if (localDate(new Date(now.getTime() + mid)) === today) low = mid
    else high = mid
  }
  return high
}

/** Fecha de hoy (YYYY-MM-DD, hora de CDMX); se actualiza sola al cambiar el día. */
export function useToday(): string {
  const [today, setToday] = useState(() => localDate(new Date()))

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      const now = new Date()
      setToday(localDate(now))
      clearTimeout(timer)
      // +1 s de margen para caer ya en el día nuevo.
      timer = setTimeout(refresh, msUntilNextMidnight(now) + 1000)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    timer = setTimeout(refresh, msUntilNextMidnight(new Date()) + 1000)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return today
}

export interface FinanceData {
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  transfers: Transfer[]
  balances: Map<string, number>
  feed: FeedEntry[]
  lookups: Lookups
}

/** Datos financieros derivados; `undefined` hasta que cargan los cuatro conjuntos. */
export function useFinance(): FinanceData | undefined {
  const accounts = useLiveRows('accounts')
  const categories = useLiveRows('categories')
  const transactions = useLiveRows('transactions')
  const transfers = useLiveRows('transfers')

  return useMemo(() => {
    if (!accounts || !categories || !transactions || !transfers)
      return undefined
    return {
      accounts,
      categories,
      transactions,
      transfers,
      balances: balancesByAccount(accounts, transactions, transfers),
      feed: buildFeed(transactions, transfers),
      // Incluyen archivadas: los movimientos viejos aún muestran su cuenta/categoría.
      lookups: {
        accounts: new Map(accounts.map((a) => [a.id, a])),
        categories: new Map(categories.map((c) => [c.id, c])),
      },
    }
  }, [accounts, categories, transactions, transfers])
}

/** Por cuenta: lo que falta cobrar de sus compras a meses activas; `undefined` al cargar. */
export function usePendingInstallments(): Map<string, number> | undefined {
  const plans = useLiveRows('installment_plans')
  const transactions = useLiveRows('transactions')
  return useMemo(
    () =>
      plans && transactions
        ? pendingInstallmentsByAccount(plans, transactions)
        : undefined,
    [plans, transactions],
  )
}
