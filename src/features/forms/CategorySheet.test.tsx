import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/dexie'
import { CategorySheet } from './CategorySheet'
import { cat, Providers, tx } from './testUtils'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('CategorySheet', () => {
  it('crea una categoría con límite opcional', async () => {
    const user = userEvent.setup()
    render(
      <Providers>
        <CategorySheet open onClose={() => {}} kind="expense" />
      </Providers>,
    )
    await user.type(screen.getByLabelText('Nombre'), 'Café')
    await user.type(screen.getByLabelText('Límite mensual (opcional)'), '300')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(async () => expect(await db.categories.count()).toBe(1))
    const saved = (await db.categories.toArray())[0]!
    expect(saved).toMatchObject({
      name: 'Café',
      kind: 'expense',
      monthly_limit_cents: 30000,
    })
  })

  it('un límite inválido no se guarda', async () => {
    const user = userEvent.setup()
    render(
      <Providers>
        <CategorySheet open onClose={() => {}} kind="expense" />
      </Providers>,
    )
    await user.type(screen.getByLabelText('Nombre'), 'Café')
    await user.type(screen.getByLabelText('Límite mensual (opcional)'), 'abc')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(
      await screen.findByText('Escribe un monto válido'),
    ).toBeInTheDocument()
    expect(await db.categories.count()).toBe(0)
  })

  it('cambiar de tipo y volver no deja un límite inválido bloqueando el guardado', async () => {
    const c = cat({ id: 'c1', name: 'Comida' })
    await db.categories.put(c)
    const user = userEvent.setup()
    render(
      <Providers>
        <CategorySheet open onClose={() => {}} kind="expense" category={c} />
      </Providers>,
    )
    await user.type(
      await screen.findByLabelText('Límite mensual (opcional)'),
      'abc',
    )
    await user.click(screen.getByRole('radio', { name: 'Ingreso' }))
    await user.click(screen.getByRole('radio', { name: 'Gasto' }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(async () =>
      expect((await db.categories.get('c1'))?.updated_at).not.toBe(
        c.updated_at,
      ),
    )
    expect((await db.categories.get('c1'))?.monthly_limit_cents).toBeNull()
  })

  it('un nombre vacío y un límite inválido se muestran juntos', async () => {
    const user = userEvent.setup()
    render(
      <Providers>
        <CategorySheet open onClose={() => {}} kind="expense" />
      </Providers>,
    )
    await user.type(screen.getByLabelText('Límite mensual (opcional)'), 'abc')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Escribe un nombre')).toBeInTheDocument()
    expect(screen.getByText('Escribe un monto válido')).toBeInTheDocument()
  })

  it('una categoría duplicada muestra el mensaje exacto', async () => {
    await db.categories.put(cat({ id: 'c1', name: 'Comida' }))
    const user = userEvent.setup()
    render(
      <Providers>
        <CategorySheet open onClose={() => {}} kind="expense" />
      </Providers>,
    )
    await user.type(screen.getByLabelText('Nombre'), 'comida')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(
      await screen.findByText('Ya tienes una categoría con ese nombre'),
    ).toBeInTheDocument()
    expect(await db.categories.count()).toBe(1)
  })

  it('en uso: no se borra y el tipo queda fijo', async () => {
    const c = cat({ id: 'c1', name: 'Comida' })
    await db.categories.put(c)
    await db.transactions.put(tx({ id: 'x1', category_id: 'c1' }))
    render(
      <Providers>
        <CategorySheet open onClose={() => {}} kind="expense" category={c} />
      </Providers>,
    )
    expect(
      await screen.findByText('Tiene movimientos: puedes archivarla'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Borrar' })).toBeNull()
    expect(screen.queryByRole('radio', { name: 'Ingreso' })).toBeNull()
  })
})
