import { expect, seedSession, test } from './fixtures'

test('sin sesión muestra Iniciar sesión y no la navegación', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.getByRole('button', { name: 'Iniciar sesión' }),
  ).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Principal' })).toHaveCount(
    0,
  )
})

test('con sesión se navega por las 5 pestañas', async ({ page }) => {
  await seedSession(page)
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Principal' })
  await expect(page.getByRole('heading', { name: 'Hola, Brian' })).toBeVisible()

  for (const name of ['Movimientos', 'Cuentas', 'Gráficas', 'Más']) {
    await nav.getByRole('link', { name, exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  }

  await nav.getByRole('link', { name: 'Inicio' }).click()
  await expect(page.getByRole('heading', { name: 'Hola, Brian' })).toBeVisible()
})

test('abre sin conexión tras la primera visita', async ({ page, context }) => {
  await seedSession(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Hola, Brian' })).toBeVisible()

  await page.evaluate(() => navigator.serviceWorker.ready)
  // La primera carga no queda controlada por el SW: recargar una vez.
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
    await page.reload()
  }
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)

  await context.setOffline(true)
  await page.goto('/cuentas')
  await expect(
    page.getByRole('heading', { name: 'Cuentas', exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Cuentas', exact: true }),
  ).toBeVisible()
})
