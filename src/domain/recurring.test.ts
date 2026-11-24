import { describe, expect, it } from 'vitest'
import type { RecurringPayment } from '../db/schema'
import { dueGroups, nextOccurrence } from './recurring'

function pago(over: Partial<RecurringPayment>): RecurringPayment {
  return {
    id: 'p1',
    user_id: 'u',
    created_at: '',
    updated_at: '',
    deleted_at: null,
    name: 'Pago',
    kind: 'expense',
    amount_cents: 100,
    account_id: null,
    category_id: null,
    frequency: 'monthly',
    day_of_month: null,
    second_day_of_month: null,
    interval_days: null,
    start_date: null,
    end_date: null,
    next_due_date: null,
    auto_create: false,
    active: true,
    ...over,
  }
}

describe('nextOccurrence', () => {
  it('mensual día 31 cae en el último día de febrero', () => {
    const p = pago({ day_of_month: 31 })
    expect(nextOccurrence(p, '2026-01-31')).toBe('2026-02-28')
    expect(nextOccurrence(p, '2028-01-31')).toBe('2028-02-29')
  })

  it('quincenal 15/31 en abril da 15 y luego 30', () => {
    const p = pago({
      frequency: 'semimonthly',
      day_of_month: 15,
      second_day_of_month: 31,
    })
    expect(nextOccurrence(p, '2026-04-01')).toBe('2026-04-15')
    expect(nextOccurrence(p, '2026-04-15')).toBe('2026-04-30')
    expect(nextOccurrence(p, '2026-04-30')).toBe('2026-05-15')
  })

  it('cada 14 días desde start_date', () => {
    const p = pago({ frequency: 'biweekly', start_date: '2026-11-23' })
    expect(nextOccurrence(p, '2026-01-01')).toBe('2026-11-23')
    expect(nextOccurrence(p, '2026-11-23')).toBe('2026-12-07')
    expect(nextOccurrence(p, '2026-12-07')).toBe('2026-12-21')
  })

  it('end_date corta la serie', () => {
    const p = pago({ day_of_month: 10, end_date: '2026-03-10' })
    expect(nextOccurrence(p, '2026-02-10')).toBe('2026-03-10')
    expect(nextOccurrence(p, '2026-03-10')).toBeNull()
  })

  it('anual 29 feb cae en 28 feb en años no bisiestos', () => {
    const p = pago({ frequency: 'yearly', start_date: '2024-02-29' })
    expect(nextOccurrence(p, '2024-02-29')).toBe('2025-02-28')
    expect(nextOccurrence(p, '2027-03-01')).toBe('2028-02-29')
  })
})

describe('dueGroups', () => {
  it('separa vencidos, hoy y esta semana, ordenados y sin inactivos', () => {
    const today = '2026-11-23'
    const g = dueGroups(
      [
        pago({ id: 'a', name: 'B', next_due_date: '2026-11-20' }),
        pago({ id: 'b', name: 'A', next_due_date: '2026-11-20' }),
        pago({ id: 'c', name: 'C', next_due_date: today }),
        pago({ id: 'd', name: 'D', next_due_date: '2026-11-29' }),
        pago({ id: 'e', name: 'E', next_due_date: '2026-11-30' }),
        pago({ id: 'f', name: 'F', next_due_date: today, active: false }),
        pago({ id: 'g', name: 'G', next_due_date: today, deleted_at: 'x' }),
        pago({ id: 'h', name: 'H', next_due_date: null }),
      ],
      today,
    )
    expect(g.overdue.map((p) => p.id)).toEqual(['b', 'a'])
    expect(g.today.map((p) => p.id)).toEqual(['c'])
    expect(g.week.map((p) => p.id)).toEqual(['d'])
  })
})
