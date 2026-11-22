import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { GateState } from '@/auth/session'
import { AppRoutes } from './router'
import { SessionValueProvider } from './SessionProvider'
import { ThemeProvider } from './ThemeProvider'

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
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
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
  it('muestra el nivel de agua vacío y la lista Hoy vacía', () => {
    renderAt('/', 'signed-in')
    expect(
      screen.getByRole('region', { name: 'Te queda este mes' }),
    ).toHaveTextContent('Aún no hay movimientos este mes')
    expect(
      screen.getByRole('heading', { level: 2, name: 'Hoy' }),
    ).toBeInTheDocument()
  })

  it('el botón + abre una hoja que dice que el registro de gastos llega pronto', async () => {
    const user = userEvent.setup()
    renderAt('/', 'signed-in')
    await user.click(screen.getByRole('button', { name: 'Registrar gasto' }))
    const dialog = screen.getByRole('dialog', { name: 'Registrar gasto' })
    expect(dialog).toHaveTextContent(
      'Muy pronto podrás anotar tus gastos aquí en dos toques.',
    )
  })
})

describe.each([
  ['/movimientos', 'Movimientos', 'Aún no hay movimientos'],
  ['/cuentas', 'Cuentas', 'Aún no tienes cuentas'],
  ['/graficas', 'Gráficas', 'Aún no hay nada que graficar'],
])('%s', (path, title, empty) => {
  it('muestra el título y un estado vacío que dice qué llegará', () => {
    renderAt(path, 'signed-in')
    expect(
      screen.getByRole('heading', { level: 1, name: title }),
    ).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent(empty)
    expect(screen.getByRole('main')).toHaveTextContent('Aquí verás')
  })
})
