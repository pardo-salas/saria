import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Clave de `localStorage` donde supabase-js guarda la sesión. */
export const AUTH_STORAGE_KEY = 'saria.auth'

/** Solo URL y clave `anon`; ninguna otra clave de Supabase llega al cliente. */
export function isConfigured(): boolean {
  const url: unknown = import.meta.env.VITE_SUPABASE_URL
  const key: unknown = import.meta.env.VITE_SUPABASE_ANON_KEY
  return (
    typeof url === 'string' &&
    url.trim() !== '' &&
    typeof key === 'string' &&
    key.trim() !== ''
  )
}

let client: SupabaseClient | null = null

/**
 * Cliente único, creado de forma perezosa: importar este módulo nunca lanza
 * aunque falten las variables `VITE_*` (la app muestra el aviso de
 * configuración en lugar de una pantalla en blanco). Lo mismo si la URL está
 * mal formada: `createClient` lanza y aquí se regresa null.
 */
export function getSupabase(): SupabaseClient | null {
  if (client) return client
  if (!isConfigured()) return null
  try {
    client = createClient(
      import.meta.env.VITE_SUPABASE_URL as string,
      import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // El enlace de restablecer contraseña llega a /restablecer con la
          // sesión de recuperación en la URL; supabase-js la detecta y emite
          // PASSWORD_RECOVERY.
          detectSessionInUrl: true,
          storageKey: AUTH_STORAGE_KEY,
          storage: localStorage,
        },
      },
    )
  } catch {
    return null
  }
  return client
}
