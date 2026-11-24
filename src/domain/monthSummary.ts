// Resumen del mes: sueldo − gastos fijos − compras a meses − gastado fuera.

import type {
  InstallmentPlan,
  RecurringPayment,
  Transaction,
} from '../db/schema'
import { monthlyCommitmentCents } from './installments'
import { sumCents } from './money'
import { nextOccurrence } from './recurring'

export interface MonthSummary {
  fixedCents: number
  commitmentsCents: number
  availableCents: number
  spentOutsideCents: number
  leftCents: number
}

// Tope por pago (uno diario da ~31 ocurrencias en un mes).
const MAX_OCURRENCIAS = 62

/** Cuántas veces toca el pago dentro de `month` (YYYY-MM), pagado o no. */
function occurrencesInMonth(p: RecurringPayment, month: string): number {
  // `nextOccurrence` busca desde el día siguiente: se parte del último día del mes anterior.
  let cursor: string | null = nextOccurrence(p, lastDayOfPreviousMonth(month))
  let count = 0
  while (
    cursor !== null &&
    cursor.slice(0, 7) === month &&
    count < MAX_OCURRENCIAS
  ) {
    count += 1
    cursor = nextOccurrence(p, cursor)
  }
  return count
}

function lastDayOfPreviousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, 0)).toISOString().slice(0, 10)
}

export function monthSummary(input: {
  salaryCents: number
  recurring: RecurringPayment[]
  plans: InstallmentPlan[]
  txs: Transaction[]
  month: string
}): MonthSummary {
  const { salaryCents, recurring, plans, txs, month } = input
  const fixedCents = sumCents(
    recurring
      .filter((p) => p.active && p.deleted_at === null && p.kind === 'expense')
      .map((p) => p.amount_cents * occurrencesInMonth(p, month)),
  )
  const livePlans = plans.filter((p) => p.deleted_at === null)
  const commitmentsCents = monthlyCommitmentCents(livePlans, txs, month)
  const spentOutsideCents = sumCents(
    txs
      .filter(
        (t) =>
          t.deleted_at === null &&
          t.kind === 'expense' &&
          t.date.slice(0, 7) === month &&
          t.recurring_id === null &&
          t.installment_plan_id === null,
      )
      .map((t) => t.amount_cents),
  )
  const availableCents = salaryCents - fixedCents - commitmentsCents
  return {
    fixedCents,
    commitmentsCents,
    availableCents,
    spentOutsideCents,
    leftCents: availableCents - spentOutsideCents,
  }
}
