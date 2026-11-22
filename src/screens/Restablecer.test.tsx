import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { updatePassword } from '@/auth/authService'
import { SessionValueProvider } from '@/app/SessionProvider'
import { Restablecer } from './Restablecer'

vi.mock('@/auth/authService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/auth/authService')>()),
  updatePassword: vi.fn(),
}))

afterEach(() => vi.clearAllMocks())

function renderScreen() {
  render(
    <SessionValueProvider
      value={{ gate: 'signed-in', userId: 'u1', signOut: vi.fn() }}
    >
      <MemoryRouter initialEntries={['/restablecer']}>
        <Routes>
          <Route path="/restablecer" element={<Restablecer />} />
          <Route path="/" element={<p>inicio</p>} />
        </Routes>
      </MemoryRouter>
    </SessionValueProvider>,
  )
  return userEvent.setup()
}

async function submit(
  user: ReturnType<typeof userEvent.setup>,
  password: string,
  confirm = password,
) {
  await user.type(screen.getByLabelText('Nueva contraseña'), password)
  await user.type(screen.getByLabelText('Repite la contraseña'), confirm)
  await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
}

describe('Restablecer', () => {
  it('pide al menos 8 caracteres antes de llamar al servidor', async () => {
    const user = renderScreen()
    await submit(user, 'corta')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Usa al menos 8 caracteres.',
    )
    expect(updatePassword).not.toHaveBeenCalled()
  })

  it('avisa si las dos contraseñas no coinciden', async () => {
    const user = renderScreen()
    await submit(user, 'larga1234', 'larga12345')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Las contraseñas no coinciden.',
    )
    expect(updatePassword).not.toHaveBeenCalled()
  })

  it('si falla muestra su propio mensaje, no el de iniciar sesión', async () => {
    vi.mocked(updatePassword).mockResolvedValue({
      ok: false,
      error: 'unknown',
    })
    const user = renderScreen()
    await submit(user, 'larga1234')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo cambiar la contraseña. Intenta de nuevo.',
    )
  })

  it('sin red dice que se necesita internet para cambiarla', async () => {
    vi.mocked(updatePassword).mockResolvedValue({
      ok: false,
      error: 'offline',
    })
    const user = renderScreen()
    await submit(user, 'larga1234')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Necesitas internet para cambiar la contraseña.',
    )
  })

  it('al cambiarla confirma y ofrece ir a Inicio', async () => {
    vi.mocked(updatePassword).mockResolvedValue({ ok: true })
    const user = renderScreen()
    await submit(user, 'larga1234')
    expect(updatePassword).toHaveBeenCalledWith('larga1234')
    expect(
      await screen.findByText('Listo, tu contraseña cambió.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ir a Inicio' }))
    expect(screen.getByText('inicio')).toBeInTheDocument()
  })
})
