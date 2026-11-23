import type { Transaction, Transfer } from '../db/schema'
import { sumCents } from './money'

// Las funciones esperan filas vivas (deleted_at === null); quien llama filtra.

export type FeedEntry =
  | { type: 'transaction'; row: Transaction }
  | { type: 'transfer'; row: Transfer }

/** Historial unificado: fecha desc y, a igualdad, created_at desc. */
export function buildFeed(
  txs: Transaction[],
  transfers: Transfer[],
): FeedEntry[] {
  const feed: FeedEntry[] = [
    ...txs.map((row): FeedEntry => ({ type: 'transaction', row })),
    ...transfers.map((row): FeedEntry => ({ type: 'transfer', row })),
  ]
  return feed.sort((a, b) => {
    if (a.row.date !== b.row.date) return a.row.date < b.row.date ? 1 : -1
    if (a.row.created_at === b.row.created_at) return 0
    return a.row.created_at < b.row.created_at ? 1 : -1
  })
}

/** Movimiento: +ingreso / −gasto. Transferencia: −salida / +entrada para `accountId`; sin cuenta, 0. */
export function signedAmount(entry: FeedEntry, accountId?: string): number {
  if (entry.type === 'transaction') {
    const { kind, amount_cents } = entry.row
    return kind === 'income' ? amount_cents : -amount_cents
  }
  if (accountId === undefined) return 0
  const { from_account_id, to_account_id, amount_cents } = entry.row
  let total = 0
  if (to_account_id === accountId) total += amount_cents
  if (from_account_id === accountId) total -= amount_cents
  return total
}

/** Entradas que afectan a la cuenta: sus movimientos y transferencias donde es origen o destino. */
export function entriesForAccount(
  feed: FeedEntry[],
  accountId: string,
): FeedEntry[] {
  return feed.filter((e) =>
    e.type === 'transaction'
      ? e.row.account_id === accountId
      : e.row.from_account_id === accountId ||
        e.row.to_account_id === accountId,
  )
}

export interface DayGroup {
  date: string
  entries: FeedEntry[]
  netCents: number
  closingBalanceCents: number | null
}

/**
 * Agrupa por día (en el orden del feed). Con `accountId` y `openingBalanceCents`
 * calcula el saldo al cierre de cada día, acumulando en orden ascendente sobre
 * `fullFeed ?? feed` (historial completo de la cuenta, aunque `feed` venga filtrado).
 */
export function groupByDay(
  feed: FeedEntry[],
  opts: {
    accountId?: string
    openingBalanceCents?: number
    fullFeed?: FeedEntry[]
  } = {},
): DayGroup[] {
  const { accountId, openingBalanceCents, fullFeed } = opts

  const byDay = new Map<string, FeedEntry[]>()
  for (const e of feed) {
    const list = byDay.get(e.row.date)
    if (list) list.push(e)
    else byDay.set(e.row.date, [e])
  }

  // Saldo al cierre de cada día con movimientos de la cuenta.
  const closing = new Map<string, number>()
  if (accountId !== undefined && openingBalanceCents !== undefined) {
    const net = new Map<string, number[]>()
    for (const e of entriesForAccount(fullFeed ?? feed, accountId)) {
      const list = net.get(e.row.date)
      const amount = signedAmount(e, accountId)
      if (list) list.push(amount)
      else net.set(e.row.date, [amount])
    }
    let running = openingBalanceCents
    for (const date of [...net.keys()].sort()) {
      running = sumCents([running, ...(net.get(date) ?? [])])
      closing.set(date, running)
    }
  }

  return [...byDay].map(([date, entries]) => ({
    date,
    entries,
    netCents: sumCents(entries.map((e) => signedAmount(e, accountId))),
    closingBalanceCents: closing.get(date) ?? null,
  }))
}
