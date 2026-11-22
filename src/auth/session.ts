import { AUTH_STORAGE_KEY } from './supabase'

export type GateState = 'misconfigured' | 'signed-in' | 'signed-out'

/**
 * Lee el `user.id` de la sesión guardada por supabase-js, SIN validar
 * `expires_at`: una sesión vencida sigue abriendo la app (también sin red) y
 * supabase-js la renueva cuando vuelve la conexión.
 *
 * Forma verificada en @supabase/auth-js 2.119.2 (`GoTrueClient._saveSession`):
 * sin `userStorage` configurado guarda la sesión completa como JSON en
 * `storageKey`, es decir `{ access_token, refresh_token, expires_at, …,
 * user: { id, … } }`, así que el id vive en `user.id` del nivel superior.
 */
export function readStoredUserId(storage: Storage): string | null {
  try {
    const raw = storage.getItem(AUTH_STORAGE_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const user = (parsed as { user?: unknown }).user
    if (typeof user !== 'object' || user === null) return null
    const id = (user as { id?: unknown }).id
    return typeof id === 'string' && id !== '' ? id : null
  } catch {
    return null
  }
}

export function decideGate(
  configured: boolean,
  storedUserId: string | null,
): GateState {
  if (!configured) return 'misconfigured'
  return storedUserId === null ? 'signed-out' : 'signed-in'
}
