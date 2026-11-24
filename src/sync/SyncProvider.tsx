import { liveQuery } from 'dexie'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useSessionContext } from '@/app/SessionProvider'
import { getSupabase } from '@/auth/supabase'
import { db } from '@/db/dexie'
import { repo } from '@/db/repo'
import { ensureCategoriesSeeded } from '@/db/seed'
import { createSyncEngine, type SyncStatus } from './engine'

const INTERVAL_MS = 60_000
const DEBOUNCE_MS = 2_000

/** Estado neutro: lo que ven las pantallas fuera de un proveedor de sincronización. */
const NEUTRAL: SyncStatus = {
  state: 'sincronizado',
  pending: 0,
  lastSyncedAt: null,
  message: null,
}

interface SyncContextValue {
  status: SyncStatus
  available: boolean
  syncNow(): Promise<void>
}

const SyncContext = createContext<SyncContextValue | null>(null)

/**
 * Crea el motor de sincronización para la sesión actual y lo dispara según
 * §6.2: al montar, al volver a la pestaña, al recuperar red, cada 60 s con la
 * pestaña visible y 2 s después de un cambio en la outbox. También siembra las
 * categorías (§6.3) tras la primera sincronización correcta; si Supabase no
 * está configurado, las siembra al montar para que la app funcione sola.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const { userId } = useSessionContext()
  const [status, setStatus] = useState<SyncStatus>(NEUTRAL)
  const available = userId !== null && getSupabase() !== null
  const forceRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    if (userId === null) return
    const seed = () =>
      ensureCategoriesSeeded(db, repo, userId).catch(() => {
        // Si falla la siembra no se avisa: se reintenta en la siguiente sincronización.
      })

    const supabase = getSupabase()
    if (supabase === null) {
      void seed()
      return
    }

    let disposed = false
    let seeded = false
    const engine = createSyncEngine({
      db,
      supabase,
      getUserId: () => userId,
    })
    const unsubscribe = engine.subscribe((s) => {
      if (!disposed) setStatus(s)
    })

    async function run(force: boolean) {
      try {
        await engine.syncNow({ force })
        if (!disposed && !seeded && engine.getStatus().lastSyncedAt !== null) {
          seeded = true
          await seed()
          if (!disposed) await engine.refreshPending()
        }
      } catch {
        // El motor guarda sus errores en el estado; nada que propagar.
      }
    }
    forceRef.current = () => run(true)

    let timer: ReturnType<typeof setTimeout> | undefined
    const visible = () => document.visibilityState === 'visible'
    const onVisibility = () => {
      if (visible()) void run(false)
    }
    const onOnline = () => void run(false)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)
    const interval = setInterval(() => {
      if (visible()) void run(false)
    }, INTERVAL_MS)

    const sub = liveQuery(() => db.outbox.count()).subscribe({
      next: (count) => {
        engine.refreshPending().catch(() => {})
        if (count > 0) {
          clearTimeout(timer)
          timer = setTimeout(() => void run(false), DEBOUNCE_MS)
        }
      },
      error: () => {},
    })

    void run(false)

    return () => {
      disposed = true
      clearTimeout(timer)
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
      sub.unsubscribe()
      unsubscribe()
      forceRef.current = async () => {}
      setStatus(NEUTRAL)
    }
  }, [userId])

  const syncNow = useCallback(() => forceRef.current(), [])
  return (
    <SyncContext.Provider value={{ status, available, syncNow }}>
      {children}
    </SyncContext.Provider>
  )
}

/**
 * Fuera de un `SyncProvider` devuelve un estado neutro (sin pendientes) para
 * que las pruebas de otras pantallas no necesiten el proveedor.
 */
export function useSyncStatus(): SyncStatus {
  return useContext(SyncContext)?.status ?? NEUTRAL
}

/** Hay un motor activo (Supabase configurado y sesión abierta); si no, la UI de sincronización se oculta. */
export function useSyncAvailable(): boolean {
  return useContext(SyncContext)?.available ?? false
}

/** Sincroniza ya, ignorando la espera por errores previos. */
export function useSyncNow(): () => Promise<void> {
  const ctx = useContext(SyncContext)
  return ctx?.syncNow ?? (async () => {})
}
