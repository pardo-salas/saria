import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { useQuickAdd } from '@/app/QuickAddContext'
import { useFinance, useToday } from '@/db/queries'
import { formatDayLabel } from '@/domain/dates'
import { entriesForAccount, groupByDay, type FeedEntry } from '@/domain/feed'
import { formatCents } from '@/domain/money'
import { CardPanel } from '@/features/accounts/CardPanel'
import { YieldPanel } from '@/features/accounts/YieldPanel'
import { AccountSheet } from '@/features/forms/AccountSheet'
import { TransactionSheet } from '@/features/forms/TransactionSheet'
import { TransferSheet } from '@/features/forms/TransferSheet'
import { Button } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { EmptyState } from '@/ui/EmptyState'
import { FeedRow } from '@/ui/FeedRow'
import { List } from '@/ui/List'
import { TYPE_LABEL } from './Cuentas'

type View = 'all' | 'transaction' | 'transfer'

const VIEWS: { value: View; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: 'transaction', label: 'Movimientos' },
  { value: 'transfer', label: 'Transferencias' },
]

export function CuentaDetalle() {
  const { id = '' } = useParams()
  const finance = useFinance()
  const today = useToday()
  const { setContextAccount } = useQuickAdd()
  const [view, setView] = useState<View>('all')
  const [editingAccount, setEditingAccount] = useState(false)
  const [editing, setEditing] = useState<FeedEntry | null>(null)

  useEffect(() => {
    setContextAccount(id)
    return () => setContextAccount(null)
  }, [id, setContextAccount])

  if (!finance) return null
  const account = finance.lookups.accounts.get(id)
  if (!account) return <Navigate to="/cuentas" replace />

  const all = entriesForAccount(finance.feed, id)
  const shown = view === 'all' ? all : all.filter((e) => e.type === view)
  const days = groupByDay(shown, {
    accountId: id,
    openingBalanceCents: account.initial_balance_cents,
    fullFeed: all,
  })
  const balance = finance.balances.get(id) ?? 0

  return (
    <>
      <Link
        to={account.archived ? '/cuentas/archivadas' : '/cuentas'}
        className="-ml-2 inline-flex min-h-11 items-center px-2 pt-3 text-sm font-medium text-agua"
      >
        ‹ Cuentas
      </Link>
      <header className="mt-1 mb-4">
        <h1 className="text-titulo">{account.name}</h1>
        <p className="mt-1 text-3xl font-bold [overflow-wrap:anywhere] cifras">
          {formatCents(balance)}
        </p>
        <p className="mt-1 text-sm text-texto-suave">
          {TYPE_LABEL[account.type]}
          {account.archived ? ' · archivada' : ''} · Saldo inicial{' '}
          <span className="cifras">
            {formatCents(account.initial_balance_cents)}
          </span>
        </p>
        <Button
          variant="secundaria"
          className="mt-3"
          onClick={() => setEditingAccount(true)}
        >
          Editar cuenta
        </Button>
      </header>

      {account.type === 'credit' && (
        <CardPanel
          account={account}
          transactions={finance.transactions}
          transfers={finance.transfers}
          today={today}
        />
      )}
      {(account.type === 'debit' || account.type === 'investment') && (
        <YieldPanel account={account} balanceCents={balance} />
      )}

      <div role="group" aria-label="Ver" className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Chip
            key={v.value}
            label={v.label}
            selected={view === v.value}
            onClick={() => setView(v.value)}
          />
        ))}
      </div>

      {days.length === 0 ? (
        <EmptyState
          title="Sin movimientos"
          text="Los movimientos y transferencias de esta cuenta aparecerán aquí."
        />
      ) : (
        days.map((day) => (
          <section key={day.date} className="mt-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">
                {formatDayLabel(day.date, today)}
              </h2>
              {day.closingBalanceCents !== null && (
                <span className="text-sm text-texto-suave cifras">
                  Saldo {formatCents(day.closingBalanceCents)}
                </span>
              )}
            </div>
            <List>
              {day.entries.map((entry) => (
                <FeedRow
                  key={`${entry.type}-${entry.row.id}`}
                  entry={entry}
                  lookups={finance.lookups}
                  accountId={id}
                  onOpen={setEditing}
                />
              ))}
            </List>
          </section>
        ))
      )}

      <AccountSheet
        open={editingAccount}
        onClose={() => setEditingAccount(false)}
        account={account}
      />
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
