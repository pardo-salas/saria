import type { Account, Transaction, Transfer } from '@/db/schema'
import { balancesByAccount } from '@/domain/balances'
import { cardStatus } from '@/domain/cards'
import { formatShortDate } from '@/domain/dates'
import { formatCents } from '@/domain/money'
import { Card } from '@/ui/Card'

/** Panel de tarjeta de crédito: línea, disponible, corte y próximo pago. */
export function CardPanel({
  account,
  transactions,
  transfers,
  today,
}: {
  account: Account
  transactions: Transaction[]
  transfers: Transfer[]
  today: string
}) {
  const balanceAt = (date: string) =>
    balancesByAccount(
      [account],
      transactions.filter((t) => t.date <= date),
      transfers.filter((t) => t.date <= date),
    ).get(account.id) ?? 0
  const status = cardStatus(account, balanceAt, transactions, today)

  if (!status) {
    return (
      <Card className="mb-4">
        <p className="font-semibold">Tarjeta de crédito</p>
        <p className="mt-0.5 text-sm text-texto-suave">
          Agrega la línea de crédito, el día de corte y el día límite de pago en
          Editar cuenta para ver cuánto te queda y cuándo pagar.
        </p>
      </Card>
    )
  }

  const used = Math.min(100, Math.max(0, status.usedPercent))
  return (
    <Card className="mb-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-etiqueta text-texto-suave">Disponible</p>
        <p className="text-sm text-texto-suave cifras">
          Línea {formatCents(account.credit_limit_cents ?? 0)}
        </p>
      </div>
      <p
        className={`mt-1 text-2xl font-bold [overflow-wrap:anywhere] cifras ${status.availableCents < 0 ? 'text-gasto' : ''}`}
      >
        {formatCents(status.availableCents)}
      </p>
      <div
        role="progressbar"
        aria-label="Uso de la línea"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={used}
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-superficie-2"
      >
        <div
          style={{ width: `${used}%` }}
          className={`h-full rounded-full ${used >= 80 ? 'bg-gasto' : 'bg-agua'}`}
        />
      </div>
      <p className="mt-1 text-sm text-texto-suave cifras">
        {status.usedPercent}% usado
      </p>
      <dl className="mt-3 divide-y divide-superficie-2">
        <div className="flex min-h-11 items-baseline justify-between gap-4 py-2">
          <dt className="text-texto-suave">
            Pagar antes del {formatShortDate(status.nextPaymentDate)}
          </dt>
          <dd className="font-semibold cifras">
            {formatCents(status.nextPaymentCents)}
          </dd>
        </div>
        <div className="flex min-h-11 items-baseline justify-between gap-4 py-2">
          <dt className="text-texto-suave">
            Gastado desde el corte del {formatShortDate(status.lastCut)}
          </dt>
          <dd className="font-medium cifras">
            {formatCents(status.periodSpentCents)}
          </dd>
        </div>
        <div className="flex min-h-11 items-baseline justify-between gap-4 py-2">
          <dt className="text-texto-suave">Día de corte</dt>
          <dd className="font-medium cifras">{account.statement_day}</dd>
        </div>
      </dl>
    </Card>
  )
}
