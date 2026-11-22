import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { BottomNav } from './BottomNav'

const icon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="8" />
  </svg>
)

const items = [
  { to: '/', label: 'Inicio', icon },
  { to: '/movimientos', label: 'Movimientos', icon },
  { to: '/cuentas', label: 'Cuentas', icon },
  { to: '/graficas', label: 'Gráficas', icon },
  { to: '/mas', label: 'Más', icon },
]

describe('BottomNav', () => {
  it('marca la ruta actual y muestra los 5 enlaces', () => {
    render(
      <MemoryRouter initialEntries={['/cuentas']}>
        <BottomNav items={items} />
      </MemoryRouter>,
    )
    expect(screen.getAllByRole('link')).toHaveLength(5)
    expect(screen.getByRole('link', { name: 'Cuentas' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    // "/" solo coincide exacto: Inicio no queda activo en /cuentas.
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute(
      'aria-current',
    )
  })
})
