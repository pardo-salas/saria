import type { Account, Category } from '../db/schema'
import { monthKey } from './dates'
import type { FeedEntry } from './feed'
import { sumCents } from './money'

export type EntryKind = 'expense' | 'income' | 'transfer'

export interface FeedFilters {
  text: string
  /** 'YYYY-MM'; null = sin filtro de mes. */
  month: string | null
  /** Rango inclusivo en ambos extremos ('YYYY-MM-DD'); reemplaza a `month`. */
  range: { from: string; to: string } | null
  kinds: EntryKind[]
  accountIds: string[]
  categoryIds: string[]
}

export const EMPTY_FILTERS: FeedFilters = {
  text: '',
  month: null,
  range: null,
  kinds: [],
  accountIds: [],
  categoryIds: [],
}

export interface Lookups {
  accounts: Map<string, Account>
  categories: Map<string, Category>
}

export const PAGE_SIZE = 100

/** NFD, sin diacríticos, minúsculas y espacios colapsados. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const NUMERIC_QUERY = /^\d+([.,]\d{0,2})?$/

/** Centavos como "1234.56": sin "$" ni separador de miles. */
function plainAmount(cents: number): string {
  const abs = Math.abs(cents)
  const decimals = String(abs % 100).padStart(2, '0')
  return `${cents < 0 ? '-' : ''}${Math.floor(abs / 100)}.${decimals}`
}

/** Busca en nota, categoría y cuenta(s); una consulta numérica también compara el monto. */
export function matchesText(
  entry: FeedEntry,
  query: string,
  lookups: Lookups,
): boolean {
  const q = normalizeText(query)
  if (q === '') return true

  const fields: (string | null | undefined)[] = [entry.row.note]
  if (entry.type === 'transaction') {
    const { category_id, account_id } = entry.row
    fields.push(
      category_id === null ? null : lookups.categories.get(category_id)?.name,
      lookups.accounts.get(account_id)?.name,
    )
  } else {
    fields.push(
      lookups.accounts.get(entry.row.from_account_id)?.name,
      lookups.accounts.get(entry.row.to_account_id)?.name,
    )
  }
  if (fields.some((f) => f != null && normalizeText(f).includes(q))) return true

  if (NUMERIC_QUERY.test(q)) {
    return plainAmount(entry.row.amount_cents).startsWith(q.replace(',', '.'))
  }
  return false
}

function entryKind(entry: FeedEntry): EntryKind {
  return entry.type === 'transfer' ? 'transfer' : entry.row.kind
}

/**
 * Filtros combinables (AND). Con texto no vacío se ignoran `month` y `range`;
 * `range` reemplaza a `month`; listas vacías = sin filtro. Un filtro de
 * categoría excluye transferencias; uno de cuenta las incluye si la cuenta es
 * origen o destino.
 */
export function filterFeed(
  feed: FeedEntry[],
  filters: FeedFilters,
  lookups: Lookups,
): FeedEntry[] {
  const { month, range, kinds, accountIds, categoryIds } = filters
  const hasText = normalizeText(filters.text) !== ''

  return feed.filter((e) => {
    if (hasText) {
      if (!matchesText(e, filters.text, lookups)) return false
    } else if (range) {
      if (e.row.date < range.from || e.row.date > range.to) return false
    } else if (month !== null && monthKey(e.row.date) !== month) {
      return false
    }

    if (kinds.length > 0 && !kinds.includes(entryKind(e))) return false

    if (accountIds.length > 0) {
      const ids =
        e.type === 'transaction'
          ? [e.row.account_id]
          : [e.row.from_account_id, e.row.to_account_id]
      if (!ids.some((id) => accountIds.includes(id))) return false
    }

    if (categoryIds.length > 0) {
      if (e.type === 'transfer') return false
      if (
        e.row.category_id === null ||
        !categoryIds.includes(e.row.category_id)
      )
        return false
    }
    return true
  })
}

/** Ingresos, gastos y neto de las entradas; las transferencias no cuentan. */
export function feedTotals(feed: FeedEntry[]): {
  incomeCents: number
  expenseCents: number
  netCents: number
} {
  const income: number[] = []
  const expense: number[] = []
  for (const e of feed) {
    if (e.type !== 'transaction') continue
    ;(e.row.kind === 'income' ? income : expense).push(e.row.amount_cents)
  }
  const incomeCents = sumCents(income)
  const expenseCents = sumCents(expense)
  return { incomeCents, expenseCents, netCents: incomeCents - expenseCents }
}
