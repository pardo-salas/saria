import { afterEach, describe, expect, it } from 'vitest'
import { createDb, type SariaDB } from './dexie'
import { createRepo } from './repo'
import { ensureCategoriesSeeded } from './seed'

const opened: SariaDB[] = []

async function open(): Promise<SariaDB> {
  const db = createDb('test-' + crypto.randomUUID())
  opened.push(db)
  await db.open()
  return db
}

afterEach(async () => {
  while (opened.length) await opened.pop()!.delete()
})

const USER = 'user-1'

describe('ensureCategoriesSeeded', () => {
  it('crea 28 categorías y 28 entradas en outbox', async () => {
    const db = await open()
    const repo = createRepo(db, () => USER)
    expect(await ensureCategoriesSeeded(db, repo, USER)).toBe(true)
    expect(await db.categories.count()).toBe(28)
    expect(await db.outbox.count()).toBe(28)
  })

  it('la segunda llamada devuelve false sin escribir', async () => {
    const db = await open()
    const repo = createRepo(db, () => USER)
    await ensureCategoriesSeeded(db, repo, USER)
    expect(await ensureCategoriesSeeded(db, repo, USER)).toBe(false)
    expect(await db.outbox.count()).toBe(28)
  })

  it('con una categoría borrada previa devuelve false', async () => {
    const db = await open()
    const repo = createRepo(db, () => USER)
    const row = await repo.put('categories', {
      name: 'X',
      kind: 'expense',
      icon: 'otros',
      color: '#000000',
      monthly_limit_cents: null,
      archived: false,
      position: 0,
    })
    await repo.softDelete('categories', row.id)
    expect(await ensureCategoriesSeeded(db, repo, USER)).toBe(false)
    expect(await db.categories.count()).toBe(1)
  })

  it('dos bases distintas producen los mismos id', async () => {
    const a = await open()
    const b = await open()
    await ensureCategoriesSeeded(
      a,
      createRepo(a, () => USER),
      USER,
    )
    await ensureCategoriesSeeded(
      b,
      createRepo(b, () => USER),
      USER,
    )
    const ids = async (d: SariaDB) =>
      (await d.categories.toArray()).map((c) => c.id).sort()
    expect(await ids(a)).toEqual(await ids(b))
  })
})
