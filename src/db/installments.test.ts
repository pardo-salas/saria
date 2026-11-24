import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type SariaDB } from './dexie'
import { createInstallmentOps } from './installments'
import { createRepo } from './repo'

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
  return { db, repo, ops: createInstallmentOps(db, repo) }
}

const base = {
  concept: 'Reloj',
  account_id: 'acc-1',
  purchase_date: '2026-09-11',
  total_cents: 120000,
  months: 4,
  monthly_cents: 30000,
  paid_months: 0,
  active: true,
  category_id: 'cat-1',
}

describe('runInstallments', () => {
  it('crea los cargos vencidos y es idempotente', async () => {
    const { db, repo, ops } = await setup()
    const p = await repo.put('installment_plans', base)
    // Cargos: 11-oct, 11-nov, 11-dic, 11-ene. Hoy 23-nov: 2 vencidos.
    expect(await ops.runInstallments(USER, '2026-11-23')).toBe(2)
    const txs = (await db.transactions.toArray()).sort((a, b) =>
      a.date.localeCompare(b.date),
    )
    expect(txs.map((t) => t.date)).toEqual(['2026-10-11', '2026-11-11'])
    expect(txs[0]).toMatchObject({
      kind: 'expense',
      amount_cents: 30000,
      account_id: 'acc-1',
      category_id: 'cat-1',
      installment_plan_id: p.id,
      recurring_id: null,
    })
    const ids = txs.map((t) => t.id)
    expect(await ops.runInstallments(USER, '2026-11-23')).toBe(0)
    expect((await db.transactions.toArray()).map((t) => t.id).sort()).toEqual(
      [...ids].sort(),
    )
    expect((await db.installment_plans.get(p.id))!.active).toBe(true)
  })

  it('respeta paid_months y desactiva el plan al último cargo', async () => {
    const { db, repo, ops } = await setup()
    const p = await repo.put('installment_plans', { ...base, paid_months: 2 })
    expect(await ops.runInstallments(USER, '2027-03-01')).toBe(2)
    const dates = (await db.transactions.toArray()).map((t) => t.date).sort()
    expect(dates).toEqual(['2026-12-11', '2027-01-11'])
    expect((await db.installment_plans.get(p.id))!.active).toBe(false)
  })

  it('mismos IDs en dos dispositivos independientes', async () => {
    const a = await setup()
    const b = await setup()
    const p = await a.repo.put('installment_plans', base)
    await b.repo.put('installment_plans', { ...base, id: p.id } as typeof base)
    await a.ops.runInstallments(USER, '2026-11-23')
    await b.ops.runInstallments(USER, '2026-11-23')
    expect((await a.db.transactions.toArray()).map((t) => t.id).sort()).toEqual(
      (await b.db.transactions.toArray()).map((t) => t.id).sort(),
    )
  })

  it('omite planes sin cuenta, inactivos o borrados', async () => {
    const { db, repo, ops } = await setup()
    await repo.put('installment_plans', { ...base, account_id: null })
    await repo.put('installment_plans', { ...base, active: false })
    expect(await ops.runInstallments(USER, '2027-03-01')).toBe(0)
    expect(await db.transactions.count()).toBe(0)
  })
})
