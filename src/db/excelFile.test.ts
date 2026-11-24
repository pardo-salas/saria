import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type SariaDB } from './dexie'
import { createExcelFileOps } from './excelFile'
import { createInstallmentOps } from './installments'
import { createRepo } from './repo'
import { planProgress } from '../domain/installments'
import type { ExcelFile } from '../domain/excelFile'

const opened: SariaDB[] = []
const USER = 'user-1'
const ACC = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PLAN = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const REC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

afterEach(async () => {
  while (opened.length) await opened.pop()!.delete()
})

async function setup() {
  const db = createDb('test-' + crypto.randomUUID())
  opened.push(db)
  await db.open()
  const repo = createRepo(db, () => USER)
  return {
    db,
    repo,
    ops: createExcelFileOps(db, repo),
    inst: createInstallmentOps(db, repo),
  }
}

const file: ExcelFile = {
  plans: [
    {
      id: PLAN,
      concept: 'Reloj',
      account_id: ACC,
      purchase_date: '2026-06-10',
      total_cents: 120000,
      months: 6,
      monthly_cents: 20000,
      paid_months: 2,
      active: true,
      category_id: null,
    },
  ],
  accountUpdates: [{ id: ACC, credit_limit_cents: 500000, statement_day: 7 }],
  deactivateRecurringIds: [REC],
  retag: [{ recurring_id: REC, installment_plan_id: PLAN }],
}

async function seed(repo: ReturnType<typeof createRepo>) {
  await repo.put('accounts', {
    id: ACC,
    name: 'Tarjeta',
    type: 'credit',
    institution: null,
    color: null,
    icon: null,
    initial_balance_cents: 0,
    include_in_total: true,
    archived: false,
    position: 0,
    credit_limit_cents: null,
    statement_day: null,
    due_day: 22,
    yield_rate: null,
    yield_cap_cents: null,
    yield_rate_over_cap: null,
  })
  await repo.put('recurring_payments', {
    id: REC,
    name: 'Reloj mensualidad',
    kind: 'expense',
    amount_cents: 20000,
    account_id: ACC,
    category_id: null,
    frequency: 'monthly',
    day_of_month: 10,
    second_day_of_month: null,
    interval_days: null,
    start_date: null,
    end_date: null,
    next_due_date: '2026-12-10',
    auto_create: true,
    active: true,
  })
  for (const date of ['2026-08-10', '2026-09-10', '2026-10-10'])
    await repo.put('transactions', {
      id: `tx-${date}`,
      kind: 'expense',
      amount_cents: 20000,
      date,
      account_id: ACC,
      category_id: null,
      note: null,
      recurring_id: REC,
      installment_plan_id: null,
      legacy_id: null,
    })
}

/** Estado sin marcas de tiempo: lo que debe repetirse al reaplicar. */
async function snapshot(db: SariaDB) {
  const strip = (rows: object[]) =>
    rows.map((r) => ({ ...r, updated_at: undefined }))
  return {
    accounts: strip(await db.accounts.toArray()),
    plans: strip(await db.installment_plans.toArray()),
    recurring: strip(await db.recurring_payments.toArray()),
    txs: strip(await db.transactions.orderBy('date').toArray()),
  }
}

describe('applyExcelFile', () => {
  it('aplicar dos veces deja el mismo estado', async () => {
    const { db, repo, ops } = await setup()
    await seed(repo)
    await ops.applyExcelFile(file)
    const first = await snapshot(db)
    await ops.applyExcelFile(file)
    expect(await snapshot(db)).toEqual(first)
  })

  it('da de baja los pagos habituales y re-etiqueta solo lo posterior a lo ya contado', async () => {
    const { db, repo, ops, inst } = await setup()
    await seed(repo)
    await ops.applyExcelFile(file)

    expect((await db.recurring_payments.get(REC))!.deleted_at).not.toBeNull()
    const acc = (await db.accounts.get(ACC))!
    expect(acc).toMatchObject({
      credit_limit_cents: 500000,
      statement_day: 7,
      due_day: 22,
      name: 'Tarjeta',
    })
    const txs = await db.transactions.orderBy('date').toArray()
    // Cargo 2 (10-ago) ya está en paid_months: sin recurring_id ni plan.
    expect(txs.map((t) => [t.recurring_id, t.installment_plan_id])).toEqual([
      [null, null],
      [null, PLAN],
      [null, PLAN],
    ])
    // paid_months 2 + 2 movimientos ligados = 4 pagados.
    const plan = (await db.installment_plans.get(PLAN))!
    expect(planProgress(plan, txs).paid).toBe(4)
    // El cargo de noviembre se genera una sola vez; los de sep y oct no se repiten.
    expect(await inst.runInstallments(USER, '2026-11-23')).toBe(1)
    const after = await db.transactions.toArray()
    expect(after).toHaveLength(4)
    expect(planProgress(plan, after).paid).toBe(5)
  })
})
