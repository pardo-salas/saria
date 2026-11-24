import type { InstallmentPlan, Transaction } from '../db/schema'
import {
  chargeDate,
  monthlyCommitmentCents,
  planProgress,
} from './installments'

// Fecha de un número de serie de Excel (25569 = 1970-01-01).
const serial = (n: number) =>
  new Date((n - 25569) * 86_400_000).toISOString().slice(0, 10)

function plan(over: Partial<InstallmentPlan>): InstallmentPlan {
  return {
    id: 'p1',
    user_id: 'u',
    created_at: '',
    updated_at: '',
    deleted_at: null,
    concept: 'x',
    account_id: 'a1',
    purchase_date: '2026-01-01',
    total_cents: 100000,
    months: 10,
    monthly_cents: 10000,
    paid_months: 0,
    active: true,
    category_id: null,
    ...over,
  }
}

// [concepto, serial compra, pago real, meses, restantes, total, acumulado, queda, serial fecha final]
const excel: [
  string,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
][] = [
  ['TLOZ', 46276, 34350, 4, 1, 137400, 103050, 34350, 46398],
  ['Litera escritorio', 46102, 33333, 12, 4, 399996, 266664, 133332, 46467],
  ['Moto', 45905, 216600, 18, 4, 4798800, 3732400, 1066400, 46451],
  ['Reloj', 46176, 22177, 12, 7, 266124, 110885, 155239, 46541],
  ['Switch', 46283, 91658, 12, 11, 1099900, 91658, 1008242, 46648],
  ['Casa', 46295, 189904, 276, 276, 65847600, 0, 65847600, 54696],
]

describe('compras a meses: cifras del Excel', () => {
  it.each(excel)(
    '%s',
    (_n, buy, real, months, left, total, acc, rest, endSerial) => {
      const p = plan({
        purchase_date: serial(buy),
        monthly_cents: real,
        months,
        total_cents: total,
        paid_months: months - left,
      })
      const r = planProgress(p, [])
      expect(r.paid).toBe(months - left)
      expect(r.remaining).toBe(left)
      expect(r.accumulatedCents).toBe(acc)
      expect(r.remainingCents).toBe(rest)
      expect(r.endDate).toBe(serial(endSerial))
    },
  )

  it('cuenta los movimientos vivos del plan como pagados', () => {
    const p = plan({ total_cents: 100000, months: 10, paid_months: 2 })
    const tx = (id: string, deleted: string | null, plan_id: string | null) =>
      ({
        id,
        deleted_at: deleted,
        installment_plan_id: plan_id,
      }) as Transaction
    const r = planProgress(p, [
      tx('a', null, 'p1'),
      tx('b', '2026-01-01T00:00:00Z', 'p1'),
      tx('c', null, 'otro'),
    ])
    expect(r.paid).toBe(3)
    expect(r.accumulatedCents).toBe(30000)
  })

  it('al terminar, el acumulado absorbe el redondeo', () => {
    const p = plan({ total_cents: 100000, months: 3, paid_months: 3 })
    const r = planProgress(p, [])
    expect(r.remaining).toBe(0)
    expect(r.accumulatedCents).toBe(100000)
    expect(r.remainingCents).toBe(0)
    expect(r.nextChargeDate).toBeNull()
  })
})

describe('chargeDate y próximo cargo', () => {
  it('cargo n = compra + n meses, con el día acotado', () => {
    const p = plan({ purchase_date: '2026-01-31' })
    expect(chargeDate(p, 1)).toBe('2026-02-28')
    expect(chargeDate(p, 2)).toBe('2026-03-31')
    expect(chargeDate(p, 12)).toBe('2027-01-31')
  })

  it('próximo cargo = cargo pagados + 1', () => {
    const p = plan({ purchase_date: '2026-09-11', paid_months: 3, months: 4 })
    expect(planProgress(p, []).nextChargeDate).toBe('2027-01-11')
  })
})

describe('monthlyCommitmentCents', () => {
  it('suma los planes vivos (activos o terminados) con un cargo en el mes', () => {
    const plans = [
      plan({ id: 'a', purchase_date: '2026-09-11', monthly_cents: 100 }),
      plan({ id: 'b', purchase_date: '2026-10-11', monthly_cents: 200 }),
      plan({
        id: 'c',
        purchase_date: '2026-01-05',
        months: 3,
        monthly_cents: 400,
      }),
      plan({
        id: 'd',
        purchase_date: '2026-09-11',
        monthly_cents: 800,
        active: false,
      }),
      plan({
        id: 'e',
        purchase_date: '2026-09-11',
        monthly_cents: 1600,
        deleted_at: 'x',
      }),
    ]
    // Noviembre: a y b; d está inactivo sin movimiento ligado (en pausa) y c terminó en abril.
    expect(monthlyCommitmentCents(plans, [], '2026-11')).toBe(300)
    // Un plan inactivo sí cuenta si ya tiene su movimiento del mes.
    const linked = {
      installment_plan_id: 'd',
      date: '2026-11-11',
      deleted_at: null,
    } as Transaction
    expect(monthlyCommitmentCents(plans, [linked], '2026-11')).toBe(1100)
    // Septiembre: nadie tiene cargo (los cargos empiezan un mes después).
    expect(monthlyCommitmentCents(plans, [], '2026-09')).toBe(0)
  })
})
