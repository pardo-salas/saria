import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type SariaDB } from './dexie'
import { COLUMNS } from './schema'

const opened: SariaDB[] = []

async function open(): Promise<SariaDB> {
  const db = createDb('test-' + crypto.randomUUID())
  opened.push(db)
  await db.open()
  return db
}

afterEach(async () => {
  while (opened.length) {
    const db = opened.pop()!
    await db.delete()
  }
})

describe('SariaDB', () => {
  it('declara las 8 tablas sincronizables más outbox y sync_state', async () => {
    const db = await open()
    expect(db.tables.map((t) => t.name).sort()).toEqual(
      [
        'accounts',
        'categories',
        'installment_plans',
        'outbox',
        'recurring_payments',
        'reminders',
        'settings',
        'sync_state',
        'transactions',
        'transfers',
      ].sort(),
    )
  })

  it('indexa transactions por [account_id+date], date y legacy_id', async () => {
    const db = await open()
    const idx = db.transactions.schema.idxByName
    expect(idx['[account_id+date]']).toBeDefined()
    expect(idx['date']).toBeDefined()
    expect(idx['legacy_id']).toBeDefined()
    expect(idx['updated_at']).toBeDefined()
  })

  it('indexa transfers por cuentas, date y legacy_id', async () => {
    const db = await open()
    const idx = db.transfers.schema.idxByName
    for (const name of [
      'from_account_id',
      'to_account_id',
      'date',
      'legacy_id',
    ]) {
      expect(idx[name]).toBeDefined()
    }
  })

  it('outbox usa seq autoincremental y sync_state usa table como clave', async () => {
    const db = await open()
    expect(db.outbox.schema.primKey.name).toBe('seq')
    expect(db.outbox.schema.primKey.auto).toBe(true)
    expect(db.sync_state.schema.primKey.name).toBe('table')
  })
})

describe('COLUMNS', () => {
  it('empieza con las columnas comunes en las 8 tablas', () => {
    for (const cols of Object.values(COLUMNS)) {
      expect(cols.slice(0, 5)).toEqual([
        'id',
        'user_id',
        'created_at',
        'updated_at',
        'deleted_at',
      ])
    }
    expect(Object.keys(COLUMNS)).toHaveLength(8)
  })
})
