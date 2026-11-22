import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, useTheme } from './ThemeProvider'

type Listener = (e: { matches: boolean }) => void

function stubMatchMedia(initialDark: boolean) {
  const listeners = new Set<Listener>()
  const mql = {
    matches: initialDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  }
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mql),
  )
  return {
    setDark(dark: boolean) {
      mql.matches = dark
      listeners.forEach((l) => l({ matches: dark }))
    },
  }
}

function Probe() {
  const { pref, resolved, setPref } = useTheme()
  return (
    <div>
      <p>
        {pref} {resolved}
      </p>
      <button onClick={() => setPref('light')}>claro</button>
      <button onClick={() => setPref('system')}>sistema</button>
    </div>
  )
}

function renderWithProvider() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sin preferencia guardada y sistema oscuro aplica el tema oscuro', () => {
    stubMatchMedia(true)
    renderWithProvider()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByText('system dark')).toBeInTheDocument()
  })

  it('setPref cambia el atributo y guarda la preferencia', async () => {
    stubMatchMedia(true)
    renderWithProvider()
    await userEvent.click(screen.getByRole('button', { name: 'claro' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('saria.theme')).toBe('light')
    expect(screen.getByText('light light')).toBeInTheDocument()
  })

  it('lee la preferencia guardada', () => {
    stubMatchMedia(true)
    localStorage.setItem('saria.theme', 'light')
    renderWithProvider()
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('ignora un valor guardado inválido', () => {
    stubMatchMedia(false)
    localStorage.setItem('saria.theme', 'morado')
    renderWithProvider()
    expect(screen.getByText('system light')).toBeInTheDocument()
  })

  it('con preferencia system sigue los cambios del sistema en vivo', () => {
    const media = stubMatchMedia(false)
    renderWithProvider()
    expect(document.documentElement.dataset.theme).toBe('light')
    act(() => media.setDark(true))
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('al volver a system usa el estado actual del sistema', async () => {
    const media = stubMatchMedia(false)
    renderWithProvider()
    await userEvent.click(screen.getByRole('button', { name: 'claro' }))
    act(() => media.setDark(true))
    expect(document.documentElement.dataset.theme).toBe('light')
    await userEvent.click(screen.getByRole('button', { name: 'sistema' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('sigue funcionando si localStorage lanza', async () => {
    stubMatchMedia(true)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    renderWithProvider()
    expect(document.documentElement.dataset.theme).toBe('dark')
    await userEvent.click(screen.getByRole('button', { name: 'claro' }))
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
