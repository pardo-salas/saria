import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primaria' | 'secundaria' | 'fantasma' | 'peligro'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: ButtonVariant
  loading?: boolean
}

const VARIANT: Record<ButtonVariant, string> = {
  primaria: 'bg-cobalto text-sobre-cobalto',
  secundaria: 'bg-superficie-2 text-texto',
  fantasma: 'bg-transparent text-texto hover:bg-superficie-2',
  peligro: 'bg-gasto text-sobre-gasto',
}

export function Button({
  variant,
  loading = false,
  disabled,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-boton px-5 text-base font-semibold',
        'transition-[filter,background-color] duration-150 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-4 shrink-0 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
        />
      )}
      {children}
    </button>
  )
}
