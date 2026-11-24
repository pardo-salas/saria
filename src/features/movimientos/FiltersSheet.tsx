import type { Account, Category } from '@/db/schema'
import type { EntryKind, FeedFilters } from '@/domain/search'
import { DateField } from '@/features/forms/pickers'
import { Button } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { Sheet } from '@/ui/Sheet'

const KINDS: { value: EntryKind; label: string }[] = [
  { value: 'expense', label: 'Gasto' },
  { value: 'income', label: 'Ingreso' },
  { value: 'transfer', label: 'Transferencia' },
]

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

function Group({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="mt-5 first:mt-0">
      <p className="text-etiqueta text-texto-suave">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export interface FiltersSheetProps {
  open: boolean
  onClose(): void
  filters: FeedFilters
  onChange(filters: FeedFilters): void
  onClear(): void
  accounts: Account[]
  categories: Category[]
}

export function FiltersSheet({
  open,
  onClose,
  filters,
  onChange,
  onClear,
  accounts,
  categories,
}: FiltersSheetProps) {
  const range = filters.range ?? { from: '', to: '' }
  function setRange(next: { from: string; to: string }) {
    onChange({
      ...filters,
      range: next.from === '' && next.to === '' ? null : next,
    })
  }

  return (
    <Sheet open={open} onClose={onClose} title="Filtros">
      <Group label="Tipo">
        {KINDS.map((k) => (
          <Chip
            key={k.value}
            label={k.label}
            selected={filters.kinds.includes(k.value)}
            onClick={() =>
              onChange({ ...filters, kinds: toggle(filters.kinds, k.value) })
            }
          />
        ))}
      </Group>
      <Group label="Cuentas">
        {accounts.map((a) => (
          <Chip
            key={a.id}
            label={a.name}
            selected={filters.accountIds.includes(a.id)}
            onClick={() =>
              onChange({
                ...filters,
                accountIds: toggle(filters.accountIds, a.id),
              })
            }
          />
        ))}
      </Group>
      <Group label="Categorías">
        {categories.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            selected={filters.categoryIds.includes(c.id)}
            onClick={() =>
              onChange({
                ...filters,
                categoryIds: toggle(filters.categoryIds, c.id),
              })
            }
          />
        ))}
      </Group>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <DateField
          label="Desde"
          value={range.from}
          onChange={(from) => setRange({ ...range, from })}
        />
        <DateField
          label="Hasta"
          value={range.to}
          onChange={(to) => setRange({ ...range, to })}
        />
      </div>
      <div className="mt-6 flex gap-2">
        <Button variant="secundaria" className="flex-1" onClick={onClear}>
          Limpiar
        </Button>
        <Button variant="primaria" className="flex-1" onClick={onClose}>
          Listo
        </Button>
      </div>
    </Sheet>
  )
}
