import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildBackup, parseBackup, type Backup } from '../domain/backup'
import { createDb, type SariaDB } from './dexie'
import { readLiveTables, restoreBackup } from './backup'
import { createRepo } from './repo'

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

const USER = '00000000-0000-4000-8000-000000000001'
const T1 = '2026-01-01T10:00:00.000Z'
const T2 = '2026-01-02T10:00:00.000Z'

const account = {
  name: 'Efectivo',
  type: 'cash' as const,
  institution: null,
  color: null,
  icon: null,
  initial_balance_cents: 100,
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

function makeRepo(db: SariaDB, user = USER, now = T1) {
  return createRepo(
    db,
    () => user,
    () => now,
  )
}

/** Base con datos en todas las tablas que importan para el ida y vuelta. */
async function populate(db: SariaDB) {
  const repo = makeRepo(db)
  const a1 = await repo.put('accounts', account)
  const a2 = await repo.put('accounts', { ...account, name: 'Banco' })
  const cat = await repo.put('categories', {
    name: 'Comida',
    kind: 'expense',
    icon: null,
    color: null,
    monthly_limit_cents: 5000,
    archived: false,
    position: 0,
  })
  await repo.put('transactions', {
    kind: 'expense',
    amount_cents: 1000,
    date: '2026-01-01',
    account_id: a1.id,
    category_id: cat.id,
    note: 'tacos',
    recurring_id: null,
    installment_plan_id: null,
    legacy_id: null,
  })
  await repo.put('transfers', {
    from_account_id: a1.id,
    to_account_id: a2.id,
    amount_cents: 300,
    date: '2026-01-01',
    note: null,
    legacy_id: null,
  })
  await repo.put('settings', {
    monthly_income_cents: 20000,
    pay_frequency: 'monthly',
    currency: 'MXN',
    theme: 'dark',
  })
  return { a1, a2, cat }
}

function parseOk(backup: Backup): Backup {
  const r = parseBackup(JSON.stringify(backup))
  if (!r.ok) throw new Error(r.error)
  return r.backup
}

const sansUpdated = (rows: object[]) =>
  rows.map((row) => ({ ...row, updated_at: undefined }))

describe('readLiveTables', () => {
  it('devuelve solo filas vivas del usuario', async () => {
    const db = await open()
    const { a2 } = await populate(db)
    await makeRepo(db).softDelete('accounts', a2.id)
    await makeRepo(db, 'otro').put('accounts', { ...account, name: 'Ajena' })
    const t = await readLiveTables(db, USER)
    expect(t.accounts.map((a) => a.name)).toEqual(['Efectivo'])
    expect(t.settings).toHaveLength(1)
  })
})

describe('restoreBackup', () => {
  it('ida y vuelta entre bases da las mismas filas salvo updated_at', async () => {
    const src = await open()
    await populate(src)
    const tables = await readLiveTables(src, USER)
    const backup = parseOk(buildBackup(tables, T2))
    const dst = await open()
    await restoreBackup(dst, makeRepo(dst, USER, T2), USER, backup)
    const after = await readLiveTables(dst, USER)
    for (const key of Object.keys(tables) as (keyof typeof tables)[]) {
      expect(sansUpdated(after[key])).toEqual(sansUpdated(tables[key]))
    }
  })

  it('conserva el created_at del archivo', async () => {
    const src = await open()
    await populate(src)
    const backup = parseOk(buildBackup(await readLiveTables(src, USER), T2))
    const dst = await open()
    await restoreBackup(dst, makeRepo(dst, USER, T2), USER, backup)
    const rows = await dst.accounts.toArray()
    expect(rows.every((r) => r.created_at === T1)).toBe(true)
    expect(rows.every((r) => r.updated_at === T2)).toBe(true)
  })

  it('borra lógicamente lo que no está en el archivo y encola el delete', async () => {
    const src = await open()
    await populate(src)
    const backup = parseOk(buildBackup(await readLiveTables(src, USER), T2))
    const dst = await open()
    const extra = await makeRepo(dst).put('accounts', {
      ...account,
      name: 'Extra',
    })
    await restoreBackup(dst, makeRepo(dst, USER, T2), USER, backup)
    const row = await dst.accounts.get(extra.id)
    expect(row?.deleted_at).toBe(T2)
    const outbox = await dst.outbox.toArray()
    expect(
      outbox.some(
        (o) =>
          o.op === 'delete' && o.table === 'accounts' && o.row_id === extra.id,
      ),
    ).toBe(true)
  })

  it('no borra settings si el archivo no trae', async () => {
    const dst = await open()
    await makeRepo(dst).put('settings', {
      monthly_income_cents: 1,
      pay_frequency: null,
      currency: 'MXN',
      theme: 'light',
    })
    const src = await open()
    const backup = parseOk(buildBackup(await readLiveTables(src, USER), T2))
    await restoreBackup(dst, makeRepo(dst, USER, T2), USER, backup)
    expect((await dst.settings.get(USER))?.deleted_at).toBeNull()
  })

  it('un respaldo de otro usuario queda con el usuario actual', async () => {
    const src = await open()
    await populate(src)
    const backup = parseOk(buildBackup(await readLiveTables(src, USER), T2))
    for (const rows of Object.values(backup.tables)) {
      for (const r of rows) r.user_id = 'otro'
    }
    const NEW_USER = '00000000-0000-4000-8000-000000000002'
    backup.tables.settings[0]!.id = NEW_USER
    const dst = await open()
    await restoreBackup(dst, makeRepo(dst, NEW_USER, T2), NEW_USER, backup)
    const t = await readLiveTables(dst, NEW_USER)
    expect(t.accounts).toHaveLength(2)
    expect(t.accounts.every((a) => a.user_id === NEW_USER)).toBe(true)
    expect(t.settings[0]).toMatchObject({ id: NEW_USER, theme: 'dark' })
  })

  it('una fila borrada localmente que está en el archivo revive', async () => {
    const db = await open()
    const { a1 } = await populate(db)
    const backup = parseOk(buildBackup(await readLiveTables(db, USER), T2))
    await makeRepo(db).softDelete('accounts', a1.id)
    await restoreBackup(db, makeRepo(db, USER, T2), USER, backup)
    expect((await db.accounts.get(a1.id))?.deleted_at).toBeNull()
  })

  it('si una escritura falla a la mitad no cambia nada', async () => {
    const src = await open()
    await populate(src)
    const backup = parseOk(buildBackup(await readLiveTables(src, USER), T2))
    const dst = await open()
    const repo = makeRepo(dst, USER, T2)
    const extra = await makeRepo(dst).put('accounts', {
      ...account,
      name: 'Extra',
    })
    const before = {
      accounts: await dst.accounts.toArray(),
      outbox: await dst.outbox.toArray(),
    }
    const real = repo.put
    let calls = 0
    vi.spyOn(repo, 'put').mockImplementation(((
      ...args: Parameters<typeof real>
    ) => {
      calls++
      if (calls === 3) throw new Error('falla simulada')
      return real(...args)
    }) as typeof real)
    await expect(restoreBackup(dst, repo, USER, backup)).rejects.toThrow(
      'falla simulada',
    )
    expect(await dst.accounts.toArray()).toEqual(before.accounts)
    expect(await dst.outbox.toArray()).toEqual(before.outbox)
    expect((await dst.accounts.get(extra.id))?.deleted_at).toBeNull()
    expect(await dst.transactions.count()).toBe(0)
  })
})
