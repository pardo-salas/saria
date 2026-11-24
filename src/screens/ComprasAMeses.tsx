import { useState } from 'react'
import { Link } from 'react-router'
import { useFinance, useLiveRows, useToday } from '@/db/queries'
import type { InstallmentPlan } from '@/db/schema'
import { formatShortDate, monthKey } from '@/domain/dates'
import { monthlyCommitmentCents, planProgress } from '@/domain/installments'
import { formatCents, sumCents } from '@/domain/money'
import { InstallmentDetail } from '@/features/installments/InstallmentDetail'
import { InstallmentSheet } from '@/features/installments/InstallmentSheet'
import { Button } from '@/ui/Button'
import { EmptyState } from '@/ui/EmptyState'
import { TabScreen } from './TabScreen'

function Total({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="rounded-tarjeta bg-superficie p-4">
      <p className="text-etiqueta text-texto-suave">{label}</p>
      <p className="mt-1 text-lg font-semibold [overflow-wrap:anywhere] cifras">
        {formatCents(cents)}
      </p>
    </div>
  )
}

export function ComprasAMeses() {
  const plans = useLiveRows('installment_plans')
  const finance = useFinance()
  const today = useToday()
  const [viewing, setViewing] = useState<InstallmentPlan | null>(null)
  const [editing, setEditing] = useState<InstallmentPlan | null>(null)
  const [creating, setCreating] = useState(false)

  const txs = finance?.transactions ?? []
  const rows = (plans ?? []).map((p) => ({ plan: p, ...planProgress(p, txs) }))
  rows.sort(
    (a, b) =>
      Number(b.plan.active) - Number(a.plan.active) ||
      (a.nextChargeDate ?? '9999').localeCompare(b.nextChargeDate ?? '9999') ||
      a.plan.concept.localeCompare(b.plan.concept),
  )
  const commitment = monthlyCommitmentCents(plans ?? [], txs, monthKey(today))
  const pending = sumCents(rows.map((r) => r.remainingCents))
  // Si se edita desde el detalle, se muestra la versión viva de la compra.
  const live = (p: InstallmentPlan | null) =>
    p ? ((plans ?? []).find((x) => x.id === p.id) ?? p) : null
  const viewingPlan = live(viewing)

  return (
    <TabScreen title="Compras a meses">
      <Link
        to="/mas"
        className="mb-2 -ml-2 inline-flex min-h-11 items-center px-2 text-sm font-medium text-agua"
      >
        ‹ Más
      </Link>
      {plans && rows.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Total label="Compromiso mensual" cents={commitment} />
          <Total label="Total por pagar" cents={pending} />
        </div>
      )}
      <Button
        variant="primaria"
        className="mb-4 w-full"
        onClick={() => setCreating(true)}
      >
        Nueva compra a meses
      </Button>
      {plans && rows.length === 0 ? (
        <EmptyState
          title="Aún no tienes compras a meses"
          text="Agrega una compra para ver cuánto pagas cada mes y cuánto te falta."
        />
      ) : (
        <ul className="flex flex-col">
          {rows.map((r) => {
            const account = r.plan.account_id
              ? finance?.lookups.accounts.get(r.plan.account_id)
              : undefined
            return (
              <li key={r.plan.id}>
                <button
                  type="button"
                  onClick={() => setViewing(r.plan)}
                  className={`flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-boton py-2 text-left transition-colors duration-150 hover:bg-superficie-2/60 active:bg-superficie-2 ${r.plan.active ? '' : 'opacity-60'}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base leading-snug font-medium">
                      {r.plan.concept}
                    </span>
                    <span className="block truncate text-sm leading-snug text-texto-suave">
                      {account ? `${account.name} · ` : ''}
                      <span className="cifras">
                        {r.paid} / {r.plan.months}
                      </span>{' '}
                      · Termina {formatShortDate(r.endDate)}
                      {!r.plan.active &&
                        (r.paid >= r.plan.months
                          ? ' · Terminada'
                          : ' · Pausada')}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-base font-semibold cifras">
                      {formatCents(r.plan.monthly_cents)}
                    </span>
                    <span className="block text-sm text-texto-suave cifras">
                      Queda {formatCents(r.remainingCents)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <InstallmentSheet open={creating} onClose={() => setCreating(false)} />
      {viewingPlan && (
        <InstallmentDetail
          open={editing === null}
          onClose={() => setViewing(null)}
          plan={viewingPlan}
          onEdit={() => setEditing(viewingPlan)}
        />
      )}
      <InstallmentSheet
        key={editing?.id ?? 'ninguno'}
        open={editing !== null}
        onClose={() => {
          setEditing(null)
          setViewing(null)
        }}
        plan={editing ?? undefined}
      />
    </TabScreen>
  )
}
