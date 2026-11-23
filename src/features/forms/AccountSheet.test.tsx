import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/dexie'
import { AccountSheet } from './AccountSheet'
import { acct, Providers, tx, xfer } from './testUtils'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

const open = (account?: ReturnType<typeof acct>) =>
  render(
    <Providers>
      <AccountSheet open onClose={() => {}} account={account} />
    </Providers>,
  )

describe('AccountSheet', () => {
  it('crea una cuenta de crédito con "Debes" guardado en negativo y la siguiente posición', async () => {
    await db.accounts.put(acct({ id: 'a0', position: 4 }))
    const user = userEvent.setup()
    open()
    await user.type(screen.getByLabelText('Nombre'), 'Tarjeta Azul')
    await user.click(screen.getByRole('radio', { name: 'Crédito' }))
    await user.type(screen.getByLabelText('Debes'), '2,859.36')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(async () => expect(await db.accounts.count()).toBe(2))
    const saved = (await db.accounts.toArray()).find(
      (a) => a.name === 'Tarjeta Azul',
    )!
    expect(saved.initial_balance_cents).toBe(-285936)
    expect(saved.type).toBe('credit')
    expect(saved.position).toBe(5)
    expect(saved.include_in_total).toBe(true)
  })

  it('con el nombre vacío muestra el error y no guarda', async () => {
    const user = userEvent.setup()
    open()
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Escribe un nombre')).toBeInTheDocument()
    expect(await db.accounts.count()).toBe(0)
  })

  it('una cuenta con una transferencia no ofrece Borrar y sugiere archivar', async () => {
    await db.accounts.bulkPut([acct({ id: 'a1' }), acct({ id: 'a2' })])
    await db.transfers.put(xfer({ id: 't1' }))
    open(acct({ id: 'a1' }))
    expect(
      await screen.findByText('Tiene movimientos: puedes archivarla'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Borrar' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Archivar' })).toBeInTheDocument()
  })

  it('una cuenta sin uso se borra tras confirmar', async () => {
    await db.accounts.put(acct({ id: 'a1' }))
    const user = userEvent.setup()
    open(acct({ id: 'a1' }))
    await user.click(await screen.findByRole('button', { name: 'Borrar' }))
    await user.click(screen.getByRole('button', { name: 'Sí, borrar' }))
    await waitFor(async () =>
      expect((await db.accounts.get('a1'))?.deleted_at).not.toBeNull(),
    )
  })

  it('archivar con saldo pide confirmar con el saldo', async () => {
    await db.accounts.put(acct({ id: 'a1', initial_balance_cents: 150000 }))
    await db.transactions.put(tx({ id: 'x1', amount_cents: 5000 }))
    const user = userEvent.setup()
    open(acct({ id: 'a1', initial_balance_cents: 150000 }))
    await user.click(await screen.findByRole('button', { name: 'Archivar' }))
    expect(
      screen.getByText(
        'Esta cuenta tiene saldo de $1,450.00; al archivarla deja de contar en el total',
      ),
    ).toBeInTheDocument()
    expect((await db.accounts.get('a1'))?.archived).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Sí, archivar' }))
    await waitFor(async () =>
      expect((await db.accounts.get('a1'))?.archived).toBe(true),
    )
  })
})
