import { colorAt } from '../domain/catalog'
import { SEED_CATEGORIES, seedCategoryId } from '../domain/seedCategories'
import type { SariaDB } from './dexie'
import type { Repo } from './repo'

/**
 * Crea las categorías iniciales si el usuario no tiene ninguna (viva o
 * borrada). Devuelve `true` si sembró. Los IDs son deterministas, así que
 * una siembra concurrente en otro dispositivo solo repite el mismo upsert.
 */
export async function ensureCategoriesSeeded(
  db: SariaDB,
  repo: Repo,
  userId: string,
): Promise<boolean> {
  // Los IDs se calculan antes: crypto.subtle no debe correr dentro de la transacción.
  const ids = await Promise.all(
    SEED_CATEGORIES.map((c) => seedCategoryId(userId, c.kind, c.name)),
  )
  const positions: Record<string, number> = { income: 0, expense: 0 }
  const rows = SEED_CATEGORIES.map((c, index) => ({
    id: ids[index]!,
    name: c.name,
    kind: c.kind,
    icon: c.icon,
    color: colorAt(index),
    monthly_limit_cents: c.monthly_limit_cents,
    archived: false,
    position: positions[c.kind]!++,
  }))

  // La verificación va dentro de la transacción para que dos llamadas
  // concurrentes no siembren dos veces.
  return db.transaction('rw', db.categories, db.outbox, async () => {
    const existing = await db.categories
      .filter((c) => c.user_id === userId)
      .count()
    if (existing > 0) return false
    for (const row of rows) await repo.put('categories', row)
    return true
  })
}
