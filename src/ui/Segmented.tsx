import { useId } from 'react'

export interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange(value: T): void
  /** Nombre accesible del grupo. */
  label: string
}

/** Selector de una opción entre pocas, como el de tema en Más (radiogroup). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedProps<T>) {
  const name = useId()
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-boton bg-superficie-2 p-1"
    >
      {options.map((option) => (
        <label
          key={option.value}
          className="flex min-h-11 cursor-pointer items-center justify-center rounded-[1rem] px-3 text-sm font-medium text-texto-suave transition-colors duration-150 hover:text-texto has-checked:bg-cobalto has-checked:font-semibold has-checked:text-sobre-cobalto has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foco"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}
