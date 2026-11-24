import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import type { CategorySpending, MonthFlow } from '@/domain/charts'

// Recharts recibe pesos solo para dibujar; los montos de verdad son centavos.
const pesos = (cents: number) => cents / 100

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
export const shortMonth = (month: string) =>
  MESES_CORTOS[Number(month.slice(5, 7)) - 1] ?? month

const compact = new Intl.NumberFormat('es-MX', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const AXIS = { fill: 'var(--texto-suave)', fontSize: 12 }
const GRID = 'var(--borde)'

/** Barras horizontales por categoría; tocar una barra la selecciona. */
export function SpendingChart({
  items,
  onSelect,
}: {
  items: CategorySpending[]
  onSelect(item: CategorySpending): void
}) {
  const shown = items.slice(0, 8)
  const data = shown.map((i) => ({ name: i.name, value: pesos(i.cents) }))
  return (
    <div aria-hidden="true" style={{ height: shown.length * 40 + 8 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
          barCategoryGap={8}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={96}
            tickLine={false}
            axisLine={false}
            tick={{ ...AXIS, fill: 'var(--texto)' }}
            tickFormatter={(v: string) =>
              v.length > 13 ? `${v.slice(0, 12)}…` : v
            }
          />
          <Bar
            dataKey="value"
            radius={[0, 4, 4, 0]}
            cursor="pointer"
            isAnimationActive={false}
            onClick={(_: unknown, i: number) => {
              const item = shown[i]
              if (item) onSelect(item)
            }}
          >
            {shown.map((i) => (
              <Cell
                key={i.categoryId ?? 'none'}
                fill={i.color ?? 'var(--texto-suave)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Barras agrupadas: ingresos en agua, gastos en gasto. */
export function FlowChart({ data }: { data: MonthFlow[] }) {
  const rows = data.map((d) => ({
    mes: shortMonth(d.month),
    ingresos: pesos(d.incomeCents),
    gastos: pesos(d.expenseCents),
  }))
  return (
    <div aria-hidden="true" className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
          barGap={2}
          barCategoryGap="18%"
        >
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey="mes"
            tickLine={false}
            axisLine={false}
            tick={{ ...AXIS, fontSize: 11 }}
            interval={0}
          />
          <YAxis hide />
          <Bar
            dataKey="ingresos"
            fill="var(--agua)"
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="gastos"
            fill="var(--gasto)"
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Línea del saldo total al cierre de cada mes. */
export function BalanceChart({
  data,
}: {
  data: { month: string; cents: number }[]
}) {
  const rows = data.map((d) => ({
    mes: shortMonth(d.month),
    saldo: pesos(d.cents),
  }))
  return (
    <div aria-hidden="true" className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={rows}
          margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey="mes"
            tickLine={false}
            axisLine={false}
            tick={{ ...AXIS, fontSize: 11 }}
            interval={1}
          />
          <YAxis
            width={48}
            tickLine={false}
            axisLine={false}
            tick={AXIS}
            tickCount={4}
            tickFormatter={(v: number) => `$${compact.format(v)}`}
          />
          <Line
            type="monotone"
            dataKey="saldo"
            stroke="var(--texto)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--superficie)', strokeWidth: 2 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
