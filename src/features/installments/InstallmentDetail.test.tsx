import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/dexie'
import type { InstallmentPlan } from '@/db/schema'
import { Providers } from '@/features/forms/testUtils'
import { InstallmentDetail } from './InstallmentDetail'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

const moto: InstallmentPlan = {
  id: 'p1',
  user_id: 'u1',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  concept: 'Moto',
  account_id: null,
  purchase_date: '2025-09-05',
  total_cents: 4798800,
  months: 18,
  monthly_cents: 216600,
  paid_months: 14,
  active: true,
  category_id: null,
}

describe('InstallmentDetail', () => {
  it('muestra pagados, lo que queda por pagar y la fecha final', async () => {
    render(
      <Providers>
        <InstallmentDetail
          open
          onClose={() => {}}
          plan={moto}
          onEdit={() => {}}
        />
      </Providers>,
    )
    expect(await screen.findByText('14 / 18')).toBeInTheDocument()
    expect(screen.getByText('Queda por pagar').parentElement).toHaveTextContent(
      'Queda por pagar$10,664.00',
    )
    expect(screen.getByText('Fecha final').parentElement).toHaveTextContent(
      /5 mar\.? 2027/,
    )
  })
})
