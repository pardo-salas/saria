import { useState } from 'react'
import { Link } from 'react-router'
import { useFinance, useSettings, useToday } from '@/db/queries'
import {
  periodSummary,
  totalBalance,
  waterLevel,
  type WaterLevel,
} from '@/domain/balances'
import { daysLeftInMonth } from '@/domain/dates'
import type { FeedEntry } from '@/domain/feed'
import { formatCents } from '@/domain/money'
import { TransactionSheet } from '@/features/forms/TransactionSheet'
import { TransferSheet } from '@/features/forms/TransferSheet'
import { useSyncAvailable, useSyncStatus } from '@/sync/SyncProvider'
import { EmptyState } from '@/ui/EmptyState'
import { FeedRow } from '@/ui/FeedRow'
import { List } from '@/ui/List'
import { SyncPill } from '@/ui/SyncPill'
import { WaterLevelCard } from '@/ui/WaterLevelCard'

const monthFormat = new Intl.DateTimeFormat('es-MX', {
  month: 'long',
  timeZone: 'America/Mexico_City',
})

function currentMonth(): string {
  const month = monthFormat.format(new Date())
  return month.charAt(0).toUpperCase() + month.slice(1)
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className="rounded-tarjeta bg-superficie p-4">
      <p className="text-etiqueta text-texto-suave">{label}</p>
      <p className="mt-1 text-lg font-semibold [overflow-wrap:anywhere] cifras">
        {value}
      </p>
      {detail && <p className="mt-0.5 text-sm text-texto-suave">{detail}</p>}
    </div>
  )
}

export function Inicio() {
  const finance = useFinance()
  const settings = useSettings()
  const today = useToday()
  const syncStatus = useSyncStatus()
  const syncAvailable = useSyncAvailable()
  const [editing, setEditing] = useState<FeedEntry | null>(null)

  let level: WaterLevel | null = null
  let todayEntries: FeedEntry[] = []
  let flows: ReturnType<typeof periodSummary> | null = null
  let total: number | null = null
  if (finance && settings !== undefined) {
    flows = periodSummary(finance.transactions, today)
    level = waterLevel(
      settings?.monthly_income_cents ?? null,
      flows.month.expenseCents,
      daysLeftInMonth(today),
    )
    todayEntries = finance.feed.filter((e) => e.row.date === today)
    total = totalBalance(finance.accounts, finance.balances)
  }

  return (
    <>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-etiqueta text-texto-suave">{currentMonth()}</p>
          <h1 className="text-titulo">Hola, Brian</h1>
        </div>
        {syncAvailable && <SyncPill status={syncStatus} />}
      </header>

      <WaterLevelCard level={level} />

      {flows && total !== null && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stat
            label="Hoy"
            value={formatCents(flows.today.expenseCents)}
            detail="gastado"
          />
          <Stat
            label="Este mes"
            value={formatCents(flows.month.expenseCents)}
            detail={`${formatCents(flows.month.incomeCents)} de ingresos`}
          />
          <div className="col-span-2">
            <Stat label="Saldo total" value={formatCents(total)} />
          </div>
        </div>
      )}

      <section aria-labelledby="hoy" className="mt-6">
        <div className="flex items-baseline justify-between">
          <h2 id="hoy" className="text-sm font-semibold">
            Hoy
          </h2>
          <Link
            to="/movimientos"
            className="-mr-2 inline-flex min-h-11 items-center px-2 text-sm font-medium text-agua"
          >
            Ver todo
          </Link>
        </div>
        {finance && todayEntries.length === 0 ? (
          <EmptyState
            title="Nada registrado hoy"
            text="Los gastos e ingresos de hoy aparecerán aquí."
          />
        ) : (
          finance && (
            <List>
              {todayEntries.map((entry) => (
                <FeedRow
                  key={`${entry.type}-${entry.row.id}`}
                  entry={entry}
                  lookups={finance.lookups}
                  onOpen={setEditing}
                />
              ))}
            </List>
          )
        )}
      </section>

      <TransactionSheet
        open={editing?.type === 'transaction'}
        onClose={() => setEditing(null)}
        transaction={editing?.type === 'transaction' ? editing.row : undefined}
      />
      <TransferSheet
        open={editing?.type === 'transfer'}
        onClose={() => setEditing(null)}
        transfer={editing?.type === 'transfer' ? editing.row : undefined}
      />
    </>
  )
}
