import {
  isAuthApiError,
  isAuthRetryableFetchError,
} from '@supabase/supabase-js'
import { AUTH_STORAGE_KEY, getSupabase } from './supabase'

export type AuthError =
  'invalid_credentials' | 'offline' | 'misconfigured' | 'unknown'

export type AuthResult = { ok: true } | { ok: false; error: AuthError }

export const AUTH_ERROR_MESSAGES: Record<AuthError, string> = {
  invalid_credentials: 'El correo o la contraseña no coinciden.',
  offline:
    'Necesitas internet para iniciar sesión la primera vez en este dispositivo.',
  misconfigured:
    'Falta configurar la conexión con Supabase (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY).',
  unknown: 'No se pudo iniciar sesión. Intenta de nuevo.',
}

function toAuthError(error: unknown): AuthError {
  if (isAuthApiError(error) && error.code === 'invalid_credentials') {
    return 'invalid_credentials'
  }
  if (isAuthRetryableFetchError(error)) return 'offline'
  return 'unknown'
}

type SupabaseAuth = NonNullable<ReturnType<typeof getSupabase>>['auth']

/** Revisa configuración y red antes de llamar; traduce cualquier error. */
async function run(
  call: (auth: SupabaseAuth) => Promise<{ error: unknown }>,
): Promise<AuthResult> {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, error: 'misconfigured' }
  if (!navigator.onLine) return { ok: false, error: 'offline' }
  try {
    const { error } = await call(supabase.auth)
    return error ? { ok: false, error: toAuthError(error) } : { ok: true }
  } catch (thrown) {
    return { ok: false, error: toAuthError(thrown) }
  }
}

export function signIn(email: string, password: string): Promise<AuthResult> {
  return run((auth) => auth.signInWithPassword({ email, password }))
}

export function sendPasswordReset(email: string): Promise<AuthResult> {
  return run((auth) =>
    auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/restablecer`,
    }),
  )
}

export function updatePassword(password: string): Promise<AuthResult> {
  return run((auth) => auth.updateUser({ password }))
}

/**
 * Cierra la sesión solo en este dispositivo (`scope: 'local'`): supabase-js
 * borra la sesión guardada antes de intentar revocar en el servidor, así que
 * funciona sin conexión. Por si algo falla, se borra la clave a mano.
 */
export async function signOut(): Promise<void> {
  const supabase = getSupabase()
  try {
    await supabase?.auth.signOut({ scope: 'local' })
  } catch {
    // Sin red o error del servidor: la sesión local se borra de todos modos.
  } finally {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem(`${AUTH_STORAGE_KEY}-user`)
  }
}
