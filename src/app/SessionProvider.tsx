import { createContext, useCallback, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { signOut as authSignOut } from '@/auth/authService'
import type { SessionState } from '@/auth/useSession'
import { useSession } from '@/auth/useSession'
import { setRepoUserSource } from '@/db/repo'

export interface SessionContextValue extends SessionState {
  /** Cierra la sesión en este dispositivo y deja la puerta en signed-out. */
  signOut(): Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

/**
 * Publica un valor de sesión ya resuelto y es la única fuente del usuario del
 * repo: cualquier escritura de un hijo (aun en su primer render o en un
 * efecto) ve al usuario actual sin esperar a un efecto del proveedor. Las
 * pruebas lo usan directo para fijar la puerta.
 */
export function SessionValueProvider({
  value,
  children,
}: {
  value: SessionContextValue
  children: ReactNode
}) {
  // Se fija durante el render (no en un efecto) para que el repo conozca al
  // usuario antes de que cualquier hijo se renderice o corra sus efectos. Es
  // idempotente: cada render deja el usuario de ese render.
  const { userId } = value
  setRepoUserSource(() => userId)

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

/** Monta `useSession` una sola vez en la raíz de la app. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const { gate, userId, markSignedOut } = useSession()

  const signOut = useCallback(async () => {
    await authSignOut()
    // authSignOut borra la sesión guardada pase lo que pase; la puerta se
    // cierra aunque supabase-js no emita SIGNED_OUT (p. ej. sin red).
    markSignedOut()
  }, [markSignedOut])

  const value = useMemo(
    () => ({ gate, userId, signOut }),
    [gate, userId, signOut],
  )
  return <SessionValueProvider value={value}>{children}</SessionValueProvider>
}

export function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx)
    throw new Error('useSessionContext debe usarse dentro de <SessionProvider>')
  return ctx
}
