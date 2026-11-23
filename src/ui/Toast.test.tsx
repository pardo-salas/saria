import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider, useToast } from './Toast'

function Disparador({ onAction }: { onAction?: () => void }) {
  const { show } = useToast()
  return (
    <button
      type="button"
      onClick={() =>
        show({
          message: 'Gasto guardado',
          actionLabel: onAction ? 'Deshacer' : undefined,
          onAction,
        })
      }
    >
      Mostrar
    </button>
  )
}

describe('Toast', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('show muestra el mensaje y Deshacer; al tocarlo llama onAction y se cierra', async () => {
    const onAction = vi.fn()
    render(
      <ToastProvider>
        <Disparador onAction={onAction} />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar' }))
    expect(screen.getByRole('status')).toHaveTextContent('Gasto guardado')
    await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Gasto guardado')).not.toBeInTheDocument()
  })

  it('se cierra solo a los 5000 ms', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Disparador />
      </ToastProvider>,
    )
    act(() => {
      screen.getByRole('button', { name: 'Mostrar' }).click()
    })
    expect(screen.getByText('Gasto guardado')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(4999)
    })
    expect(screen.getByText('Gasto guardado')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByText('Gasto guardado')).not.toBeInTheDocument()
  })

  it('un aviso nuevo reemplaza al anterior', async () => {
    function Dos() {
      const { show } = useToast()
      return (
        <>
          <button type="button" onClick={() => show({ message: 'Uno' })}>
            A
          </button>
          <button type="button" onClick={() => show({ message: 'Dos' })}>
            B
          </button>
        </>
      )
    }
    render(
      <ToastProvider>
        <Dos />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    await userEvent.click(screen.getByRole('button', { name: 'B' }))
    expect(screen.queryByText('Uno')).not.toBeInTheDocument()
    expect(screen.getByText('Dos')).toBeInTheDocument()
  })
})
