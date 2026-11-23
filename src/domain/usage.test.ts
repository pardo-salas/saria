import { describe, expect, it } from 'vitest'
import type { Account, Category, Transaction, Transfer } from '../db/schema'
import {
  categoriesByUsage,
  defaultAccountId,
  isAccountInUse,
  isCategoryInUse,
  nextPosition,
} from './usage'

const base = {
  user_id: 'u',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
}

function acc(id: string, position: number, archived = false): Account {
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
    position,
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
  position: number,
  opts: Partial<Category> = {},
): Category {
  return {
    ...base,
    id,
    name,
    kind: 'expense',
    icon: null,
    color: null,
    monthly_limit_cents: null,
    archived: false,
    position,
    ...opts,
  }
}

function tx(
  account_id: string,
  created_at: string,
  category_id: string | null = null,
): Transaction {
  return {
    ...base,
    id: `${account_id}-${created_at}-${category_id}`,
    created_at,
    kind: 'expense',
    amount_cents: 100,
    date: '2026-11-01',
    account_id,
    category_id,
    note: null,
    recurring_id: null,
    installment_plan_id: null,
    legacy_id: null,
  }
}

function tr(from: string, to: string, created_at: string): Transfer {
  return {
    ...base,
    id: `${from}-${to}-${created_at}`,
    created_at,
    from_account_id: from,
    to_account_id: to,
    amount_cents: 100,
    date: '2026-11-01',
    note: null,
    legacy_id: null,
  }
}

describe('categoriesByUsage', () => {
  const cats = [
    cat('a', 'Zeta', 0),
    cat('b', 'Beta', 1),
    cat('c', 'Alfa', 1),
    cat('d', 'Archivada', 0, { archived: true }),
    cat('e', 'Ingreso', 0, { kind: 'income' }),
  ]
  it('ordena por conteo, luego position, luego nombre', () => {
    const txs = [tx('x', 't1', 'b'), tx('x', 't2', 'b'), tx('x', 't3', 'a')]
    expect(categoriesByUsage(cats, txs, 'expense').map((c) => c.id)).toEqual([
      'b',
      'a',
      'c',
    ])
  })
  it('sin uso, desempata por position y nombre', () => {
    expect(categoriesByUsage(cats, [], 'expense').map((c) => c.id)).toEqual([
      'a',
      'c',
      'b',
    ])
  })
  it('excluye archivadas y otros tipos', () => {
    const ids = categoriesByUsage(cats, [tx('x', 't', 'd')], 'expense').map(
      (c) => c.id,
    )
    expect(ids).not.toContain('d')
    expect(ids).not.toContain('e')
  })
})

describe('defaultAccountId', () => {
  const accounts = [acc('b', 1), acc('a', 0), acc('arch', 2, true)]
  it('devuelve null sin cuentas', () => {
    expect(defaultAccountId([], [], [])).toBeNull()
  })
  it('cae a la primera no archivada por position', () => {
    expect(defaultAccountId(accounts, [], [])).toBe('a')
    expect(defaultAccountId([acc('z', 0, true)], [], [])).toBeNull()
  })
  it('usa la cuenta del movimiento más reciente', () => {
    const txs = [
      tx('a', '2026-11-01T00:00:00Z'),
      tx('b', '2026-11-02T00:00:00Z'),
    ]
    expect(defaultAccountId(accounts, txs, [])).toBe('b')
  })
  it('una transferencia más reciente gana sobre un movimiento más viejo', () => {
    const txs = [tx('a', '2026-11-01T00:00:00Z')]
    const trs = [tr('b', 'a', '2026-11-05T00:00:00Z')]
    expect(defaultAccountId(accounts, txs, trs)).toBe('b')
  })
  it('salta cuentas archivadas o inexistentes', () => {
    const txs = [
      tx('ghost', '2026-11-09T00:00:00Z'),
      tx('arch', '2026-11-08T00:00:00Z'),
      tx('b', '2026-11-02T00:00:00Z'),
    ]
    expect(defaultAccountId(accounts, txs, [])).toBe('b')
  })
})

describe('reglas de uso', () => {
  it('isAccountInUse con solo una transferencia', () => {
    const trs = [tr('a', 'b', 't')]
    expect(isAccountInUse('a', [], trs)).toBe(true)
    expect(isAccountInUse('b', [], trs)).toBe(true)
    expect(isAccountInUse('c', [], trs)).toBe(false)
  })
  it('isAccountInUse con un movimiento', () => {
    expect(isAccountInUse('a', [tx('a', 't')], [])).toBe(true)
  })
  it('isCategoryInUse', () => {
    expect(isCategoryInUse('c', [tx('a', 't', 'c')])).toBe(true)
    expect(isCategoryInUse('c', [tx('a', 't', null)])).toBe(false)
  })
  it('nextPosition', () => {
    expect(nextPosition([])).toBe(0)
    expect(
      nextPosition([{ position: 0 }, { position: 4 }, { position: 2 }]),
    ).toBe(5)
  })
})
