import type { ReactNode } from 'react'
import { SessionValueProvider } from '../../app/SessionProvider'
import { ToastProvider } from '../../ui/Toast'
import type { Account, Category, Transaction, Transfer } from '../../db/schema'

const T = '2026-01-01T00:00:00.000Z'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionValueProvider
      value={{ gate: 'signed-in', userId: 'u1', signOut: async () => {} }}
    >
      <ToastProvider>{children}</ToastProvider>
    </SessionValueProvider>
  )
}

const base = { user_id: 'u1', created_at: T, updated_at: T, deleted_at: null }

export const acct = (o: Partial<Account> & { id: string }): Account => ({
  ...base,
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

export const cat = (o: Partial<Category> & { id: string }): Category => ({
  ...base,
  name: o.id,
  kind: 'expense',
  icon: null,
  color: null,
  monthly_limit_cents: null,
  archived: false,
  position: 0,
  ...o,
})

export const tx = (o: Partial<Transaction> & { id: string }): Transaction => ({
  ...base,
  kind: 'expense',
  amount_cents: 1000,
  date: '2026-03-10',
  account_id: 'a1',
  category_id: null,
  note: null,
  recurring_id: null,
  installment_plan_id: null,
  legacy_id: null,
  ...o,
})

export const xfer = (o: Partial<Transfer> & { id: string }): Transfer => ({
  ...base,
  from_account_id: 'a1',
  to_account_id: 'a2',
  amount_cents: 5000,
  date: '2026-03-10',
  note: null,
  legacy_id: null,
  ...o,
})
