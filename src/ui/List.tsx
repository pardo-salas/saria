import type { ReactNode } from 'react'
import { formatCents } from '@/domain/money'

export function List({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col">{children}</ul>
}

export interface ListItemProps {
  title: string
  subtitle?: string
  /** Normalmente un <AppIcon />. */
  icon?: ReactNode
  /** En centavos y con signo: positivo es ingreso, negativo es gasto. */
  amountCents?: number
  /** `auto` colorea por signo; `neutral` usa el color del texto (traspasos). */
  tone?: 'auto' | 'neutral'
  /** Con onClick el renglón completo es un botón. */
  onClick?(): void
}

function formatAmount(cents: number, tone: 'auto' | 'neutral'): string {
  if (cents > 0 && tone === 'auto') return '+' + formatCents(cents)
  return formatCents(cents)
}

export function ListItem({
  title,
  subtitle,
  icon,
  amountCents,
  tone = 'auto',
  onClick,
}: ListItemProps) {
  const amountColor =
    tone === 'neutral' || amountCents === undefined || amountCents === 0
      ? 'text-texto'
      : amountCents > 0
        ? 'text-agua'
        : 'text-gasto'

  const content = (
    <>
      {icon}
      <div className="min-w-0 flex-1">
        <p className="truncate text-base leading-snug font-medium">{title}</p>
        {subtitle && (
          <p className="truncate text-sm leading-snug text-texto-suave">
            {subtitle}
          </p>
        )}
      </div>
      {amountCents !== undefined && (
        <span
          className={`shrink-0 text-base font-semibold cifras ${amountColor}`}
        >
          {formatAmount(amountCents, tone)}
        </span>
      )}
    </>
  )

  const row = 'flex min-h-14 w-full items-center gap-3 py-2 text-left'

  return (
    <li>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={`${row} cursor-pointer rounded-boton transition-colors duration-150 hover:bg-superficie-2/60 active:bg-superficie-2`}
        >
          {content}
        </button>
      ) : (
        <div className={row}>{content}</div>
      )}
    </li>
  )
}
