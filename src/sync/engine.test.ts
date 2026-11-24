import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type SariaDB } from '../db/dexie'
import { createRepo } from '../db/repo'
import { createSyncEngine } from './engine'
import { createFakeSupabase } from './fakeSupabase'

const USER = 'user-1'
const opened: SariaDB[] = []

function device(server: ReturnType<typeof createFakeSupabase>) {
  const db = createDb('test-' + crypto.randomUUID())
  opened.push(db)
  let t = 0
  const repo = createRepo(
    db,
    () => USER,
    () => new Date(Date.UTC(2026, 5, 1) + ++t * 1000).toISOString(),
  )
  const engine = createSyncEngine({
    db,
    supabase: server.client,
    getUserId: () => USER,
    isOnline: () => true,
  })
  return { db, repo, engine }
}

const account = (name: string) => ({
  name,
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
})

afterEach(async () => {
  while (opened.length) await opened.pop()!.delete()
})

describe('motor de sincronización', () => {
  it('una escritura durante el push sobrevive en la outbox', async () => {
    const server = createFakeSupabase()
    const a = device(server)
    await a.engine.syncNow() // primera sincronización
    const acc = await a.repo.put('accounts', account('Efectivo'))
    server.hooks.onUpsert = async () => {
      server.hooks.onUpsert = null
      await a.repo.put('accounts', { ...account('Efectivo 2'), id: acc.id })
    }
    await a.engine.syncNow()
    const left = await a.db.outbox.toArray()
    expect(left).toHaveLength(1)
    expect(server.rows('accounts')[0].name).toBe('Efectivo')
    expect((await a.db.accounts.get(acc.id))!.name).toBe('Efectivo 2')
    await a.engine.syncNow()
    expect(await a.db.outbox.count()).toBe(0)
    expect(server.rows('accounts')[0].name).toBe('Efectivo 2')
  })

  it('el pull no pisa una fila con cambio local pendiente', async () => {
    const server = createFakeSupabase()
    const a = device(server)
    const b = device(server)
    const acc = await a.repo.put('accounts', account('Original'))
    await a.engine.syncNow()
    await b.engine.syncNow()
    await a.repo.put('accounts', { ...account('Remoto'), id: acc.id })
    await a.engine.syncNow()
    await b.repo.put('accounts', { ...account('Local'), id: acc.id })
    // Hace fallar solo el push de B para que el pull vea la fila con outbox pendiente.
    server.hooks.onUpsert = async () => {
      server.hooks.onUpsert = null
      throw new Error('sin red')
    }
    await b.engine.syncNow()
    expect((await b.db.accounts.get(acc.id))!.name).toBe('Local')
    expect(await b.db.outbox.count()).toBe(1)
  })

  it('la primera sincronización descarta datos locales y no los sube', async () => {
    const server = createFakeSupabase()
    const a = device(server)
    await a.repo.put('accounts', account('Remota'))
    await a.engine.syncNow() // primera: descarta lo local (nada sube)
    expect(server.rows('accounts')).toHaveLength(0)
    await a.repo.put('accounts', account('Remota'))
    await a.engine.syncNow()
    const b = device(server)
    await b.repo.put('accounts', account('Prueba'))
    await b.engine.syncNow()
    expect((await b.db.accounts.toArray()).map((r) => r.name)).toEqual([
      'Remota',
    ])
    expect(await b.db.outbox.count()).toBe(0)
    expect(server.rows('accounts').map((r) => r.name)).toEqual(['Remota'])
    expect(await b.db.sync_state.count()).toBe(8)
  })

  it('dos dispositivos que editan la misma fila sin conexión convergen', async () => {
    const server = createFakeSupabase()
    const a = device(server)
    const b = device(server)
    await a.engine.syncNow()
    await b.engine.syncNow()
    const acc = await a.repo.put('accounts', account('Base'))
    await a.engine.syncNow()
    await b.engine.syncNow()
    await a.repo.put('accounts', { ...account('Desde A'), id: acc.id })
    await b.repo.put('accounts', { ...account('Desde B'), id: acc.id })
    await a.engine.syncNow()
    await b.engine.syncNow()
    await a.engine.syncNow()
    await b.engine.syncNow()
    const ra = await a.db.accounts.get(acc.id)
    const rb = await b.db.accounts.get(acc.id)
    expect(ra).toEqual(rb)
    expect(ra!.name).toBe('Desde B')
    expect(ra!.updated_at).toBe(server.rows('accounts')[0].updated_at)
  })

  it('sube padres antes que hijos', async () => {
    const server = createFakeSupabase()
    const a = device(server)
    await a.engine.syncNow()
    const acc = await a.repo.put('accounts', account('Cuenta'))
    await a.repo.put('transactions', {
      kind: 'expense',
      amount_cents: 100,
      date: '2026-06-01',
      account_id: acc.id,
      category_id: null,
      note: null,
      recurring_id: null,
      installment_plan_id: null,
      legacy_id: null,
    })
    await a.engine.syncNow()
    expect(server.upsertLog).toEqual(['accounts', 'transactions'])
  })

  it('una fila rechazada no bloquea el resto de la cola', async () => {
    const server = createFakeSupabase()
    const a = device(server)
    await a.engine.syncNow()
    const ok1 = await a.repo.put('accounts', account('Uno'))
    const bad = await a.repo.put('accounts', account('Mala'))
    const ok2 = await a.repo.put('accounts', account('Dos'))
    server.hooks.rejectIds.add(bad.id)
    await a.engine.syncNow()
    const ids = server.rows('accounts').map((r) => r.id)
    expect(ids).toContain(ok1.id)
    expect(ids).toContain(ok2.id)
    expect(ids).not.toContain(bad.id)
    const left = await a.db.outbox.toArray()
    expect(left).toHaveLength(1)
    expect(left[0]!.row_id).toBe(bad.id)
    expect(left[0]!.attempts).toBe(1)
    for (let i = 0; i < 6; i++) await a.engine.syncNow({ force: true })
    expect((await a.db.outbox.toArray())[0]!.attempts).toBe(5)
    expect(a.engine.getStatus()).toMatchObject({
      state: 'error',
      pending: 1,
      message: '1 cambios no se pudieron subir',
    })
  })

  it('el borrado lógico se propaga', async () => {
    const server = createFakeSupabase()
    const a = device(server)
    const b = device(server)
    await a.engine.syncNow()
    await b.engine.syncNow()
    const acc = await a.repo.put('accounts', account('Vieja'))
    await a.engine.syncNow()
    await b.engine.syncNow()
    expect((await b.db.accounts.get(acc.id))!.deleted_at).toBeNull()
    await a.repo.softDelete('accounts', acc.id)
    await a.engine.syncNow()
    await b.engine.syncNow()
    expect((await b.db.accounts.get(acc.id))!.deleted_at).not.toBeNull()
  })
})
