import { useState } from 'react'
import { Link } from 'react-router'
import { useFinance, useLiveRows } from '@/db/queries'
import type { RecurringPayment } from '@/db/schema'
import type { IconName } from '@/domain/catalog'
import { formatCents } from '@/domain/money'
import { describeFrequency } from '@/features/recurring/labels'
import { RecurringSheet } from '@/features/recurring/RecurringSheet'
import { AppIcon } from '@/ui/AppIcon'
import { Button } from '@/ui/Button'
import { EmptyState } from '@/ui/EmptyState'
import { TabScreen } from './TabScreen'

const dateFormat = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

function shortDate(date: string): string {
  return dateFormat.format(new Date(`${date}T00:00:00Z`))
}

export function PagosHabituales() {
  const payments = useLiveRows('recurring_payments')
  const finance = useFinance()
  const [editing, setEditing] = useState<RecurringPayment | null>(null)
  const [creating, setCreating] = useState(false)

  const sorted = [...(payments ?? [])].sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      (a.next_due_date ?? '9999').localeCompare(b.next_due_date ?? '9999') ||
      a.name.localeCompare(b.name),
  )

  return (
    <TabScreen title="Pagos habituales">
      <Link
        to="/mas"
        className="mb-2 -ml-2 inline-flex min-h-11 items-center px-2 text-sm font-medium text-agua"
      >
        ‹ Más
      </Link>
      <Button
        variant="primaria"
        className="mb-4 w-full"
        onClick={() => setCreating(true)}
      >
        Nuevo pago habitual
      </Button>
      {payments && sorted.length === 0 ? (
        <EmptyState
          title="Aún no tienes pagos habituales"
          text="Agrega rentas, suscripciones o mensualidades para ver cuándo toca pagar."
        />
      ) : (
        <ul className="flex flex-col">
          {sorted.map((p) => {
            const category = p.category_id
              ? finance?.lookups.categories.get(p.category_id)
              : undefined
            const account = p.account_id
              ? finance?.lookups.accounts.get(p.account_id)
              : undefined
            const next = p.active
              ? p.next_due_date
                ? `Próximo: ${shortDate(p.next_due_date)}`
                : 'Sin próxima fecha'
              : 'Inactivo'
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setEditing(p)}
                  className={`flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-boton py-2 text-left transition-colors duration-150 hover:bg-superficie-2/60 active:bg-superficie-2 ${p.active ? '' : 'opacity-60'}`}
                >
                  <AppIcon
                    name={(category?.icon as IconName | null) ?? null}
                    color={category?.color}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base leading-snug font-medium">
                      {p.name}
                    </span>
                    <span className="block truncate text-sm leading-snug text-texto-suave">
                      {describeFrequency(p)}
                      {account ? ` · ${account.name}` : ''} · {next}
                    </span>
                  </span>
                  <span className="shrink-0 text-base font-semibold cifras">
                    {formatCents(p.amount_cents)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <RecurringSheet open={creating} onClose={() => setCreating(false)} />
      <RecurringSheet
        key={editing?.id ?? 'ninguno'}
        open={editing !== null}
        onClose={() => setEditing(null)}
        payment={editing ?? undefined}
      />
    </TabScreen>
  )
}
