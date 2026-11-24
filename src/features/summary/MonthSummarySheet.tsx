import type { MonthSummary } from '@/domain/monthSummary'
import { formatCents } from '@/domain/money'
import { Sheet } from '@/ui/Sheet'

function Row({
  label,
  cents,
  strong,
  minus,
}: {
  label: string
  cents: number
  strong?: boolean
  minus?: boolean
}) {
  return (
    <div
      className={`flex min-h-11 items-baseline justify-between gap-4 py-2 ${strong ? 'font-semibold' : ''}`}
    >
      <dt className={strong ? '' : 'text-texto-suave'}>{label}</dt>
      <dd className={`text-right cifras ${cents < 0 ? 'text-gasto' : ''}`}>
        {minus ? '−' : ''}
        {formatCents(cents)}
      </dd>
    </div>
  )
}

/** Desglose de cómo se calcula "Te queda" en el mes. */
export function MonthSummarySheet({
  open,
  onClose,
  salaryCents,
  summary,
}: {
  open: boolean
  onClose(): void
  salaryCents: number
  summary: MonthSummary
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Tu mes">
      <dl className="divide-y divide-superficie-2">
        <Row label="Sueldo" cents={salaryCents} />
        <Row label="Gastos fijos" cents={summary.fixedCents} minus />
        <Row label="Compras a meses" cents={summary.commitmentsCents} minus />
        <Row label="Disponible" cents={summary.availableCents} strong />
        <Row
          label="Gastado (fuera de pagos fijos)"
          cents={summary.spentOutsideCents}
          minus
        />
        <Row label="Te queda" cents={summary.leftCents} strong />
      </dl>
      <p className="mt-3 text-sm text-texto-suave">
        Los gastos fijos y las compras a meses se descuentan completos del
        sueldo, aunque aún no se paguen.
      </p>
    </Sheet>
  )
}
