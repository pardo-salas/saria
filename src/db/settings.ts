import { db as appDb, type SariaDB } from './dexie'
import { currentUserId, repo as appRepo, type Repo } from './repo'
import type { Settings } from './schema'

type SettingsPatch = Partial<
  Pick<Settings, 'monthly_income_cents' | 'pay_frequency' | 'theme'>
>

/**
 * Actualiza los ajustes del usuario leyendo y escribiendo en una sola
 * transacción, para que dos cambios simultáneos no se pisen.
 */
export async function updateSettings(
  patch: SettingsPatch,
  deps?: { db: SariaDB; repo: Repo; userId: string },
): Promise<Settings> {
  const { db, repo, userId } = deps ?? {
    db: appDb,
    repo: appRepo,
    userId: currentUserId(),
  }
  return db.transaction('rw', db.settings, db.outbox, async () => {
    const existing = await db.settings.get(userId)
    return repo.put('settings', {
      monthly_income_cents: existing?.monthly_income_cents ?? null,
      pay_frequency: existing?.pay_frequency ?? null,
      currency: 'MXN',
      theme: existing?.theme ?? 'system',
      ...patch,
    })
  })
}
