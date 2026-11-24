import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { WaterLevelCard } from './WaterLevelCard'

const r = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('WaterLevelCard', () => {
  it('sin sueldo invita a capturarlo en Más', () => {
    r(<WaterLevelCard level={{ state: 'no-salary' }} />)
    expect(screen.getByText(/Captura tu sueldo en/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Más' })).toHaveAttribute(
      'href',
      '/mas',
    )
  })

  it('muestra porcentaje y días; el último día lo dice', () => {
    r(
      <WaterLevelCard
        level={{
          state: 'ok',
          remainingCents: 724000,
          percent: 60,
          daysLeft: 0,
        }}
      />,
    )
    expect(screen.getByText(/60% de tu sueldo/)).toHaveTextContent(
      'último día del mes',
    )
  })

  it('con saldo negativo el agua queda en 0%', () => {
    r(
      <WaterLevelCard
        level={{ state: 'ok', remainingCents: -5000, percent: 0, daysLeft: 8 }}
      />,
    )
    expect(screen.getByTestId('agua')).toHaveStyle({ height: '0%' })
  })
})
