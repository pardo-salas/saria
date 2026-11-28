import type { Account, Transaction } from '../db/schema'
import { cardStatus, creditUse } from './cards'

function card(over: Partial<Account>): Account {
  return {
    id: 'c1',
    user_id: 'u',
    created_at: '',
    updated_at: '',
    deleted_at: null,
    name: 'Tarjeta',
    type: 'credit',
    institution: null,
    color: null,
    icon: null,
    initial_balance_cents: 0,
    include_in_total: true,
    archived: false,
    position: 0,
    credit_limit_cents: 1_000_000,
    statement_day: 23,
    due_day: 10,
    yield_rate: null,
    yield_cap_cents: null,
    yield_rate_over_cap: null,
    ...over,
  }
}

const exp = (date: string, amount: number, account = 'c1') =>
  ({
    kind: 'expense',
    date,
    amount_cents: amount,
    account_id: account,
    deleted_at: null,
  }) as Transaction

describe('cardStatus', () => {
  it('Nu (corte 23, pago 10): el corte cruza de mes', () => {
    const txs = [
      exp('2026-10-20', 30000),
      exp('2026-10-25', 5000),
      exp('2026-11-02', 7000),
    ]
    // Saldo al fin de cada día: deuda 30000 al corte, 35000 el 25-oct, 42000 hoy.
    const balanceAt = (d: string) =>
      -txs.filter((t) => t.date <= d).reduce((s, t) => s + t.amount_cents, 0)
    const s = cardStatus(card({}), balanceAt, txs, '2026-11-05')!
    expect(s.lastCut).toBe('2026-10-23')
    expect(s.nextPaymentDate).toBe('2026-11-10')
    expect(s.nextPaymentCents).toBe(30000)
    expect(s.periodSpentCents).toBe(12000)
    expect(s.availableCents).toBe(1_000_000 - 42000)
    expect(s.usedPercent).toBe(4)
  })

  it('Didi (corte 7, pago 22): el pago cae después del corte en el mismo mes', () => {
    const txs = [exp('2026-11-01', 100000), exp('2026-11-10', 50000)]
    const balanceAt = (d: string) =>
      -txs.filter((t) => t.date <= d).reduce((s, t) => s + t.amount_cents, 0)
    const s = cardStatus(
      card({ statement_day: 7, due_day: 22, credit_limit_cents: 500_000 }),
      balanceAt,
      txs,
      '2026-11-23',
    )!
    expect(s.lastCut).toBe('2026-11-07')
    expect(s.nextPaymentDate).toBe('2026-11-22')
    expect(s.nextPaymentCents).toBe(100000)
    expect(s.periodSpentCents).toBe(50000)
    expect(s.usedPercent).toBe(30)
  })

  it('hoy es el día de corte: ese día ya es el último corte', () => {
    const s = cardStatus(
      card({ statement_day: 23 }),
      () => 0,
      [],
      '2026-11-23',
    )!
    expect(s.lastCut).toBe('2026-11-23')
    expect(s.nextPaymentDate).toBe('2026-12-10')
  })

  it('día de corte 31 se acota al fin de mes', () => {
    const s = cardStatus(
      card({ statement_day: 31 }),
      () => 0,
      [],
      '2026-03-05',
    )!
    expect(s.lastCut).toBe('2026-02-28')
  })

  it('sin deuda al corte o saldo a favor: próximo pago 0, uso 0', () => {
    const s = cardStatus(card({}), () => 5000, [], '2026-11-05')!
    expect(s.nextPaymentCents).toBe(0)
    expect(s.usedPercent).toBe(0)
    expect(s.availableCents).toBe(1_005_000)
  })

  it('devuelve null si faltan línea, corte o pago', () => {
    expect(
      cardStatus(card({ statement_day: null }), () => 0, [], '2026-11-05'),
    ).toBeNull()
    expect(
      cardStatus(card({ due_day: null }), () => 0, [], '2026-11-05'),
    ).toBeNull()
    expect(
      cardStatus(card({ credit_limit_cents: null }), () => 0, [], '2026-11-05'),
    ).toBeNull()
  })
})

describe('creditUse', () => {
  it('lo pendiente a meses también ocupa la línea', () => {
    // Línea 10,000; deuda 2,000; faltan 3,000 a meses.
    expect(creditUse(1_000_000, -200_000, 300_000)).toEqual({
      availableCents: 500_000,
      usedPercent: 50,
    })
  })

  it('sin línea no hay uso', () => {
    expect(creditUse(null, -100, 0)).toBeNull()
  })

  it('cardStatus descuenta lo pendiente a meses del disponible', () => {
    const s = cardStatus(card({}), () => -100_000, [], '2026-11-05', 250_000)!
    expect(s.availableCents).toBe(650_000)
    expect(s.usedPercent).toBe(35)
    expect(s.installmentsPendingCents).toBe(250_000)
  })
})

describe('cardStatus: lo pendiente del periodo', () => {
  it('resta los abonos hechos desde el corte', () => {
    // Deuda al corte (23-oct) 30,000; luego gasto 5,000 y abono 20,000.
    const balanceAt = (d: string) => (d <= '2026-10-23' ? -30000 : -15000)
    const s = cardStatus(
      card({}),
      balanceAt,
      [exp('2026-10-25', 5000)],
      '2026-11-05',
    )!
    expect(s.nextPaymentCents).toBe(30000)
    expect(s.paidSinceCutCents).toBe(20000)
    expect(s.pendingPaymentCents).toBe(10000)
  })

  it('pagado completo deja 0 pendiente', () => {
    const balanceAt = (d: string) => (d <= '2026-10-23' ? -30000 : 0)
    const s = cardStatus(card({}), balanceAt, [], '2026-11-05')!
    expect(s.pendingPaymentCents).toBe(0)
  })
})
