import type { Page } from '@playwright/test'
import { expect, seedSession, test } from './fixtures'

test.skip(({ isMobile }) => !isMobile, 'Solo en el perfil móvil')

async function crearCuenta(
  page: Page,
  name: string,
  saldo: string,
  tipo = 'Efectivo',
) {
  await page.getByRole('button', { name: 'Nueva cuenta' }).first().click()
  const sheet = page.getByRole('dialog')
  await sheet.getByLabel('Nombre').fill(name)
  await sheet.getByText(tipo, { exact: true }).click()
  await sheet.getByRole('textbox', { name: 'Saldo inicial' }).fill(saldo)
  await sheet.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(sheet).toBeHidden()
}

async function abrirApp(page: Page) {
  await seedSession(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Hola, Brian' })).toBeVisible()
}

test('registra un gasto sin conexión en dos toques', async ({
  page,
  context,
}) => {
  await abrirApp(page)
  await page.evaluate(() => navigator.serviceWorker.ready)
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
    await page.reload()
  }
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)

  await context.setOffline(true)
  expect(await page.evaluate(() => navigator.onLine)).toBe(false)

  const nav = page.getByRole('navigation', { name: 'Principal' })
  await nav.getByRole('link', { name: 'Cuentas', exact: true }).click()
  await crearCuenta(page, 'Cartera', '1000')
  await expect(page.getByText('$1,000.00').first()).toBeVisible()

  await page.getByRole('button', { name: 'Registrar', exact: true }).click()
  await page.keyboard.type('185.50')
  await page
    .getByRole('button', { name: /^Guardar gasto de \$185\.50 en Comida/ })
    .click()

  await nav.getByRole('link', { name: 'Inicio', exact: true }).click()
  await expect(page.getByText('−$185.50').first()).toBeVisible()
  await nav.getByRole('link', { name: 'Cuentas', exact: true }).click()
  await expect(page.getByText('$814.50').first()).toBeVisible()

  await page.reload()
  await expect(page.getByText('$814.50').first()).toBeVisible()
  await nav.getByRole('link', { name: 'Inicio', exact: true }).click()
  await expect(page.getByText('−$185.50').first()).toBeVisible()
})

test('una transferencia mueve ambos saldos', async ({ page }) => {
  await abrirApp(page)
  const nav = page.getByRole('navigation', { name: 'Principal' })
  await nav.getByRole('link', { name: 'Cuentas', exact: true }).click()
  await crearCuenta(page, 'Origen', '1000')
  await crearCuenta(page, 'Destino', '0')

  await page.getByRole('button', { name: 'Registrar', exact: true }).click()
  const sheet = page.getByRole('dialog')
  await sheet
    .getByRole('radiogroup', { name: 'Tipo de movimiento' })
    .getByText('Transferir', { exact: true })
    .click()
  await sheet.getByRole('textbox', { name: 'Monto' }).fill('300')
  await sheet
    .getByRole('radiogroup', { name: 'De' })
    .getByText('Origen')
    .click()
  await sheet
    .getByRole('radiogroup', { name: 'A' })
    .getByText('Destino')
    .click()
  await sheet.getByRole('button', { name: 'Transferir', exact: true }).click()
  await expect(sheet).toBeHidden()

  await expect(page.getByText('$700.00').first()).toBeVisible()
  await expect(page.getByText('$300.00').first()).toBeVisible()

  await page.getByRole('link', { name: /Origen/ }).click()
  await expect(page.getByText(/A Destino/).first()).toBeVisible()
  await page.goBack()
  await page.getByRole('link', { name: /Destino/ }).click()
  await expect(page.getByText(/De Origen/).first()).toBeVisible()
})

test('respaldo de ida y vuelta', async ({ page }) => {
  await abrirApp(page)
  const nav = page.getByRole('navigation', { name: 'Principal' })
  await nav.getByRole('link', { name: 'Cuentas', exact: true }).click()
  await crearCuenta(page, 'Respaldada', '50')

  await page.goto('/mas/respaldo')
  const exportado = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar respaldo' }).click()
  const archivo = await (await exportado).path()

  await nav.getByRole('link', { name: 'Cuentas', exact: true }).click()
  await page.getByRole('link', { name: /Respaldada/ }).click()
  await page.getByRole('button', { name: /Editar/ }).click()
  await page.getByRole('button', { name: 'Borrar' }).click()
  await page.getByRole('button', { name: 'Sí, borrar' }).click()
  await expect(page.getByText('Aún no tienes cuentas')).toBeVisible()

  await page.goto('/mas/respaldo')
  await page.getByLabel('Archivo de respaldo').setInputFiles(archivo)
  const auto = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Restaurar respaldo' }).click()
  await auto
  await expect(page.getByText('Respaldo restaurado')).toBeVisible()

  await nav.getByRole('link', { name: 'Cuentas', exact: true }).click()
  await expect(page.getByText('Respaldada')).toBeVisible()
})
