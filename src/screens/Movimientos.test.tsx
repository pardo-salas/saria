import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/dexie'
import { localDate, monthKey, shiftMonth } from '@/domain/dates'
import { acct, cat, Providers, tx } from '@/features/forms/testUtils'
import { Movimientos } from './Movimientos'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

function renderScreen() {
  render(
    <Providers>
      <MemoryRouter>
        <Movimientos />
      </MemoryRouter>
    </Providers>,
  )
}

describe('Movimientos', () => {
  it('buscar "tacos" encuentra una nota de otro mes', async () => {
    const month = monthKey(localDate(new Date()))
    await db.accounts.put(acct({ id: 'a1', name: 'Efectivo' }))
    await db.categories.put(cat({ id: 'c1', name: 'Comida' }))
    await db.transactions.put(
      tx({
        id: 't1',
        date: `${shiftMonth(month, -3)}-05`,
        note: 'tacos al pastor',
        category_id: 'c1',
      }),
    )
    renderScreen()
    expect(
      await screen.findByText('Aún no hay movimientos este mes'),
    ).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Buscar movimientos'), 'tacos')
    expect(await screen.findByText('tacos al pastor')).toBeInTheDocument()
    expect(
      screen.getByText('Buscando en todo el historial'),
    ).toBeInTheDocument()
  })

  it('con 150 movimientos muestra 100 y "Ver más" muestra 150', async () => {
    const month = monthKey(localDate(new Date()))
    await db.accounts.put(acct({ id: 'a1', name: 'Efectivo' }))
    await db.categories.put(cat({ id: 'c1', name: 'Comida' }))
    await db.transactions.bulkPut(
      Array.from({ length: 150 }, (_, i) =>
        tx({ id: `t${i}`, date: `${month}-01`, category_id: 'c1' }),
      ),
    )
    renderScreen()
    expect(
      await screen.findAllByRole('button', { name: /Comida/ }),
    ).toHaveLength(100)
    await userEvent.click(screen.getByRole('button', { name: 'Ver más' }))
    expect(screen.getAllByRole('button', { name: /Comida/ })).toHaveLength(150)
  })
})
