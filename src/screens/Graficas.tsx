import { lazy, Suspense, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useFinance, useToday } from '@/db/queries'
import {
  incomeVsExpenseByMonth,
  spendingByCategory,
  totalBalanceByMonth,
  type CategorySpending,
} from '@/domain/charts'
import { formatMonth, monthKey, shiftMonth } from '@/domain/dates'
import { formatCents, sumCents } from '@/domain/money'
import { Card } from '@/ui/Card'
import { EmptyState } from '@/ui/EmptyState'
import { TabScreen } from './TabScreen'

// Recharts queda fuera del paquete principal: un solo trozo diferido.
const SpendingChart = lazy(() =>
  import('@/features/graficas/Charts').then((m) => ({
    default: m.SpendingChart,
  })),
)
const FlowChart = lazy(() =>
  import('@/features/graficas/Charts').then((m) => ({ default: m.FlowChart })),
)
const BalanceChart = lazy(() =>
  import('@/features/graficas/Charts').then((m) => ({
    default: m.BalanceChart,
  })),
)

const MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]
const shortLabel = (m: string) =>
  `${MESES_CORTOS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`

function Placeholder({ height }: { height: string }) {
  return (
    <div
      role="status"
      aria-label="Cargando gráfica"
      className={`${height} animate-pulse rounded-boton bg-superficie-2`}
    />
  )
}

function Section({
  id,
  title,
  summary,
  children,
}: {
  id: string
  title: string
  summary: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="mt-4">
      <Card>
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        <p className="mt-1 text-sm text-texto-suave">{summary}</p>
        <div className="mt-4">{children}</div>
      </Card>
    </section>
  )
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-3 shrink-0 rounded-sm"
      style={{ background: color }}
    />
  )
}

export function Graficas() {
  const finance = useFinance()
  const today = useToday()
  const navigate = useNavigate()
  const currentMonth = monthKey(today)
  const [month, setMonth] = useState<string | null>(null)
  const shown = month ?? currentMonth

  if (!finance) return <TabScreen title="Gráficas">{null}</TabScreen>

  if (finance.transactions.length === 0)
    return (
      <TabScreen title="Gráficas">
        <EmptyState
          title="Aún no hay nada que graficar"
          text="Aquí verás en qué se va tu dinero cada mes, en cuanto registres tus gastos."
        />
      </TabScreen>
    )

  const spending = spendingByCategory(
    finance.transactions,
    finance.categories,
    shown,
  )
  const spendingTotal = sumCents(spending.map((s) => s.cents))
  const flow = incomeVsExpenseByMonth(finance.transactions, currentMonth)
  const balance = totalBalanceByMonth(
    finance.accounts,
    finance.transactions,
    finance.transfers,
    currentMonth,
  )

  const open = (item: CategorySpending) =>
    navigate('/movimientos', {
      state: { categoryId: item.categoryId, month: shown },
    })

  const first = balance[0]!
  const last = balance[balance.length - 1]!
  const navBtn =
    'flex size-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-3xl leading-none text-texto hover:bg-superficie-2 disabled:cursor-not-allowed disabled:opacity-40'
  const tableCell = 'py-1.5 text-right cifras'

  return (
    <TabScreen title="Gráficas">
      <Section
        id="g-gasto"
        title="Gasto por categoría"
        summary={
          spending.length === 0
            ? `Sin gastos en ${formatMonth(shown)}.`
            : `En ${formatMonth(shown)} gastaste ${formatCents(spendingTotal)}; lo que más pesa es ${spending[0]!.name} con ${formatCents(spending[0]!.cents)}.`
        }
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="Mes anterior"
            onClick={() => setMonth(shiftMonth(shown, -1))}
            className={navBtn}
          >
            ‹
          </button>
          <p aria-live="polite" className="flex-1 text-center font-semibold">
            {formatMonth(shown)}
          </p>
          <button
            type="button"
            aria-label="Mes siguiente"
            disabled={shown >= currentMonth}
            onClick={() => setMonth(shiftMonth(shown, 1))}
            className={navBtn}
          >
            ›
          </button>
        </div>
        <p className="mt-1 text-center text-titulo cifras">
          {formatCents(spendingTotal)}
        </p>
        {spending.length > 0 && (
          <>
            <div className="mt-3">
              <Suspense fallback={<Placeholder height="h-48" />}>
                <SpendingChart items={spending} onSelect={open} />
              </Suspense>
            </div>
            <ul className="mt-2">
              {spending.map((s) => (
                <li key={s.categoryId ?? 'none'}>
                  <button
                    type="button"
                    onClick={() => open(s)}
                    className="flex min-h-11 w-full items-center gap-3 rounded-boton px-1 text-left hover:bg-superficie-2"
                  >
                    <Swatch color={s.color ?? 'var(--texto-suave)'} />
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <span className="text-sm text-texto-suave cifras">
                      {Math.round((s.cents * 100) / spendingTotal)}%
                    </span>
                    <span className="font-semibold cifras">
                      {formatCents(s.cents)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section
        id="g-flujo"
        title="Ingresos y gastos"
        summary={`Últimos 12 meses. En ${formatMonth(currentMonth)}: ingresos ${formatCents(flow[11]!.incomeCents)} y gastos ${formatCents(flow[11]!.expenseCents)}.`}
      >
        <p className="mb-2 flex gap-4 text-sm">
          <span className="flex items-center gap-2">
            <Swatch color="var(--agua)" /> Ingresos
          </span>
          <span className="flex items-center gap-2">
            <Swatch color="var(--gasto)" /> Gastos
          </span>
        </p>
        <Suspense fallback={<Placeholder height="h-56" />}>
          <FlowChart data={flow} />
        </Suspense>
        <details className="mt-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
            Ver cifras por mes
          </summary>
          <table className="w-full text-sm">
            <thead className="text-texto-suave">
              <tr>
                <th scope="col" className="py-1.5 text-left font-medium">
                  Mes
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Ingresos
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Gastos
                </th>
              </tr>
            </thead>
            <tbody>
              {flow.map((f) => (
                <tr key={f.month} className="border-t border-borde">
                  <th scope="row" className="py-1.5 text-left font-normal">
                    {shortLabel(f.month)}
                  </th>
                  <td className={tableCell}>{formatCents(f.incomeCents)}</td>
                  <td className={tableCell}>{formatCents(f.expenseCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </Section>

      <Section
        id="g-saldo"
        title="Evolución del saldo"
        summary={`Saldo total al cierre de cada mes: de ${formatCents(first.cents)} en ${formatMonth(first.month)} a ${formatCents(last.cents)} en ${formatMonth(last.month)}.`}
      >
        <Suspense fallback={<Placeholder height="h-56" />}>
          <BalanceChart data={balance} />
        </Suspense>
        <details className="mt-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
            Ver cifras por mes
          </summary>
          <table className="w-full text-sm">
            <thead className="text-texto-suave">
              <tr>
                <th scope="col" className="py-1.5 text-left font-medium">
                  Cierre de
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Saldo total
                </th>
              </tr>
            </thead>
            <tbody>
              {balance.map((b) => (
                <tr key={b.month} className="border-t border-borde">
                  <th scope="row" className="py-1.5 text-left font-normal">
                    {shortLabel(b.month)}
                  </th>
                  <td className={tableCell}>{formatCents(b.cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </Section>
    </TabScreen>
  )
}
