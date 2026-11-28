// Estado de una tarjeta de crédito: corte, próximo pago, disponible y uso.

import type { Account, Transaction } from '../db/schema'
import { clamped } from './recurring'

export interface CardStatus {
  lastCut: string
  periodSpentCents: number
  /** Deuda al corte: el pago del periodo. */
  nextPaymentCents: number
  /** Lo abonado a la tarjeta desde el corte. */
  paidSinceCutCents: number
  /** Lo que falta pagar del periodo (pago del periodo − abonos). */
  pendingPaymentCents: number
  nextPaymentDate: string
  /** Lo que aún falta cobrar de las compras a meses de la tarjeta. */
  installmentsPendingCents: number
  availableCents: number
  usedPercent: number
}

export interface CreditUse {
  availableCents: number
  usedPercent: number
}

/**
 * Disponible y porcentaje ocupado de una línea de crédito: la deuda actual más
 * lo que falta por cobrar de las compras a meses también ocupa la línea.
 * `null` si la cuenta no tiene línea.
 */
export function creditUse(
  limitCents: number | null,
  balanceCents: number,
  installmentsPendingCents = 0,
): CreditUse | null {
  if (limitCents === null) return null
  const occupied = Math.max(0, -balanceCents) + installmentsPendingCents
  return {
    availableCents: limitCents + balanceCents - installmentsPendingCents,
    // El porcentaje no es dinero: la división flotante es válida.
    usedPercent: limitCents > 0 ? Math.round((occupied * 100) / limitCents) : 0,
  }
}

function monthOf(date: string): [number, number] {
  return [Number(date.slice(0, 4)), Number(date.slice(5, 7))]
}

function shift(y: number, m: number, delta: number): [number, number] {
  const t = y * 12 + (m - 1) + delta
  return [Math.floor(t / 12), (t % 12) + 1]
}

/**
 * `balanceAt(date)` = saldo de la cuenta al cierre de ese día (negativo = deuda).
 * `null` si a la cuenta le faltan línea, día de corte o día de pago.
 */
export function cardStatus(
  account: Account,
  balanceAt: (date: string) => number,
  txs: Transaction[],
  today: string,
  installmentsPendingCents = 0,
): CardStatus | null {
  const { credit_limit_cents: limit, statement_day, due_day } = account
  if (limit === null || statement_day === null || due_day === null) return null

  const [y, m] = monthOf(today)
  let lastCut = clamped(y, m, statement_day)
  if (lastCut > today) {
    const [py, pm] = shift(y, m, -1)
    lastCut = clamped(py, pm, statement_day)
  }

  const [cy, cm] = monthOf(lastCut)
  let nextPaymentDate = clamped(cy, cm, due_day)
  if (nextPaymentDate <= lastCut) {
    const [ny, nm] = shift(cy, cm, 1)
    nextPaymentDate = clamped(ny, nm, due_day)
  }

  let periodSpentCents = 0
  for (const t of txs) {
    if (
      t.deleted_at === null &&
      t.kind === 'expense' &&
      t.account_id === account.id &&
      t.date > lastCut &&
      t.date <= today
    )
      periodSpentCents += t.amount_cents
  }

  const balanceToday = balanceAt(today)
  const balanceAtCut = balanceAt(lastCut)
  const nextPaymentCents = Math.max(0, -balanceAtCut)
  // Abonos desde el corte: lo que subió el saldo además de lo gastado.
  const paidSinceCutCents = Math.max(
    0,
    balanceToday - balanceAtCut + periodSpentCents,
  )
  const use = creditUse(limit, balanceToday, installmentsPendingCents)!
  return {
    lastCut,
    periodSpentCents,
    nextPaymentCents,
    paidSinceCutCents,
    pendingPaymentCents: Math.max(0, nextPaymentCents - paidSinceCutCents),
    nextPaymentDate,
    installmentsPendingCents,
    ...use,
  }
}
