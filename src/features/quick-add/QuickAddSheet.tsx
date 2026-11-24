import { useRef, useState } from 'react'
import { useFinance, useToday } from '@/db/queries'
import { repo } from '@/db/repo'
import type { Category, Transaction } from '@/db/schema'
import type { IconName } from '@/domain/catalog'
import { formatDayLabel } from '@/domain/dates'
import { formatCents } from '@/domain/money'
import { categoriesByUsage, defaultAccountId } from '@/domain/usage'
import { validateTransaction, validateTransfer } from '@/domain/validate'
import { AccountSheet } from '@/features/forms/AccountSheet'
import {
  AccountPicker,
  DateField,
  FieldError,
  selectableAccounts,
} from '@/features/forms/pickers'
import { TransactionSheet } from '@/features/forms/TransactionSheet'
import {
  TransferFields,
  type TransferErrors,
  type TransferValue,
} from '@/features/forms/TransferSheet'
import { AmountInput } from '@/ui/AmountInput'
import { AppIcon } from '@/ui/AppIcon'
import { Button } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { Segmented } from '@/ui/Segmented'
import { Sheet } from '@/ui/Sheet'
import { TextField } from '@/ui/TextField'
import { useToast } from '@/ui/Toast'

type Kind = 'expense' | 'income' | 'transfer'
type Defaults = Partial<
  Pick<
    Transaction,
    'kind' | 'amount_cents' | 'account_id' | 'category_id' | 'date' | 'note'
  >
>

const VISIBLE_CATEGORIES = 7

export interface QuickAddSheetProps {
  open: boolean
  onClose(): void
  accountId?: string
  initialKind?: Kind
}

/**
 * Registro rápido (§5.1): monto, toca una categoría y queda guardado. Sheet no
 * monta a sus hijos cerrada, así que el formulario nace limpio en cada apertura.
 */
export function QuickAddSheet({
  open,
  onClose,
  accountId,
  initialKind,
}: QuickAddSheetProps) {
  const [accountOpen, setAccountOpen] = useState(false)
  const [moreDefaults, setMoreDefaults] = useState<Defaults | null>(null)

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Registrar movimiento">
        <QuickForm
          onClose={onClose}
          accountId={accountId}
          initialKind={initialKind}
          onNeedAccount={() => {
            onClose()
            setAccountOpen(true)
          }}
          onMore={(defaults) => {
            onClose()
            setMoreDefaults(defaults)
          }}
        />
      </Sheet>
      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} />
      <TransactionSheet
        open={moreDefaults !== null}
        onClose={() => setMoreDefaults(null)}
        defaults={moreDefaults ?? undefined}
      />
    </>
  )
}

function QuickForm({
  onClose,
  accountId,
  initialKind,
  onNeedAccount,
  onMore,
}: {
  onClose(): void
  accountId?: string
  initialKind?: Kind
  onNeedAccount(): void
  onMore(defaults: Defaults): void
}) {
  const finance = useFinance()
  const today = useToday()
  const toast = useToast()
  const [kind, setKind] = useState<Kind>(initialKind ?? 'expense')
  const [amount, setAmount] = useState<number | null>(null)
  const [account, setAccount] = useState<string | null>(accountId ?? null)
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [panel, setPanel] = useState<'account' | 'date' | 'note' | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [errors, setErrors] = useState<{ amount?: string; account?: string }>(
    {},
  )
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  const amountRef = useRef<HTMLInputElement>(null)

  const defaultAccount = finance
    ? defaultAccountId(
        finance.accounts,
        finance.transactions,
        finance.transfers,
      )
    : null
  const shownAccount = account ?? defaultAccount
  const accounts = selectableAccounts(finance?.accounts ?? [], [shownAccount])
  const accountName = accounts.find((a) => a.id === shownAccount)?.name

  const [transfer, setTransfer] = useState<TransferValue>({
    amount_cents: null,
    from_account_id: account,
    to_account_id: null,
    date: today,
    note: '',
  })
  const [transferErrors, setTransferErrors] = useState<TransferErrors>({})
  const [fromTouched, setFromTouched] = useState(false)
  const shownTransfer: TransferValue =
    !fromTouched && transfer.from_account_id === null
      ? { ...transfer, from_account_id: defaultAccount }
      : transfer

  async function persist(
    action: () => Promise<{ undo(): Promise<void> }>,
    message: string,
  ) {
    inFlight.current = true
    setSaving(true)
    try {
      const { undo } = await action()
      toast.show({
        message,
        actionLabel: 'Deshacer',
        onAction: () => void undo(),
      })
      onClose()
    } catch {
      inFlight.current = false
      setSaving(false)
      toast.show({ message: 'No se pudo guardar. Intenta de nuevo' })
    }
  }

  function cleanNote() {
    return note.trim() === '' ? null : note.trim()
  }

  function saveWith(category: Category) {
    if (inFlight.current || !finance || kind === 'transfer') return
    const result = validateTransaction(
      {
        kind,
        amount_cents: amount,
        account_id: shownAccount,
        category_id: category.id,
        date,
        note: cleanNote(),
      },
      finance.lookups,
    )
    if (!result.ok) {
      setErrors({
        amount: result.errors.amount_cents,
        account: result.errors.account_id ?? result.errors.date,
      })
      if (result.errors.amount_cents) amountRef.current?.focus()
      return
    }
    setErrors({})
    inFlight.current = true
    void persist(
      async () => {
        const saved = await repo.put('transactions', {
          kind,
          amount_cents: amount!,
          date,
          account_id: shownAccount!,
          category_id: category.id,
          note: cleanNote(),
          recurring_id: null,
          installment_plan_id: null,
          legacy_id: null,
        })
        return { undo: () => repo.softDelete('transactions', saved.id) }
      },
      kind === 'income' ? 'Ingreso guardado' : 'Gasto guardado',
    )
  }

  function saveTransfer() {
    if (inFlight.current || !finance) return
    const v = shownTransfer
    const text = v.note.trim() === '' ? null : v.note.trim()
    const result = validateTransfer(
      {
        amount_cents: v.amount_cents,
        from_account_id: v.from_account_id,
        to_account_id: v.to_account_id,
        date: v.date,
        note: text,
      },
      finance.lookups,
    )
    if (!result.ok) {
      setTransferErrors(result.errors)
      return
    }
    setTransferErrors({})
    inFlight.current = true
    void persist(async () => {
      const saved = await repo.put('transfers', {
        from_account_id: v.from_account_id!,
        to_account_id: v.to_account_id!,
        amount_cents: v.amount_cents!,
        date: v.date,
        note: text,
        legacy_id: null,
      })
      return { undo: () => repo.softDelete('transfers', saved.id) }
    }, 'Transferencia guardada')
  }

  if (finance && accounts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-lg font-semibold">Primero crea una cuenta</p>
        <p className="text-sm text-texto-suave">
          Necesitas una cuenta para registrar tus movimientos.
        </p>
        <Button variant="primaria" onClick={onNeedAccount}>
          Crear cuenta
        </Button>
      </div>
    )
  }

  const categories = categoriesByUsage(
    finance?.categories ?? [],
    finance?.transactions ?? [],
    kind === 'income' ? 'income' : 'expense',
  )
  const shown = expanded ? categories : categories.slice(0, VISIBLE_CATEGORIES)
  const hasMore = categories.length > VISIBLE_CATEGORIES
  const verb = kind === 'income' ? 'ingreso' : 'gasto'
  const togglePanel = (p: 'account' | 'date' | 'note') =>
    setPanel((cur) => (cur === p ? null : p))

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Tipo de movimiento"
        options={[
          { value: 'expense', label: 'Gasto' },
          { value: 'income', label: 'Ingreso' },
          { value: 'transfer', label: 'Transferir' },
        ]}
        value={kind}
        onChange={(next) => {
          setKind(next)
          setExpanded(false)
          setErrors({})
        }}
      />

      {kind === 'transfer' ? (
        <form
          className="flex flex-col gap-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            saveTransfer()
          }}
        >
          <TransferFields
            value={shownTransfer}
            onChange={(next) => {
              setFromTouched(true)
              setTransfer(next)
            }}
            errors={transferErrors}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- el monto es lo primero que se captura
            autoFocus
          />
          <Button variant="primaria" type="submit" loading={saving}>
            Transferir
          </Button>
        </form>
      ) : (
        <>
          <AmountInput
            label="Monto"
            valueCents={amount}
            onChange={setAmount}
            error={errors.amount}
            inputRef={amountRef}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- el monto es lo primero que se captura
            autoFocus
          />

          <div className="flex flex-wrap gap-2">
            <Chip
              label={`${accountName ?? 'Cuenta'} ▾`}
              selected={panel === 'account'}
              onClick={() => togglePanel('account')}
            />
            <Chip
              label={`${formatDayLabel(date, today)} ▾`}
              selected={panel === 'date'}
              onClick={() => togglePanel('date')}
            />
            <Chip
              label={note.trim() === '' ? 'Nota' : `Nota: ${note.trim()}`}
              selected={panel === 'note'}
              onClick={() => togglePanel('note')}
            />
          </div>
          {panel === 'account' && (
            <AccountPicker
              accounts={accounts}
              value={shownAccount}
              onChange={(id) => {
                setAccount(id)
                setPanel(null)
              }}
            />
          )}
          {panel === 'date' && <DateField value={date} onChange={setDate} />}
          {panel === 'note' && (
            <TextField
              label="Nota"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              autoComplete="off"
            />
          )}
          <FieldError message={errors.account} />

          <p className="text-sm text-texto-suave">
            Toca la categoría para guardar
          </p>
          <div className="grid grid-cols-4 gap-2">
            {shown.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={saving}
                aria-label={
                  amount !== null && amount > 0
                    ? `Guardar ${verb} de ${formatCents(amount)} en ${c.name}`
                    : `Guardar ${verb} en ${c.name}`
                }
                onClick={() => saveWith(c)}
                className="flex min-h-[4.5rem] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-boton bg-superficie-2 px-1 py-2 text-xs font-medium text-texto outline-foco focus-visible:outline-2 focus-visible:outline-offset-2 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <AppIcon name={c.icon as IconName | null} color={c.color} />
                <span className="w-full truncate text-center">{c.name}</span>
              </button>
            ))}
            {hasMore && (
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded((e) => !e)}
                className="flex min-h-[4.5rem] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-boton border border-dashed border-borde px-1 py-2 text-xs font-medium text-texto-suave outline-foco focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <span aria-hidden="true" className="text-xl leading-none">
                  {expanded ? '−' : '+'}
                </span>
                {expanded ? 'Menos' : 'Más'}
              </button>
            )}
          </div>

          <Button
            variant="fantasma"
            disabled={saving}
            onClick={() =>
              onMore({
                kind,
                amount_cents: amount ?? undefined,
                account_id: shownAccount ?? undefined,
                date,
                note: cleanNote(),
              })
            }
          >
            Más opciones
          </Button>
        </>
      )}
    </div>
  )
}
