import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { SessionValueProvider } from '../app/SessionProvider'
import { db } from './dexie'
import { useFinance, useLiveRows, useSettings } from './queries'
import { repo } from './repo'
import type { Account, Settings } from './schema'

const wrapper = ({ children }: { children: ReactNode }) => (
  <SessionValueProvider
    value={{ gate: 'signed-in', userId: 'u1', signOut: async () => {} }}
  >
    {children}
  </SessionValueProvider>
)

const T = '2026-01-01T00:00:00.000Z'
const acct = (o: Partial<Account> & { id: string }): Account => ({
  user_id: 'u1',
  created_at: T,
  updated_at: T,
  deleted_at: null,
  name: o.id,
  type: 'debit',
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
  ...o,
})

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('useLiveRows', () => {
  it('excluye filas borradas y de otro usuario, y refleja altas nuevas', async () => {
    await db.accounts.bulkPut([
      acct({ id: 'a1' }),
      acct({ id: 'a2', deleted_at: T }),
      acct({ id: 'a3', user_id: 'u2' }),
    ])
    const { result } = renderHook(() => useLiveRows('accounts'), { wrapper })
    await waitFor(() => expect(result.current).toBeDefined())
    expect(result.current!.map((a) => a.id)).toEqual(['a1'])

    await repo.put('accounts', { ...acct({ id: 'x' }), id: undefined })
    await waitFor(() => expect(result.current).toHaveLength(2))
  })
})

describe('useSettings', () => {
  it('devuelve null si no existe y la fila si existe', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper })
    await waitFor(() => expect(result.current).toBeNull())
    const row: Settings = {
      id: 'u1',
      user_id: 'u1',
      created_at: T,
      updated_at: T,
      deleted_at: null,
      monthly_income_cents: null,
      pay_frequency: null,
      currency: 'MXN',
      theme: 'system',
    }
    await db.settings.put(row)
    await waitFor(() => expect(result.current).toEqual(row))
  })
})

describe('useFinance', () => {
  it('calcula el saldo de una cuenta con un gasto', async () => {
    await db.accounts.put(acct({ id: 'a1', initial_balance_cents: 10000 }))
    await db.transactions.put({
      id: 't1',
      user_id: 'u1',
      created_at: T,
      updated_at: T,
      deleted_at: null,
      kind: 'expense',
      amount_cents: 2500,
      date: '2026-01-02',
      account_id: 'a1',
      category_id: null,
      note: null,
      recurring_id: null,
      installment_plan_id: null,
      legacy_id: null,
    })
    const { result } = renderHook(() => useFinance(), { wrapper })
    await waitFor(() => expect(result.current).toBeDefined())
    expect(result.current!.balances.get('a1')).toBe(7500)
    expect(result.current!.feed).toHaveLength(1)
    expect(result.current!.lookups.accounts.get('a1')?.id).toBe('a1')
  })
})
