import { useId, useState } from 'react'
import { formatCents, parseToCents, type ParseError } from '@/domain/money'

export interface AmountInputProps {
  label: string
  valueCents: number | null
  onChange(cents: number | null): void
  error?: string
}

const MESSAGES: Record<Exclude<ParseError, 'empty'>, string> = {
  invalid: 'Escribe un monto válido',
  too_many_decimals: 'Usa máximo dos decimales',
  too_large: 'El monto máximo es 999,999,999.99',
}

/** Texto para el input: el monto formateado sin el "$", que va como prefijo. */
function toText(cents: number | null): string {
  return cents === null ? '' : formatCents(cents).replace('$', '')
}

function messageFor(text: string): string | undefined {
  const result = parseToCents(text)
  if (result.ok || result.error === 'empty') return undefined
  return MESSAGES[result.error]
}

/**
 * Campo de monto para captura rápida: teclado decimal en Android, cifra grande
 * con números tabulares. Acepta coma decimal ("12,50") y separador de miles.
 */
export function AmountInput({
  label,
  valueCents,
  onChange,
  error,
}: AmountInputProps) {
  const id = useId()
  const errorId = `${id}-error`
  const [text, setText] = useState(() => toText(valueCents))
  const [focused, setFocused] = useState(false)
  const [prevValue, setPrevValue] = useState(valueCents)

  // Si el padre cambia el valor mientras no se edita, el texto lo sigue.
  if (valueCents !== prevValue) {
    setPrevValue(valueCents)
    if (!focused) setText(toText(valueCents))
  }

  const message = error ?? messageFor(text)

  return (
    <div>
      <label htmlFor={id} className="text-etiqueta text-texto-suave">
        {label}
      </label>
      <div
        className={[
          'mt-1.5 flex min-h-16 items-baseline gap-1 rounded-boton bg-superficie-2 px-4 py-3',
          'outline-2 outline-offset-2 outline-transparent focus-within:outline-foco',
          message ? 'ring-2 ring-gasto' : '',
        ].join(' ')}
      >
        <span
          aria-hidden="true"
          className="text-2xl font-semibold text-texto-suave"
        >
          $
        </span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          placeholder="0.00"
          value={text}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? errorId : undefined}
          onFocus={() => setFocused(true)}
          onChange={(event) => {
            const next = event.target.value
            setText(next)
            const result = parseToCents(next)
            onChange(result.ok ? result.cents : null)
          }}
          onBlur={() => {
            setFocused(false)
            const result = parseToCents(text)
            if (result.ok) setText(toText(result.cents))
          }}
          className="w-full min-w-0 bg-transparent text-4xl font-bold tracking-tight text-texto cifras placeholder:text-texto-suave/50 focus:outline-none"
        />
      </div>
      {message && (
        <p id={errorId} className="mt-1.5 text-sm text-gasto">
          {message}
        </p>
      )}
    </div>
  )
}
