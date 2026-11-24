import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface SheetProps {
  open: boolean
  onClose(): void
  title: string
  children: ReactNode
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Hoja modal que sube desde abajo. Se monta en document.body; Escape, el fondo
 * y el botón de cerrar llaman onClose. Al abrir el foco entra a la hoja, Tab
 * no sale de ella y al cerrar vuelve a donde estaba.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  // onClose en una ref para que un padre que lo recrea en cada render no
  // reinicie el efecto (y no robe ni devuelva el foco a destiempo).
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    // Si un hijo ya tomó el foco (autoFocus), se respeta.
    if (!panelRef.current?.contains(document.activeElement))
      panelRef.current?.focus()

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      )
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center lg:items-center">
      {/* El fondo es solo para el puntero; con teclado se cierra con Escape. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        data-testid="sheet-backdrop"
        className="absolute inset-0 bg-velo transition-opacity duration-200 motion-reduce:transition-none starting:opacity-0"
        onClick={() => onCloseRef.current()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-tarjeta border-t border-borde bg-superficie pb-[env(safe-area-inset-bottom)] text-texto transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] focus-visible:outline-none motion-reduce:transition-none lg:rounded-tarjeta lg:border starting:translate-y-full lg:starting:translate-y-4"
      >
        <div
          aria-hidden="true"
          className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-superficie-2"
        />
        <div className="flex shrink-0 items-center justify-between gap-3 pt-2 pr-3 pb-1 pl-5">
          <h2 id={titleId} className="text-titulo">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            aria-label="Cerrar"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-texto-suave hover:bg-superficie-2 hover:text-texto"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="size-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pt-2 pb-6">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
