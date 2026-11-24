import type {
  InstallmentPlan,
  RecurringPayment,
  Transaction,
} from '../db/schema'
import { monthSummary } from './monthSummary'

const rec = (over: Partial<RecurringPayment>): RecurringPayment => ({
  id: 'r',
  user_id: 'u',
  created_at: '',
  updated_at: '',
  deleted_at: null,
  name: 'x',
  kind: 'expense',
  amount_cents: 100000,
  account_id: 'a1',
  category_id: null,
  frequency: 'monthly',
  day_of_month: 10,
  second_day_of_month: null,
  interval_days: null,
  start_date: '2026-01-10',
  end_date: null,
  next_due_date: '2026-11-10',
  auto_create: false,
  active: true,
  ...over,
})

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 't',
  user_id: 'u',
  created_at: '',
  updated_at: '',
  deleted_at: null,
  kind: 'expense',
  amount_cents: 1000,
  date: '2026-11-03',
  account_id: 'a1',
  category_id: null,
  note: null,
  recurring_id: null,
  installment_plan_id: null,
  legacy_id: null,
  ...over,
})

const plan: InstallmentPlan = {
  id: 'p1',
  user_id: 'u',
  created_at: '',
  updated_at: '',
  deleted_at: null,
  concept: 'x',
  account_id: 'a1',
  purchase_date: '2026-09-11',
  total_cents: 1000000,
  months: 10,
  monthly_cents: 200000,
  paid_months: 0,
  active: true,
  category_id: null,
}

describe('monthSummary', () => {
  it('quincenal cuenta 2 veces; inactivos e ingresos no cuentan', () => {
    const r = monthSummary({
      salaryCents: 2_000_000,
      recurring: [
        rec({ id: 'a', frequency: 'monthly', amount_cents: 100000 }),
        rec({
          id: 'b',
          frequency: 'semimonthly',
          day_of_month: 15,
          second_day_of_month: 30,
          amount_cents: 50000,
        }),
        rec({ id: 'c', active: false, amount_cents: 999 }),
        rec({ id: 'd', kind: 'income', amount_cents: 999 }),
        rec({ id: 'e', deleted_at: 'x', amount_cents: 999 }),
      ],
      plans: [plan],
      txs: [],
      month: '2026-11',
    })
    expect(r.fixedCents).toBe(200000)
    expect(r.commitmentsCents).toBe(200000)
    expect(r.availableCents).toBe(1_600_000)
    expect(r.spentOutsideCents).toBe(0)
    expect(r.leftCents).toBe(1_600_000)
  })

  it('un pago semanal cuenta todas sus ocurrencias del mes', () => {
    const r = monthSummary({
      salaryCents: 1_000_000,
      recurring: [
        rec({
          frequency: 'weekly',
          start_date: '2026-11-02',
          next_due_date: '2026-11-02',
          amount_cents: 1000,
        }),
      ],
      plans: [],
      txs: [],
      month: '2026-11',
    })
    // 2, 9, 16, 23 y 30 de noviembre.
    expect(r.fixedCents).toBe(5000)
  })

  it('gastado: solo gastos del mes sin recurring_id ni installment_plan_id', () => {
    const r = monthSummary({
      salaryCents: 1_000_000,
      recurring: [],
      plans: [],
      txs: [
        tx({ id: '1', amount_cents: 1000 }),
        tx({ id: '2', amount_cents: 2000, recurring_id: 'r' }),
        tx({ id: '3', amount_cents: 4000, installment_plan_id: 'p1' }),
        tx({ id: '4', amount_cents: 8000, date: '2026-10-30' }),
        tx({ id: '5', amount_cents: 16000, kind: 'income' }),
        tx({ id: '6', amount_cents: 32000, deleted_at: 'x' }),
      ],
      month: '2026-11',
    })
    expect(r.spentOutsideCents).toBe(1000)
    expect(r.leftCents).toBe(1_000_000 - 1000)
  })
})
