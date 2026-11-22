import { afterEach, describe, expect, it, vi } from 'vitest'

const createClient = vi.fn(() => ({ auth: {} }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  createClient.mockClear()
})

describe('supabase (Review Focus 4)', () => {
  it('sin variables VITE_* no está configurado y getSupabase regresa null', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const { getSupabase, isConfigured } = await import('./supabase')
    expect(isConfigured()).toBe(false)
    expect(getSupabase()).toBeNull()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('con solo una variable no está configurado', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const { isConfigured } = await import('./supabase')
    expect(isConfigured()).toBe(false)
  })

  it('configurado crea un único cliente con sesión persistente en saria.auth', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')
    const { getSupabase, isConfigured } = await import('./supabase')
    expect(isConfigured()).toBe(true)
    const client = getSupabase()
    expect(client).not.toBeNull()
    expect(getSupabase()).toBe(client)
    expect(createClient).toHaveBeenCalledTimes(1)
    expect(createClient).toHaveBeenCalledWith('https://x.supabase.co', 'anon', {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'saria.auth',
        storage: localStorage,
      },
    })
  })

  it('con una URL mal formada (createClient lanza) getSupabase regresa null', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'no-es-una-url')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')
    createClient.mockImplementationOnce(() => {
      throw new Error('Invalid supabaseUrl')
    })
    const { getSupabase } = await import('./supabase')
    expect(getSupabase()).toBeNull()
  })
})
