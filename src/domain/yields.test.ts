import type { Account } from '../db/schema'
import { monthlyYieldCents } from './yields'

const didi = {
  yield_rate: 15,
  yield_cap_cents: 1_000_000,
  yield_rate_over_cap: 7,
} as Account

describe('monthlyYieldCents', () => {
  it('Didi bajo el tope: todo a la tasa', () => {
    expect(monthlyYieldCents(didi, 500_000)).toBe(6250)
  })

  it('Didi sobre el tope: el excedente a la otra tasa', () => {
    // (1,000,000 × 15 + 684,376 × 7) / 100 / 12 = 16492.19…
    expect(monthlyYieldCents(didi, 1_684_376)).toBe(16492)
  })

  it('sin tope todo va a la tasa', () => {
    const a = {
      yield_rate: 12,
      yield_cap_cents: null,
      yield_rate_over_cap: null,
    } as Account
    expect(monthlyYieldCents(a, 1_200_000)).toBe(12000)
  })

  it('sin tasa o con saldo no positivo rinde 0', () => {
    const a = {
      yield_rate: null,
      yield_cap_cents: null,
      yield_rate_over_cap: null,
    } as Account
    expect(monthlyYieldCents(a, 500_000)).toBe(0)
    expect(monthlyYieldCents(didi, -100)).toBe(0)
  })
})
