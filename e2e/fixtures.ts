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
    // Datos: un servidor vacío que acepta todo, para que la primera sincronización
    // termine y la app siembre las categorías. Se registra después, así que gana.
    await page.route(`${SUPABASE_URL}/rest/v1/**`, (route) => {
      const headers = { 'access-control-allow-origin': '*' }
      const method = route.request().method()
      if (method === 'OPTIONS')
        return route.fulfill({
          status: 204,
          headers: {
            ...headers,
            'access-control-allow-headers': '*',
            'access-control-allow-methods': '*',
          },
        })
      if (method === 'GET')
        return route.fulfill({
          status: 200,
          headers,
          contentType: 'application/json',
          body: '[]',
        })
      return route.fulfill({ status: 201, headers, body: '' })
    })
    await provide(page)
  },
})

export { expect }
