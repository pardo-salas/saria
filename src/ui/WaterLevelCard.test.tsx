import { render, screen } from '@testing-library/react'
import { WaterLevelCard } from './WaterLevelCard'

describe('WaterLevelCard', () => {
  it('muestra lo que queda, el porcentaje y los días', () => {
    render(<WaterLevelCard remainingCents={724000} percent={58} daysLeft={8} />)
    expect(screen.getByText('Te queda este mes')).toBeInTheDocument()
    expect(screen.getByText('$7,240.00')).toBeInTheDocument()
    expect(
      screen.getByText('58% de tu disponible, faltan 8 días'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('agua').style.height).toBe('58%')
  })

  it('usa singular cuando falta 1 día', () => {
    render(<WaterLevelCard remainingCents={10000} percent={5} daysLeft={1} />)
    expect(
      screen.getByText('5% de tu disponible, falta 1 día'),
    ).toBeInTheDocument()
  })

  it('acota el porcentaje a 0–100', () => {
    const { rerender } = render(
      <WaterLevelCard remainingCents={724000} percent={140} daysLeft={8} />,
    )
    expect(screen.getByTestId('agua').style.height).toBe('100%')
    rerender(
      <WaterLevelCard remainingCents={-5000} percent={-20} daysLeft={8} />,
    )
    expect(screen.getByTestId('agua').style.height).toBe('0%')
  })

  it('sin movimientos muestra el estado vacío con el agua en 0', () => {
    render(
      <WaterLevelCard remainingCents={null} percent={null} daysLeft={null} />,
    )
    expect(
      screen.getByText('Aún no hay movimientos este mes'),
    ).toBeInTheDocument()
    expect(screen.getByText(/botón \+/)).toBeInTheDocument()
    expect(screen.getByTestId('agua').style.height).toBe('0%')
  })
})
