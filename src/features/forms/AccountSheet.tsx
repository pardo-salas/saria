import { useRef, useState } from 'react'
import { useFinance } from '../../db/queries'
import { repo, type NewRow } from '../../db/repo'
import type { Account } from '../../db/schema'
import { colorAt } from '../../domain/catalog'
import { formatCents } from '../../domain/money'
import { isAccountInUse, nextPosition } from '../../domain/usage'
import { validateAccount } from '../../domain/validate'
import { AmountInput } from '../../ui/AmountInput'
import { Button } from '../../ui/Button'
import { Segmented } from '../../ui/Segmented'
import { Sheet } from '../../ui/Sheet'
import { TextField } from '../../ui/TextField'
import { useToast } from '../../ui/Toast'
import { ColorPicker, ConfirmStep, IconPicker } from './pickers'

export interface AccountSheetProps {
  open: boolean
  onClose(): void
  account?: Account
}

const TYPES: { value: Account['type']; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'debit', label: 'Débito' },
  { value: 'credit', label: 'Crédito' },
  { value: 'investment', label: 'Inversión' },
]

/** Los campos de la fila sin los metadatos de sincronización. */
function rowOf(a: Account): NewRow<'accounts'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user_id, created_at, updated_at, deleted_at, ...fields } = a
  return fields
}

export function AccountSheet({ open, onClose, account }: AccountSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={account ? 'Editar cuenta' : 'Nueva cuenta'}
    >
      {/* Sheet no monta a sus hijos cerrada: el formulario nace limpio en cada apertura. */}
      <AccountForm onClose={onClose} account={account} />
    </Sheet>
  )
}

type Sign = 'pos' | 'neg'
type Pending = 'archive' | 'delete' | null

function AccountForm({
  onClose,
  account,
}: {
  onClose(): void
  account?: Account
}) {
  const finance = useFinance()
  const toast = useToast()
  const [name, setName] = useState(account?.name ?? '')
  const [type, setType] = useState<Account['type']>(account?.type ?? 'debit')
  const [balance, setBalance] = useState<number | null>(
    account ? Math.abs(account.initial_balance_cents) : null,
  )
  const [inTotal, setInTotal] = useState(account?.include_in_total ?? true)
  // Una cuenta existente conserva su icono y color (aunque sean null).
  const [icon, setIcon] = useState<string | null>(
    account ? account.icon : 'cartera',
  )
  const [color, setColor] = useState<string | null>(
    account ? account.color : colorAt(0),
  )
  // El monto se captura siempre en positivo; el signo se elige aparte.
  const [sign, setSign] = useState<Sign>(
    account && account.initial_balance_cents < 0 ? 'neg' : 'pos',
  )
  const [balanceValid, setBalanceValid] = useState(true)
  const balanceRef = useRef<HTMLInputElement>(null)
  const inFlight = useRef(false)
  const [nameError, setNameError] = useState<string>()
  const [pending, setPending] = useState<Pending>(null)
  const [busy, setBusy] = useState(false)

  const inUse = account
    ? isAccountInUse(
        account.id,
        finance?.transactions ?? [],
        finance?.transfers ?? [],
      )
    : false
  const currentBalance = account ? (finance?.balances.get(account.id) ?? 0) : 0

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
      setPending(null)
      toast.show({ message: 'No se pudo guardar. Intenta de nuevo' })
    }
  }

  // Al pasar de o a crédito el sentido vuelve a su valor natural: crédito debe
  // (negativo), cualquier otro tipo a favor (positivo). Entre tipos que no son
  // crédito se conserva lo elegido.
  function changeType(next: Account['type']) {
    if ((next === 'credit') !== (type === 'credit')) {
      setSign(next === 'credit' ? 'neg' : 'pos')
    }
    setType(next)
  }

  function save() {
    const result = validateAccount({ name })
    if (!result.ok) {
      setNameError(result.errors.name)
      return
    }
    setNameError(undefined)
    if (!balanceValid) {
      balanceRef.current?.focus()
      return
    }
    const cents = balance ?? 0
    void run(async () => {
      await repo.put('accounts', {
        ...(account ? rowOf(account) : emptyFields()),
        id: account?.id,
        name: name.trim(),
        type,
        initial_balance_cents: sign === 'neg' ? -cents : cents,
        include_in_total: inTotal,
        icon,
        color,
        position: account?.position ?? nextPosition(finance?.accounts ?? []),
      })
    }, 'Cuenta guardada')
  }

  function setArchived(archived: boolean) {
    if (!account) return
    void run(
      async () => {
        await repo.put('accounts', { ...rowOf(account), archived })
      },
      archived ? 'Cuenta archivada' : 'Cuenta desarchivada',
    )
  }

  function remove() {
    if (!account) return
    void run(() => repo.softDelete('accounts', account.id), 'Cuenta borrada')
  }

  function askArchive() {
    if (currentBalance !== 0) setPending('archive')
    else setArchived(true)
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
      <TextField
        label="Nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={nameError}
        autoComplete="off"
        maxLength={60}
      />
      <Segmented<Account['type']>
        label="Tipo de cuenta"
        options={TYPES}
        value={type}
        onChange={changeType}
      />
      <Segmented<Sign>
        label="Sentido del saldo inicial"
        options={
          type === 'credit'
            ? [
                { value: 'neg', label: 'Debes' },
                { value: 'pos', label: 'A favor' },
              ]
            : [
                { value: 'pos', label: 'A favor' },
                { value: 'neg', label: 'En contra' },
              ]
        }
        value={sign}
        onChange={setSign}
      />
      <AmountInput
        label="Saldo inicial"
        valueCents={balance}
        onChange={setBalance}
        onValidityChange={setBalanceValid}
        inputRef={balanceRef}
      />
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base text-texto">
        <input
          type="checkbox"
          checked={inTotal}
          onChange={(e) => setInTotal(e.target.checked)}
          className="size-5 accent-cobalto"
        />
        Contar en el saldo total
      </label>
      <IconPicker value={icon} onChange={setIcon} color={color} />
      <ColorPicker value={color} onChange={setColor} />

      {pending === 'archive' && (
        <ConfirmStep
          message={`Esta cuenta tiene saldo de ${formatCents(currentBalance)}; al archivarla deja de contar en el total`}
          confirmLabel="Sí, archivar"
          danger={false}
          busy={busy}
          onConfirm={() => setArchived(true)}
          onCancel={() => setPending(null)}
        />
      )}
      {pending === 'delete' && (
        <ConfirmStep
          message="¿Borrar esta cuenta?"
          confirmLabel="Sí, borrar"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setPending(null)}
        />
      )}

      {pending === null && (
        <div className="flex flex-col gap-2">
          <Button
            variant="primaria"
            type="submit"
            loading={busy}
            disabled={!finance}
          >
            Guardar
          </Button>
          {account && (
            <>
              {account.archived ? (
                <Button
                  variant="secundaria"
                  disabled={busy}
                  onClick={() => setArchived(false)}
                >
                  Desarchivar
                </Button>
              ) : (
                <Button
                  variant="secundaria"
                  disabled={busy}
                  onClick={askArchive}
                >
                  Archivar
                </Button>
              )}
              {inUse ? (
                <p className="text-sm text-texto-suave">
                  Tiene movimientos: puedes archivarla
                </p>
              ) : (
                <Button
                  variant="fantasma"
                  disabled={busy}
                  onClick={() => setPending('delete')}
                >
                  Borrar
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </form>
  )
}

function emptyFields(): NewRow<'accounts'> {
  return {
    name: '',
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
  }
}
