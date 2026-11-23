import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type SariaDB } from './dexie'
import { createRepo } from './repo'
import { updateSettings } from './settings'

const opened: SariaDB[] = []
const USER = 'user-1'

async function setup() {
  const db = createDb('test-' + crypto.randomUUID())
  opened.push(db)
  await db.open()
  const repo = createRepo(
    db,
    () => USER,
    () => '2026-01-01T10:00:00.000Z',
  )
  return { db, deps: { db, repo, userId: USER } }
}

afterEach(async () => {
  while (opened.length) await opened.pop()!.delete()
})

describe('updateSettings', () => {
  it('sin fila previa crea con los valores por defecto', async () => {
    const { db, deps } = await setup()
    const saved = await updateSettings({ monthly_income_cents: 1860000 }, deps)
    expect(saved).toMatchObject({
      id: USER,
      monthly_income_cents: 1860000,
      pay_frequency: null,
      currency: 'MXN',
      theme: 'system',
    })
    expect(await db.settings.count()).toBe(1)
  })

  it('conserva los campos que no se tocan', async () => {
    const { deps } = await setup()
    await updateSettings({ monthly_income_cents: 1860000 }, deps)
    const saved = await updateSettings({ theme: 'dark' }, deps)
    expect(saved.monthly_income_cents).toBe(1860000)
    expect(saved.theme).toBe('dark')
  })

  it('dos llamadas en paralelo con campos distintos dejan ambos', async () => {
    const { db, deps } = await setup()
    await Promise.all([
      updateSettings({ monthly_income_cents: 500000 }, deps),
      updateSettings({ theme: 'light' }, deps),
    ])
    expect(await db.settings.get(USER)).toMatchObject({
      monthly_income_cents: 500000,
      theme: 'light',
    })
  })
})
