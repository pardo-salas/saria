import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/dexie'
import { localDate } from '@/domain/dates'
import { acct, Providers } from '@/features/forms/testUtils'
import { shiftDay } from '@/features/recurring/labels'
import { Inicio } from './Inicio'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('Por pagar en Inicio', () => {
  it('muestra un pago vencido y Pagado crea el movimiento y lo saca de la lista', async () => {
    const yesterday = shiftDay(localDate(new Date()), -1)
    await db.accounts.put(acct({ id: 'a1', name: 'Efectivo' }))
    await db.recurring_payments.put({
      id: 'r1',
      user_id: 'u1',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      deleted_at: null,
      name: 'Seguro',
      kind: 'expense',
      amount_cents: 120000,
      account_id: 'a1',
      category_id: null,
      frequency: 'yearly',
      day_of_month: null,
      second_day_of_month: null,
      interval_days: null,
      start_date: shiftDay(yesterday, -365),
      end_date: null,
      next_due_date: yesterday,
      auto_create: false,
      active: true,
    })
    render(
      <Providers>
        <MemoryRouter>
          <Inicio />
        </MemoryRouter>
      </Providers>,
    )
    const card = (await screen.findByText('Por pagar')).closest('section')!
    expect(within(card).getByText('Vencidos')).toBeInTheDocument()
    expect(within(card).getByText('Seguro')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(within(card).getByRole('button', { name: /Pagado/ }))
    await user.click(
      await screen.findByRole('button', { name: 'Registrar pago' }),
    )

    await waitFor(async () => {
      const txs = await db.transactions.toArray()
      expect(txs).toHaveLength(1)
      expect(txs[0]).toMatchObject({ recurring_id: 'r1', date: yesterday })
    })
    await waitFor(() => expect(screen.queryByText('Por pagar')).toBeNull())
  })
})
