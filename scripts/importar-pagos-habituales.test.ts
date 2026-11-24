// Prueba condicionada: solo corre si hay un .mmbackup y el Excel en data/ (git-ignored).
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseRecurringFile } from '../src/domain/recurringFile'
import { nextOccurrence } from '../src/domain/recurring'
import type { RecurringPayment } from '../src/db/schema'
// @ts-expect-error script .mjs sin tipos
import * as pagos from './importar-pagos-habituales.mjs'
// @ts-expect-error script .mjs sin tipos
import * as importador from './importar-money-manager.mjs'

const dataDir = join(__dirname, '..', 'data')
const archivo = existsSync(dataDir)
  ? readdirSync(dataDir).find((f) => f.endsWith('.mmbackup'))
  : undefined
const excel = join(dataDir, 'Gastos Personales.xlsx')
const ruta = archivo && existsSync(excel) ? join(dataDir, archivo) : ''

describe('centavos', () => {
  it('convierte con aritmética de texto', () => {
    expect(pagos.centavos('293.38')).toBe(29338)
    expect(pagos.centavos('2760')).toBe(276000)
    expect(pagos.centavos('0.1')).toBe(10)
  })
})

describe.skipIf(!ruta)('importador de pagos habituales', () => {
  it('genera 16 pagos que apuntan a lo importado en la Fase 2', async () => {
    const { archivo: out, fecha } = await pagos.construirPagos(ruta, excel)
    const { backup } = await importador.convertirMmbackup(ruta)
    const cuentas = new Set<string>(
      backup.tables.accounts.map((a: { id: string }) => a.id),
    )
    const categorias = new Set<string>(
      backup.tables.categories.map((c: { id: string }) => c.id),
    )
    const lista = out.recurring_payments as RecurringPayment[]
    expect(lista).toHaveLength(16)
    for (const p of lista) {
      if (p.account_id !== null)
        expect(cuentas.has(p.account_id), p.name).toBe(true)
      if (p.category_id !== null)
        expect(categorias.has(p.category_id), p.name).toBe(true)
      // Una compra a meses ya terminada queda sin próxima fecha e inactiva.
      if (p.next_due_date === null) expect(p.active, p.name).toBe(false)
      else expect(p.next_due_date > fecha, p.name).toBe(true)
      // Mismo algoritmo que la app.
      expect(p.next_due_date, p.name).toBe(nextOccurrence(p, fecha))
    }
    const check = parseRecurringFile(
      JSON.stringify(out),
      { accountIds: cuentas, categoryIds: categorias },
      new Set(),
    )
    expect(check.ok).toBe(true)
  })
})
