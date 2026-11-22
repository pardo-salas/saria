import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionValueProvider } from '@/app/SessionProvider'
import { ThemeProvider } from '@/app/ThemeProvider'
import { db } from '@/db/dexie'
import { repo } from '@/db/repo'
import { Mas } from './Mas'

afterEach(async () => {
  localStorage.clear()
  await db.settings.clear()
  await db.outbox.clear()
  vi.restoreAllMocks()
})

function renderMas(userId: string | null, signOut = vi.fn(async () => {})) {
  render(
    <ThemeProvider>
      <SessionValueProvider
        value={{
          gate: userId ? 'signed-in' : 'signed-out',
          userId,
          signOut,
        }}
      >
        <MemoryRouter initialEntries={['/mas']}>
          <Routes>
            <Route path="/mas" element={<Mas />} />
            <Route
              path="/iniciar-sesion"
              element={<p>pantalla de entrada</p>}
            />
          </Routes>
        </MemoryRouter>
      </SessionValueProvider>
    </ThemeProvider>,
  )
  return { signOut }
}

describe('Más: tema', () => {
  it('muestra Sistema, Claro y Oscuro como opciones de un solo grupo', () => {
    renderMas('u1')
    const group = screen.getByRole('radiogroup', { name: 'Tema' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Sistema' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Claro' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Oscuro' })).not.toBeChecked()
  })

  it('con sesión, elegir Claro aplica el tema y lo guarda en settings conservando lo demás', async () => {
    await db.settings.put({
      id: 'u1',
      user_id: 'u1',
      created_at: '2026-11-01T00:00:00.000Z',
      updated_at: '2026-11-01T00:00:00.000Z',
      deleted_at: null,
      monthly_income_cents: 2_500_000,
      pay_frequency: 'semimonthly',
      currency: 'MXN',
      theme: 'system',
    })
    const put = vi.spyOn(repo, 'put')
    const user = userEvent.setup()
    renderMas('u1')

    await user.click(screen.getByRole('radio', { name: 'Claro' }))

    expect(screen.getByRole('radio', { name: 'Claro' })).toBeChecked()
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('saria.theme')).toBe('light')
    await vi.waitFor(() =>
      expect(put).toHaveBeenCalledWith('settings', {
        monthly_income_cents: 2_500_000,
        pay_frequency: 'semimonthly',
        currency: 'MXN',
        theme: 'light',
      }),
    )
    await vi.waitFor(async () =>
      expect(await db.settings.get('u1')).toMatchObject({
        theme: 'light',
        monthly_income_cents: 2_500_000,
        created_at: '2026-11-01T00:00:00.000Z',
      }),
    )
  })

  it('con sesión y sin fila de settings la crea con valores por defecto', async () => {
    const user = userEvent.setup()
    renderMas('u1')
    await user.click(screen.getByRole('radio', { name: 'Oscuro' }))
    await vi.waitFor(async () =>
      expect(await db.settings.get('u1')).toMatchObject({
        user_id: 'u1',
        monthly_income_cents: null,
        pay_frequency: null,
        currency: 'MXN',
        theme: 'dark',
      }),
    )
  })

  it('sin sesión solo aplica el tema', async () => {
    const put = vi.spyOn(repo, 'put')
    const user = userEvent.setup()
    renderMas(null)
    await user.click(screen.getByRole('radio', { name: 'Oscuro' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(put).not.toHaveBeenCalled()
  })
})

describe('Más: cerrar sesión', () => {
  it('pide confirmación en una hoja y solo entonces cierra sesión y va a iniciar sesión', async () => {
    const user = userEvent.setup()
    const { signOut } = renderMas('u1')

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    const dialog = screen.getByRole('dialog', {
      name: '¿Cerrar sesión en este dispositivo?',
    })
    expect(signOut).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(dialog).not.toBeInTheDocument()
    expect(signOut).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    const confirm = screen
      .getAllByRole('button', { name: 'Cerrar sesión' })
      .find((b) => screen.getByRole('dialog').contains(b))!
    await user.click(confirm)
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('pantalla de entrada')).toBeInTheDocument()
  })
})

describe('Más: versión', () => {
  it('muestra la versión de la app', () => {
    renderMas('u1')
    expect(
      screen.getByText(`Versión ${import.meta.env.VITE_APP_VERSION}`),
    ).toBeInTheDocument()
    expect(import.meta.env.VITE_APP_VERSION).toMatch(/^\d+\.\d+\.\d+/)
  })
})
