import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'

export interface ToastContent {
  message: string
  actionLabel?: string
  onAction?(): void
}

interface ToastApi {
  show(toast: ToastContent): void
}

const TOAST_MS = 5000

// Sin proveedor (pruebas de pantallas aisladas) mostrar no hace nada.
const ToastContext = createContext<ToastApi>({ show: () => {} })

export function useToast(): ToastApi {
  return useContext(ToastContext)
}

/**
 * Un aviso a la vez: uno nuevo reemplaza al anterior y reinicia los 5 s.
 * Se ubica encima de la barra inferior en móvil y al centro de la columna de
 * contenido en pantallas anchas (donde la navegación es un riel lateral).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<
    (ToastContent & { id: number }) | null
  >(null)

  const show = useCallback((toast: ToastContent) => {
    setCurrent((prev) => ({ ...toast, id: (prev?.id ?? 0) + 1 }))
  }, [])

  const id = current?.id
  useEffect(() => {
    if (id === undefined) return
    const timer = setTimeout(() => setCurrent(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [id])

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* La región siempre existe para que los lectores de pantalla anuncien el cambio. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] z-50 flex justify-center px-4 lg:bottom-6 lg:left-24"
      >
        {current && (
          <div
            key={current.id}
            className="pointer-events-auto flex min-h-12 w-full max-w-md items-center gap-2 rounded-boton border border-borde bg-superficie-2 py-1 pr-1 pl-4 text-texto shadow-lg shadow-black/30 transition-[opacity,translate] duration-200 motion-reduce:transition-none starting:translate-y-2 starting:opacity-0"
          >
            <p className="min-w-0 flex-1 text-sm leading-snug">
              {current.message}
            </p>
            {current.actionLabel && (
              <button
                type="button"
                onClick={() => {
                  current.onAction?.()
                  setCurrent(null)
                }}
                className="min-h-11 shrink-0 rounded-[1rem] px-4 text-sm font-semibold text-agua hover:bg-superficie"
              >
                {current.actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
