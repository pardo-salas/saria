import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('App', () => {
  it('sin variables VITE_* muestra el aviso de configuración, no una pantalla en blanco', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const { App } = await import('./App')
    render(<App />)
    expect(
      screen.getByText(/Falta configurar la conexión con Supabase/),
    ).toBeInTheDocument()
  })

  it('con una URL mal formada también muestra el aviso de configuración', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'esto no es una url')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')
    const { App } = await import('./App')
    render(<App />)
    expect(
      screen.getByText(/Falta configurar la conexión con Supabase/),
    ).toBeInTheDocument()
  })
})
