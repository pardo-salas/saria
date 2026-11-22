import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSupabase, isConfigured } from './supabase'
import { useSession } from './useSession'

vi.mock('./supabase', () => ({
  AUTH_STORAGE_KEY: 'saria.auth',
  getSupabase: vi.fn(),
  isConfigured: vi.fn(() => true),
}))

type Listener = (
  event: string,
  session: { user: { id: string } } | null,
) => void
let listener: Listener | null = null
const unsubscribe = vi.fn()

beforeEach(() => {
  listener = null
  vi.mocked(isConfigured).mockReturnValue(true)
  vi.mocked(getSupabase).mockReturnValue({
    auth: {
      onAuthStateChange: (cb: Listener) => {
        listener = cb
        return { data: { subscription: { unsubscribe } } }
      },
    },
  } as never)
})

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('useSession', () => {
  it('arranca en signed-in con la sesión guardada, sin esperar a la red', () => {
    localStorage.setItem(
      'saria.auth',
      JSON.stringify({ expires_at: 1, user: { id: 'u1' } }),
    )
    const { result } = renderHook(() => useSession())
    expect(result.current).toMatchObject({ gate: 'signed-in', userId: 'u1' })
  })

  it('arranca en signed-out sin sesión guardada', () => {
    const { result } = renderHook(() => useSession())
    expect(result.current).toMatchObject({ gate: 'signed-out', userId: null })
  })

  it('sin configuración es misconfigured y no se suscribe', () => {
    vi.mocked(isConfigured).mockReturnValue(false)
    vi.mocked(getSupabase).mockReturnValue(null)
    const { result } = renderHook(() => useSession())
    expect(result.current).toMatchObject({
      gate: 'misconfigured',
      userId: null,
    })
  })

  it('si el cliente no se pudo crear (URL mal formada) es misconfigured', () => {
    localStorage.setItem(
      'saria.auth',
      JSON.stringify({ expires_at: 1, user: { id: 'u1' } }),
    )
    vi.mocked(isConfigured).mockReturnValue(true)
    vi.mocked(getSupabase).mockReturnValue(null)
    const { result } = renderHook(() => useSession())
    expect(result.current).toMatchObject({
      gate: 'misconfigured',
      userId: null,
    })
  })

  it('sigue los eventos de Supabase', () => {
    const { result, unmount } = renderHook(() => useSession())
    act(() => listener!('SIGNED_IN', { user: { id: 'u2' } }))
    expect(result.current).toMatchObject({ gate: 'signed-in', userId: 'u2' })

    act(() => listener!('SIGNED_OUT', null))
    expect(result.current).toMatchObject({ gate: 'signed-out', userId: null })

    unmount()
    expect(unsubscribe).toHaveBeenCalled()
  })

  it('markSignedOut cierra la puerta aunque no llegue SIGNED_OUT, y un nuevo SIGNED_IN la abre', () => {
    localStorage.setItem(
      'saria.auth',
      JSON.stringify({ expires_at: 1, user: { id: 'u1' } }),
    )
    const { result } = renderHook(() => useSession())
    act(() => result.current.markSignedOut())
    expect(result.current).toMatchObject({ gate: 'signed-out', userId: null })

    act(() => listener!('SIGNED_IN', { user: { id: 'u1' } }))
    expect(result.current).toMatchObject({ gate: 'signed-in', userId: 'u1' })
  })

  it('ignora INITIAL_SESSION sin sesión (refresh offline fallido) para no sacar al usuario', () => {
    localStorage.setItem(
      'saria.auth',
      JSON.stringify({ expires_at: 1, user: { id: 'u1' } }),
    )
    const { result } = renderHook(() => useSession())
    act(() => listener!('INITIAL_SESSION', null))
    expect(result.current).toMatchObject({ gate: 'signed-in', userId: 'u1' })
  })
})
