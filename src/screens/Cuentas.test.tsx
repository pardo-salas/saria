import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/dexie'
import { acct, Providers } from '@/features/forms/testUtils'
import { Cuentas } from './Cuentas'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('Cuentas', () => {
  it('muestra total, deuda de tarjetas, grupos y cuentas fuera del total', async () => {
    await db.accounts.bulkPut([
      acct({ id: 'nu', name: 'NU', initial_balance_cents: 2517663 }),
      acct({
        id: 'ca',
        name: 'Cartera',
        type: 'cash',
        initial_balance_cents: 61500,
      }),
      acct({
        id: 'bb',
        name: 'BBVA Crédito',
        type: 'credit',
        initial_balance_cents: -285936,
      }),
      acct({
        id: 'bn',
        name: 'Banamex Crédito',
        type: 'credit',
        initial_balance_cents: -351258,
        include_in_total: false,
      }),
      acct({
        id: 'po',
        name: 'Póliza',
        type: 'investment',
        initial_balance_cents: 7166202,
        include_in_total: false,
      }),
    ])
    render(
      <Providers>
        <MemoryRouter>
          <Cuentas />
        </MemoryRouter>
      </Providers>,
    )
    expect(await screen.findByText('$22,932.27')).toBeInTheDocument()
    expect(
      screen.getByText(/Debes en tarjetas \$6,371\.94/),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/fuera del total/).length).toBeGreaterThan(0)
    expect(screen.getByText('Efectivo y débito')).toBeInTheDocument()
    expect(screen.queryByText(/Archivadas/)).not.toBeInTheDocument()
  })
})
