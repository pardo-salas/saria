import { describe, expect, it } from 'vitest'
import type { Account, Category } from '../db/schema'
import type { Lookups } from './search'
import {
  validateAccount,
  validateCategory,
  validateTransaction,
  validateTransfer,
} from './validate'

const base = {
  user_id: 'u',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
}

function acc(id: string, archived = false): Account {
  return {
    ...base,
    id,
    name: id,
    type: 'debit',
    institution: null,
    color: null,
    icon: null,
    initial_balance_cents: 0,
    include_in_total: true,
    archived,
    position: 0,
    credit_limit_cents: null,
    statement_day: null,
    due_day: null,
    yield_rate: null,
    yield_cap_cents: null,
    yield_rate_over_cap: null,
  }
}

function cat(
  id: string,
  name: string,
  kind: Category['kind'] = 'expense',
): Category {
  return {
    ...base,
    id,
    name,
    kind,
    icon: null,
    color: null,
    monthly_limit_cents: null,
    archived: false,
    position: 0,
  }
}

const lookups: Lookups = {
  accounts: new Map([
    ['a1', acc('a1')],
    ['a2', acc('a2')],
    ['old', acc('old', true)],
  ]),
  categories: new Map([
    ['c1', cat('c1', 'Comida')],
    ['c2', cat('c2', 'Sueldo', 'income')],
  ]),
}

describe('validateAccount', () => {
  it('acepta un nombre válido', () => {
    expect(validateAccount({ name: 'BBVA' })).toEqual({ ok: true })
  })
  it('rechaza nombre vacío o solo espacios', () => {
    const r = { ok: false, errors: { name: 'Escribe un nombre' } }
    expect(validateAccount({ name: '' })).toEqual(r)
    expect(validateAccount({ name: '   ' })).toEqual(r)
  })
  it('rechaza más de 40 caracteres (después de recortar)', () => {
    expect(validateAccount({ name: 'a'.repeat(41) })).toEqual({
      ok: false,
      errors: { name: 'Máximo 40 caracteres' },
    })
    expect(validateAccount({ name: ' ' + 'a'.repeat(40) + ' ' })).toEqual({
      ok: true,
    })
  })
})

describe('validateCategory', () => {
  const existing = [cat('c1', 'Comida'), cat('c2', 'Sueldo', 'income')]
  const input = {
    name: 'Renta',
    kind: 'expense' as const,
    monthly_limit_cents: null,
  }

  it('acepta una categoría válida', () => {
    expect(validateCategory(input, existing)).toEqual({ ok: true })
  })
  it('rechaza nombre vacío y largo', () => {
    expect(validateCategory({ ...input, name: ' ' }, existing)).toEqual({
      ok: false,
      errors: { name: 'Escribe un nombre' },
    })
    expect(
      validateCategory({ ...input, name: 'a'.repeat(41) }, existing),
    ).toEqual({ ok: false, errors: { name: 'Máximo 40 caracteres' } })
  })
  it('detecta duplicados sin distinguir acentos ni mayúsculas', () => {
    const r = {
      ok: false,
      errors: { name: 'Ya tienes una categoría con ese nombre' },
    }
    expect(validateCategory({ ...input, name: ' cómida ' }, existing)).toEqual(
      r,
    )
    expect(validateCategory({ ...input, name: 'comida' }, existing)).toEqual(r)
  })
  it('no choca consigo misma al editar', () => {
    expect(
      validateCategory({ ...input, id: 'c1', name: 'comida' }, existing),
    ).toEqual({ ok: true })
  })
  it('no choca con otro tipo', () => {
    expect(validateCategory({ ...input, name: 'sueldo' }, existing)).toEqual({
      ok: true,
    })
  })
  it('valida el límite mensual', () => {
    const r = {
      ok: false,
      errors: { monthly_limit_cents: 'El límite debe ser mayor a 0' },
    }
    expect(
      validateCategory({ ...input, monthly_limit_cents: 0 }, existing),
    ).toEqual(r)
    expect(
      validateCategory({ ...input, monthly_limit_cents: -5 }, existing),
    ).toEqual(r)
    expect(
      validateCategory({ ...input, monthly_limit_cents: 100 }, existing),
    ).toEqual({ ok: true })
  })
})

describe('validateTransaction', () => {
  const input = {
    kind: 'expense' as const,
    amount_cents: 1000,
    account_id: 'a1',
    category_id: 'c1',
    date: '2026-11-22',
    note: null,
  }

  it('acepta un movimiento válido, con o sin categoría', () => {
    expect(validateTransaction(input, lookups)).toEqual({ ok: true })
    expect(
      validateTransaction({ ...input, category_id: null }, lookups),
    ).toEqual({ ok: true })
  })
  it('rechaza monto nulo o 0', () => {
    const r = { ok: false, errors: { amount_cents: 'Escribe un monto' } }
    expect(
      validateTransaction({ ...input, amount_cents: null }, lookups),
    ).toEqual(r)
    expect(validateTransaction({ ...input, amount_cents: 0 }, lookups)).toEqual(
      r,
    )
  })
  it('rechaza cuenta ausente o desconocida', () => {
    const r = { ok: false, errors: { account_id: 'Elige una cuenta' } }
    expect(
      validateTransaction({ ...input, account_id: null }, lookups),
    ).toEqual(r)
    expect(
      validateTransaction({ ...input, account_id: 'zzz' }, lookups),
    ).toEqual(r)
  })
  it('rechaza cuenta archivada al crear', () => {
    expect(
      validateTransaction({ ...input, account_id: 'old' }, lookups),
    ).toEqual({
      ok: false,
      errors: { account_id: 'Esa cuenta está archivada' },
    })
  })
  it('permite cuenta archivada al editar si es la original', () => {
    expect(
      validateTransaction(
        { ...input, account_id: 'old', original_account_id: 'old' },
        lookups,
      ),
    ).toEqual({ ok: true })
    expect(
      validateTransaction(
        { ...input, account_id: 'old', original_account_id: 'a1' },
        lookups,
      ),
    ).toEqual({
      ok: false,
      errors: { account_id: 'Esa cuenta está archivada' },
    })
  })
  it('rechaza categoría de otro tipo o desconocida', () => {
    const r = {
      ok: false,
      errors: { category_id: 'La categoría no es del tipo correcto' },
    }
    expect(
      validateTransaction({ ...input, category_id: 'c2' }, lookups),
    ).toEqual(r)
    expect(
      validateTransaction({ ...input, category_id: 'zzz' }, lookups),
    ).toEqual(r)
  })
  it('rechaza fecha inválida', () => {
    expect(
      validateTransaction({ ...input, date: '2026-02-30' }, lookups),
    ).toEqual({ ok: false, errors: { date: 'Elige una fecha válida' } })
  })
  it('rechaza nota de más de 200 caracteres', () => {
    expect(
      validateTransaction({ ...input, note: 'a'.repeat(201) }, lookups),
    ).toEqual({ ok: false, errors: { note: 'Máximo 200 caracteres' } })
    expect(
      validateTransaction({ ...input, note: 'a'.repeat(200) }, lookups),
    ).toEqual({ ok: true })
  })
  it('junta varios errores', () => {
    expect(
      validateTransaction({ ...input, amount_cents: 0, date: 'x' }, lookups),
    ).toEqual({
      ok: false,
      errors: {
        amount_cents: 'Escribe un monto',
        date: 'Elige una fecha válida',
      },
    })
  })
})

describe('validateTransfer', () => {
  const input = {
    amount_cents: 500,
    from_account_id: 'a1',
    to_account_id: 'a2',
    date: '2026-11-22',
    note: null,
  }

  it('acepta una transferencia válida', () => {
    expect(validateTransfer(input, lookups)).toEqual({ ok: true })
  })
  it('rechaza monto nulo o 0', () => {
    expect(validateTransfer({ ...input, amount_cents: 0 }, lookups)).toEqual({
      ok: false,
      errors: { amount_cents: 'Escribe un monto' },
    })
  })
  it('rechaza cuentas ausentes o desconocidas', () => {
    expect(
      validateTransfer({ ...input, from_account_id: null }, lookups),
    ).toEqual({ ok: false, errors: { from_account_id: 'Elige una cuenta' } })
    expect(
      validateTransfer({ ...input, to_account_id: 'zzz' }, lookups),
    ).toEqual({ ok: false, errors: { to_account_id: 'Elige una cuenta' } })
  })
  it('rechaza cuentas iguales', () => {
    expect(
      validateTransfer({ ...input, to_account_id: 'a1' }, lookups),
    ).toEqual({
      ok: false,
      errors: { to_account_id: 'Elige dos cuentas distintas' },
    })
  })
  it('rechaza fecha inválida y nota larga', () => {
    expect(
      validateTransfer(
        { ...input, date: 'hoy', note: 'a'.repeat(201) },
        lookups,
      ),
    ).toEqual({
      ok: false,
      errors: {
        date: 'Elige una fecha válida',
        note: 'Máximo 200 caracteres',
      },
    })
  })
})
