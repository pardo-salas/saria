import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/dexie'
import { localDate } from '@/domain/dates'
import { acct, Providers } from '@/features/forms/testUtils'
import { RecurringSheet } from './RecurringSheet'
import { shiftDay } from './labels'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('RecurringSheet', () => {
  it('editar solo el monto de un mensual vencido sin inicio conserva next_due_date', async () => {
    const overdue = shiftDay(localDate(new Date()), -10)
    await db.accounts.put(acct({ id: 'a1', name: 'Efectivo' }))
    const payment = {
      id: 'r1',
      user_id: 'u1',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      deleted_at: null,
      name: 'Renta',
      kind: 'expense' as const,
      amount_cents: 500000,
      account_id: 'a1',
      category_id: null,
      frequency: 'monthly' as const,
      day_of_month: 5,
      second_day_of_month: null,
      interval_days: null,
      start_date: null,
      end_date: null,
      next_due_date: overdue,
      auto_create: false,
      active: true,
    }
    await db.recurring_payments.put(payment)
    render(
      <Providers>
        <RecurringSheet open onClose={() => {}} payment={payment} />
      </Providers>,
    )
    const user = userEvent.setup()
    const amount = await screen.findByLabelText('Monto')
    await user.clear(amount)
    await user.type(amount, '6000')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(async () => {
      const row = await db.recurring_payments.get('r1')
      expect(row?.amount_cents).toBe(600000)
      expect(row?.next_due_date).toBe(overdue)
      expect(row?.start_date).toBeNull()
    })
  })
})
