// Aplica un archivo `saria-excel` en una sola transacción. Reaplicarlo da el
// mismo resultado: los planes y las cuentas se escriben por ID, un pago ya
// borrado no se vuelve a borrar y un movimiento ya re-etiquetado ya no trae
// `recurring_id`.

import { addMonths } from '../domain/installments'
import type { ExcelFile } from '../domain/excelFile'
import { db as appDb, type SariaDB } from './dexie'
import { repo as appRepo, type Repo } from './repo'
import type { SyncedRow } from './schema'

function stripMeta<T extends SyncedRow>(
  row: T,
): Omit<T, keyof SyncedRow> & {
  id: string
} {
  const rest: Partial<T> = { ...row }
  delete rest.user_id
  delete rest.created_at
  delete rest.updated_at
  delete rest.deleted_at
  return rest as Omit<T, keyof SyncedRow> & { id: string }
}

export function createExcelFileOps(db: SariaDB, repo: Repo) {
  async function applyExcelFile(file: ExcelFile): Promise<void> {
    await db.transaction(
      'rw',
      db.installment_plans,
      db.accounts,
      db.recurring_payments,
      db.transactions,
      db.outbox,
      async () => {
        for (const plan of file.plans) await repo.put('installment_plans', plan)

        for (const update of file.accountUpdates) {
          const account = await db.accounts.get(update.id)
          if (!account || account.deleted_at !== null) continue
          await repo.put('accounts', { ...stripMeta(account), ...update })
        }

        for (const id of file.deactivateRecurringIds) {
          const payment = await db.recurring_payments.get(id)
          if (!payment || payment.deleted_at !== null) continue
          await repo.softDelete('recurring_payments', id)
        }

        // Los movimientos que la Fase 3 ya generó pasan de `recurring_id` a
        // `installment_plan_id`. `paid_months` del plan ya cuenta los cargos
        // hasta la fecha del cargo n.º `paid_months` (los pagos de antes de
        // Saria): re-etiquetar esos movimientos los contaría dos veces, así que
        // solo se ligan al plan los de fecha posterior; los demás únicamente
        // pierden el `recurring_id`.
        for (const { recurring_id, installment_plan_id } of file.retag) {
          const plan = file.plans.find((p) => p.id === installment_plan_id)
          if (!plan) continue
          const counted =
            plan.paid_months > 0
              ? addMonths(plan.purchase_date, plan.paid_months)
              : null
          const txs = await db.transactions
            .filter(
              (t) => t.deleted_at === null && t.recurring_id === recurring_id,
            )
            .toArray()
          for (const tx of txs) {
            const alreadyCounted = counted !== null && tx.date <= counted
            await repo.put('transactions', {
              ...stripMeta(tx),
              recurring_id: null,
              installment_plan_id: alreadyCounted
                ? tx.installment_plan_id
                : installment_plan_id,
            })
          }
        }
      },
    )
  }

  return { applyExcelFile }
}

const ops = createExcelFileOps(appDb, appRepo)
export const applyExcelFile = ops.applyExcelFile
