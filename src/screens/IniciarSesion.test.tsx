import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendPasswordReset, signIn, type AuthResult } from '@/auth/authService'
import { IniciarSesion } from './IniciarSesion'

vi.mock('@/auth/authService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/auth/authService')>()),
  signIn: vi.fn(),
  sendPasswordReset: vi.fn(),
}))

afterEach(() => vi.clearAllMocks())

function renderScreen() {
  return render(
    <MemoryRouter>
      <IniciarSesion />
    </MemoryRouter>,
  )
}

async function fillAndSubmit() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Correo'), 'brian@example.com')
  await user.type(screen.getByLabelText('Contraseña'), 'secreta123')
  await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
  return user
}

describe('IniciarSesion', () => {
  it('no ofrece crear cuenta', () => {
    renderScreen()
    expect(document.body.textContent).not.toMatch(/crear cuenta|regístrate/i)
  })

  it('con credenciales incorrectas muestra el mensaje claro', async () => {
    vi.mocked(signIn).mockResolvedValue({
      ok: false,
      error: 'invalid_credentials',
    })
    renderScreen()
    await fillAndSubmit()
    expect(signIn).toHaveBeenCalledWith('brian@example.com', 'secreta123')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El correo o la contraseña no coinciden.',
    )
  })

  it('el botón queda en loading mientras espera', async () => {
    let resolve!: (r: AuthResult) => void
    vi.mocked(signIn).mockReturnValue(
      new Promise<AuthResult>((r) => (resolve = r)),
    )
    renderScreen()
    await fillAndSubmit()
    const button = screen.getByRole('button', { name: 'Iniciar sesión' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toBeDisabled()
    resolve({ ok: true })
    await vi.waitFor(() => expect(button).not.toHaveAttribute('aria-busy'))
  })

  it('¿Olvidaste tu contraseña? pide el correo y confirma el envío', async () => {
    vi.mocked(sendPasswordReset).mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    renderScreen()
    await user.type(screen.getByLabelText('Correo'), 'brian@example.com')
    await user.click(
      screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Restablecer contraseña',
    })
    const email = screen.getByLabelText('Correo de tu cuenta')
    expect(email).toHaveValue('brian@example.com')
    await user.click(screen.getByRole('button', { name: 'Enviar correo' }))
    expect(sendPasswordReset).toHaveBeenCalledWith('brian@example.com')
    expect(dialog).toHaveTextContent(
      'Te enviamos un correo para restablecer tu contraseña.',
    )
  })

  it('si el envío falla sin red lo dice con su propio mensaje', async () => {
    vi.mocked(sendPasswordReset).mockResolvedValue({
      ok: false,
      error: 'offline',
    })
    const user = userEvent.setup()
    renderScreen()
    await user.click(
      screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }),
    )
    await user.type(
      screen.getByLabelText('Correo de tu cuenta'),
      'brian@example.com',
    )
    await user.click(screen.getByRole('button', { name: 'Enviar correo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Necesitas internet para enviar el correo.',
    )
  })
})
