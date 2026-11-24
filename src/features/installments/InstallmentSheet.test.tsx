import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/dexie'
import type { InstallmentPlan } from '@/db/schema'
import { Providers } from '@/features/forms/testUtils'
import { InstallmentSheet } from './InstallmentSheet'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

const casa: InstallmentPlan = {
  id: 'casa',
  user_id: 'u1',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  concept: 'Casa',
  account_id: null,
  purchase_date: '2025-09-05',
  total_cents: 1200000,
  months: 12,
  monthly_cents: 100000,
  paid_months: 2,
  active: false,
  category_id: null,
}

describe('InstallmentSheet', () => {
  it('editar solo el concepto de una compra pausada la deja pausada', async () => {
    await db.installment_plans.put(casa)
    const user = userEvent.setup()
    render(
      <Providers>
        <InstallmentSheet open onClose={() => {}} plan={casa} />
      </Providers>,
    )
    expect(
      await screen.findByRole('checkbox', { name: /Compra pausada/ }),
    ).toBeChecked()
    const concept = screen.getByLabelText('Concepto')
    await user.clear(concept)
    await user.type(concept, 'Casa nueva')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(async () =>
      expect((await db.installment_plans.get('casa'))?.concept).toBe(
        'Casa nueva',
      ),
    )
    expect((await db.installment_plans.get('casa'))?.active).toBe(false)
  })
})
