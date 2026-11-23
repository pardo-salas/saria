import type { Account, Transaction, Transfer } from '../db/schema'
import { monthKey } from './dates'
import { sumCents } from './money'

// Todas las funciones esperan filas vivas (deleted_at === null); quien llama filtra.

/** Saldo por cuenta: inicial + ingresos − gastos + transferencias entrantes − salientes (todas las fechas). */
export function balancesByAccount(
  accounts: Account[],
  txs: Transaction[],
  transfers: Transfer[],
): Map<string, number> {
  const parts = new Map<string, number[]>()
  for (const a of accounts) parts.set(a.id, [a.initial_balance_cents])
  for (const t of txs) {
    if (t.kind === 'income') parts.get(t.account_id)?.push(t.amount_cents)
    else if (t.kind === 'expense')
      parts.get(t.account_id)?.push(-t.amount_cents)
  }
  for (const r of transfers) {
    parts.get(r.to_account_id)?.push(r.amount_cents)
    parts.get(r.from_account_id)?.push(-r.amount_cents)
  }
  const result = new Map<string, number>()
  for (const [id, values] of parts) result.set(id, sumCents(values))
  return result
}

/** Saldo total: solo cuentas incluidas en el total y no archivadas. */
export function totalBalance(
  accounts: Account[],
  balances: Map<string, number>,
): number {
  return sumCents(
    accounts
      .filter((a) => a.include_in_total && !a.archived)
      .map((a) => balances.get(a.id) ?? 0),
  )
}

export type AccountGroup = 'liquid' | 'credit' | 'investment'

export function groupOf(type: Account['type']): AccountGroup {
  if (type === 'credit') return 'credit'
  if (type === 'investment') return 'investment'
  return 'liquid'
}

export interface AccountsBreakdown {
  totalCents: number
  groups: { group: AccountGroup; subtotalCents: number; accounts: Account[] }[]
  creditDebtCents: number
  investmentApartCents: number
}

const GROUP_ORDER: AccountGroup[] = ['liquid', 'credit', 'investment']

/** Desglose de Cuentas: solo no archivadas; los subtotales incluyen también las excluidas del total. */
export function accountsBreakdown(
  accounts: Account[],
  balances: Map<string, number>,
): AccountsBreakdown {
  const active = accounts.filter((a) => !a.archived)
  const bal = (a: Account) => balances.get(a.id) ?? 0

  const groups = GROUP_ORDER.map((group) => {
    const members = active
      .filter((a) => groupOf(a.type) === group)
      .sort((x, y) => x.position - y.position)
    return {
      group,
      subtotalCents: sumCents(members.map(bal)),
      accounts: members,
    }
  }).filter((g) => g.accounts.length > 0)

  const creditDebtCents = Math.abs(
    sumCents(
      active
        .filter((a) => a.type === 'credit')
        .map(bal)
        .filter((v) => v < 0),
    ),
  )
  const investmentApartCents = sumCents(
    active
      .filter((a) => a.type === 'investment' && !a.include_in_total)
      .map(bal),
  )

  return {
    totalCents: totalBalance(accounts, balances),
    groups,
    creditDebtCents,
    investmentApartCents,
  }
}

export interface Flow {
  incomeCents: number
  expenseCents: number
}

function flowOf(txs: Transaction[]): Flow {
  return {
    incomeCents: sumCents(
      txs.filter((t) => t.kind === 'income').map((t) => t.amount_cents),
    ),
    expenseCents: sumCents(
      txs.filter((t) => t.kind === 'expense').map((t) => t.amount_cents),
    ),
  }
}

/** Ingresos y gastos de hoy y del mes actual, de todas las cuentas. */
export function periodSummary(
  txs: Transaction[],
  today: string,
): { today: Flow; month: Flow } {
  const month = monthKey(today)
  const inMonth = txs.filter((t) => monthKey(t.date) === month)
  return {
    today: flowOf(inMonth.filter((t) => t.date === today)),
    month: flowOf(inMonth),
  }
}

export type WaterLevel =
  | { state: 'no-salary' }
  | { state: 'ok'; remainingCents: number; percent: number; daysLeft: number }

/** Nivel de agua: lo que queda del sueldo; el porcentaje se acota a 0–100. */
export function waterLevel(
  salaryCents: number | null,
  monthExpenseCents: number,
  daysLeft: number,
): WaterLevel {
  if (salaryCents === null || salaryCents <= 0) return { state: 'no-salary' }
  const remainingCents = salaryCents - monthExpenseCents
  // El porcentaje no es dinero: aquí la división flotante es válida.
  const percent = Math.min(
    100,
    Math.max(0, Math.round((remainingCents * 100) / salaryCents)),
  )
  return { state: 'ok', remainingCents, percent, daysLeft }
}
