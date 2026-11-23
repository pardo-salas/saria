import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Account, Category } from '../../db/schema'
import { ICON_NAMES, PALETTE, type IconName } from '../../domain/catalog'
import { AppIcon } from '../../ui/AppIcon'
import { Button } from '../../ui/Button'

/** Mensaje de error de un campo; se anuncia al aparecer. */
export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm text-gasto">
      {message}
    </p>
  )
}

interface Option {
  value: string
  label: string
  icon?: ReactNode
}

/**
 * Grupo de fichas con semántica de radio: una sola opción, flechas para
 * moverse, foco visible. Cada ficha mide al menos 44 px de alto.
 */
function RadioChips({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string
  options: Option[]
  value: string | null
  onChange(value: string): void
  error?: string
}) {
  const name = useId()
  const errorId = `${name}-error`
  return (
    <div>
      <p id={`${name}-label`} className="text-etiqueta text-texto-suave">
        {label}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={`${name}-label`}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        className="mt-1.5 flex flex-wrap gap-2"
      >
        {options.map((o) => (
          <label
            key={o.value}
            className="inline-flex min-h-11 max-w-full cursor-pointer items-center gap-2 rounded-full bg-superficie-2 px-4 text-sm font-medium text-texto has-checked:bg-cobalto has-checked:font-semibold has-checked:text-sobre-cobalto has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foco"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.icon}
            <span className="truncate">{o.label}</span>
          </label>
        ))}
      </div>
      <FieldError id={errorId} message={error} />
    </div>
  )
}

/** Cuentas a mostrar: las activas, más la que ya tenía el registro aunque esté archivada. */
export function selectableAccounts(
  accounts: Account[],
  keepIds: (string | null | undefined)[],
): Account[] {
  return accounts
    .filter((a) => !a.archived || keepIds.includes(a.id))
    .sort((a, b) => a.position - b.position)
}

export function AccountPicker({
  label = 'Cuenta',
  accounts,
  value,
  onChange,
  error,
}: {
  label?: string
  accounts: Account[]
  value: string | null
  onChange(id: string): void
  error?: string
}) {
  return (
    <RadioChips
      label={label}
      value={value}
      onChange={onChange}
      error={error}
      options={accounts.map((a) => ({
        value: a.id,
        label: a.name,
        icon: (
          <AppIcon name={a.icon as IconName | null} color={a.color} size="sm" />
        ),
      }))}
    />
  )
}

/** `null` = sin categoría. */
export function CategoryPicker({
  categories,
  value,
  onChange,
  error,
}: {
  categories: Category[]
  value: string | null
  onChange(id: string | null): void
  error?: string
}) {
  return (
    <RadioChips
      label="Categoría"
      value={value ?? ''}
      onChange={(v) => onChange(v === '' ? null : v)}
      error={error}
      options={[
        { value: '', label: 'Sin categoría' },
        ...categories.map((c) => ({
          value: c.id,
          label: c.name,
          icon: (
            <AppIcon
              name={c.icon as IconName | null}
              color={c.color}
              size="sm"
            />
          ),
        })),
      ]}
    />
  )
}

export function DateField({
  label = 'Fecha',
  value,
  onChange,
  error,
}: {
  label?: string
  value: string
  onChange(date: string): void
  error?: string
}) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div>
      <label htmlFor={id} className="text-etiqueta text-texto-suave">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={[
          'mt-1.5 block min-h-12 w-full rounded-boton bg-superficie-2 px-4 text-base text-texto cifras',
          error ? 'ring-2 ring-gasto' : '',
        ].join(' ')}
      />
      <FieldError id={errorId} message={error} />
    </div>
  )
}

/** Rejilla de iconos con semántica de radio; el nombre accesible es el del icono. */
export function IconPicker({
  value,
  onChange,
  color,
}: {
  value: string | null
  onChange(icon: string): void
  color: string | null
}) {
  const name = useId()
  return (
    <div>
      <p id={`${name}-label`} className="text-etiqueta text-texto-suave">
        Icono
      </p>
      <div
        role="radiogroup"
        aria-labelledby={`${name}-label`}
        className="mt-1.5 grid grid-cols-6 gap-1.5"
      >
        {ICON_NAMES.map((icon) => (
          <label
            key={icon}
            className="flex min-h-11 cursor-pointer items-center justify-center rounded-boton has-checked:bg-superficie-2 has-checked:ring-2 has-checked:ring-cobalto has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foco"
          >
            <input
              type="radio"
              name={name}
              value={icon}
              aria-label={`Icono ${icon}`}
              checked={icon === value}
              onChange={() => onChange(icon)}
              className="sr-only"
            />
            <AppIcon name={icon} color={color} size="md" />
          </label>
        ))}
      </div>
    </div>
  )
}

/** Muestras de la paleta con semántica de radio. */
export function ColorPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange(color: string): void
}) {
  const name = useId()
  return (
    <div>
      <p id={`${name}-label`} className="text-etiqueta text-texto-suave">
        Color
      </p>
      <div
        role="radiogroup"
        aria-labelledby={`${name}-label`}
        className="mt-1.5 flex flex-wrap gap-2"
      >
        {PALETTE.map((color, i) => (
          <label
            key={color}
            className="flex size-11 cursor-pointer items-center justify-center rounded-full has-checked:ring-2 has-checked:ring-texto has-checked:ring-offset-2 has-checked:ring-offset-superficie has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foco"
          >
            <input
              type="radio"
              name={name}
              value={color}
              aria-label={`Color ${i + 1}`}
              checked={color === value}
              onChange={() => onChange(color)}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className="size-8 rounded-full"
              style={{ backgroundColor: color }}
            />
          </label>
        ))}
      </div>
    </div>
  )
}

/**
 * Paso de confirmación en la misma hoja. El mensaje se anuncia al aparecer y
 * el foco cae en "Cancelar", la opción segura.
 */
export function ConfirmStep({
  message,
  confirmLabel,
  danger = true,
  busy,
  onConfirm,
  onCancel,
}: {
  message: string
  confirmLabel: string
  danger?: boolean
  busy?: boolean
  onConfirm(): void
  onCancel(): void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    cancelRef.current?.focus()
  }, [])
  return (
    <div className="rounded-boton bg-superficie-2 p-4">
      <p role="alert" className="text-base font-medium text-texto">
        {message}
      </p>
      <div className="mt-3 flex gap-2">
        <button
          ref={cancelRef}
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="min-h-12 flex-1 cursor-pointer rounded-boton bg-superficie px-5 text-base font-semibold text-texto disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancelar
        </button>
        <Button
          variant={danger ? 'peligro' : 'primaria'}
          className="flex-1"
          loading={busy}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}
