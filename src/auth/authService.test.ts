import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSupabase } from './supabase'
import {
  AUTH_ERROR_MESSAGES,
  sendPasswordReset,
  signIn,
  signOut,
  updatePassword,
} from './authService'

vi.mock('./supabase', () => ({
  AUTH_STORAGE_KEY: 'saria.auth',
  getSupabase: vi.fn(),
  isConfigured: vi.fn(() => true),
}))

const auth = {
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}

beforeEach(() => {
  vi.mocked(getSupabase).mockReturnValue({ auth } as never)
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  localStorage.clear()
})

describe('signIn', () => {
  it('éxito regresa ok', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: null })
    await expect(signIn('b@x.mx', 'secreto')).resolves.toEqual({ ok: true })
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'b@x.mx',
      password: 'secreto',
    })
  })

  it('credenciales incorrectas → invalid_credentials', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: new AuthApiError(
        'Invalid login credentials',
        400,
        'invalid_credentials',
      ),
    })
    await expect(signIn('b@x.mx', 'mal')).resolves.toEqual({
      ok: false,
      error: 'invalid_credentials',
    })
  })

  it('AuthRetryableFetchError → offline', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: new AuthRetryableFetchError('Failed to fetch', 0),
    })
    await expect(signIn('b@x.mx', 'secreto')).resolves.toEqual({
      ok: false,
      error: 'offline',
    })
  })

  it('navigator.onLine false → offline sin llamar a Supabase', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await expect(signIn('b@x.mx', 'secreto')).resolves.toEqual({
      ok: false,
      error: 'offline',
    })
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('sin configuración → misconfigured', async () => {
    vi.mocked(getSupabase).mockReturnValue(null)
    await expect(signIn('b@x.mx', 'secreto')).resolves.toEqual({
      ok: false,
      error: 'misconfigured',
    })
  })

  it('otro error o excepción → unknown', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: new AuthApiError('boom', 500, 'unexpected_failure'),
    })
    await expect(signIn('b@x.mx', 'secreto')).resolves.toEqual({
      ok: false,
      error: 'unknown',
    })
    auth.signInWithPassword.mockRejectedValueOnce(new Error('kaput'))
    await expect(signIn('b@x.mx', 'secreto')).resolves.toEqual({
      ok: false,
      error: 'unknown',
    })
  })
})

describe('sendPasswordReset', () => {
  it('redirige a /restablecer del mismo origen', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
    await expect(sendPasswordReset('b@x.mx')).resolves.toEqual({ ok: true })
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('b@x.mx', {
      redirectTo: `${location.origin}/restablecer`,
    })
  })

  it('sin conexión → offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await expect(sendPasswordReset('b@x.mx')).resolves.toEqual({
      ok: false,
      error: 'offline',
    })
  })
})

describe('updatePassword', () => {
  it('actualiza la contraseña del usuario', async () => {
    auth.updateUser.mockResolvedValue({ data: {}, error: null })
    await expect(updatePassword('nueva-123')).resolves.toEqual({ ok: true })
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'nueva-123' })
  })

  it('sin configuración → misconfigured', async () => {
    vi.mocked(getSupabase).mockReturnValue(null)
    await expect(updatePassword('nueva-123')).resolves.toEqual({
      ok: false,
      error: 'misconfigured',
    })
  })
})

describe('signOut', () => {
  it('cierra solo la sesión local y borra la sesión guardada', async () => {
    localStorage.setItem('saria.auth', '{"user":{"id":"u1"}}')
    auth.signOut.mockResolvedValue({ error: null })
    await signOut()
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(localStorage.getItem('saria.auth')).toBeNull()
  })

  it('borra la sesión guardada aunque Supabase falle', async () => {
    localStorage.setItem('saria.auth', '{"user":{"id":"u1"}}')
    auth.signOut.mockRejectedValue(new Error('sin red'))
    await signOut()
    expect(localStorage.getItem('saria.auth')).toBeNull()
  })

  it('sin configuración solo borra la sesión guardada', async () => {
    vi.mocked(getSupabase).mockReturnValue(null)
    localStorage.setItem('saria.auth', '{"user":{"id":"u1"}}')
    await signOut()
    expect(localStorage.getItem('saria.auth')).toBeNull()
  })
})

describe('AUTH_ERROR_MESSAGES', () => {
  it('tiene la copia fija en español', () => {
    expect(AUTH_ERROR_MESSAGES).toEqual({
      invalid_credentials: 'El correo o la contraseña no coinciden.',
      offline:
        'Necesitas internet para iniciar sesión la primera vez en este dispositivo.',
      misconfigured:
        'Falta configurar la conexión con Supabase (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY).',
      unknown: 'No se pudo iniciar sesión. Intenta de nuevo.',
    })
  })
})
