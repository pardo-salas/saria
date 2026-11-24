import type { RecurringRow } from '../domain/recurringFile'
import type { Repo } from './repo'

/** Upsert por ID de cada pago habitual: lo existente se actualiza, nada se borra. */
export async function addRecurringPayments(
  repo: Repo,
  rows: RecurringRow[],
): Promise<void> {
  for (const row of rows) await repo.put('recurring_payments', row)
}
