// Fuente de verdad del esquema (spec §6.2). La migración SQL (Task 4) debe
// coincidir con COLUMNS mediante una prueba de paridad.
// Montos *_cents: enteros en centavos. Fechas de calendario: 'YYYY-MM-DD'.
// Horas: 'HH:mm'. Timestamps: ISO 8601 en UTC.

export type SyncedTableName =
  | 'accounts'
  | 'categories'
  | 'transactions'
  | 'transfers'
  | 'recurring_payments'
  | 'reminders'
  | 'installment_plans'
  | 'settings'

export interface SyncedRow {
  id: string
  user_id: string
  created_at: string
  updated_at: string
  /** Nulo si la fila está viva. */
  deleted_at: string | null
}

export type Frequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'semimonthly'
  | 'monthly'
  | 'yearly'
  | 'custom'

export interface Account extends SyncedRow {
  name: string
  type: 'cash' | 'debit' | 'credit' | 'investment'
  institution: string | null
  color: string | null
  icon: string | null
  /** Puede ser negativo (deuda de tarjeta). */
  initial_balance_cents: number
  include_in_total: boolean
  archived: boolean
  position: number
  credit_limit_cents: number | null
  statement_day: number | null
  due_day: number | null
  /** Porcentaje anual. */
  yield_rate: number | null
  yield_cap_cents: number | null
  yield_rate_over_cap: number | null
}

export interface Category extends SyncedRow {
  name: string
  kind: 'income' | 'expense'
  icon: string | null
  color: string | null
  monthly_limit_cents: number | null
  archived: boolean
  position: number
}

export interface Transaction extends SyncedRow {
  kind: 'income' | 'expense'
  /** Positivo; el signo lo da `kind`. */
  amount_cents: number
  date: string
  account_id: string
  category_id: string | null
  note: string | null
  recurring_id: string | null
  installment_plan_id: string | null
  legacy_id: string | null
}

export interface Transfer extends SyncedRow {
  from_account_id: string
  to_account_id: string
  amount_cents: number
  date: string
  note: string | null
  legacy_id: string | null
}

export interface RecurringPayment extends SyncedRow {
  name: string
  kind: 'income' | 'expense'
  amount_cents: number
  account_id: string | null
  category_id: string | null
  frequency: Frequency
  day_of_month: number | null
  /** Solo para 'semimonthly'. */
  second_day_of_month: number | null
  /** Solo para 'custom'. */
  interval_days: number | null
  start_date: string | null
  end_date: string | null
  next_due_date: string | null
  auto_create: boolean
  active: boolean
}

export interface Reminder extends SyncedRow {
  title: string
  text: string | null
  time: string | null
  frequency: Frequency | null
  second_day_of_month: number | null
  interval_days: number | null
  start_date: string | null
  enabled: boolean
  recurring_id: string | null
}

export interface InstallmentPlan extends SyncedRow {
  concept: string
  account_id: string | null
  purchase_date: string
  total_cents: number
  months: number
  monthly_cents: number
  paid_months: number
  active: boolean
}

/** Una fila por usuario; el repo fuerza `id === user_id`. */
export interface Settings extends SyncedRow {
  monthly_income_cents: number | null
  pay_frequency: 'monthly' | 'semimonthly' | 'biweekly' | null
  currency: 'MXN'
  theme: 'system' | 'light' | 'dark'
}

interface RowMap {
  accounts: Account
  categories: Category
  transactions: Transaction
  transfers: Transfer
  recurring_payments: RecurringPayment
  reminders: Reminder
  installment_plans: InstallmentPlan
  settings: Settings
}

export type RowOf<T extends SyncedTableName> = RowMap[T]

// Cada mapa debe tener exactamente las claves de la interfaz (falta o sobra
// una columna = error de compilación). El orden de las claves es el orden de
// COLUMNS, que sigue la migración SQL.
type ColumnMap<R> = { [K in keyof R]-?: true }

const common: ColumnMap<SyncedRow> = {
  id: true,
  user_id: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
}

const columnMaps: { [T in SyncedTableName]: ColumnMap<RowOf<T>> } = {
  accounts: {
    ...common,
    name: true,
    type: true,
    institution: true,
    color: true,
    icon: true,
    initial_balance_cents: true,
    include_in_total: true,
    archived: true,
    position: true,
    credit_limit_cents: true,
    statement_day: true,
    due_day: true,
    yield_rate: true,
    yield_cap_cents: true,
    yield_rate_over_cap: true,
  },
  categories: {
    ...common,
    name: true,
    kind: true,
    icon: true,
    color: true,
    monthly_limit_cents: true,
    archived: true,
    position: true,
  },
  transactions: {
    ...common,
    kind: true,
    amount_cents: true,
    date: true,
    account_id: true,
    category_id: true,
    note: true,
    recurring_id: true,
    installment_plan_id: true,
    legacy_id: true,
  },
  transfers: {
    ...common,
    from_account_id: true,
    to_account_id: true,
    amount_cents: true,
    date: true,
    note: true,
    legacy_id: true,
  },
  recurring_payments: {
    ...common,
    name: true,
    kind: true,
    amount_cents: true,
    account_id: true,
    category_id: true,
    frequency: true,
    day_of_month: true,
    second_day_of_month: true,
    interval_days: true,
    start_date: true,
    end_date: true,
    next_due_date: true,
    auto_create: true,
    active: true,
  },
  reminders: {
    ...common,
    title: true,
    text: true,
    time: true,
    frequency: true,
    second_day_of_month: true,
    interval_days: true,
    start_date: true,
    enabled: true,
    recurring_id: true,
  },
  installment_plans: {
    ...common,
    concept: true,
    account_id: true,
    purchase_date: true,
    total_cents: true,
    months: true,
    monthly_cents: true,
    paid_months: true,
    active: true,
  },
  settings: {
    ...common,
    monthly_income_cents: true,
    pay_frequency: true,
    currency: true,
    theme: true,
  },
}

export const COLUMNS: Record<SyncedTableName, readonly string[]> =
  Object.fromEntries(
    Object.entries(columnMaps).map(([table, map]) => [table, Object.keys(map)]),
  ) as unknown as Record<SyncedTableName, readonly string[]>

export interface OutboxEntry {
  seq?: number
  table: SyncedTableName
  row_id: string
  op: 'upsert' | 'delete'
  payload: SyncedRow
  created_at: string
  attempts: number
}

export interface SyncState {
  table: SyncedTableName
  last_pulled_at: string | null
}
