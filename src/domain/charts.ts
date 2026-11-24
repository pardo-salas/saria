import type { Account, Category, Transaction, Transfer } from '../db/schema'
import { balancesByAccount, totalBalance } from './balances'
import { monthKey, shiftMonth } from './dates'
import { sumCents } from './money'

// Funciones puras sobre filas vivas; los montos son centavos enteros.

export interface CategorySpending {
  categoryId: string | null
  name: string
  color: string | null
  cents: number
}

/** Gasto del mes por categoría, de mayor a menor. Sin categoría se agrupa aparte. */
export function spendingByCategory(
  txs: Transaction[],
  categories: Category[],
  month: string,
): CategorySpending[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const groups = new Map<string | null, number[]>()
  for (const t of txs) {
    if (t.kind !== 'expense' || monthKey(t.date) !== month) continue
    const id =
      t.category_id !== null && byId.has(t.category_id) ? t.category_id : null
    const list = groups.get(id)
    if (list) list.push(t.amount_cents)
    else groups.set(id, [t.amount_cents])
  }
  return [...groups]
    .map(([categoryId, values]) => {
      const cat = categoryId === null ? undefined : byId.get(categoryId)
      return {
        categoryId,
        name: cat?.name ?? 'Sin categoría',
        color: cat?.color ?? null,
        cents: sumCents(values),
      }
    })
    .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name, 'es'))
}

function lastMonths(endMonth: string, months: number): string[] {
  return Array.from({ length: months }, (_, i) =>
    shiftMonth(endMonth, i - (months - 1)),
  )
}

export interface MonthFlow {
  month: string
  incomeCents: number
  expenseCents: number
}

/** Ingresos y gastos de cada uno de los últimos `months` meses hasta `endMonth`. */
export function incomeVsExpenseByMonth(
  txs: Transaction[],
  endMonth: string,
  months = 12,
): MonthFlow[] {
  const list = lastMonths(endMonth, months)
  const income = new Map<string, number[]>(list.map((m) => [m, []]))
  const expense = new Map<string, number[]>(list.map((m) => [m, []]))
  for (const t of txs) {
    const target = (t.kind === 'income' ? income : expense).get(
      monthKey(t.date),
    )
    target?.push(t.amount_cents)
  }
  return list.map((month) => ({
    month,
    incomeCents: sumCents(income.get(month) ?? []),
    expenseCents: sumCents(expense.get(month) ?? []),
  }))
}

/**
 * Saldo total al cierre de cada mes: saldos iniciales más todo lo ocurrido
 * hasta el último día de ese mes, con las reglas de saldo total vigentes
 * (cuentas incluidas y no archivadas, según sus banderas actuales).
 */
export function totalBalanceByMonth(
  accounts: Account[],
  txs: Transaction[],
  transfers: Transfer[],
  endMonth: string,
  months = 12,
): { month: string; cents: number }[] {
  return lastMonths(endMonth, months).map((month) => {
    // Las fechas son YYYY-MM-DD: `${month}-31` las acota por orden de texto.
    const limit = `${month}-31`
    const balances = balancesByAccount(
      accounts,
      txs.filter((t) => t.date <= limit),
      transfers.filter((r) => r.date <= limit),
    )
    return { month, cents: totalBalance(accounts, balances) }
  })
}
