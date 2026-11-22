import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { AmountInput } from './AmountInput'

function Controlled({
  onChange,
  initial = null,
}: {
  onChange: (cents: number | null) => void
  initial?: number | null
}) {
  const [cents, setCents] = useState<number | null>(initial)
  return (
    <AmountInput
      label="Monto"
      valueCents={cents}
      onChange={(next) => {
        setCents(next)
        onChange(next)
      }}
    />
  )
}

describe('AmountInput', () => {
  it('tiene etiqueta accesible igual a label y teclado decimal', () => {
    render(<AmountInput label="Monto" valueCents={null} onChange={() => {}} />)
    const input = screen.getByRole('textbox', { name: 'Monto' })
    expect(input).toHaveAttribute('inputmode', 'decimal')
  })

  it('escribir "1,234.5" llama onChange(123450)', async () => {
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Monto' }),
      '1,234.5',
    )
    expect(onChange).toHaveBeenLastCalledWith(123450)
  })

  it('escribir "12,50" llama onChange(1250)', async () => {
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Monto' }),
      '12,50',
    )
    expect(onChange).toHaveBeenLastCalledWith(1250)
  })

  it('escribir "abc" llama onChange(null) y muestra el error', async () => {
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)
    const input = screen.getByRole('textbox', { name: 'Monto' })
    await userEvent.type(input, 'abc')
    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(screen.getByText('Escribe un monto válido')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Escribe un monto válido')
  })

  it('vacío llama onChange(null) sin mostrar error', async () => {
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)
    const input = screen.getByRole('textbox', { name: 'Monto' })
    await userEvent.type(input, '5')
    await userEvent.clear(input)
    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(input).not.toHaveAttribute('aria-invalid', 'true')
    expect(
      screen.queryByText('Escribe un monto válido'),
    ).not.toBeInTheDocument()
  })

  it('al perder el foco con 123450 muestra "1,234.50"', async () => {
    render(<Controlled onChange={() => {}} />)
    const input = screen.getByRole('textbox', { name: 'Monto' })
    await userEvent.type(input, '1234.5')
    await userEvent.tab()
    expect(input).toHaveValue('1,234.50')
  })

  it('muestra el error del padre en lugar del propio', () => {
    render(
      <AmountInput
        label="Monto"
        valueCents={null}
        onChange={() => {}}
        error="Escribe el monto del gasto"
      />,
    )
    const input = screen.getByRole('textbox', { name: 'Monto' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Escribe el monto del gasto')
  })

  it('sigue a valueCents cuando cambia sin foco', () => {
    const { rerender } = render(
      <AmountInput label="Monto" valueCents={1250} onChange={() => {}} />,
    )
    const input = screen.getByRole('textbox', { name: 'Monto' })
    expect(input).toHaveValue('12.50')
    rerender(
      <AmountInput label="Monto" valueCents={null} onChange={() => {}} />,
    )
    expect(input).toHaveValue('')
  })
})
