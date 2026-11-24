// Generación de los cargos mensuales de las compras a meses. Los IDs son
// deterministas (plan + número de cargo): repetir la corrida, o hacerla en dos
// dispositivos, no duplica movimientos.

import {
  chargeDate,
  chargeTransactionId,
  paidCount,
} from '../domain/installments'
import { db as appDb, type SariaDB } from './dexie'
import { repo as appRepo, type Repo } from './repo'
import type { InstallmentPlan, SyncedRow } from './schema'

function stripMeta(p: InstallmentPlan) {
  const rest: Partial<InstallmentPlan> = { ...p }
  delete rest.user_id
  delete rest.created_at
  delete rest.updated_at
  delete rest.deleted_at
  return rest as Omit<InstallmentPlan, keyof SyncedRow> & { id: string }
}

export function createInstallmentOps(db: SariaDB, repo: Repo) {
  /** Crea los cargos con fecha <= hoy; devuelve cuántos movimientos nuevos. */
  async function runInstallments(
    userId: string,
    today: string,
  ): Promise<number> {
    const plans = (await db.installment_plans.toArray()).filter(
      (p) =>
        p.user_id === userId &&
        p.deleted_at === null &&
        p.active &&
        p.account_id !== null,
    )
    let created = 0
    for (const p of plans) {
      const numbers: number[] = []
      for (let n = p.paid_months + 1; n <= p.months; n++) {
        if (chargeDate(p, n) > today) break
        numbers.push(n)
      }
      // crypto.subtle no puede correr dentro de una transacción de Dexie.
      const ids = await Promise.all(
        numbers.map((n) => chargeTransactionId(p.id, n)),
      )
      await db.transaction(
        'rw',
        db.transactions,
        db.installment_plans,
        db.outbox,
        async () => {
          // Meses que ya tienen un cargo ligado al plan (p. ej. un movimiento
          // re-etiquetado desde un pago habitual): no se cobra otra vez.
          const linkedMonths = new Set(
            (
              await db.transactions
                .filter(
                  (t) =>
                    t.deleted_at === null && t.installment_plan_id === p.id,
                )
                .toArray()
            ).map((t) => t.date.slice(0, 7)),
          )
          for (let i = 0; i < numbers.length; i++) {
            // Si otro dispositivo ya la creó (o se borró), no se vuelve a escribir.
            if (await db.transactions.get(ids[i]!)) continue
            if (linkedMonths.has(chargeDate(p, numbers[i]!).slice(0, 7)))
              continue
            await repo.put('transactions', {
              id: ids[i]!,
              kind: 'expense',
              amount_cents: p.monthly_cents,
              date: chargeDate(p, numbers[i]!),
              account_id: p.account_id!,
              category_id: p.category_id,
              note: null,
              recurring_id: null,
              installment_plan_id: p.id,
              legacy_id: null,
            })
            created += 1
          }
          const live = await db.transactions
            .filter((t) => t.installment_plan_id === p.id)
            .toArray()
          if (paidCount(p, live) >= p.months) {
            await repo.put('installment_plans', {
              ...stripMeta(p),
              active: false,
            })
          }
        },
      )
    }
    return created
  }

  return { runInstallments }
}

const ops = createInstallmentOps(appDb, appRepo)
export const runInstallments = ops.runInstallments
