import { describe, expect, it } from 'vitest'
import { excelPreview, parseExcelFile } from './excelFile'

const ACC = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PLAN = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const lookups = { accountIds: new Set([ACC]), categoryIds: new Set<string>() }
const plan = {
  id: PLAN,
  concept: 'Reloj',
  account_id: ACC,
  purchase_date: '2026-06-10',
  total_cents: 120000,
  months: 6,
  monthly_cents: 20000,
  paid_months: 2,
  active: true,
  category_id: null,
}
const make = (extra: object = {}) =>
  JSON.stringify({
    format: 'saria-excel',
    version: 1,
    installment_plans: [plan],
    account_updates: [{ id: ACC, due_day: 5 }],
    deactivate_recurring_ids: [],
    retag: [],
    ...extra,
  })

describe('parseExcelFile', () => {
  it('acepta un archivo válido y cuenta lo que hará', () => {
    const r = parseExcelFile(make(), lookups)
    expect(r.ok && excelPreview(r.file)).toBe(
      'Se agregarán 1 compras a meses, se actualizarán 1 cuentas y se desactivarán 0 pagos habituales',
    )
  })

  it('rechaza otros formatos, cuentas inexistentes y campos no permitidos', () => {
    expect(parseExcelFile('{"format":"saria-recurring"}', lookups).ok).toBe(
      false,
    )
    expect(
      parseExcelFile(
        make({ account_updates: [{ id: PLAN, due_day: 5 }] }),
        lookups,
      ).ok,
    ).toBe(false)
    expect(
      parseExcelFile(
        make({ account_updates: [{ id: ACC, name: 'x' }] }),
        lookups,
      ).ok,
    ).toBe(false)
  })
})
