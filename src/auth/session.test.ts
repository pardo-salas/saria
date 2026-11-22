import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUTH_STORAGE_KEY } from './supabase'
import { decideGate, readStoredUserId } from './session'

/** Forma que supabase-js 2.119 guarda en `saria.auth` (sin `userStorage`). */
function storedSession(expiresAtSeconds: number) {
  return JSON.stringify({
    access_token: 'access',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAtSeconds,
    refresh_token: 'refresh',
    user: { id: 'u1', email: 'brian@example.com' },
  })
}

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('decideGate', () => {
  it('sin configuración siempre es misconfigured (Review Focus 4)', () => {
    expect(decideGate(false, 'u1')).toBe('misconfigured')
    expect(decideGate(false, null)).toBe('misconfigured')
  })

  it('configurado sin sesión guardada es signed-out', () => {
    expect(decideGate(true, null)).toBe('signed-out')
  })

  it('configurado con sesión guardada es signed-in', () => {
    expect(decideGate(true, 'u1')).toBe('signed-in')
  })
})

describe('readStoredUserId', () => {
  it('regresa el user.id aunque el token ya haya vencido', () => {
    const past = Math.floor(Date.now() / 1000) - 86_400
    localStorage.setItem(AUTH_STORAGE_KEY, storedSession(past))
    expect(readStoredUserId(localStorage)).toBe('u1')
  })

  it('sin clave regresa null', () => {
    expect(readStoredUserId(localStorage)).toBeNull()
  })

  it('con JSON inválido regresa null', () => {
    localStorage.setItem(AUTH_STORAGE_KEY, '{no es json')
    expect(readStoredUserId(localStorage)).toBeNull()
  })

  it('sin user.id de texto regresa null', () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: {} }))
    expect(readStoredUserId(localStorage)).toBeNull()
    localStorage.setItem(AUTH_STORAGE_KEY, 'null')
    expect(readStoredUserId(localStorage)).toBeNull()
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: { id: 7 } }))
    expect(readStoredUserId(localStorage)).toBeNull()
  })
})

describe('Review Focus 1: token vencido sin conexión', () => {
  it('abre la app (signed-in) con sesión vencida y navigator.onLine false', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const past = Math.floor(Date.now() / 1000) - 3600
    localStorage.setItem(AUTH_STORAGE_KEY, storedSession(past))

    expect(navigator.onLine).toBe(false)
    expect(decideGate(true, readStoredUserId(localStorage))).toBe('signed-in')
  })
})
