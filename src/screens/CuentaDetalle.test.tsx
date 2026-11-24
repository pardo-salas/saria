import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { QuickAddProvider } from '@/app/QuickAddContext'
import { db } from '@/db/dexie'
import { acct, Providers, tx, xfer } from '@/features/forms/testUtils'
import { CuentaDetalle } from './CuentaDetalle'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('CuentaDetalle', () => {
  it('muestra la transferencia y el cierre del día; el chip no cambia los cierres', async () => {
    await db.accounts.bulkPut([
      acct({ id: 'a1', name: 'NU', initial_balance_cents: 100000 }),
      acct({ id: 'a2', name: 'BBVA Crédito', type: 'credit' }),
    ])
    await db.transactions.put(
      tx({ id: 't1', amount_cents: 20000, date: '2026-03-09' }),
    )
    await db.transfers.put(xfer({ id: 'x1', amount_cents: 5000 }))
    render(
      <Providers>
        <QuickAddProvider>
          <MemoryRouter initialEntries={['/cuentas/a1']}>
            <Routes>
              <Route path="cuentas/:id" element={<CuentaDetalle />} />
              <Route path="cuentas" element={<p>lista</p>} />
            </Routes>
          </MemoryRouter>
        </QuickAddProvider>
      </Providers>,
    )
    expect(await screen.findByText('A BBVA Crédito')).toBeInTheDocument()
    expect(screen.getByText('Saldo $750.00')).toBeInTheDocument()
    expect(screen.getByText('Saldo $800.00')).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'Transferencias' }),
    )
    expect(screen.queryByText('Sin categoría')).not.toBeInTheDocument()
    expect(screen.getByText('Saldo $750.00')).toBeInTheDocument()
  })
})
