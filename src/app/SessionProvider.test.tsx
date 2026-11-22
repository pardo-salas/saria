import { act, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { repo } from '@/db/repo'
import { db } from '@/db/dexie'
import { signOut } from '@/auth/authService'
import {
  SessionProvider,
  SessionValueProvider,
  useSessionContext,
} from './SessionProvider'

vi.mock('@/auth/authService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/auth/authService')>()),
  signOut: vi.fn(async () => {}),
}))

vi.mock('@/auth/supabase', () => ({
  AUTH_STORAGE_KEY: 'saria.auth',
  isConfigured: () => true,
  getSupabase: () => ({
    auth: {
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe() {} } },
      }),
    },
  }),
}))

afterEach(async () => {
  localStorage.clear()
  await db.settings.clear()
  await db.outbox.clear()
})

describe('SessionValueProvider', () => {
  it('el repo ya conoce al usuario en el primer render de los hijos (antes de cualquier efecto)', async () => {
    let write: Promise<unknown> | null = null
    function Child() {
      // Solo para la prueba: escribir durante el primer render, antes de que
      // corra ningún efecto, debe usar ya al usuario de la sesión.
      write ??= repo.put('settings', {
        monthly_income_cents: null,
        pay_frequency: null,
        currency: 'MXN',
        theme: 'dark',
      })
      return null
    }
    render(
      <SessionValueProvider
        value={{ gate: 'signed-in', userId: 'u1', signOut: vi.fn() }}
      >
        <Child />
      </SessionValueProvider>,
    )
    await expect(write).resolves.toMatchObject({ id: 'u1', user_id: 'u1' })
  })

  it('expone gate y userId por contexto', () => {
    const { result } = renderHook(() => useSessionContext(), {
      wrapper: ({ children }) => (
        <SessionValueProvider
          value={{ gate: 'signed-out', userId: null, signOut: vi.fn() }}
        >
          {children}
        </SessionValueProvider>
      ),
    })
    expect(result.current.gate).toBe('signed-out')
    expect(result.current.userId).toBeNull()
  })
})

describe('SessionProvider', () => {
  it('después de signOut la puerta queda en signed-out aunque no llegue SIGNED_OUT', async () => {
    localStorage.setItem(
      'saria.auth',
      JSON.stringify({ expires_at: 1, user: { id: 'u1' } }),
    )
    function Gate() {
      const { gate, signOut: out } = useSessionContext()
      return (
        <>
          <p>{gate}</p>
          <button onClick={() => void out()}>salir</button>
        </>
      )
    }
    render(
      <SessionProvider>
        <Gate />
      </SessionProvider>,
    )
    expect(screen.getByText('signed-in')).toBeInTheDocument()
    await act(async () => screen.getByText('salir').click())
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(screen.getByText('signed-out')).toBeInTheDocument()
  })
})
