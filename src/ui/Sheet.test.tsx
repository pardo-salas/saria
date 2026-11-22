import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Sheet } from './Sheet'

describe('Sheet', () => {
  it('abierto es un diálogo con el título como nombre accesible', () => {
    render(
      <Sheet open onClose={() => {}} title="Nuevo movimiento">
        <p>Contenido</p>
      </Sheet>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Nuevo movimiento' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Contenido')).toBeInTheDocument()
  })

  it('Escape llama onClose', async () => {
    const onClose = vi.fn()
    render(
      <Sheet open onClose={onClose} title="Nuevo movimiento">
        <p>Contenido</p>
      </Sheet>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('cerrado no se renderiza', () => {
    render(
      <Sheet open={false} onClose={() => {}} title="Nuevo movimiento">
        <p>Contenido</p>
      </Sheet>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Contenido')).not.toBeInTheDocument()
  })

  it('mueve el foco adentro al abrir y lo devuelve al cerrar', async () => {
    function Demo() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Abrir
          </button>
          <Sheet open={open} onClose={() => setOpen(false)} title="Hoja">
            <p>Contenido</p>
          </Sheet>
        </>
      )
    }
    render(<Demo />)
    const trigger = screen.getByRole('button', { name: 'Abrir' })
    await userEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Hoja' })
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('el botón de cerrar y el fondo llaman onClose', async () => {
    const onClose = vi.fn()
    render(
      <Sheet open onClose={onClose} title="Hoja">
        <p>Contenido</p>
      </Sheet>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
