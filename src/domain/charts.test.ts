import { describe, expect, it } from 'vitest'
import type { Account, Category, Transaction, Transfer } from '../db/schema'
import {
  incomeVsExpenseByMonth,
  spendingByCategory,
  totalBalanceByMonth,
} from './charts'

const base = {
  user_id: 'u1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
}
let n = 0
const acct = (o: Partial<Account> & { id: string }): Account => ({
  ...base,
  name: o.id,
  type: 'debit',
  institution: null,
  color: null,
  icon: null,
  initial_balance_cents: 0,
  include_in_total: true,
  archived: false,
  position: 0,
  credit_limit_cents: null,
  statement_day: null,
  due_day: null,
  yield_rate: null,
  yield_cap_cents: null,
  yield_rate_over_cap: null,
  ...o,
})
const cat = (
  id: string,
  name: string,
  color: string | null = null,
): Category => ({
  ...base,
  id,
  name,
  kind: 'expense',
  icon: null,
  color,
  monthly_limit_cents: null,
  archived: false,
  position: 0,
})
const tx = (o: Partial<Transaction>): Transaction => ({
  ...base,
  id: `t${n++}`,
  kind: 'expense',
  amount_cents: 100,
  date: '2026-03-10',
  account_id: 'a',
  category_id: null,
  note: null,
  recurring_id: null,
  installment_plan_id: null,
  legacy_id: null,
  ...o,
})
const tr = (o: Partial<Transfer>): Transfer => ({
  ...base,
  id: `r${n++}`,
  from_account_id: 'a',
  to_account_id: 'b',
  amount_cents: 100,
  date: '2026-03-10',
  note: null,
  legacy_id: null,
  ...o,
})

describe('spendingByCategory', () => {
  it('suma solo gastos del mes, agrupa sin categoría y ordena de mayor a menor', () => {
    const cats = [cat('c1', 'Comida', '#E8735A'), cat('c2', 'Renta')]
    const txs = [
      tx({ category_id: 'c1', amount_cents: 5000 }),
      tx({ category_id: 'c1', amount_cents: 2500 }),
      tx({ category_id: 'c2', amount_cents: 10000 }),
      tx({ category_id: null, amount_cents: 300 }),
      tx({ kind: 'income', category_id: 'c1', amount_cents: 99999 }),
      tx({ category_id: 'c1', date: '2026-02-28', amount_cents: 777 }),
    ]
    expect(spendingByCategory(txs, cats, '2026-03')).toEqual([
      { categoryId: 'c2', name: 'Renta', color: null, cents: 10000 },
      { categoryId: 'c1', name: 'Comida', color: '#E8735A', cents: 7500 },
      { categoryId: null, name: 'Sin categoría', color: null, cents: 300 },
    ])
    expect(spendingByCategory(txs, cats, '2026-04')).toEqual([])
  })
})

describe('incomeVsExpenseByMonth', () => {
  it('devuelve 12 meses terminando en el actual, con ceros sin movimientos', () => {
    const txs = [
      tx({ kind: 'income', amount_cents: 5000, date: '2026-03-01' }),
      tx({ amount_cents: 1200, date: '2026-03-05' }),
      tx({ amount_cents: 800, date: '2026-01-31' }),
      tx({ amount_cents: 1, date: '2025-03-15' }),
    ]
    const r = incomeVsExpenseByMonth(txs, '2026-03')
    expect(r).toHaveLength(12)
    expect(r[0]!.month).toBe('2025-04')
    expect(r[11]).toEqual({
      month: '2026-03',
      incomeCents: 5000,
      expenseCents: 1200,
    })
    expect(r[9]).toEqual({
      month: '2026-01',
      incomeCents: 0,
      expenseCents: 800,
    })
    expect(r[10]).toEqual({
      month: '2026-02',
      incomeCents: 0,
      expenseCents: 0,
    })
  })
})

describe('totalBalanceByMonth', () => {
  it('acumula al cierre de mes, arrastra meses vacíos e ignora traspasos internos', () => {
    const accounts = [
      acct({ id: 'a', initial_balance_cents: 1000 }),
      acct({ id: 'b', initial_balance_cents: 500 }),
      acct({ id: 'x', initial_balance_cents: 9999, include_in_total: false }),
    ]
    const txs = [
      tx({ kind: 'income', amount_cents: 2000, date: '2026-01-31' }),
      tx({ amount_cents: 300, date: '2026-03-02' }),
    ]
    const transfers = [
      tr({ date: '2026-01-15', amount_cents: 400 }), // a -> b: no cambia el total
      tr({
        date: '2026-03-03',
        from_account_id: 'a',
        to_account_id: 'x',
        amount_cents: 200,
      }), // sale del total
    ]
    const r = totalBalanceByMonth(accounts, txs, transfers, '2026-03', 3)
    expect(r).toEqual([
      { month: '2026-01', cents: 3500 },
      { month: '2026-02', cents: 3500 }, // sin movimientos: valor arrastrado
      { month: '2026-03', cents: 3000 },
    ])
  })
})
