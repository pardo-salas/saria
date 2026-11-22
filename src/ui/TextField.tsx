import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'

export interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'className'
> {
  label: string
  /** Texto de ayuda bajo el campo. */
  hint?: string
}

/** Campo de texto con etiqueta visible, del mismo tamaño táctil que Button. */
export function TextField({ label, hint, ...rest }: TextFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div>
      <label htmlFor={id} className="text-etiqueta text-texto-suave">
        {label}
      </label>
      <input
        {...rest}
        id={id}
        aria-describedby={hint ? hintId : undefined}
        className="mt-1.5 block min-h-12 w-full rounded-boton bg-superficie-2 px-4 text-base text-texto placeholder:text-texto-suave/60"
      />
      {hint && (
        <p id={hintId} className="mt-1.5 text-sm text-texto-suave">
          {hint}
        </p>
      )}
    </div>
  )
}
