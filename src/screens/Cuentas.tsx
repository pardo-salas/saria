import { useState } from 'react'
import { Link } from 'react-router'
import { useFinance } from '@/db/queries'
import type { Account } from '@/db/schema'
import { accountsBreakdown, type AccountGroup } from '@/domain/balances'
import type { IconName } from '@/domain/catalog'
import { formatCents, sumCents } from '@/domain/money'
import { monthlyYieldCents } from '@/domain/yields'
import { AccountSheet } from '@/features/forms/AccountSheet'
import { AppIcon } from '@/ui/AppIcon'
import { Button } from '@/ui/Button'
import { EmptyState } from '@/ui/EmptyState'
import { TabScreen } from './TabScreen'

export const TYPE_LABEL: Record<Account['type'], string> = {
  cash: 'Efectivo',
  debit: 'Débito',
  credit: 'Crédito',
  investment: 'Inversión',
}

const GROUP_LABEL: Record<AccountGroup, string> = {
  liquid: 'Efectivo y débito',
  credit: 'Crédito',
  investment: 'Inversión',
}

/** Renglón de cuenta que lleva a su detalle. */
export function AccountLink({
  account,
  cents,
}: {
  account: Account
  cents: number
}) {
  const detail = [
    account.institution ?? TYPE_LABEL[account.type],
    account.include_in_total ? null : 'fuera del total',
  ].filter(Boolean)
  return (
    <li>
      <Link
        to={`/cuentas/${account.id}`}
        className="flex min-h-14 items-center gap-3 rounded-boton py-2 transition-colors duration-150 hover:bg-superficie-2/60 active:bg-superficie-2"
      >
        <AppIcon name={account.icon as IconName | null} color={account.color} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base leading-snug font-medium">
            {account.name}
          </span>
          <span className="block truncate text-sm leading-snug text-texto-suave">
            {detail.join(' · ')}
          </span>
        </span>
        <span
          className={`shrink-0 text-base font-semibold cifras ${cents < 0 ? 'text-gasto' : ''}`}
        >
          {formatCents(cents)}
        </span>
      </Link>
    </li>
  )
}

export function Cuentas() {
  const finance = useFinance()
  const [creating, setCreating] = useState(false)

  if (!finance) return <TabScreen title="Cuentas">{null}</TabScreen>

  const breakdown = accountsBreakdown(finance.accounts, finance.balances)
  const archivedCount = finance.accounts.filter((a) => a.archived).length
  const hasActive = breakdown.groups.length > 0

  const yieldCents = sumCents(
    finance.accounts
      .filter((a) => !a.archived)
      .map((a) => monthlyYieldCents(a, finance.balances.get(a.id) ?? 0)),
  )
  const hasYield = finance.accounts.some(
    (a) => !a.archived && a.yield_rate !== null,
  )

  const notes = [
    breakdown.creditDebtCents > 0
      ? `Debes en tarjetas ${formatCents(breakdown.creditDebtCents)}`
      : null,
    breakdown.investmentApartCents !== 0
      ? `Inversión aparte ${formatCents(breakdown.investmentApartCents)}`
      : null,
  ].filter(Boolean)

  const archivedLink = archivedCount > 0 && (
    <Link
      to="/cuentas/archivadas"
      className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-agua"
    >
      Archivadas ›
    </Link>
  )

  return (
    <TabScreen title="Cuentas">
      {hasActive ? (
        <>
          <section
            aria-label="Total"
            className="rounded-tarjeta bg-superficie p-5"
          >
            <p className="text-etiqueta text-texto-suave">Saldo total</p>
            <p className="mt-1 text-3xl font-bold [overflow-wrap:anywhere] cifras">
              {formatCents(breakdown.totalCents)}
            </p>
            {notes.length > 0 && (
              <p className="mt-2 text-sm text-texto-suave">
                {notes.join(' · ')}
              </p>
            )}
            {hasYield && (
              <p className="mt-2 text-sm text-texto-suave">
                Rendimiento estimado este mes{' '}
                <span className="font-semibold text-texto cifras">
                  {formatCents(yieldCents)}
                </span>
              </p>
            )}
          </section>

          {breakdown.groups.map((g) => (
            <section key={g.group} className="mt-6">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">
                  {GROUP_LABEL[g.group]}
                </h2>
                <span className="text-sm text-texto-suave cifras">
                  {formatCents(g.subtotalCents)}
                </span>
              </div>
              <ul className="mt-1 flex flex-col">
                {g.accounts.map((a) => (
                  <AccountLink
                    key={a.id}
                    account={a}
                    cents={finance.balances.get(a.id) ?? 0}
                  />
                ))}
              </ul>
            </section>
          ))}

          <div className="mt-6 flex flex-col gap-3">
            <Button variant="secundaria" onClick={() => setCreating(true)}>
              Nueva cuenta
            </Button>
            {archivedLink}
          </div>
        </>
      ) : (
        <>
          <EmptyState
            title="Aún no tienes cuentas"
            text="Aquí verás tu efectivo, tus cuentas de débito y tus tarjetas de crédito, cada una con su saldo."
            action={
              <Button variant="primaria" onClick={() => setCreating(true)}>
                Nueva cuenta
              </Button>
            }
          />
          <div className="flex justify-center">{archivedLink}</div>
        </>
      )}
      <AccountSheet open={creating} onClose={() => setCreating(false)} />
    </TabScreen>
  )
}
