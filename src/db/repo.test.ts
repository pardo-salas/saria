import { afterEach, describe, expect, it, vi } from 'vitest'
import { db as appDb, createDb, type SariaDB } from './dexie'
import {
  createRepo,
  NotSignedInError,
  repo as appRepo,
  setRepoUserSource,
} from './repo'

const opened: SariaDB[] = []

async function open(): Promise<SariaDB> {
  const db = createDb('test-' + crypto.randomUUID())
  opened.push(db)
  await db.open()
  return db
}

afterEach(async () => {
  vi.restoreAllMocks()
  while (opened.length) {
    const db = opened.pop()!
    await db.delete()
  }
})

const T1 = '2026-01-01T10:00:00.000Z'
const T2 = '2026-01-02T10:00:00.000Z'
const USER = 'user-1'

const account = {
  name: 'Efectivo',
  type: 'cash' as const,
  institution: null,
  color: null,
  icon: null,
  initial_balance_cents: 0,
  include_in_total: true,
  archived: false,
  position: 0,
  credit_limit_cents: null,
  statement_day: null,
  due_day: null,
  yield_rate: null,
  yield_cap_cents: null,
  yield_rate_over_cap: null,
}

describe('repo', () => {
  it('put nuevo estampa metadatos y encola un upsert', async () => {
    const db = await open()
    const repo = createRepo(
      db,
      () => USER,
      () => T1,
    )
    const saved = await repo.put('accounts', account)
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(saved).toMatchObject({
      user_id: USER,
      created_at: T1,
      updated_at: T1,
      deleted_at: null,
    })
    expect(await db.accounts.get(saved.id)).toEqual(saved)
    const outbox = await db.outbox.toArray()
    expect(outbox).toHaveLength(1)
    expect(outbox[0]).toMatchObject({
      table: 'accounts',
      row_id: saved.id,
      op: 'upsert',
      attempts: 0,
      payload: saved,
    })
  })

  it('put sobre un id existente conserva created_at e ignora otro user_id', async () => {
    const db = await open()
    let now = T1
    const repo = createRepo(
      db,
      () => USER,
      () => now,
    )
    const first = await repo.put('accounts', account)
    now = T2
    // El tipo NewRow no admite user_id; se fuerza con un cast para simular
    // a un llamador que se porta mal.
    const second = await repo.put('accounts', {
      ...account,
      id: first.id,
      name: 'Otra',
      user_id: 'intruso',
    } as never)
    expect(second.name).toBe('Otra')
    expect(second.created_at).toBe(T1)
    expect(second.updated_at).toBe(T2)
    expect(second.user_id).toBe(USER)
    expect(await db.accounts.get(first.id)).toEqual(second)
    const outbox = await db.outbox.orderBy('seq').toArray()
    expect(outbox.map((e) => e.op)).toEqual(['upsert', 'upsert'])
    expect(outbox[0]!.payload).toEqual(first)
    expect(outbox[1]!.payload).toEqual(second)
    expect(outbox[0]!.seq).toBeLessThan(outbox[1]!.seq!)
  })

  it('put en settings fuerza id === user_id', async () => {
    const db = await open()
    const repo = createRepo(
      db,
      () => USER,
      () => T1,
    )
    const settings = {
      monthly_income_cents: null,
      pay_frequency: null,
      currency: 'MXN' as const,
      theme: 'system' as const,
    }
    const saved = await repo.put('settings', settings)
    expect(saved.id).toBe(USER)
    const other = await repo.put('settings', { ...settings, id: 'otro' })
    expect(other.id).toBe(USER)
    expect(await db.settings.count()).toBe(1)
  })

  it('softDelete marca deleted_at y encola un delete', async () => {
    const db = await open()
    let now = T1
    const repo = createRepo(
      db,
      () => USER,
      () => now,
    )
    const saved = await repo.put('accounts', account)
    now = T2
    await repo.softDelete('accounts', saved.id)
    const row = await db.accounts.get(saved.id)
    expect(row).toMatchObject({
      deleted_at: T2,
      updated_at: T2,
      created_at: T1,
    })
    const outbox = await db.outbox.orderBy('seq').toArray()
    expect(outbox).toHaveLength(2)
    expect(outbox[1]).toMatchObject({
      op: 'delete',
      row_id: saved.id,
      table: 'accounts',
      payload: row,
    })
  })

  it('softDelete de un id inexistente rechaza sin crear ni encolar', async () => {
    const db = await open()
    const repo = createRepo(
      db,
      () => USER,
      () => T1,
    )
    await expect(repo.softDelete('accounts', 'nope')).rejects.toThrow(
      /no existe/,
    )
    expect(await db.accounts.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it('revierte la fila si falla el encolado', async () => {
    const db = await open()
    const repo = createRepo(
      db,
      () => USER,
      () => T1,
    )
    vi.spyOn(db.outbox, 'add').mockRejectedValue(new Error('boom'))
    await expect(repo.put('accounts', account)).rejects.toThrow('boom')
    expect(await db.accounts.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it('sin sesión rechaza con NotSignedInError', async () => {
    const db = await open()
    const repo = createRepo(
      db,
      () => null,
      () => T1,
    )
    await expect(repo.put('accounts', account)).rejects.toBeInstanceOf(
      NotSignedInError,
    )
    await expect(repo.softDelete('accounts', 'x')).rejects.toBeInstanceOf(
      NotSignedInError,
    )
    expect(await db.outbox.count()).toBe(0)
  })

  describe('validación de montos *_cents', () => {
    const tx = {
      kind: 'expense' as const,
      amount_cents: 1250,
      date: '2026-01-01',
      account_id: 'a1',
      category_id: null,
      note: null,
      recurring_id: null,
      installment_plan_id: null,
      legacy_id: null,
    }

    it('rechaza con RangeError un monto no entero y no escribe nada', async () => {
      const db = await open()
      const repo = createRepo(
        db,
        () => USER,
        () => T1,
      )
      await expect(
        repo.put('transactions', { ...tx, amount_cents: 12.5 }),
      ).rejects.toBeInstanceOf(RangeError)
      await expect(
        repo.put('transactions', { ...tx, amount_cents: Number.NaN }),
      ).rejects.toBeInstanceOf(RangeError)
      expect(await db.table('transactions').count()).toBe(0)
      expect(await db.outbox.count()).toBe(0)
    })

    it('rechaza también campos opcionales como credit_limit_cents', async () => {
      const db = await open()
      const repo = createRepo(
        db,
        () => USER,
        () => T1,
      )
      await expect(
        repo.put('accounts', { ...account, credit_limit_cents: 0.5 }),
      ).rejects.toBeInstanceOf(RangeError)
      expect(await db.table('accounts').count()).toBe(0)
      expect(await db.outbox.count()).toBe(0)
    })

    it('acepta null y enteros', async () => {
      const db = await open()
      const repo = createRepo(
        db,
        () => USER,
        () => T1,
      )
      await repo.put('accounts', { ...account, credit_limit_cents: null })
      await repo.put('transactions', tx)
      expect(await db.table('accounts').count()).toBe(1)
      expect(await db.table('transactions').count()).toBe(1)
      expect(await db.outbox.count()).toBe(2)
    })
  })
})

describe('repo de la app', () => {
  afterEach(async () => {
    setRepoUserSource(() => null)
    await appDb.delete()
  })

  it('usa el usuario que fija setRepoUserSource', async () => {
    await expect(appRepo.put('accounts', account)).rejects.toBeInstanceOf(
      NotSignedInError,
    )
    setRepoUserSource(() => 'u-app')
    const saved = await appRepo.put('accounts', account)
    expect(saved.user_id).toBe('u-app')
    setRepoUserSource(() => null)
    await expect(
      appRepo.softDelete('accounts', saved.id),
    ).rejects.toBeInstanceOf(NotSignedInError)
  })
})
