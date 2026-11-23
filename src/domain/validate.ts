import type { Category } from '../db/schema'
import { isValidDate } from './dates'
import { normalizeText, type Lookups } from './search'

export type Validation<F extends string> =
  { ok: true } | { ok: false; errors: Partial<Record<F, string>> }

function result<F extends string>(
  errors: Partial<Record<F, string>>,
): Validation<F> {
  return Object.keys(errors).length === 0 ? { ok: true } : { ok: false, errors }
}

/** Devuelve el error del nombre (recortado) o undefined si es válido. */
function nameError(name: string): string | undefined {
  const trimmed = name.trim()
  if (trimmed.length === 0) return 'Escribe un nombre'
  if (trimmed.length > 40) return 'Máximo 40 caracteres'
  return undefined
}

function noteError(note: string | null): string | undefined {
  return note !== null && note.length > 200
    ? 'Máximo 200 caracteres'
    : undefined
}

function amountError(amount: number | null): string | undefined {
  return amount === null || amount <= 0 ? 'Escribe un monto' : undefined
}

export function validateAccount(input: { name: string }): Validation<'name'> {
  const name = nameError(input.name)
  return result<'name'>(name ? { name } : {})
}

export function validateCategory(
  input: {
    id?: string
    name: string
    kind: Category['kind']
    monthly_limit_cents: number | null
  },
  existing: Category[],
): Validation<'name' | 'monthly_limit_cents'> {
  const errors: Partial<Record<'name' | 'monthly_limit_cents', string>> = {}

  const name = nameError(input.name)
  if (name) {
    errors.name = name
  } else {
    // Duplicado: mismo tipo, mismo nombre normalizado, distinta fila.
    const wanted = normalizeText(input.name)
    const duplicate = existing.some(
      (c) =>
        c.id !== input.id &&
        c.kind === input.kind &&
        normalizeText(c.name) === wanted,
    )
    if (duplicate) errors.name = 'Ya tienes una categoría con ese nombre'
  }

  if (input.monthly_limit_cents !== null && input.monthly_limit_cents <= 0) {
    errors.monthly_limit_cents = 'El límite debe ser mayor a 0'
  }
  return result(errors)
}

export function validateTransaction(
  input: {
    id?: string
    kind: Category['kind']
    amount_cents: number | null
    account_id: string | null
    category_id: string | null
    date: string
    note: string | null
    /** Cuenta que tenía el movimiento al abrir la edición. */
    original_account_id?: string
  },
  lookups: Lookups,
): Validation<'amount_cents' | 'account_id' | 'category_id' | 'date' | 'note'> {
  const errors: Partial<
    Record<
      'amount_cents' | 'account_id' | 'category_id' | 'date' | 'note',
      string
    >
  > = {}

  const amount = amountError(input.amount_cents)
  if (amount) errors.amount_cents = amount

  const account =
    input.account_id === null
      ? undefined
      : lookups.accounts.get(input.account_id)
  if (!account) {
    errors.account_id = 'Elige una cuenta'
  } else if (account.archived && account.id !== input.original_account_id) {
    // Al editar se conserva la cuenta archivada original; al crear no.
    errors.account_id = 'Esa cuenta está archivada'
  }

  if (input.category_id !== null) {
    const category = lookups.categories.get(input.category_id)
    if (!category || category.kind !== input.kind) {
      errors.category_id = 'La categoría no es del tipo correcto'
    }
  }

  if (!isValidDate(input.date)) errors.date = 'Elige una fecha válida'

  const note = noteError(input.note)
  if (note) errors.note = note

  return result(errors)
}

export function validateTransfer(
  input: {
    amount_cents: number | null
    from_account_id: string | null
    to_account_id: string | null
    date: string
    note: string | null
  },
  lookups: Lookups,
): Validation<
  'amount_cents' | 'from_account_id' | 'to_account_id' | 'date' | 'note'
> {
  const errors: Partial<
    Record<
      'amount_cents' | 'from_account_id' | 'to_account_id' | 'date' | 'note',
      string
    >
  > = {}

  const amount = amountError(input.amount_cents)
  if (amount) errors.amount_cents = amount

  const known = (id: string | null) => id !== null && lookups.accounts.has(id)
  if (!known(input.from_account_id)) errors.from_account_id = 'Elige una cuenta'
  if (!known(input.to_account_id)) {
    errors.to_account_id = 'Elige una cuenta'
  } else if (input.from_account_id === input.to_account_id) {
    errors.to_account_id = 'Elige dos cuentas distintas'
  }

  if (!isValidDate(input.date)) errors.date = 'Elige una fecha válida'

  const note = noteError(input.note)
  if (note) errors.note = note

  return result(errors)
}
