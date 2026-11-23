import { test as base, expect, type Page } from '@playwright/test'

const SUPABASE_URL = 'http://127.0.0.1:54321'

/** Escribe una sesión falsa y vencida donde la app la espera (`saria.auth`). */
export async function seedSession(page: Page) {
  await page.addInitScript(() => {
    const now = Math.floor(Date.now() / 1000)
    localStorage.setItem(
      'saria.auth',
      JSON.stringify({
        access_token: 'e2e-access-token',
        refresh_token: 'e2e-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: now - 3600,
        user: { id: '00000000-0000-4000-8000-000000000001' },
      }),
    )
  })
}

/** Ninguna prueba toca Supabase: la renovación falla como error de red. */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.route(`${SUPABASE_URL}/**`, (route) => route.abort())
    await provide(page)
  },
})

export { expect }
