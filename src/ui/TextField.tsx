import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'

export interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'className'
> {
  label: string
  /** Texto de ayuda bajo el campo. */
  hint?: string
  /** Mensaje de error; se anuncia al aparecer y marca el campo como inválido. */
  error?: string
}

/** Campo de texto con etiqueta visible, del mismo tamaño táctil que Button. */
export function TextField({ label, hint, error, ...rest }: TextFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') ||
    undefined
  return (
    <div>
      <label htmlFor={id} className="text-etiqueta text-texto-suave">
        {label}
      </label>
      <input
        {...rest}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={[
          'mt-1.5 block min-h-12 w-full rounded-boton bg-superficie-2 px-4 text-base text-texto placeholder:text-texto-suave/60',
          error ? 'ring-2 ring-gasto' : '',
        ].join(' ')}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-sm text-gasto">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="mt-1.5 text-sm text-texto-suave">
          {hint}
        </p>
      )}
    </div>
  )
}
