import { describe, expect, it } from 'vitest'
import { SEED_CATEGORIES, seedCategoryId } from './seedCategories'

describe('SEED_CATEGORIES', () => {
  it('tiene 20 de gasto y 8 de ingreso', () => {
    expect(SEED_CATEGORIES.filter((c) => c.kind === 'expense')).toHaveLength(20)
    expect(SEED_CATEGORIES.filter((c) => c.kind === 'income')).toHaveLength(8)
  })

  it('no repite nombres dentro de un tipo', () => {
    for (const kind of ['expense', 'income']) {
      const names = SEED_CATEGORIES.filter((c) => c.kind === kind).map(
        (c) => c.name,
      )
      expect(new Set(names).size).toBe(names.length)
    }
  })

  it('Seguro tiene límite de 28800', () => {
    expect(
      SEED_CATEGORIES.find((c) => c.name === 'Seguro')?.monthly_limit_cents,
    ).toBe(28800)
  })
})

describe('seedCategoryId', () => {
  it('es estable para la misma entrada', async () => {
    expect(await seedCategoryId('u1', 'expense', 'Otros')).toBe(
      await seedCategoryId('u1', 'expense', 'Otros'),
    )
  })

  it('distingue Otros de gasto e ingreso', async () => {
    expect(await seedCategoryId('u1', 'expense', 'Otros')).not.toBe(
      await seedCategoryId('u1', 'income', 'Otros'),
    )
  })
})
