import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setRepoUserSource } from '@/db/repo'
import { getSupabase, isConfigured } from './supabase'
import { useSession } from './useSession'

vi.mock('./supabase', () => ({
  AUTH_STORAGE_KEY: 'saria.auth',
  getSupabase: vi.fn(),
  isConfigured: vi.fn(() => true),
}))

vi.mock('@/db/repo', () => ({ setRepoUserSource: vi.fn() }))

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

function currentRepoUser(): string | null {
  const calls = vi.mocked(setRepoUserSource).mock.calls
  return calls[calls.length - 1][0]()
}

describe('useSession', () => {
  it('arranca en signed-in con la sesión guardada, sin esperar a la red', () => {
    localStorage.setItem(
      'saria.auth',
      JSON.stringify({ expires_at: 1, user: { id: 'u1' } }),
    )
    const { result } = renderHook(() => useSession())
    expect(result.current).toEqual({ gate: 'signed-in', userId: 'u1' })
    expect(currentRepoUser()).toBe('u1')
  })

  it('arranca en signed-out sin sesión guardada', () => {
    const { result } = renderHook(() => useSession())
    expect(result.current).toEqual({ gate: 'signed-out', userId: null })
    expect(currentRepoUser()).toBeNull()
  })

  it('sin configuración es misconfigured y no se suscribe', () => {
    vi.mocked(isConfigured).mockReturnValue(false)
    vi.mocked(getSupabase).mockReturnValue(null)
    const { result } = renderHook(() => useSession())
    expect(result.current).toEqual({ gate: 'misconfigured', userId: null })
    expect(currentRepoUser()).toBeNull()
  })

  it('sigue los eventos de Supabase y actualiza el usuario del repo', () => {
    const { result, unmount } = renderHook(() => useSession())
    act(() => listener!('SIGNED_IN', { user: { id: 'u2' } }))
    expect(result.current).toEqual({ gate: 'signed-in', userId: 'u2' })
    expect(currentRepoUser()).toBe('u2')

    act(() => listener!('SIGNED_OUT', null))
    expect(result.current).toEqual({ gate: 'signed-out', userId: null })
    expect(currentRepoUser()).toBeNull()

    unmount()
    expect(unsubscribe).toHaveBeenCalled()
  })

  it('ignora INITIAL_SESSION sin sesión (refresh offline fallido) para no sacar al usuario', () => {
    localStorage.setItem(
      'saria.auth',
      JSON.stringify({ expires_at: 1, user: { id: 'u1' } }),
    )
    const { result } = renderHook(() => useSession())
    act(() => listener!('INITIAL_SESSION', null))
    expect(result.current).toEqual({ gate: 'signed-in', userId: 'u1' })
  })
})
