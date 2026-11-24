import { useFinance } from '@/db/queries'
import type { InstallmentPlan } from '@/db/schema'
import { formatShortDate } from '@/domain/dates'
import { planProgress } from '@/domain/installments'
import { formatCents } from '@/domain/money'
import { Button } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-baseline justify-between gap-4 py-2">
      <dt className="text-texto-suave">{label}</dt>
      <dd className="text-right font-medium cifras">{value}</dd>
    </div>
  )
}

/** Detalle de una compra a meses con las cifras del Excel. */
export function InstallmentDetail({
  open,
  onClose,
  plan,
  onEdit,
}: {
  open: boolean
  onClose(): void
  plan: InstallmentPlan
  onEdit(): void
}) {
  const finance = useFinance()
  const account = plan.account_id
    ? finance?.lookups.accounts.get(plan.account_id)
    : undefined
  const progress = planProgress(plan, finance?.transactions ?? [])

  return (
    <Sheet open={open} onClose={onClose} title={plan.concept}>
      <p className="mb-2 text-sm text-texto-suave">
        {account ? `${account.name} · ` : ''}Comprada el{' '}
        {formatShortDate(plan.purchase_date)} por{' '}
        <span className="cifras">{formatCents(plan.total_cents)}</span>
      </p>
      <dl className="divide-y divide-superficie-2">
        <Row label="Pagados" value={`${progress.paid} / ${plan.months}`} />
        <Row label="Pago real" value={formatCents(plan.monthly_cents)} />
        <Row
          label="Costo por mes"
          value={formatCents(progress.costPerMonthCents)}
        />
        <Row label="Acumulado" value={formatCents(progress.accumulatedCents)} />
        <Row
          label="Queda por pagar"
          value={formatCents(progress.remainingCents)}
        />
        <Row label="Fecha final" value={formatShortDate(progress.endDate)} />
        <Row
          label="Próximo cargo"
          value={
            progress.nextChargeDate
              ? formatShortDate(progress.nextChargeDate)
              : 'Liquidada'
          }
        />
      </dl>
      <div className="mt-6 flex flex-col gap-2">
        <Button variant="secundaria" onClick={onEdit}>
          Editar compra
        </Button>
        <Button variant="fantasma" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </Sheet>
  )
}
