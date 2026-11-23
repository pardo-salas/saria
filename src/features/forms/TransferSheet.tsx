import { useRef, useState } from 'react'
import { useFinance, useToday } from '../../db/queries'
import { repo } from '../../db/repo'
import type { Transfer } from '../../db/schema'
import { defaultAccountId } from '../../domain/usage'
import { validateTransfer } from '../../domain/validate'
import { AmountInput } from '../../ui/AmountInput'
import { Button } from '../../ui/Button'
import { Sheet } from '../../ui/Sheet'
import { TextField } from '../../ui/TextField'
import { useToast } from '../../ui/Toast'
import {
  AccountPicker,
  ConfirmStep,
  DateField,
  selectableAccounts,
} from './pickers'

export interface TransferValue {
  amount_cents: number | null
  from_account_id: string | null
  to_account_id: string | null
  date: string
  note: string
}

export type TransferErrors = Partial<Record<keyof TransferValue, string>>

/**
 * Campos de una transferencia (monto, De, A, fecha, nota); los comparte la hoja
 * de transferencia y la hoja rápida. El estado vive en quien lo usa.
 */
export function TransferFields({
  value,
  onChange,
  errors,
  autoFocus,
}: {
  value: TransferValue
  onChange(next: TransferValue): void
  errors: TransferErrors
  autoFocus?: boolean
}) {
  const finance = useFinance()
  const accounts = selectableAccounts(finance?.accounts ?? [], [
    value.from_account_id,
    value.to_account_id,
  ])
  const set = (patch: Partial<TransferValue>) =>
    onChange({ ...value, ...patch })
  return (
    <>
      <AmountInput
        label="Monto"
        valueCents={value.amount_cents}
        onChange={(amount_cents) => set({ amount_cents })}
        error={errors.amount_cents}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- lo decide quien arma la pantalla
        autoFocus={autoFocus}
      />
      <AccountPicker
        label="De"
        accounts={accounts}
        value={value.from_account_id}
        onChange={(from_account_id) => set({ from_account_id })}
        error={errors.from_account_id}
      />
      <AccountPicker
        label="A"
        accounts={accounts}
        value={value.to_account_id}
        onChange={(to_account_id) => set({ to_account_id })}
        error={errors.to_account_id}
      />
      <DateField
        value={value.date}
        onChange={(date) => set({ date })}
        error={errors.date}
      />
      <TextField
        label="Nota"
        value={value.note}
        onChange={(e) => set({ note: e.target.value })}
        error={errors.note}
        autoComplete="off"
      />
    </>
  )
}

export interface TransferSheetProps {
  open: boolean
  onClose(): void
  transfer?: Transfer
}

export function TransferSheet({ open, onClose, transfer }: TransferSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={transfer ? 'Editar transferencia' : 'Nueva transferencia'}
    >
      {/* Sheet no monta a sus hijos cerrada: el formulario nace limpio en cada apertura. */}
      <TransferForm onClose={onClose} transfer={transfer} />
    </Sheet>
  )
}

function TransferForm({
  onClose,
  transfer,
}: {
  onClose(): void
  transfer?: Transfer
}) {
  const finance = useFinance()
  const today = useToday()
  const toast = useToast()
  const [value, setValue] = useState<TransferValue>(() => ({
    amount_cents: transfer?.amount_cents ?? null,
    from_account_id: transfer?.from_account_id ?? null,
    to_account_id: transfer?.to_account_id ?? null,
    date: transfer?.date ?? today,
    note: transfer?.note ?? '',
  }))
  const [errors, setErrors] = useState<TransferErrors>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  // Sin elegir nada, "De" arranca con la cuenta de la última transferencia o movimiento.
  const defaultFrom =
    transfer || !finance
      ? null
      : defaultAccountId(
          finance.accounts,
          finance.transactions,
          finance.transfers,
        )
  const [fromTouched, setFromTouched] = useState(false)
  const shown: TransferValue =
    !fromTouched && value.from_account_id === null
      ? { ...value, from_account_id: defaultFrom }
      : value

  const inFlight = useRef(false)

  async function run(action: () => Promise<void>, done: string) {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    try {
      await action()
      toast.show({ message: done })
      onClose()
    } catch {
      inFlight.current = false
      setBusy(false)
      setConfirmDelete(false)
      toast.show({ message: 'No se pudo guardar. Intenta de nuevo' })
    }
  }

  function save() {
    if (!finance) return
    const result = validateTransfer(
      {
        amount_cents: shown.amount_cents,
        from_account_id: shown.from_account_id,
        to_account_id: shown.to_account_id,
        date: shown.date,
        note: shown.note.trim() === '' ? null : shown.note.trim(),
      },
      finance.lookups,
    )
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    void run(async () => {
      await repo.put('transfers', {
        id: transfer?.id,
        from_account_id: shown.from_account_id!,
        to_account_id: shown.to_account_id!,
        amount_cents: shown.amount_cents!,
        date: shown.date,
        note: shown.note.trim() === '' ? null : shown.note.trim(),
        legacy_id: transfer?.legacy_id ?? null,
      })
    }, 'Transferencia guardada')
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
      <TransferFields
        value={shown}
        onChange={(next) => {
          setFromTouched(true)
          setValue(next)
        }}
        errors={errors}
      />
      {confirmDelete ? (
        <ConfirmStep
          message="¿Borrar esta transferencia?"
          confirmLabel="Sí, borrar"
          busy={busy}
          onConfirm={() =>
            void run(
              () => repo.softDelete('transfers', transfer!.id),
              'Transferencia borrada',
            )
          }
          onCancel={() => setConfirmDelete(false)}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            variant="primaria"
            type="submit"
            loading={busy}
            disabled={!finance}
          >
            Guardar
          </Button>
          {transfer && (
            <Button
              variant="fantasma"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
            >
              Borrar
            </Button>
          )}
        </div>
      )}
    </form>
  )
}
