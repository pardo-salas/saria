import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/dexie'
import { localDate } from '@/domain/dates'
import { acct, cat, Providers, tx } from '@/features/forms/testUtils'
import { Inicio } from './Inicio'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('Inicio', () => {
  it('con sueldo y un gasto de hoy muestra lo que te queda y el gasto en Hoy', async () => {
    const today = localDate(new Date())
    await db.accounts.put(acct({ id: 'a1', name: 'Efectivo' }))
    await db.categories.put(cat({ id: 'c1', name: 'Comida' }))
    await db.transactions.put(
      tx({ id: 't1', amount_cents: 18550, date: today, category_id: 'c1' }),
    )
    await db.settings.put({
      id: 'u1',
      user_id: 'u1',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      deleted_at: null,
      monthly_income_cents: 1860000,
      pay_frequency: 'monthly',
      currency: 'MXN',
      theme: 'system',
    })
    render(
      <Providers>
        <MemoryRouter>
          <Inicio />
        </MemoryRouter>
      </Providers>,
    )
    expect(await screen.findByText('$18,414.50')).toBeInTheDocument()
    expect(screen.getByText('Te queda este mes')).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: /Comida/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver todo' })).toHaveAttribute(
      'href',
      '/movimientos',
    )
  })
})
