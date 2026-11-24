// Rendimiento estimado mensual de una cuenta (tasas en porcentaje anual).

import type { Account } from '../db/schema'

export function monthlyYieldCents(
  account: Pick<
    Account,
    'yield_rate' | 'yield_cap_cents' | 'yield_rate_over_cap'
  >,
  balanceCents: number,
): number {
  const rate = account.yield_rate
  if (rate === null || balanceCents <= 0) return 0
  const cap = account.yield_cap_cents
  if (cap === null) return Math.round((balanceCents * rate) / 100 / 12)
  const under = Math.min(balanceCents, cap)
  const over = Math.max(balanceCents - cap, 0)
  const overRate = account.yield_rate_over_cap ?? 0
  return Math.round((under * rate + over * overRate) / 100 / 12)
}
