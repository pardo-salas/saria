import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { useToday } from '@/db/queries'
import { runAutoCreate } from '@/db/recurring'
import { ensureDailyReminder } from '@/db/reminders'
import { SyncProvider, useSyncTick } from '@/sync/SyncProvider'
import { BottomNav, type NavItem } from '@/ui/BottomNav'
import { Fab } from '@/ui/Fab'
import {
  IconCuentas,
  IconGraficas,
  IconInicio,
  IconMas,
  IconMovimientos,
} from '@/ui/icons'
import { QuickAddProvider, useQuickAdd } from './QuickAddContext'
import { useSessionContext } from './SessionProvider'

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Inicio', icon: <IconInicio /> },
  { to: '/movimientos', label: 'Movimientos', icon: <IconMovimientos /> },
  { to: '/cuentas', label: 'Cuentas', icon: <IconCuentas /> },
  { to: '/graficas', label: 'Gráficas', icon: <IconGraficas /> },
  { to: '/mas', label: 'Más', icon: <IconMas /> },
]

/**
 * Marco de las 5 pestañas. Móvil: una columna con espacio abajo para la barra
 * y el botón +. ≥ 1024 px: riel a la izquierda y la columna centrada a 40 rem
 * (el Fab se alinea a ese ancho, ver src/ui/Fab.tsx).
 */
export function Layout() {
  return (
    <SyncProvider>
      <QuickAddProvider>
        <LayoutFrame />
      </QuickAddProvider>
    </SyncProvider>
  )
}

function LayoutFrame() {
  const quickAdd = useQuickAdd()
  const { userId } = useSessionContext()
  const today = useToday()
  // Tras la primera sincronización: antes, un dispositivo nuevo pisaría lo de la nube.
  const syncTick = useSyncTick()
  const synced = syncTick > 0

  useEffect(() => {
    if (userId === null || !synced) return
    // Si falla, se reintenta en la próxima apertura de la app.
    ensureDailyReminder(userId).catch(() => {})
  }, [userId, synced])

  useEffect(() => {
    if (userId === null || !synced) return
    // Un error aquí no debe afectar la app: los pagos quedan en "Por pagar".
    // Se repite tras cada sincronización para procesar pagos recién bajados.
    runAutoCreate(userId, today).catch(() => {})
  }, [userId, today, synced, syncTick])

  return (
    <>
      <div className="lg:pl-24">
        <main className="mx-auto w-full max-w-[40rem] px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(10rem+env(safe-area-inset-bottom))] lg:px-0 lg:pt-12 lg:pb-16">
          <Outlet />
        </main>
      </div>

      <Fab
        label="Registrar"
        onClick={() =>
          quickAdd.open({ accountId: quickAdd.contextAccount ?? undefined })
        }
      />
      <BottomNav items={NAV_ITEMS} />
    </>
  )
}
