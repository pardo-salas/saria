import { useState } from 'react'
import { Link } from 'react-router'
import { useFinance, useLiveRows, useToday } from '@/db/queries'
import { skipOccurrence } from '@/db/recurring'
import type { RecurringPayment } from '@/db/schema'
import type { IconName } from '@/domain/catalog'
import { formatCents } from '@/domain/money'
import { dueGroups } from '@/domain/recurring'
import { AppIcon } from '@/ui/AppIcon'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { Sheet } from '@/ui/Sheet'
import { useToast } from '@/ui/Toast'
import { dueLabel } from './labels'
import { PayDueSheet } from './PayDueSheet'

function DueRow({
  payment,
  today,
  onPay,
  onMenu,
}: {
  payment: RecurringPayment
  today: string
  onPay(): void
  onMenu(): void
}) {
  const finance = useFinance()
  const account = payment.account_id
    ? finance?.lookups.accounts.get(payment.account_id)
    : undefined
  const category = payment.category_id
    ? finance?.lookups.categories.get(payment.category_id)
    : undefined
  const overdue = (payment.next_due_date ?? '') < today
  return (
    <li className="flex min-h-14 items-center gap-2 py-2">
      <AppIcon
        name={(category?.icon as IconName | null) ?? null}
        color={category?.color}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base leading-snug font-medium">
          {payment.name}
        </p>
        <p
          className={`truncate text-sm leading-snug ${overdue ? 'text-gasto' : 'text-texto-suave'}`}
        >
          <span className="cifras">{formatCents(payment.amount_cents)}</span>
          {account ? ` · ${account.name}` : ''} ·{' '}
          {dueLabel(payment.next_due_date ?? today, today)}
        </p>
      </div>
      <button
        type="button"
        onClick={onPay}
        aria-label={`Pagado: ${payment.name}`}
        className="min-h-11 shrink-0 cursor-pointer rounded-full bg-cobalto px-4 text-sm font-semibold text-sobre-cobalto active:brightness-90"
      >
        Pagado
      </button>
      <button
        type="button"
        onClick={onMenu}
        aria-label={`Más opciones de ${payment.name}`}
        className="-mr-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-xl text-texto-suave hover:bg-superficie-2"
      >
        <span aria-hidden="true">…</span>
      </button>
    </li>
  )
}

/** Tarjeta "Por pagar" de Inicio; no se muestra si no hay nada pendiente. */
export function DueCard() {
  const payments = useLiveRows('recurring_payments')
  const today = useToday()
  const toast = useToast()
  const [paying, setPaying] = useState<RecurringPayment | null>(null)
  const [menu, setMenu] = useState<RecurringPayment | null>(null)
  const [busy, setBusy] = useState(false)

  const groups = dueGroups(payments ?? [], today)
  const sections: [string, RecurringPayment[]][] = [
    ['Vencidos', groups.overdue],
    ['Hoy', groups.today],
    ['Esta semana', groups.week],
  ]
  const total = sections.reduce((n, [, l]) => n + l.length, 0)

  async function skip() {
    if (!menu || busy) return
    setBusy(true)
    try {
      await skipOccurrence(menu)
      toast.show({ message: 'Pago omitido' })
      setMenu(null)
    } catch {
      toast.show({ message: 'No se pudo omitir. Intenta de nuevo' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {total > 0 && (
        <section aria-labelledby="por-pagar" className="mt-6">
          <Card>
            <div className="flex items-baseline justify-between">
              <h2 id="por-pagar" className="text-sm font-semibold">
                Por pagar
              </h2>
              <Link
                to="/mas/pagos"
                className="-mr-2 inline-flex min-h-11 items-center px-2 text-sm font-medium text-agua"
              >
                Ver todos
              </Link>
            </div>
            {sections
              .filter(([, list]) => list.length > 0)
              .map(([title, list]) => (
                <div key={title} className="mt-1">
                  <h3 className="text-etiqueta text-texto-suave">{title}</h3>
                  <ul>
                    {list.map((p) => (
                      <DueRow
                        key={p.id}
                        payment={p}
                        today={today}
                        onPay={() => setPaying(p)}
                        onMenu={() => setMenu(p)}
                      />
                    ))}
                  </ul>
                </div>
              ))}
          </Card>
        </section>
      )}

      <PayDueSheet
        open={paying !== null}
        onClose={() => setPaying(null)}
        payment={paying}
      />
      <Sheet
        open={menu !== null}
        onClose={() => setMenu(null)}
        title={menu?.name ?? 'Pago'}
      >
        <p className="text-texto-suave">
          Omitir pasa este pago a su siguiente fecha sin crear un movimiento.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button
            variant="secundaria"
            loading={busy}
            onClick={() => void skip()}
          >
            Omitir este pago
          </Button>
          <Button variant="fantasma" onClick={() => setMenu(null)}>
            Cancelar
          </Button>
        </div>
      </Sheet>
    </>
  )
}
