import type { ReactNode } from 'react'

export interface ChipProps {
  label: string
  selected?: boolean
  onClick?(): void
  /** Si se pasa, se agrega un botón aparte para quitar el filtro. */
  onRemove?(): void
  icon?: ReactNode
}

/**
 * Ficha para filtros y selecciones. Con `onClick` alterna (aria-pressed);
 * con `onRemove` suma una "x" propia de 44 px para quitarla.
 */
export function Chip({ label, selected, onClick, onRemove, icon }: ChipProps) {
  const tone = selected
    ? 'bg-cobalto text-sobre-cobalto'
    : 'bg-superficie-2 text-texto'
  const body = (
    <>
      {icon && (
        <span aria-hidden="true" className="flex shrink-0 [&>svg]:size-4">
          {icon}
        </span>
      )}
      <span className="truncate">{label}</span>
    </>
  )
  const shape = `inline-flex min-h-11 max-w-full items-center gap-1.5 text-sm font-medium ${tone}`
  const left = icon ? 'pl-2' : 'pl-4'
  const pad = onRemove
    ? `rounded-l-full pr-2 ${left}`
    : `rounded-full pr-4 ${left}`

  return (
    <span className="inline-flex max-w-full">
      {onClick ? (
        <button
          type="button"
          aria-pressed={selected ?? false}
          onClick={onClick}
          className={`${shape} cursor-pointer ${pad}`}
        >
          {body}
        </button>
      ) : (
        <span className={`${shape} ${pad}`}>{body}</span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar ${label}`}
          className={`flex min-h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-r-full ${tone}`}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </span>
  )
}
