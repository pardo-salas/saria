import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { List, ListItem } from './List'

describe('ListItem', () => {
  it('un gasto muestra el monto con signo menos', () => {
    render(
      <List>
        <ListItem title="Gasolina" subtitle="Nu crédito" amountCents={-65000} />
      </List>,
    )
    expect(screen.getByText('−$650.00')).toBeInTheDocument()
    expect(screen.getByText('Gasolina')).toBeInTheDocument()
    expect(screen.getByText('Nu crédito')).toBeInTheDocument()
  })

  it('un ingreso muestra el monto con signo más', () => {
    render(
      <List>
        <ListItem title="Nómina" amountCents={65000} />
      </List>,
    )
    expect(screen.getByText('+$650.00')).toBeInTheDocument()
  })

  it('la lista expone sus elementos como lista', () => {
    render(
      <List>
        <ListItem title="Uno" />
        <ListItem title="Dos" />
      </List>,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('un gasto de -18550 muestra "−$185.50" con color de gasto', () => {
    render(
      <List>
        <ListItem title="Comida" amountCents={-18550} />
      </List>,
    )
    expect(screen.getByText('−$185.50')).toHaveClass('text-gasto')
  })

  it('un ingreso de 4120 muestra "+$41.20" en color agua', () => {
    render(
      <List>
        <ListItem title="Reembolso" amountCents={4120} />
      </List>,
    )
    expect(screen.getByText('+$41.20')).toHaveClass('text-agua')
  })

  it('con tone="neutral" conserva el signo sin color de gasto', () => {
    render(
      <List>
        <ListItem title="Traspaso" amountCents={-200000} tone="neutral" />
      </List>,
    )
    const amount = screen.getByText('−$2,000.00')
    expect(amount).not.toHaveClass('text-gasto')
    expect(amount).not.toHaveClass('text-agua')
  })

  it('con tone="neutral" un monto positivo no lleva signo', () => {
    render(
      <List>
        <ListItem title="Traspaso" amountCents={200000} tone="neutral" />
      </List>,
    )
    expect(screen.getByText('$2,000.00')).toBeInTheDocument()
  })

  it('con onClick el renglón es un botón que lo llama', async () => {
    const onClick = vi.fn()
    render(
      <List>
        <ListItem title="Gasolina" amountCents={-65000} onClick={onClick} />
      </List>,
    )
    await userEvent.click(screen.getByRole('button', { name: /Gasolina/ }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
