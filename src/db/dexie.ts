import Dexie, { type Table } from 'dexie'
import type {
  Account,
  Category,
  InstallmentPlan,
  OutboxEntry,
  RecurringPayment,
  Reminder,
  Settings,
  SyncState,
  Transaction,
  Transfer,
} from './schema'

export class SariaDB extends Dexie {
  accounts!: Table<Account, string>
  categories!: Table<Category, string>
  transactions!: Table<Transaction, string>
  transfers!: Table<Transfer, string>
  recurring_payments!: Table<RecurringPayment, string>
  reminders!: Table<Reminder, string>
  installment_plans!: Table<InstallmentPlan, string>
  settings!: Table<Settings, string>
  outbox!: Table<OutboxEntry, number>
  sync_state!: Table<SyncState, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      accounts: 'id, updated_at',
      categories: 'id, updated_at',
      transactions: 'id, updated_at, date, [account_id+date], legacy_id',
      transfers:
        'id, updated_at, date, from_account_id, to_account_id, legacy_id',
      recurring_payments: 'id, updated_at',
      reminders: 'id, updated_at',
      installment_plans: 'id, updated_at',
      settings: 'id, updated_at',
      outbox: '++seq, table, row_id',
      sync_state: 'table',
    })
  }
}

export function createDb(name = 'saria'): SariaDB {
  return new SariaDB(name)
}

export const db = createDb()
