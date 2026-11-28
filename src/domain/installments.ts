// Compras a meses: avance, fechas de cargo y compromiso mensual (fórmulas del Excel).

import type { InstallmentPlan, Transaction } from '../db/schema'
import { clamped } from './recurring'
import { SARIA_NAMESPACE } from './seedCategories'
import { uuidV5 } from './uuid'

/** `date` + `n` meses, con el día acotado al fin de mes (31 ene + 1 = 28 feb). */
export function addMonths(date: string, n: number): string {
  const total =
    Number(date.slice(0, 4)) * 12 + (Number(date.slice(5, 7)) - 1) + n
  return clamped(
    Math.floor(total / 12),
    (total % 12) + 1,
    Number(date.slice(8, 10)),
  )
}

/** Fecha del cargo n-ésimo (n = 1…meses). */
export function chargeDate(plan: InstallmentPlan, n: number): string {
  return addMonths(plan.purchase_date, n)
}

/** ID del movimiento del cargo n: igual en cualquier dispositivo. */
export function chargeTransactionId(
  planId: string,
  n: number,
): Promise<string> {
  return uuidV5(`${planId}:${n}`, SARIA_NAMESPACE)
}

export interface PlanProgress {
  paid: number
  remaining: number
  costPerMonthCents: number
  accumulatedCents: number
  remainingCents: number
  endDate: string
  nextChargeDate: string | null
}

/** Pagados = meses de antes de Saria + movimientos vivos ligados al plan. */
export function paidCount(plan: InstallmentPlan, txs: Transaction[]): number {
  return (
    plan.paid_months +
    txs.filter(
      (t) => t.deleted_at === null && t.installment_plan_id === plan.id,
    ).length
  )
}

export function planProgress(
  plan: InstallmentPlan,
  txs: Transaction[],
): PlanProgress {
  const paid = paidCount(plan, txs)
  const remaining = Math.max(0, plan.months - paid)
  const costPerMonthCents = Math.round(plan.total_cents / plan.months)
  // El último mes absorbe el redondeo.
  const accumulatedCents =
    remaining === 0 ? plan.total_cents : paid * costPerMonthCents
  return {
    paid,
    remaining,
    costPerMonthCents,
    accumulatedCents,
    remainingCents: plan.total_cents - accumulatedCents,
    endDate: addMonths(plan.purchase_date, plan.months),
    nextChargeDate: remaining === 0 ? null : chargeDate(plan, paid + 1),
  }
}

/** Σ `monthly_cents` de los planes vivos (activos o ya terminados) con un cargo en `month` (YYYY-MM). */
export function monthlyCommitmentCents(
  plans: InstallmentPlan[],
  txs: Transaction[],
  month: string,
): number {
  let total = 0
  for (const p of plans) {
    if (p.deleted_at !== null) continue
    // Un plan inactivo (terminado o en pausa, como una hipoteca por nómina)
    // solo compromete el mes si ya tiene ahí un movimiento ligado.
    const hasLinked = () =>
      txs.some(
        (t) =>
          t.deleted_at === null &&
          t.installment_plan_id === p.id &&
          t.date.slice(0, 7) === month,
      )
    for (let n = 1; n <= p.months; n++) {
      const d = chargeDate(p, n)
      if (d.slice(0, 7) === month) {
        if (!p.active && !hasLinked()) break
        total += p.monthly_cents
        break
      }
      if (d.slice(0, 7) > month) break
    }
  }
  return total
}

/**
 * Por cuenta: lo que falta cobrar de sus compras a meses activas. Los planes
 * en pausa (como una hipoteca por nómina) no ocupan la línea.
 */
export function pendingInstallmentsByAccount(
  plans: InstallmentPlan[],
  txs: Transaction[],
): Map<string, number> {
  const out = new Map<string, number>()
  for (const p of plans) {
    if (p.deleted_at !== null || !p.active || p.account_id === null) continue
    const { remainingCents } = planProgress(p, txs)
    if (remainingCents > 0)
      out.set(p.account_id, (out.get(p.account_id) ?? 0) + remainingCents)
  }
  return out
}
