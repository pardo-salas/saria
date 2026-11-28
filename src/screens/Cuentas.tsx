import { useState } from 'react'
import { Link } from 'react-router'
import { useFinance, usePendingInstallments, useToday } from '@/db/queries'
import type { Account } from '@/db/schema'
import {
  accountsBreakdown,
  balancesByAccount,
  type AccountGroup,
} from '@/domain/balances'
import { cardStatus, creditUse } from '@/domain/cards'
import type { IconName } from '@/domain/catalog'
import { formatShortDate } from '@/domain/dates'
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

export interface CreditSummary {
  usedPercent: number | null
  /** `null` si a la tarjeta le faltan día de corte o de pago. */
  payment: { pendingCents: number; date: string } | null
}

/** Renglón de cuenta que lleva a su detalle. */
export function AccountLink({
  account,
  cents,
  credit = null,
}: {
  account: Account
  cents: number
  /** Solo tarjetas: % ocupado y lo que falta pagar del periodo. */
  credit?: CreditSummary | null
}) {
  const detail = [
    account.institution ?? TYPE_LABEL[account.type],
    credit?.usedPercent == null ? null : `${credit.usedPercent}% ocupado`,
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
        <span className="shrink-0 text-right">
          <span
            className={`block text-base leading-snug font-semibold cifras ${cents < 0 ? 'text-gasto' : ''}`}
          >
            {formatCents(cents)}
          </span>
          {credit?.payment && (
            <span className="block text-sm leading-snug text-texto-suave cifras">
              {credit.payment.pendingCents > 0
                ? `Por pagar ${formatCents(credit.payment.pendingCents)} · ${formatShortDate(credit.payment.date)}`
                : 'Periodo pagado'}
            </span>
          )}
        </span>
      </Link>
    </li>
  )
}

const COLLAPSED_KEY = 'saria:cuentas-plegadas'

function readCollapsed(): AccountGroup[] {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter(
          (g): g is AccountGroup => typeof g === 'string' && g in GROUP_LABEL,
        )
      : []
  } catch {
    return []
  }
}

/** Grupos que el usuario plegó; se recuerdan en este dispositivo. */
function useCollapsedGroups() {
  const [collapsed, setCollapsed] = useState<AccountGroup[]>(readCollapsed)
  function toggle(group: AccountGroup) {
    setCollapsed((prev) => {
      const next = prev.includes(group)
        ? prev.filter((g) => g !== group)
        : [...prev, group]
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next))
      } catch {
        // Sin almacenamiento solo se pierde el recuerdo.
      }
      return next
    })
  }
  return [collapsed, toggle] as const
}

export function Cuentas() {
  const finance = useFinance()
  const pending = usePendingInstallments()
  const today = useToday()
  const [creating, setCreating] = useState(false)
  const [collapsed, toggleGroup] = useCollapsedGroups()

  if (!finance) return <TabScreen title="Cuentas">{null}</TabScreen>

  const creditSummary = (a: Account): CreditSummary | null => {
    if (a.type !== 'credit') return null
    const pendingCents = pending?.get(a.id) ?? 0
    const balanceAt = (date: string) =>
      balancesByAccount(
        [a],
        finance.transactions.filter((t) => t.date <= date),
        finance.transfers.filter((t) => t.date <= date),
      ).get(a.id) ?? 0
    const status = cardStatus(
      a,
      balanceAt,
      finance.transactions,
      today,
      pendingCents,
    )
    if (status)
      return {
        usedPercent: status.usedPercent,
        payment:
          status.nextPaymentCents > 0
            ? {
                pendingCents: status.pendingPaymentCents,
                date: status.nextPaymentDate,
              }
            : null,
      }
    return {
      usedPercent:
        creditUse(
          a.credit_limit_cents,
          finance.balances.get(a.id) ?? 0,
          pendingCents,
        )?.usedPercent ?? null,
      payment: null,
    }
  }

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

          {breakdown.groups.map((g) => {
            const open = !collapsed.includes(g.group)
            const listId = `cuentas-${g.group}`
            return (
              <section key={g.group} className="mt-4">
                <h2>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={listId}
                    onClick={() => toggleGroup(g.group)}
                    className="-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center gap-2 rounded-boton px-2 text-left transition-colors duration-150 hover:bg-superficie-2/60 active:bg-superficie-2"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className={`size-4 shrink-0 text-texto-suave transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                    <span className="text-sm font-semibold">
                      {GROUP_LABEL[g.group]}
                    </span>
                    <span className="flex-1 text-sm text-texto-suave cifras">
                      {`· ${g.accounts.length}`}
                    </span>
                    <span className="text-sm text-texto-suave cifras">
                      {formatCents(g.subtotalCents)}
                    </span>
                  </button>
                </h2>
                {open && (
                  <ul id={listId} className="flex flex-col">
                    {g.accounts.map((a) => (
                      <AccountLink
                        key={a.id}
                        account={a}
                        cents={finance.balances.get(a.id) ?? 0}
                        credit={creditSummary(a)}
                      />
                    ))}
                  </ul>
                )}
              </section>
            )
          })}

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
