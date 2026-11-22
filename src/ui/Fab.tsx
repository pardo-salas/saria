import type { MouseEventHandler } from 'react'

export interface FabProps {
  onClick: MouseEventHandler<HTMLButtonElement>
  /** Nombre accesible; lo visible es solo el "+". */
  label: string
}

/**
 * Botón flotante abajo a la derecha, por encima de la barra inferior
 * (4 rem + área segura). En ≥ 1024 px la barra se vuelve riel lateral y el
 * botón baja y se pega al borde derecho de la columna de contenido (40 rem
 * centrados a la derecha del riel de 6 rem), sin irse a la esquina de la
 * ventana.
 */
export function Fab({ onClick, label }: FabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="fixed right-4 bottom-[calc(4rem+env(safe-area-inset-bottom)+1rem)] z-30 flex size-14 items-center justify-center rounded-boton bg-fab text-sobre-fab shadow-lg shadow-fondo/50 transition-[filter] duration-150 active:brightness-90 lg:right-[max(1.5rem,calc(50vw-28rem))] lg:bottom-8"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  )
}
