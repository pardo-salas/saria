import type { Account, Transaction, Transfer } from '../db/schema'
import {
  accountsBreakdown,
  balancesByAccount,
  groupOf,
  periodSummary,
  totalBalance,
  waterLevel,
} from './balances'

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
const tx = (o: Partial<Transaction>): Transaction => ({
  ...base,
  id: `t${n++}`,
  kind: 'expense',
  amount_cents: 0,
  date: '2026-11-01',
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
  amount_cents: 0,
  date: '2026-11-01',
  note: null,
  legacy_id: null,
  ...o,
})

describe('balancesByAccount', () => {
  it('combina inicial, ingresos, gastos y transferencias', () => {
    const accounts = [
      acct({ id: 'a', initial_balance_cents: 10000 }),
      acct({ id: 'b' }),
    ]
    const txs = [
      tx({ kind: 'income', amount_cents: 5000 }),
      tx({ kind: 'expense', amount_cents: 2000 }),
    ]
    const transfers = [
      tr({ from_account_id: 'b', to_account_id: 'a', amount_cents: 1000 }),
      tr({ from_account_id: 'a', to_account_id: 'b', amount_cents: 500 }),
    ]
    const m = balancesByAccount(accounts, txs, transfers)
    expect(m.get('a')).toBe(13500)
    expect(m.get('b')).toBe(-500)
  })
  it('saldo inicial negativo en crédito', () => {
    const m = balancesByAccount(
      [acct({ id: 'a', type: 'credit', initial_balance_cents: -285936 })],
      [tx({ amount_cents: 10000 })],
      [],
    )
    expect(m.get('a')).toBe(-295936)
  })
  it('cuenta movimientos con fecha futura', () => {
    const m = balancesByAccount(
      [acct({ id: 'a' })],
      [tx({ kind: 'income', amount_cents: 700, date: '2030-01-01' })],
      [],
    )
    expect(m.get('a')).toBe(700)
  })
})

describe('totalBalance', () => {
  it('excluye cuentas fuera del total y archivadas', () => {
    const accounts = [
      acct({ id: 'a' }),
      acct({ id: 'b', include_in_total: false }),
      acct({ id: 'c', archived: true }),
    ]
    const balances = new Map([
      ['a', 100],
      ['b', 200],
      ['c', 400],
    ])
    expect(totalBalance(accounts, balances)).toBe(100)
  })
})

describe('groupOf', () => {
  it('agrupa por tipo', () => {
    expect(groupOf('cash')).toBe('liquid')
    expect(groupOf('debit')).toBe('liquid')
    expect(groupOf('credit')).toBe('credit')
    expect(groupOf('investment')).toBe('investment')
  })
})

describe('accountsBreakdown', () => {
  const accounts = [
    acct({ id: 'nu', type: 'debit', position: 0 }),
    acct({ id: 'cartera', type: 'cash', position: 1 }),
    acct({ id: 'bbva', type: 'credit', position: 2 }),
    acct({
      id: 'banamex',
      type: 'credit',
      position: 3,
      include_in_total: false,
    }),
    acct({
      id: 'poliza',
      type: 'investment',
      position: 4,
      include_in_total: false,
    }),
    acct({ id: 'vieja', type: 'cash', position: 5, archived: true }),
  ]
  const balances = new Map([
    ['nu', 2517663],
    ['cartera', 61500],
    ['bbva', -285936],
    ['banamex', -351258],
    ['poliza', 7166202],
    ['vieja', 999],
  ])
  it('calcula total, subtotales, deuda e inversión aparte', () => {
    const b = accountsBreakdown(accounts, balances)
    expect(b.totalCents).toBe(2293227)
    expect(b.groups.map((g) => g.group)).toEqual([
      'liquid',
      'credit',
      'investment',
    ])
    expect(b.groups.map((g) => g.subtotalCents)).toEqual([
      2579163, -637194, 7166202,
    ])
    expect(b.groups[0].accounts.map((a) => a.id)).toEqual(['nu', 'cartera'])
    expect(b.creditDebtCents).toBe(637194)
    expect(b.investmentApartCents).toBe(7166202)
  })
  it('omite grupos vacíos', () => {
    const b = accountsBreakdown(
      [acct({ id: 'x', type: 'cash' })],
      new Map([['x', 5]]),
    )
    expect(b.groups.map((g) => g.group)).toEqual(['liquid'])
    expect(b.creditDebtCents).toBe(0)
    expect(b.investmentApartCents).toBe(0)
  })
})

describe('periodSummary', () => {
  it('suma hoy y el mes, ignorando otros meses', () => {
    const s = periodSummary(
      [
        tx({ kind: 'expense', amount_cents: 300, date: '2026-11-22' }),
        tx({ kind: 'expense', amount_cents: 200, date: '2026-11-01' }),
        tx({ kind: 'income', amount_cents: 9000, date: '2026-10-31' }),
        tx({
          kind: 'income',
          amount_cents: 50,
          date: '2026-11-22',
          account_id: 'excluida',
        }),
      ],
      '2026-11-22',
    )
    expect(s.today).toEqual({ incomeCents: 50, expenseCents: 300 })
    expect(s.month).toEqual({ incomeCents: 50, expenseCents: 500 })
  })
})

describe('periodSummary (archivadas)', () => {
  it('incluye movimientos de una cuenta archivada', () => {
    // periodSummary no recibe cuentas: suma todos los movimientos que le pasan.
    const s = periodSummary(
      [
        tx({
          kind: 'expense',
          amount_cents: 70,
          date: '2026-11-22',
          account_id: 'archivada',
        }),
      ],
      '2026-11-22',
    )
    expect(s.today.expenseCents).toBe(70)
    expect(s.month.expenseCents).toBe(70)
  })
})

describe('waterLevel', () => {
  it('calcula lo que queda', () => {
    expect(waterLevel(1860000, 742000, 8)).toEqual({
      state: 'ok',
      remainingCents: 1118000,
      percent: 60,
      daysLeft: 8,
    })
  })
  it('acota en 0 si se gastó más que el sueldo', () => {
    expect(waterLevel(1860000, 2000000, 3)).toMatchObject({
      remainingCents: -140000,
      percent: 0,
    })
  })
  it('sueldo 0 cuenta como sin sueldo', () => {
    expect(waterLevel(0, 100, 5)).toEqual({ state: 'no-salary' })
  })
  it('sin sueldo', () => {
    expect(waterLevel(null, 5, 1)).toEqual({ state: 'no-salary' })
  })
  it('100% sin gastos', () => {
    expect(waterLevel(1000, 0, 0)).toMatchObject({ percent: 100, daysLeft: 0 })
  })
})
