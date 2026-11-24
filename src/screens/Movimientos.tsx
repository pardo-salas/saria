import { useState } from 'react'
import { useFinance, useToday } from '@/db/queries'
import {
  formatDayLabel,
  formatMonth,
  monthKey,
  shiftMonth,
} from '@/domain/dates'
import { groupByDay, type FeedEntry } from '@/domain/feed'
import { formatCents } from '@/domain/money'
import {
  EMPTY_FILTERS,
  feedTotals,
  filterFeed,
  normalizeText,
  PAGE_SIZE,
  type EntryKind,
  type FeedFilters,
} from '@/domain/search'
import { FiltersSheet } from '@/features/movimientos/FiltersSheet'
import { TransactionSheet } from '@/features/forms/TransactionSheet'
import { TransferSheet } from '@/features/forms/TransferSheet'
import { Button } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { EmptyState } from '@/ui/EmptyState'
import { FeedRow } from '@/ui/FeedRow'
import { List } from '@/ui/List'
import { TabScreen } from './TabScreen'

const KIND_LABEL: Record<EntryKind, string> = {
  expense: 'Gasto',
  income: 'Ingreso',
  transfer: 'Transferencia',
}

export function Movimientos() {
  const finance = useFinance()
  const today = useToday()
  const [filters, setFilters] = useState<FeedFilters>({
    ...EMPTY_FILTERS,
    month: monthKey(today),
  })
  const [pages, setPages] = useState({ key: '', extra: 0 })
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [editing, setEditing] = useState<FeedEntry | null>(null)

  const searching = normalizeText(filters.text) !== ''
  const effective: FeedFilters = {
    ...filters,
    range:
      filters.range && filters.range.from && filters.range.to
        ? filters.range
        : null,
  }
  const key = JSON.stringify(effective)
  const extra = pages.key === key ? pages.extra : 0
  const monthLocked = searching || effective.range !== null

  const filtered = finance
    ? filterFeed(finance.feed, effective, finance.lookups)
    : []
  const totals = feedTotals(filtered)
  const visible = filtered.slice(0, PAGE_SIZE + extra)
  const days = groupByDay(visible)

  const patch = (p: Partial<FeedFilters>) => setFilters((f) => ({ ...f, ...p }))
  const clear = () =>
    setFilters((f) => ({
      ...EMPTY_FILTERS,
      text: f.text,
      month: f.month,
    }))

  const chips: { label: string; remove(): void }[] = []
  for (const k of filters.kinds)
    chips.push({
      label: KIND_LABEL[k],
      remove: () => patch({ kinds: filters.kinds.filter((x) => x !== k) }),
    })
  for (const id of filters.accountIds)
    chips.push({
      label: finance?.lookups.accounts.get(id)?.name ?? 'Cuenta',
      remove: () =>
        patch({ accountIds: filters.accountIds.filter((x) => x !== id) }),
    })
  for (const id of filters.categoryIds)
    chips.push({
      label: finance?.lookups.categories.get(id)?.name ?? 'Categoría',
      remove: () =>
        patch({ categoryIds: filters.categoryIds.filter((x) => x !== id) }),
    })
  if (effective.range)
    chips.push({
      label: `${effective.range.from} a ${effective.range.to}`,
      remove: () => patch({ range: null }),
    })

  const navBtn =
    'flex size-11 shrink-0 items-center justify-center rounded-full text-xl text-texto hover:bg-superficie-2 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <TabScreen title="Movimientos">
      <div className="flex items-center gap-2">
        <input
          type="search"
          aria-label="Buscar movimientos"
          placeholder="Buscar nota, categoría, cuenta o monto"
          value={filters.text}
          onChange={(e) => patch({ text: e.target.value })}
          className="min-h-12 min-w-0 flex-1 rounded-boton bg-superficie-2 px-4 text-base text-texto placeholder:text-texto-suave"
        />
        <Button variant="secundaria" onClick={() => setFiltersOpen(true)}>
          Filtros
        </Button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Mes anterior"
          disabled={filters.month === null || monthLocked}
          onClick={() =>
            filters.month && patch({ month: shiftMonth(filters.month, -1) })
          }
          className={navBtn}
        >
          ‹
        </button>
        <p
          aria-live="polite"
          className={`min-w-0 flex-1 truncate text-center font-semibold ${monthLocked ? 'text-texto-suave' : ''}`}
        >
          {filters.month === null
            ? 'Todo el historial'
            : formatMonth(filters.month)}
        </p>
        <button
          type="button"
          aria-label="Mes siguiente"
          disabled={filters.month === null || monthLocked}
          onClick={() =>
            filters.month && patch({ month: shiftMonth(filters.month, 1) })
          }
          className={navBtn}
        >
          ›
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {searching ? (
          <p className="text-sm text-texto-suave">
            Buscando en todo el historial
          </p>
        ) : (
          <Chip
            label="Todo el historial"
            selected={filters.month === null}
            onClick={() =>
              patch({ month: filters.month === null ? monthKey(today) : null })
            }
          />
        )}
      </div>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((c) => (
            <Chip key={c.label} label={c.label} selected onRemove={c.remove} />
          ))}
        </div>
      )}

      {finance && filtered.length > 0 && (
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-texto-suave">
          <span>
            Gastos{' '}
            <span className="font-semibold text-gasto cifras">
              {formatCents(totals.expenseCents)}
            </span>
          </span>
          <span>
            Ingresos{' '}
            <span className="font-semibold text-agua cifras">
              {formatCents(totals.incomeCents)}
            </span>
          </span>
          <span>
            Neto{' '}
            <span className="font-semibold text-texto cifras">
              {formatCents(totals.netCents)}
            </span>
          </span>
        </p>
      )}

      {finance &&
        (filtered.length === 0 ? (
          <EmptyState
            title={
              searching || chips.length > 0
                ? 'Nada coincide con tu búsqueda'
                : 'Aún no hay movimientos este mes'
            }
            text={
              searching || chips.length > 0
                ? 'Prueba con otra palabra o quita algún filtro.'
                : 'Aquí verás cada gasto e ingreso que registres, del más reciente al más antiguo.'
            }
          />
        ) : (
          <>
            {days.map((day) => (
              <section key={day.date} className="mt-5">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold">
                    {formatDayLabel(day.date, today)}
                  </h2>
                  <span className="text-sm text-texto-suave cifras">
                    {formatCents(day.netCents)}
                  </span>
                </div>
                <List>
                  {day.entries.map((entry) => (
                    <FeedRow
                      key={`${entry.type}-${entry.row.id}`}
                      entry={entry}
                      lookups={finance.lookups}
                      onOpen={setEditing}
                    />
                  ))}
                </List>
              </section>
            ))}
            {visible.length < filtered.length && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="secundaria"
                  onClick={() => setPages({ key, extra: extra + PAGE_SIZE })}
                >
                  Ver más
                </Button>
              </div>
            )}
          </>
        ))}

      {finance && (
        <FiltersSheet
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          filters={filters}
          onChange={setFilters}
          onClear={clear}
          accounts={finance.accounts.filter((a) => !a.archived)}
          categories={finance.categories.filter((c) => !c.archived)}
        />
      )}
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
    </TabScreen>
  )
}
