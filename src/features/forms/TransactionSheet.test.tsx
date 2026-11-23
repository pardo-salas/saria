import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/dexie'
import { TransactionSheet } from './TransactionSheet'
import { acct, cat, Providers, tx } from './testUtils'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  await db.accounts.put(acct({ id: 'a1', name: 'Efectivo' }))
  await db.categories.put(cat({ id: 'c1', name: 'Comida' }))
})

describe('TransactionSheet', () => {
  it('crea un gasto con los datos del formulario', async () => {
    const user = userEvent.setup()
    render(
      <Providers>
        <TransactionSheet
          open
          onClose={() => {}}
          defaults={{ date: '2026-03-10' }}
        />
      </Providers>,
    )
    await user.type(screen.getByLabelText('Monto'), '185.50')
    await user.click(await screen.findByRole('radio', { name: 'Comida' }))
    await user.click(screen.getByRole('radio', { name: 'Efectivo' }))
    await user.type(screen.getByLabelText('Nota'), ' tacos ')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(async () => expect(await db.transactions.count()).toBe(1))
    expect((await db.transactions.toArray())[0]).toMatchObject({
      kind: 'expense',
      amount_cents: 18550,
      account_id: 'a1',
      category_id: 'c1',
      date: '2026-03-10',
      note: 'tacos',
    })
  })

  it('sin monto muestra el error y no guarda', async () => {
    const user = userEvent.setup()
    render(
      <Providers>
        <TransactionSheet open onClose={() => {}} />
      </Providers>,
    )
    await user.click(await screen.findByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Escribe un monto')).toBeInTheDocument()
    expect(await db.transactions.count()).toBe(0)
  })

  it('editar cambia el monto y conserva id y created_at', async () => {
    const t = tx({ id: 'x1', amount_cents: 1000, account_id: 'a1' })
    await db.transactions.put(t)
    const user = userEvent.setup()
    render(
      <Providers>
        <TransactionSheet open onClose={() => {}} transaction={t} />
      </Providers>,
    )
    const amount = await screen.findByLabelText('Monto')
    await user.clear(amount)
    await user.type(amount, '25')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(async () =>
      expect((await db.transactions.get('x1'))?.amount_cents).toBe(2500),
    )
    const saved = (await db.transactions.get('x1'))!
    expect(saved.created_at).toBe(t.created_at)
    expect(await db.transactions.count()).toBe(1)
  })

  it('borrar pide confirmación y deja deleted_at', async () => {
    const t = tx({ id: 'x1' })
    await db.transactions.put(t)
    const user = userEvent.setup()
    render(
      <Providers>
        <TransactionSheet open onClose={() => {}} transaction={t} />
      </Providers>,
    )
    await user.click(await screen.findByRole('button', { name: 'Borrar' }))
    expect(screen.getByText('¿Borrar este movimiento?')).toBeInTheDocument()
    expect((await db.transactions.get('x1'))?.deleted_at).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Sí, borrar' }))
    await waitFor(async () =>
      expect((await db.transactions.get('x1'))?.deleted_at).not.toBeNull(),
    )
  })
})
