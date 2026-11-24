// Prueba condicionada: solo corre si existe un .mmbackup en data/ (git-ignored).
// Cruza el script .mjs (que duplica columnas, UUID v5 e iconos) con los
// fuentes TS de la app para detectar divergencias.
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseBackup } from '../src/domain/backup'
import { balancesByAccount } from '../src/domain/balances'
import { SEED_CATEGORIES } from '../src/domain/seedCategories'
import { uuidV5 } from '../src/domain/uuid'
import { COLUMNS } from '../src/db/schema'
// @ts-expect-error script .mjs sin tipos
import * as importador from './importar-money-manager.mjs'

const dataDir = join(__dirname, '..', 'data')
const archivo = existsSync(dataDir)
  ? readdirSync(dataDir).find((f) => f.endsWith('.mmbackup'))
  : undefined
const ruta = archivo ? join(dataDir, archivo) : ''

describe.skipIf(!ruta)('importador de Money Manager', () => {
  it('genera un respaldo válido que cuadra con account_balance', async () => {
    const { backup, resumen } = await importador.convertirMmbackup(ruta)
    const check = parseBackup(JSON.stringify(backup))
    expect(check.ok).toBe(true)
    if (!check.ok) return

    // Hay 325 transferencias en el archivo, pero 3 tienen isRemoved = 1.
    expect(check.counts.accounts).toBe(14)
    expect(check.counts.categories).toBe(28)
    expect(check.counts.transactions).toBe(2706)
    expect(check.counts.transfers).toBe(322)

    const { tables } = check.backup
    const saldos = balancesByAccount(
      tables.accounts,
      tables.transactions,
      tables.transfers,
    )
    for (const c of resumen.cuentas as { nombre: string; saldoMm: number }[]) {
      const cuenta = tables.accounts.find((a) => a.name === c.nombre)!
      expect(saldos.get(cuenta.id), c.nombre).toBe(c.saldoMm)
    }
  })

  it('mantiene en sincronía columnas, UUID v5 e iconos con la app', async () => {
    expect(importador.COLUMNS).toEqual(COLUMNS)
    const nombre = 'uid-de-prueba'
    expect(importador.uuidV5(nombre, importador.NAMESPACE_IMPORTADOR)).toBe(
      await uuidV5(nombre, importador.NAMESPACE_IMPORTADOR),
    )
    const { backup } = await importador.convertirMmbackup(ruta)
    for (const c of backup.tables.categories as {
      name: string
      kind: string
      icon: string
    }[]) {
      const semilla = SEED_CATEGORIES.find(
        (s) => s.name === c.name && s.kind === c.kind,
      )
      expect(semilla?.icon, c.name).toBe(c.icon)
    }
  })
})
