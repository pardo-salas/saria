// Prueba condicionada: solo corre si hay un .mmbackup y el Excel en data/ (git-ignored).
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { planProgress } from '../src/domain/installments'
import type { InstallmentPlan } from '../src/db/schema'
// @ts-expect-error script .mjs sin tipos
import * as excel from './importar-excel.mjs'
// @ts-expect-error script .mjs sin tipos
import * as pagos from './importar-pagos-habituales.mjs'
// @ts-expect-error script .mjs sin tipos
import * as importador from './importar-money-manager.mjs'

const dataDir = join(__dirname, '..', 'data')
const archivo = existsSync(dataDir)
  ? readdirSync(dataDir).find((f) => f.endsWith('.mmbackup'))
  : undefined
const xlsx = join(dataDir, 'Gastos Personales.xlsx')
const ruta = archivo && existsSync(xlsx) ? join(dataDir, archivo) : ''

describe('conversiones del Excel', () => {
  it('serial de fecha y porcentajes sin ruido', () => {
    expect(excel.fechaDeSerial('46276.0')).toBe('2026-09-11')
    expect(excel.porcentaje('0.065')).toBe(6.5)
    expect(excel.porcentaje('0.07')).toBe(7)
    expect(excel.porcentaje('0.054')).toBe(5.4)
  })
})

describe.skipIf(!ruta)('importador del Excel', () => {
  it('genera 7 compras con las cifras del Excel y 9 actualizaciones de cuenta', async () => {
    const r = await excel.construirExcel(ruta, xlsx)
    const { backup } = await importador.convertirMmbackup(ruta)
    const { archivo: pagosArchivo } = await pagos.construirPagos(ruta, xlsx)
    const cuentas = new Set<string>(
      backup.tables.accounts.map((a: { id: string }) => a.id),
    )
    const planes = r.archivo.installment_plans as InstallmentPlan[]
    expect(planes).toHaveLength(7)
    // Las 6 del Excel coinciden con "Acumulado" (J) y "Queda por pagar" (L).
    expect(r.excel).toHaveLength(6)
    for (const e of r.excel) {
      const p = planes.find((x) => x.concept === e.concepto)!
      const prog = planProgress(p, [])
      expect(
        Math.abs(prog.accumulatedCents - e.acumuladoCents),
        e.concepto,
      ).toBeLessThanOrEqual(1)
      expect(
        Math.abs(prog.remainingCents - e.quedaCents),
        e.concepto,
      ).toBeLessThanOrEqual(1)
      if (e.concepto !== 'Casa') expect(cuentas.has(p.account_id!)).toBe(true)
    }
    expect(r.archivo.account_updates).toHaveLength(9)
    for (const u of r.archivo.account_updates)
      expect(cuentas.has(u.id), u.id).toBe(true)

    // Los pagos a desactivar son los de la Fase 3 para esos 5 recordatorios.
    const ids = new Map<string, string>(
      pagosArchivo.recurring_payments.map((p: { name: string; id: string }) => [
        p.name,
        p.id,
      ]),
    )
    const esperados = [
      'Reloj mensualidad',
      'Mesualidades de cama',
      'Laptop de karina',
      'Mensualidad TLOZ',
      'Mensualidad switch 2',
    ].map((n) => ids.get(n))
    expect([...r.archivo.deactivate_recurring_ids].sort()).toEqual(
      [...esperados].sort(),
    )
    expect(r.archivo.retag).toHaveLength(5)
    // Casa: sin cuenta y en pausa (la hipoteca sale de la nómina).    const casa = planes.find((x) => x.concept === 'Casa')!    expect(casa).toMatchObject({ account_id: null, active: false, monthly_cents: 189904 })    expect(planes.find((x) => x.concept === 'Moto')!.monthly_cents).toBe(216600)    // Próximo cargo real: día del recordatorio de Money Manager tras el respaldo.    const proximo = (c: string) =>      planProgress(planes.find((x) => x.concept === c)!, []).nextChargeDate    expect({      Switch: proximo('Switch'),      Reloj: proximo('Reloj'),      'Litera escritorio': proximo('Litera escritorio'),      TLOZ: proximo('TLOZ'),      'Laptop de karina': proximo('Laptop de karina'),    }).toEqual({      Switch: '2026-11-25',      Reloj: '2026-12-13',      'Litera escritorio': '2026-11-23',      TLOZ: '2026-12-14',      'Laptop de karina': '2026-11-23',    })
  })
})
