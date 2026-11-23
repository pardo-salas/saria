import { useState } from 'react'
import { useFinance, useToday } from '../../db/queries'
import { repo } from '../../db/repo'
import type { Transaction } from '../../db/schema'
import { categoriesByUsage, defaultAccountId } from '../../domain/usage'
import { validateTransaction } from '../../domain/validate'
import { AmountInput } from '../../ui/AmountInput'
import { Button } from '../../ui/Button'
import { Segmented } from '../../ui/Segmented'
import { Sheet } from '../../ui/Sheet'
import { TextField } from '../../ui/TextField'
import { useToast } from '../../ui/Toast'
import {
  AccountPicker,
  CategoryPicker,
  ConfirmStep,
  DateField,
  selectableAccounts,
} from './pickers'

type Defaults = Partial<
  Pick<
    Transaction,
    'kind' | 'amount_cents' | 'account_id' | 'category_id' | 'date' | 'note'
  >
>

export interface TransactionSheetProps {
  open: boolean
  onClose(): void
  transaction?: Transaction
  defaults?: Defaults
}

export function TransactionSheet({
  open,
  onClose,
  transaction,
  defaults,
}: TransactionSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={transaction ? 'Editar movimiento' : 'Nuevo movimiento'}
    >
      {/* Sheet no monta a sus hijos cerrada: el formulario nace limpio en cada apertura. */}
      <TransactionForm
        onClose={onClose}
        transaction={transaction}
        defaults={defaults}
      />
    </Sheet>
  )
}

type Errors = Partial<
  Record<
    'amount_cents' | 'account_id' | 'category_id' | 'date' | 'note',
    string
  >
>

function TransactionForm({
  onClose,
  transaction,
  defaults,
}: Omit<TransactionSheetProps, 'open'>) {
  const finance = useFinance()
  const today = useToday()
  const toast = useToast()
  const source = transaction ?? defaults
  const [kind, setKind] = useState<Transaction['kind']>(
    source?.kind ?? 'expense',
  )
  const [amount, setAmount] = useState<number | null>(
    source?.amount_cents ?? null,
  )
  const [accountId, setAccountId] = useState<string | null>(
    source?.account_id ?? null,
  )
  const [accountTouched, setAccountTouched] = useState(false)
  const [categoryId, setCategoryId] = useState<string | null>(
    source?.category_id ?? null,
  )
  const [date, setDate] = useState(source?.date ?? today)
  const [note, setNote] = useState(source?.note ?? '')
  const [errors, setErrors] = useState<Errors>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  // Sin cuenta elegida se propone la de uso más reciente.
  const shownAccountId =
    accountId ??
    (accountTouched || !finance
      ? null
      : defaultAccountId(
          finance.accounts,
          finance.transactions,
          finance.transfers,
        ))

  const accounts = selectableAccounts(finance?.accounts ?? [], [
    transaction?.account_id,
    shownAccountId,
  ])
  const categories = categoriesByUsage(
    (finance?.categories ?? []).filter(
      (c) => !c.archived || c.id === categoryId,
    ),
    finance?.transactions ?? [],
    kind,
  )
  // categoriesByUsage descarta archivadas; la actual archivada se agrega aparte.
  const current = finance?.categories.find((c) => c.id === categoryId)
  if (current && current.kind === kind && !categories.includes(current)) {
    categories.push(current)
  }

  async function run(action: () => Promise<void>, done: string) {
    setBusy(true)
    try {
      await action()
      toast.show({ message: done })
      onClose()
    } catch {
      setBusy(false)
      setConfirmDelete(false)
      toast.show({ message: 'No se pudo guardar. Intenta de nuevo' })
    }
  }

  function save() {
    if (!finance) return
    const cleanNote = note.trim() === '' ? null : note.trim()
    const result = validateTransaction(
      {
        id: transaction?.id,
        kind,
        amount_cents: amount,
        account_id: shownAccountId,
        category_id: categoryId,
        date,
        note: cleanNote,
        original_account_id: transaction?.account_id,
      },
      finance.lookups,
    )
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    void run(async () => {
      await repo.put('transactions', {
        id: transaction?.id,
        kind,
        amount_cents: amount!,
        date,
        account_id: shownAccountId!,
        category_id: categoryId,
        note: cleanNote,
        recurring_id: transaction?.recurring_id ?? null,
        installment_plan_id: transaction?.installment_plan_id ?? null,
        legacy_id: transaction?.legacy_id ?? null,
      })
    }, 'Movimiento guardado')
  }

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <Segmented
        label="Tipo de movimiento"
        options={[
          { value: 'expense', label: 'Gasto' },
          { value: 'income', label: 'Ingreso' },
        ]}
        value={kind}
        onChange={(next) => {
          setKind(next)
          // La categoría es del tipo: al cambiarlo se pierde.
          setCategoryId(null)
        }}
      />
      <AmountInput
        label="Monto"
        valueCents={amount}
        onChange={setAmount}
        error={errors.amount_cents}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- el monto es lo primero que se captura
        autoFocus={!transaction}
      />
      <CategoryPicker
        categories={categories}
        value={categoryId}
        onChange={setCategoryId}
        error={errors.category_id}
      />
      <AccountPicker
        accounts={accounts}
        value={shownAccountId}
        onChange={(id) => {
          setAccountTouched(true)
          setAccountId(id)
        }}
        error={errors.account_id}
      />
      <DateField value={date} onChange={setDate} error={errors.date} />
      <TextField
        label="Nota"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        error={errors.note}
        autoComplete="off"
      />
      {confirmDelete ? (
        <ConfirmStep
          message="¿Borrar este movimiento?"
          confirmLabel="Sí, borrar"
          busy={busy}
          onConfirm={() =>
            void run(
              () => repo.softDelete('transactions', transaction!.id),
              'Movimiento borrado',
            )
          }
          onCancel={() => setConfirmDelete(false)}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <Button variant="primaria" type="submit" loading={busy}>
            Guardar
          </Button>
          {transaction && (
            <Button variant="fantasma" onClick={() => setConfirmDelete(true)}>
              Borrar
            </Button>
          )}
        </div>
      )}
    </form>
  )
}
