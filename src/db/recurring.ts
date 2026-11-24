// Escrituras de pagos habituales: pagar, omitir y creación automática.
// Los IDs de los movimientos son deterministas (ver occurrenceTransactionId),
// así que repetir una operación, o hacerla en dos dispositivos, no duplica.

import { nextOccurrence, occurrenceTransactionId } from '../domain/recurring'
import { db as appDb, type SariaDB } from './dexie'
import { repo as appRepo, type Repo } from './repo'
import type { RecurringPayment, SyncedRow } from './schema'

export type PaidInput = {
  amount_cents: number
  account_id: string
  category_id: string | null
  date: string
  note: string | null
}

function stripMeta(p: RecurringPayment) {
  const rest: Partial<RecurringPayment> = { ...p }
  delete rest.user_id
  delete rest.created_at
  delete rest.updated_at
  delete rest.deleted_at
  return rest as Omit<RecurringPayment, keyof SyncedRow> & { id: string }
}

// Tope de ocurrencias por pago en la creación automática (p. ej. un pago
// diario de hace años), para no ciclar ni bloquear la app.
const MAX_OCURRENCIAS = 1000

export function createRecurringOps(db: SariaDB, repo: Repo) {
  function advance(p: RecurringPayment, from: string) {
    const next = nextOccurrence(p, from)
    return {
      ...stripMeta(p),
      next_due_date: next,
      active: p.active && next !== null,
    }
  }

  async function markPaid(
    p: RecurringPayment,
    input: PaidInput,
  ): Promise<void> {
    if (p.deleted_at !== null || p.next_due_date === null) return
    const occurrence = p.next_due_date
    // crypto.subtle no puede correr dentro de una transacción de Dexie.
    const id = await occurrenceTransactionId(p.id, occurrence)
    await db.transaction(
      'rw',
      db.transactions,
      db.recurring_payments,
      db.outbox,
      async () => {
        await repo.put('transactions', {
          id,
          kind: p.kind,
          amount_cents: input.amount_cents,
          date: input.date,
          account_id: input.account_id,
          category_id: input.category_id,
          note: input.note,
          recurring_id: p.id,
          installment_plan_id: null,
          legacy_id: null,
        })
        await repo.put('recurring_payments', advance(p, occurrence))
      },
    )
  }

  async function skipOccurrence(p: RecurringPayment): Promise<void> {
    if (p.deleted_at !== null || p.next_due_date === null) return
    await repo.put('recurring_payments', advance(p, p.next_due_date))
  }

  async function runAutoCreate(userId: string, today: string): Promise<number> {
    const all = await db.recurring_payments.toArray()
    const due = all.filter(
      (p) =>
        p.user_id === userId &&
        p.deleted_at === null &&
        p.active &&
        p.auto_create &&
        p.account_id !== null &&
        p.next_due_date !== null &&
        p.next_due_date <= today,
    )
    let created = 0
    for (const p of due) {
      const dates: string[] = []
      let cursor: string | null = p.next_due_date
      while (
        cursor !== null &&
        cursor <= today &&
        dates.length < MAX_OCURRENCIAS
      ) {
        dates.push(cursor)
        cursor = nextOccurrence(p, cursor)
      }
      const ids = await Promise.all(
        dates.map((d) => occurrenceTransactionId(p.id, d)),
      )
      await db.transaction(
        'rw',
        db.transactions,
        db.recurring_payments,
        db.outbox,
        async () => {
          for (let i = 0; i < dates.length; i++) {
            // Si otro dispositivo ya la creó, no se vuelve a escribir.
            if (await db.transactions.get(ids[i]!)) continue
            await repo.put('transactions', {
              id: ids[i]!,
              kind: p.kind,
              amount_cents: p.amount_cents,
              date: dates[i]!,
              account_id: p.account_id!,
              category_id: p.category_id,
              note: null,
              recurring_id: p.id,
              installment_plan_id: null,
              legacy_id: null,
            })
            created += 1
          }
          await repo.put('recurring_payments', {
            ...stripMeta(p),
            next_due_date: cursor,
            active: cursor !== null,
          })
        },
      )
    }
    return created
  }

  return { markPaid, skipOccurrence, runAutoCreate }
}

const ops = createRecurringOps(appDb, appRepo)
export const markPaid = ops.markPaid
export const skipOccurrence = ops.skipOccurrence
export const runAutoCreate = ops.runAutoCreate
