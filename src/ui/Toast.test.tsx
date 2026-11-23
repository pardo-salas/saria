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

  it('un aviso nuevo reinicia los 5 s', () => {
    vi.useFakeTimers()
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
    act(() => screen.getByRole('button', { name: 'A' }).click())
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    act(() => screen.getByRole('button', { name: 'B' }).click())
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.getByText('Dos')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.queryByText('Dos')).not.toBeInTheDocument()
  })

  it('useToast fuera del proveedor lanza un error claro', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Disparador />)).toThrow(/ToastProvider/)
    spy.mockRestore()
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
