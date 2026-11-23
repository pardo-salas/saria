import type { Account, Category, Transaction, Transfer } from '../db/schema'

/** Categorías activas del tipo dado, las más usadas primero (§6.1). */
export function categoriesByUsage(
  categories: Category[],
  txs: Transaction[],
  kind: Category['kind'],
): Category[] {
  const counts = new Map<string, number>()
  for (const t of txs) {
    if (t.category_id !== null) {
      counts.set(t.category_id, (counts.get(t.category_id) ?? 0) + 1)
    }
  }
  return categories
    .filter((c) => !c.archived && c.kind === kind)
    .sort(
      (a, b) =>
        (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) ||
        a.position - b.position ||
        a.name.localeCompare(b.name, 'es'),
    )
}

/**
 * Cuenta por defecto del registro rápido: la del movimiento o transferencia
 * (cuenta de origen) más reciente por `created_at`, ignorando cuentas
 * archivadas o inexistentes. Si no hay, la primera activa por `position`.
 */
export function defaultAccountId(
  accounts: Account[],
  txs: Transaction[],
  transfers: Transfer[],
): string | null {
  const active = new Map(
    accounts.filter((a) => !a.archived).map((a) => [a.id, a]),
  )
  const candidates = [
    ...txs.map((t) => ({ at: t.created_at, id: t.account_id })),
    ...transfers.map((t) => ({ at: t.created_at, id: t.from_account_id })),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))

  const recent = candidates.find((c) => active.has(c.id))
  if (recent) return recent.id

  const first = [...active.values()].sort((a, b) => a.position - b.position)[0]
  return first ? first.id : null
}

export function isAccountInUse(
  id: string,
  txs: Transaction[],
  transfers: Transfer[],
): boolean {
  return (
    txs.some((t) => t.account_id === id) ||
    transfers.some((t) => t.from_account_id === id || t.to_account_id === id)
  )
}

export function isCategoryInUse(id: string, txs: Transaction[]): boolean {
  return txs.some((t) => t.category_id === id)
}

/** Siguiente posición libre: máximo + 1, o 0 si no hay filas. */
export function nextPosition(rows: { position: number }[]): number {
  return rows.length === 0 ? 0 : Math.max(...rows.map((r) => r.position)) + 1
}
