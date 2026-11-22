import { render, screen } from '@testing-library/react'
import { List, ListItem } from './List'

describe('ListItem', () => {
  it('un gasto muestra el monto con signo menos', () => {
    render(
      <List>
        <ListItem
          title="Gasolina"
          subtitle="Nu crédito"
          amountCents={65000}
          kind="expense"
        />
      </List>,
    )
    expect(screen.getByText('−$650.00')).toBeInTheDocument()
    expect(screen.getByText('Gasolina')).toBeInTheDocument()
    expect(screen.getByText('Nu crédito')).toBeInTheDocument()
  })

  it('un ingreso muestra el monto con signo más', () => {
    render(
      <List>
        <ListItem title="Nómina" amountCents={65000} kind="income" />
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
})
