import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/ui/Button'

/**
 * Aviso de versión nueva (registerType: 'prompt'). No es modal ni recarga
 * solo: aparece sobre la barra y el botón + y espera a que se pida.
 * `offlineReady` se ignora a propósito: quedar lista sin conexión no necesita aviso.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(9.25rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-[40rem] flex-wrap items-center justify-end gap-x-2 gap-y-1 rounded-tarjeta border border-borde bg-superficie py-2 pr-2 pl-4 text-texto shadow-lg shadow-fondo/50 lg:right-auto lg:bottom-8 lg:left-[calc(6rem+1.5rem)] lg:w-max"
    >
      {/* En teléfono el texto va arriba y los botones abajo a la derecha. */}
      <p className="w-full pt-1 font-medium sm:w-auto sm:flex-1 sm:pt-0 sm:whitespace-nowrap">
        Hay una versión nueva
      </p>
      <Button
        variant="fantasma"
        className="shrink-0 px-3"
        onClick={() => setNeedRefresh(false)}
      >
        Ahora no
      </Button>
      <Button
        variant="primaria"
        className="shrink-0 px-4"
        onClick={() => void updateServiceWorker(true)}
      >
        Actualizar
      </Button>
    </div>
  )
}
