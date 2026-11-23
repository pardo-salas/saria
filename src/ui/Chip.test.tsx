import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Chip } from './Chip'

describe('Chip', () => {
  it('el botón de quitar tiene nombre accesible y llama onRemove', async () => {
    const onRemove = vi.fn()
    render(<Chip label="Comida" selected onRemove={onRemove} />)
    await userEvent.click(screen.getByRole('button', { name: 'Quitar Comida' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('con onClick alterna y expone aria-pressed', async () => {
    const onClick = vi.fn()
    render(<Chip label="Este mes" selected onClick={onClick} />)
    const chip = screen.getByRole('button', { name: 'Este mes' })
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(chip)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
