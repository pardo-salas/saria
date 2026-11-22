import { useCallback, useEffect, useMemo, useState } from 'react'
import { decideGate, readStoredUserId, type GateState } from './session'
import { getSupabase } from './supabase'

export type SessionState = { gate: GateState; userId: string | null }

export interface SessionControls extends SessionState {
  /** Cierra la puerta ya, sin esperar a que supabase-js emita SIGNED_OUT. */
  markSignedOut(): void
}

function initialState(): SessionState {
  // Un cliente que no se pudo crear (variables ausentes o URL mal formada)
  // cuenta como configuración faltante.
  const configured = getSupabase() !== null
  const userId = configured ? readStoredUserId(localStorage) : null
  return { gate: decideGate(configured, userId), userId }
}

const SIGNED_OUT: SessionState = { gate: 'signed-out', userId: null }

const SIGNED_IN_EVENTS = new Set([
  'SIGNED_IN',
  'TOKEN_REFRESHED',
  'USER_UPDATED',
  'PASSWORD_RECOVERY',
])

/**
 * Estado de la puerta de la app. El estado inicial sale de `localStorage` de
 * forma síncrona (sin pantalla de carga): una sesión guardada abre la app
 * aunque el token haya vencido y no haya red. Se usa una sola vez, en
 * `SessionProvider` (src/app/SessionProvider.tsx).
 *
 * Eventos de supabase-js (verificado en @supabase/auth-js 2.119.2):
 * - Un refresh que falla por red (`AuthRetryableFetchError`) conserva la
 *   sesión guardada y NO emite `SIGNED_OUT` (`_callRefreshToken`), así que
 *   no hace falta protegerse de eso aquí.
 * - `SIGNED_OUT` solo se emite después de borrar la sesión (`_removeSession`):
 *   cierre de sesión o refresh token rechazado por el servidor.
 * - `INITIAL_SESSION` se ignora: el estado inicial ya viene de
 *   `localStorage`, y sin red puede llegar con `session: null` aunque la
 *   sesión siga guardada.
 */
export function useSession(): SessionControls {
  const [state, setState] = useState<SessionState>(initialState)

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setState(SIGNED_OUT)
      } else if (SIGNED_IN_EVENTS.has(event) && session?.user.id) {
        const id = session.user.id
        setState((prev) =>
          prev.gate === 'signed-in' && prev.userId === id
            ? prev
            : { gate: 'signed-in', userId: id },
        )
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const markSignedOut = useCallback(() => {
    setState((prev) => (prev.gate === 'misconfigured' ? prev : SIGNED_OUT))
  }, [])

  return useMemo(() => ({ ...state, markSignedOut }), [state, markSignedOut])
}
