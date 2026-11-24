import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { GateState } from '@/auth/session'
import { AppRoutes } from './router'
import { SessionValueProvider } from './SessionProvider'
import { ThemeProvider } from './ThemeProvider'
import { ToastProvider } from '@/ui/Toast'

function renderAt(path: string, gate: GateState) {
  return render(
    <ThemeProvider>
      <SessionValueProvider
        value={{
          gate,
          userId: gate === 'signed-in' ? 'u1' : null,
          signOut: vi.fn(async () => {}),
        }}
      >
        <ToastProvider>
          <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
          </MemoryRouter>
        </ToastProvider>
      </SessionValueProvider>
    </ThemeProvider>,
  )
}

describe('rutas', () => {
  it('sin sesión, /cuentas redirige a iniciar sesión', () => {
    renderAt('/cuentas', 'signed-out')
    expect(
      screen.getByRole('button', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Cuentas' }),
    ).not.toBeInTheDocument()
  })

  it('con sesión, /cuentas muestra el encabezado Cuentas dentro de la navegación', () => {
    renderAt('/cuentas', 'signed-in')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Cuentas' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'Principal' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(5)
  })

  it.each(['/', '/cuentas', '/iniciar-sesion', '/restablecer', '/no-existe'])(
    'sin configuración, %s muestra el aviso de configuración faltante',
    (path) => {
      renderAt(path, 'misconfigured')
      expect(
        screen.getByText(/Falta configurar la conexión con Supabase/),
      ).toBeInTheDocument()
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    },
  )

  it('con sesión, /iniciar-sesion redirige a Inicio', () => {
    renderAt('/iniciar-sesion', 'signed-in')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Hola, Brian' }),
    ).toBeInTheDocument()
  })

  it('con sesión (recuperación de contraseña), /restablecer no redirige', () => {
    renderAt('/restablecer', 'signed-in')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Cambia tu contraseña' }),
    ).toBeInTheDocument()
  })

  it('una ruta desconocida lleva a Inicio', () => {
    renderAt('/no-existe', 'signed-in')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Hola, Brian' }),
    ).toBeInTheDocument()
  })
})

describe('Inicio', () => {
  it('sin sueldo invita a capturarlo y muestra la lista Hoy', async () => {
    renderAt('/', 'signed-in')
    expect(await screen.findByText(/Captura tu sueldo en/)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Hoy' }),
    ).toBeInTheDocument()
  })

  it('el botón + abre el registro rápido', async () => {
    const user = userEvent.setup()
    renderAt('/', 'signed-in')
    await user.click(screen.getByRole('button', { name: 'Registrar' }))
    expect(
      screen.getByRole('dialog', { name: 'Registrar movimiento' }),
    ).toBeInTheDocument()
  })
})

describe.each([
  ['/movimientos', 'Movimientos', 'Aún no hay movimientos'],
  ['/cuentas', 'Cuentas', 'Aún no tienes cuentas'],
  ['/graficas', 'Gráficas', 'Aún no hay nada que graficar'],
])('%s', (path, title, empty) => {
  it('muestra el título y un estado vacío que dice qué llegará', async () => {
    renderAt(path, 'signed-in')
    expect(
      await screen.findByRole('heading', { level: 1, name: title }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('main')).toHaveTextContent(empty),
    )
    expect(screen.getByRole('main')).toHaveTextContent('Aquí verás')
  })
})
