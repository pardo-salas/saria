import { describe, expect, it } from 'vitest'
import { COLUMNS } from '../db/schema'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFileName,
  buildBackup,
  parseBackup,
  type BackupTables,
} from './backup'

const U = '00000000-0000-4000-8000-000000000001'
const A1 = '00000000-0000-4000-8000-0000000000a1'
const A2 = '00000000-0000-4000-8000-0000000000a2'
const C1 = '00000000-0000-4000-8000-0000000000c1'
const T = '2026-01-01T10:00:00.000Z'
const common = (id: string) => ({
  id,
  user_id: U,
  created_at: T,
  updated_at: T,
  deleted_at: null,
})

function account(id: string) {
  return {
    ...common(id),
    name: 'Efectivo',
    type: 'cash' as const,
    institution: null,
    color: null,
    icon: null,
    initial_balance_cents: 0,
    include_in_total: true,
    archived: false,
    position: 0,
    credit_limit_cents: null,
    statement_day: null,
    due_day: null,
    yield_rate: null,
    yield_cap_cents: null,
    yield_rate_over_cap: null,
  }
}

function sampleTables(): BackupTables {
  return {
    accounts: [account(A1), account(A2)],
    categories: [
      {
        ...common(C1),
        name: 'Comida',
        kind: 'expense',
        icon: null,
        color: null,
        monthly_limit_cents: null,
        archived: false,
        position: 0,
      },
    ],
    transactions: [
      {
        ...common('00000000-0000-4000-8000-0000000000b1'),
        kind: 'expense',
        amount_cents: 1000,
        date: '2026-01-01',
        account_id: A1,
        category_id: C1,
        note: null,
        recurring_id: null,
        installment_plan_id: null,
        legacy_id: null,
      },
    ],
    transfers: [
      {
        ...common('00000000-0000-4000-8000-0000000000d1'),
        from_account_id: A1,
        to_account_id: A2,
        amount_cents: 500,
        date: '2026-01-01',
        note: null,
        legacy_id: null,
      },
    ],
    recurring_payments: [],
    reminders: [],
    installment_plans: [],
    settings: [
      {
        ...common(U),
        monthly_income_cents: null,
        pay_frequency: null,
        currency: 'MXN',
        theme: 'system',
      },
    ],
  }
}

type Loose = { tables: Record<string, Record<string, unknown>[]> }

function text(mutate?: (b: Loose) => void) {
  const b = JSON.parse(JSON.stringify(buildBackup(sampleTables(), T))) as Loose
  mutate?.(b)
  return JSON.stringify(b)
}

function error(t: string): string {
  const r = parseBackup(t)
  if (r.ok) throw new Error('se esperaba error')
  return r.error
}

describe('buildBackup / backupFileName', () => {
  it('arma el envoltorio', () => {
    const b = buildBackup(sampleTables(), T)
    expect(b).toMatchObject({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exported_at: T,
    })
  })
  it('nombra el archivo con la fecha', () => {
    expect(backupFileName('2026-11-22')).toBe('saria-respaldo-2026-11-22.json')
  })
})

describe('parseBackup', () => {
  it('acepta un respaldo válido y cuenta filas', () => {
    const r = parseBackup(text())
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.counts).toMatchObject({
        accounts: 2,
        categories: 1,
        transactions: 1,
        transfers: 1,
        settings: 1,
        reminders: 0,
      })
      expect(Object.keys(r.counts)).toEqual(Object.keys(COLUMNS))
    }
  })

  const notSaria = 'El archivo no es un respaldo de Saria'
  it('rechaza JSON inválido, otro formato o sin tables', () => {
    expect(error('{no')).toBe(notSaria)
    expect(error('null')).toBe(notSaria)
    expect(error(JSON.stringify({ format: 'otro', tables: {} }))).toBe(notSaria)
    expect(error(JSON.stringify({ format: BACKUP_FORMAT, version: 1 }))).toBe(
      notSaria,
    )
  })
  it('rechaza si falta una tabla', () => {
    expect(error(text((b) => delete b.tables.reminders))).toBe(notSaria)
  })
  it('rechaza versión más nueva', () => {
    const b = JSON.parse(text()) as { version: number }
    b.version = 2
    expect(error(JSON.stringify(b))).toBe(
      'Este respaldo es de una versión más nueva de Saria',
    )
  })
  it('rechaza columna faltante', () => {
    expect(error(text((b) => delete b.tables.accounts![0]!.name))).toBe(
      'Falta la columna name en accounts',
    )
  })
  it('rechaza montos inválidos', () => {
    expect(
      error(text((b) => (b.tables.transactions![0]!.amount_cents = 10.5))),
    ).toBe('Hay un monto inválido en transactions')
    expect(
      error(text((b) => (b.tables.accounts![0]!.credit_limit_cents = '5'))),
    ).toBe('Hay un monto inválido en accounts')
  })
  it('rechaza IDs inválidos, incluido settings', () => {
    expect(error(text((b) => (b.tables.accounts![0]!.id = 'abc')))).toBe(
      'Hay un ID inválido en accounts',
    )
    expect(error(text((b) => (b.tables.settings![0]!.id = 'abc')))).toBe(
      'Hay un ID inválido en settings',
    )
  })
  it('rechaza referencias rotas', () => {
    const mov =
      'Un movimiento apunta a una cuenta o categoría que no está en el respaldo'
    const tr =
      'Una transferencia apunta a una cuenta que no está en el respaldo'
    expect(
      error(text((b) => (b.tables.transactions![0]!.account_id = U))),
    ).toBe(mov)
    expect(
      error(text((b) => (b.tables.transactions![0]!.category_id = U))),
    ).toBe(mov)
    expect(
      error(text((b) => (b.tables.transfers![0]!.to_account_id = U))),
    ).toBe(tr)
    expect(
      error(text((b) => (b.tables.transfers![0]!.from_account_id = U))),
    ).toBe(tr)
    expect(
      error(text((b) => (b.tables.transfers![0]!.to_account_id = A1))),
    ).toBe('Una transferencia tiene la misma cuenta de origen y destino')
  })
  it('rechaza monto obligatorio nulo', () => {
    expect(
      error(text((b) => (b.tables.transactions![0]!.amount_cents = null))),
    ).toBe('Hay un monto inválido en transactions')
  })
  it('rechaza versión no entera o menor a 1', () => {
    for (const v of [0, 1.5, '1']) {
      const b = JSON.parse(text()) as { version: unknown }
      b.version = v
      expect(error(JSON.stringify(b))).toBe(notSaria)
    }
  })
  it('descarta llaves desconocidas', () => {
    const r = parseBackup(text((b) => (b.tables.accounts![0]!.extra = 'x')))
    expect(r.ok && 'extra' in r.backup.tables.accounts[0]!).toBe(false)
  })
  it('acepta category_id nulo', () => {
    expect(
      parseBackup(text((b) => (b.tables.transactions![0]!.category_id = null)))
        .ok,
    ).toBe(true)
  })
})
