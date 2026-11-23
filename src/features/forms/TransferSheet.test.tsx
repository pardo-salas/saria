import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/dexie'
import { TransferSheet } from './TransferSheet'
import { acct, Providers, xfer } from './testUtils'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  await db.accounts.bulkPut([
    acct({ id: 'a1', name: 'Efectivo' }),
    acct({ id: 'a2', name: 'Débito', position: 1 }),
  ])
})

const pick = async (
  user: ReturnType<typeof userEvent.setup>,
  group: string,
  name: string,
) => {
  const g = await screen.findByRole('radiogroup', { name: group })
  await user.click(within(g).getByRole('radio', { name }))
}

describe('TransferSheet', () => {
  it('De igual a A muestra "Elige dos cuentas distintas"', async () => {
    const user = userEvent.setup()
    render(
      <Providers>
        <TransferSheet open onClose={() => {}} />
      </Providers>,
    )
    await user.type(screen.getByLabelText('Monto'), '100')
    await pick(user, 'De', 'Efectivo')
    await pick(user, 'A', 'Efectivo')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(
      await screen.findByText('Elige dos cuentas distintas'),
    ).toBeInTheDocument()
    expect(await db.transfers.count()).toBe(0)
  })

  it('guarda una transferencia válida', async () => {
    const user = userEvent.setup()
    render(
      <Providers>
        <TransferSheet open onClose={() => {}} />
      </Providers>,
    )
    await user.type(screen.getByLabelText('Monto'), '100')
    await pick(user, 'De', 'Efectivo')
    await pick(user, 'A', 'Débito')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(async () => expect(await db.transfers.count()).toBe(1))
    expect((await db.transfers.toArray())[0]).toMatchObject({
      from_account_id: 'a1',
      to_account_id: 'a2',
      amount_cents: 10000,
    })
  })

  it('borrar pide confirmación', async () => {
    const t = xfer({ id: 't1' })
    await db.transfers.put(t)
    const user = userEvent.setup()
    render(
      <Providers>
        <TransferSheet open onClose={() => {}} transfer={t} />
      </Providers>,
    )
    await user.click(await screen.findByRole('button', { name: 'Borrar' }))
    expect(screen.getByText('¿Borrar esta transferencia?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sí, borrar' }))
    await waitFor(async () =>
      expect((await db.transfers.get('t1'))?.deleted_at).not.toBeNull(),
    )
  })
})
