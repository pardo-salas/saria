import { render, screen } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  it('con loading queda deshabilitado y ocupado', () => {
    render(
      <Button variant="primaria" loading>
        Guardar
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Guardar' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('sin loading está habilitado y es type="button" por omisión', () => {
    render(<Button variant="secundaria">Cancelar</Button>)
    const button = screen.getByRole('button', { name: 'Cancelar' })
    expect(button).toBeEnabled()
    expect(button).not.toHaveAttribute('aria-busy')
    expect(button).toHaveAttribute('type', 'button')
  })
})
