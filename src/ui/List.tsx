import type { ReactNode } from 'react'
import { formatCents } from '@/domain/money'

export function List({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col">{children}</ul>
}

export interface ListItemProps {
  title: string
  subtitle?: string
  /** Color de la categoría o cuenta (dato del usuario); sin él, superficie-2. */
  iconColor?: string
  /** Entero positivo en centavos; el signo lo da `kind`. */
  amountCents?: number
  kind?: 'income' | 'expense'
}

export function ListItem({
  title,
  subtitle,
  iconColor,
  amountCents,
  kind = 'expense',
}: ListItemProps) {
  const hasAmount = amountCents !== undefined
  const amount = hasAmount
    ? (kind === 'income' ? '+' : '−') + formatCents(Math.abs(amountCents))
    : null

  return (
    <li className="flex min-h-14 items-center gap-3 py-2">
      <span
        aria-hidden="true"
        className="size-9 shrink-0 rounded-xl bg-superficie-2"
        style={iconColor ? { backgroundColor: iconColor } : undefined}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base leading-snug font-medium">{title}</p>
        {subtitle && (
          <p className="truncate text-sm leading-snug text-texto-suave">
            {subtitle}
          </p>
        )}
      </div>
      {amount && (
        <span
          className={[
            'shrink-0 text-base font-semibold cifras',
            kind === 'income' ? 'text-agua' : 'text-gasto',
          ].join(' ')}
        >
          {amount}
        </span>
      )}
    </li>
  )
}
