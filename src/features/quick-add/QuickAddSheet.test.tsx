import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/dexie'
import { createRepo } from '@/db/repo'
import { ensureCategoriesSeeded } from '@/db/seed'
import { localDate } from '@/domain/dates'
import { acct, Providers } from '@/features/forms/testUtils'
import { QuickAddSheet } from './QuickAddSheet'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  await db.accounts.put(acct({ id: 'a1', name: 'Efectivo' }))
  await ensureCategoriesSeeded(
    db,
    createRepo(db, () => 'u1'),
    'u1',
  )
})

function renderSheet(onClose = () => {}) {
  render(
    <Providers>
      <QuickAddSheet open onClose={onClose} />
    </Providers>,
  )
}

describe('QuickAddSheet', () => {
  it('al abrir, el foco queda en el monto', () => {
    renderSheet()
    expect(screen.getByLabelText('Monto')).toHaveFocus()
  })

  it('escribir el monto y tocar Comida guarda el gasto y permite deshacer', async () => {
    const user = userEvent.setup()
    renderSheet()
    await user.type(screen.getByLabelText('Monto'), '185.50')
    await user.click(await screen.findByRole('button', { name: /en Comida$/ }))
    await waitFor(async () => expect(await db.transactions.count()).toBe(1))
    expect((await db.transactions.toArray())[0]).toMatchObject({
      kind: 'expense',
      amount_cents: 18550,
      account_id: 'a1',
      date: localDate(new Date()),
    })
    expect(await screen.findByText('Gasto guardado')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    await waitFor(async () =>
      expect((await db.transactions.toArray())[0]!.deleted_at).not.toBeNull(),
    )
  })

  it('un doble clic rápido guarda un solo movimiento', async () => {
    const user = userEvent.setup()
    renderSheet()
    await user.type(screen.getByLabelText('Monto'), '50')
    await user.dblClick(
      await screen.findByRole('button', { name: /en Comida$/ }),
    )
    await waitFor(async () => expect(await db.transactions.count()).toBe(1))
    await new Promise((r) => setTimeout(r, 50))
    expect(await db.transactions.count()).toBe(1)
  })

  it('la pestaña Transferir guarda una transferencia', async () => {
    await db.accounts.put(acct({ id: 'a2', name: 'Banco', position: 1 }))
    const user = userEvent.setup()
    renderSheet()
    await user.click(screen.getByRole('radio', { name: 'Transferir' }))
    await user.type(screen.getByLabelText('Monto'), '500')
    const banco = await screen.findAllByRole('radio', { name: 'Banco' })
    await user.click(banco[banco.length - 1]!)
    await user.click(screen.getByRole('button', { name: 'Transferir' }))
    await waitFor(async () => expect(await db.transfers.count()).toBe(1))
  })
})
