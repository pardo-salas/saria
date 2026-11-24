import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type SariaDB } from './dexie'
import { createRecurringOps } from './recurring'
import { createRepo } from './repo'
import type { RecurringPayment } from './schema'

const opened: SariaDB[] = []
const USER = 'user-1'

afterEach(async () => {
  while (opened.length) await opened.pop()!.delete()
})

async function setup() {
  const db = createDb('test-' + crypto.randomUUID())
  opened.push(db)
  await db.open()
  const repo = createRepo(db, () => USER)
  return { db, repo, ops: createRecurringOps(db, repo) }
}

const base = {
  name: 'Luz',
  kind: 'expense' as const,
  amount_cents: 50000,
  account_id: 'acc-1',
  category_id: null,
  frequency: 'monthly' as const,
  day_of_month: 10,
  second_day_of_month: null,
  interval_days: null,
  start_date: '2026-01-10',
  end_date: null,
  next_due_date: '2026-09-10',
  auto_create: true,
  active: true,
}

describe('pagos habituales (Dexie)', () => {
  it('markPaid crea el movimiento determinista y avanza next_due_date', async () => {
    const { db, repo, ops } = await setup()
    const p = (await repo.put('recurring_payments', base)) as RecurringPayment
    await ops.markPaid(p, {
      amount_cents: 51000,
      account_id: 'acc-1',
      category_id: null,
      date: '2026-09-12',
      note: null,
    })
    const txs = await db.transactions.toArray()
    expect(txs).toHaveLength(1)
    expect(txs[0]).toMatchObject({
      amount_cents: 51000,
      date: '2026-09-12',
      recurring_id: p.id,
    })
    expect((await db.recurring_payments.get(p.id))!.next_due_date).toBe(
      '2026-10-10',
    )
  })

  it('runAutoCreate dos veces no duplica movimientos', async () => {
    const { db, repo, ops } = await setup()
    const p = await repo.put('recurring_payments', base)
    expect(await ops.runAutoCreate(USER, '2026-11-23')).toBe(3)
    const ids = (await db.transactions.toArray()).map((t) => t.id).sort()
    expect(ids).toHaveLength(3)
    expect(await ops.runAutoCreate(USER, '2026-11-23')).toBe(0)
    expect((await db.transactions.toArray()).map((t) => t.id).sort()).toEqual(
      ids,
    )
    expect((await db.recurring_payments.get(p.id))!.next_due_date).toBe(
      '2026-12-10',
    )
  })
})
