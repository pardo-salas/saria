import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Account, Category, Transaction, Transfer } from '@/db/schema'
import type { FeedEntry } from '@/domain/feed'
import type { Lookups } from '@/domain/search'
import { List } from './List'
import { FeedRow } from './FeedRow'

const base = {
  user_id: 'u',
  created_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-01T00:00:00Z',
  deleted_at: null,
}

const bbva = { ...base, id: 'a1', name: 'BBVA Débito' } as Account
const credito = { ...base, id: 'a2', name: 'BBVA Crédito' } as Account
const comida = {
  ...base,
  id: 'c1',
  name: 'Comida',
  icon: 'super',
  color: '#5DB36A',
} as Category

const lookups: Lookups = {
  accounts: new Map([
    [bbva.id, bbva],
    [credito.id, credito],
  ]),
  categories: new Map([[comida.id, comida]]),
}

const gasto: FeedEntry = {
  type: 'transaction',
  row: {
    ...base,
    id: 't1',
    kind: 'expense',
    amount_cents: 18550,
    date: '2026-11-20',
    account_id: 'a1',
    category_id: 'c1',
    note: null,
  } as Transaction,
}

const traspaso: FeedEntry = {
  type: 'transfer',
  row: {
    ...base,
    id: 'tr1',
    from_account_id: 'a1',
    to_account_id: 'a2',
    amount_cents: 200000,
    date: '2026-11-20',
    note: null,
  } as Transfer,
}

function renderRow(entry: FeedEntry, accountId?: string) {
  const onOpen = vi.fn()
  render(
    <List>
      <FeedRow
        entry={entry}
        lookups={lookups}
        accountId={accountId}
        onOpen={onOpen}
      />
    </List>,
  )
  return onOpen
}

describe('FeedRow', () => {
  it('un gasto muestra categoría, cuenta y monto con signo; al tocarlo abre', async () => {
    const onOpen = renderRow(gasto)
    expect(screen.getByText('Comida')).toBeInTheDocument()
    expect(screen.getByText('BBVA Débito')).toBeInTheDocument()
    expect(screen.getByText('−$185.50')).toHaveClass('text-gasto')
    await userEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledWith(gasto)
  })

  it('sin categoría dice "Sin categoría" y usa la nota como subtítulo', () => {
    const entry: FeedEntry = {
      type: 'transaction',
      row: { ...gasto.row, category_id: null, note: 'Tacos' } as Transaction,
    }
    renderRow(entry)
    expect(screen.getByText('Sin categoría')).toBeInTheDocument()
    expect(screen.getByText('Tacos')).toBeInTheDocument()
  })

  it('una transferencia vista desde el origen dice "A BBVA Crédito"', () => {
    renderRow(traspaso, 'a1')
    expect(screen.getByText('A BBVA Crédito')).toBeInTheDocument()
    expect(screen.getByText('−$2,000.00')).not.toHaveClass('text-gasto')
  })

  it('vista desde el destino dice "De BBVA Débito" con monto neutro sin signo', () => {
    renderRow(traspaso, 'a2')
    expect(screen.getByText('De BBVA Débito')).toBeInTheDocument()
    expect(screen.getByText('$2,000.00')).not.toHaveClass('text-agua')
  })

  it('sin cuenta muestra "origen → destino" y el monto sin signo', () => {
    renderRow(traspaso)
    expect(screen.getByText('BBVA Débito → BBVA Crédito')).toBeInTheDocument()
    expect(screen.getByText('$2,000.00')).toBeInTheDocument()
  })
})
