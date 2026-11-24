import { useState } from 'react'
import { Link } from 'react-router'
import { useFinance, useToday } from '@/db/queries'
import type { Category } from '@/db/schema'
import type { IconName } from '@/domain/catalog'
import { monthKey } from '@/domain/dates'
import { formatCents, sumCents } from '@/domain/money'
import { CategorySheet } from '@/features/forms/CategorySheet'
import { AppIcon } from '@/ui/AppIcon'
import { Button } from '@/ui/Button'
import { Segmented } from '@/ui/Segmented'
import { TabScreen } from './TabScreen'

type Kind = Category['kind']

function CategoryRow({
  category,
  spentCents,
  onOpen,
}: {
  category: Category
  spentCents: number
  onOpen(): void
}) {
  const limit = category.monthly_limit_cents
  const over = limit !== null && spentCents > limit
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-boton py-2 text-left transition-colors duration-150 hover:bg-superficie-2/60 active:bg-superficie-2"
      >
        <AppIcon
          name={category.icon as IconName | null}
          color={category.color}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base leading-snug font-medium">
            {category.name}
          </span>
          {limit !== null && (
            <span
              className={`block truncate text-sm leading-snug cifras ${over ? 'text-gasto' : 'text-texto-suave'}`}
            >
              {`${formatCents(spentCents)} de ${formatCents(limit)}`}
            </span>
          )}
        </span>
      </button>
    </li>
  )
}

export function Categorias() {
  const finance = useFinance()
  const today = useToday()
  const [kind, setKind] = useState<Kind>('expense')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)

  const back = (
    <Link
      to="/mas"
      className="mb-2 -ml-2 inline-flex min-h-11 items-center px-2 text-sm font-medium text-agua"
    >
      ‹ Más
    </Link>
  )
  if (!finance) return <TabScreen title="Categorías">{back}</TabScreen>

  const month = monthKey(today)
  const spent = (id: string) =>
    sumCents(
      finance.transactions
        .filter(
          (t) =>
            t.kind === 'expense' &&
            t.category_id === id &&
            monthKey(t.date) === month,
        )
        .map((t) => t.amount_cents),
    )

  const ofKind = finance.categories
    .filter((c) => c.kind === kind)
    .sort(
      (a, b) => a.position - b.position || a.name.localeCompare(b.name, 'es'),
    )
  const active = ofKind.filter((c) => !c.archived)
  const archived = ofKind.filter((c) => c.archived)

  const rows = (list: Category[]) => (
    <ul className="mt-1 flex flex-col">
      {list.map((c) => (
        <CategoryRow
          key={c.id}
          category={c}
          spentCents={kind === 'expense' ? spent(c.id) : 0}
          onOpen={() => setEditing(c)}
        />
      ))}
    </ul>
  )

  return (
    <TabScreen title="Categorías">
      {back}
      <Segmented
        label="Tipo de categoría"
        options={[
          { value: 'expense', label: 'Gasto' },
          { value: 'income', label: 'Ingreso' },
        ]}
        value={kind}
        onChange={(v) => setKind(v as Kind)}
      />
      {active.length === 0 ? (
        <p className="mt-6 text-texto-suave">
          {kind === 'expense'
            ? 'Aún no tienes categorías de gasto.'
            : 'Aún no tienes categorías de ingreso.'}
        </p>
      ) : (
        <section className="mt-4">{rows(active)}</section>
      )}
      <Button
        variant="secundaria"
        className="mt-6 w-full"
        onClick={() => setCreating(true)}
      >
        Nueva categoría
      </Button>
      {archived.length > 0 && (
        <section className="mt-8" aria-labelledby="cat-archivadas">
          <h2 id="cat-archivadas" className="text-sm font-semibold">
            Archivadas
          </h2>
          {rows(archived)}
        </section>
      )}
      <CategorySheet
        open={creating}
        onClose={() => setCreating(false)}
        kind={kind}
      />
      <CategorySheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        kind={kind}
        category={editing ?? undefined}
      />
    </TabScreen>
  )
}
