import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@/app/ThemeProvider'
import { db } from '@/db/dexie'
import { Providers, acct } from '@/features/forms/testUtils'
import { Respaldo } from './Respaldo'

vi.mock('@/app/download', () => ({ downloadJson: vi.fn() }))

afterEach(async () => {
  vi.clearAllMocks()
  await Promise.all(db.tables.map((t) => t.clear()))
})

function renderRespaldo() {
  render(
    <ThemeProvider>
      <Providers>
        <MemoryRouter>
          <Respaldo />
        </MemoryRouter>
      </Providers>
    </ThemeProvider>,
  )
}

const ID_A = '11111111-1111-4111-8111-111111111111'
const ID_B = '22222222-2222-4222-8222-222222222222'
const ID_LUZ = '33333333-3333-4333-8333-333333333333'

const row = (id: string, name: string) => ({
  id,
  user_id: 'x',
  created_at: '2026-11-23T00:00:00.000Z',
  updated_at: '2026-11-23T00:00:00.000Z',
  deleted_at: null,
  name,
  kind: 'expense',
  amount_cents: 29338,
  account_id: 'a1',
  category_id: null,
  frequency: 'monthly',
  day_of_month: 15,
  second_day_of_month: null,
  interval_days: null,
  start_date: null,
  end_date: null,
  next_due_date: '2026-12-15',
  auto_create: false,
  active: true,
})

const file = (rows: object[]) =>
  new File(
    [
      JSON.stringify({
        format: 'saria-recurring',
        version: 1,
        recurring_payments: rows,
      }),
    ],
    'p.json',
    { type: 'application/json' },
  )

describe('Respaldo: agregar pagos habituales', () => {
  it('agrega sin borrar lo existente y volver a agregar no duplica', async () => {
    const user = userEvent.setup()
    await db.accounts.put(acct({ id: 'a1' }))
    await db.recurring_payments.put({
      ...row(ID_LUZ, 'Luz'),
      user_id: 'u1',
    } as never)
    renderRespaldo()
    const input = screen.getByLabelText('Archivo de pagos habituales')
    await user.upload(input, file([row(ID_A, 'Agua'), row(ID_B, 'Gym')]))
    expect(
      await screen.findByText(
        'Se agregarán 2 pagos habituales (0 ya existen y se actualizarán)',
      ),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Agregar pagos habituales' }),
    )
    expect(
      await screen.findByText('Pagos habituales agregados'),
    ).toBeInTheDocument()
    expect(await db.recurring_payments.count()).toBe(3)
    expect((await db.recurring_payments.get(ID_LUZ))?.name).toBe('Luz')

    await user.upload(input, file([row(ID_A, 'Agua'), row(ID_B, 'Gym')]))
    expect(
      await screen.findByText(
        'Se agregarán 0 pagos habituales (2 ya existen y se actualizarán)',
      ),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Agregar pagos habituales' }),
    )
    await vi.waitFor(async () => expect(await db.outbox.count()).toBe(4))
    expect(await db.recurring_payments.count()).toBe(3)
  })

  it('rechaza una cuenta que no existe', async () => {
    const user = userEvent.setup()
    renderRespaldo()
    await user.upload(
      screen.getByLabelText('Archivo de pagos habituales'),
      file([row(ID_A, 'Agua')]),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'cuenta o categoría que no existe',
    )
  })
})
