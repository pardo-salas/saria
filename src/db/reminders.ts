// Recordatorio diario: una sola fila por usuario con ID determinista, para
// que dos dispositivos que la creen a la vez escriban la misma fila.

import { SARIA_NAMESPACE } from '../domain/seedCategories'
import { uuidV5 } from '../domain/uuid'
import { db } from './dexie'
import { repo } from './repo'
import type { Reminder } from './schema'

export const DAILY_REMINDER_TITLE = 'Registra tus gastos del día'

export function dailyReminderId(userId: string): Promise<string> {
  return uuidV5(`${userId}:recordatorio-diario`, SARIA_NAMESPACE)
}

/** Crea el recordatorio diario si el usuario no lo tiene (ni borrado). */
export async function ensureDailyReminder(userId: string): Promise<void> {
  const id = await dailyReminderId(userId)
  if (await db.reminders.get(id)) return
  await repo.put('reminders', {
    id,
    title: DAILY_REMINDER_TITLE,
    text: null,
    time: '20:00',
    frequency: 'daily',
    second_day_of_month: null,
    interval_days: null,
    start_date: null,
    enabled: true,
    recurring_id: null,
  })
}

export async function saveDailyReminder(
  r: Reminder,
  changes: { enabled?: boolean; time?: string },
): Promise<void> {
  await repo.put('reminders', {
    id: r.id,
    title: r.title,
    text: r.text,
    time: changes.time ?? r.time,
    frequency: r.frequency,
    second_day_of_month: r.second_day_of_month,
    interval_days: r.interval_days,
    start_date: r.start_date,
    enabled: changes.enabled ?? r.enabled,
    recurring_id: r.recurring_id,
  })
}
