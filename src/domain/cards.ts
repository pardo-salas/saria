// Estado de una tarjeta de crédito: corte, próximo pago, disponible y uso.

import type { Account, Transaction } from '../db/schema'
import { clamped } from './recurring'

export interface CardStatus {
  lastCut: string
  periodSpentCents: number
  nextPaymentCents: number
  nextPaymentDate: string
  availableCents: number
  usedPercent: number
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

  const balance = balanceAt(today)
  const debt = Math.max(0, -balance)
  return {
    lastCut,
    periodSpentCents,
    nextPaymentCents: Math.max(0, -balanceAt(lastCut)),
    nextPaymentDate,
    availableCents: limit + balance,
    // El porcentaje no es dinero: la división flotante es válida.
    usedPercent: limit > 0 ? Math.round((debt * 100) / limit) : 0,
  }
}
