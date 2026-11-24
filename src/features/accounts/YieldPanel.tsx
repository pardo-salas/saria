import type { Account } from '@/db/schema'
import { monthlyYieldCents } from '@/domain/yields'
import { formatCents } from '@/domain/money'
import { Card } from '@/ui/Card'

const rateFormat = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 })

/** Panel de rendimiento de una cuenta de débito o inversión con tasa. */
export function YieldPanel({
  account,
  balanceCents,
}: {
  account: Account
  balanceCents: number
}) {
  if (account.yield_rate === null) return null
  const estimate = monthlyYieldCents(account, balanceCents)
  return (
    <Card className="mb-4">
      <p className="text-etiqueta text-texto-suave">
        Rendimiento estimado este mes
      </p>
      <p className="mt-1 text-2xl font-bold [overflow-wrap:anywhere] cifras">
        {formatCents(estimate)}
      </p>
      <dl className="mt-3 divide-y divide-superficie-2">
        <div className="flex min-h-11 items-baseline justify-between gap-4 py-2">
          <dt className="text-texto-suave">
            {account.yield_cap_cents !== null
              ? `Tasa anual hasta ${formatCents(account.yield_cap_cents)}`
              : 'Tasa anual'}
          </dt>
          <dd className="font-medium cifras">
            {rateFormat.format(account.yield_rate)}%
          </dd>
        </div>
        {account.yield_cap_cents !== null && (
          <div className="flex min-h-11 items-baseline justify-between gap-4 py-2">
            <dt className="text-texto-suave">Tasa anual del excedente</dt>
            <dd className="font-medium cifras">
              {rateFormat.format(account.yield_rate_over_cap ?? 0)}%
            </dd>
          </div>
        )}
      </dl>
    </Card>
  )
}
