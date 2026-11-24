import { useRef, useState } from 'react'
import { useFinance } from '@/db/queries'
import { markPaid } from '@/db/recurring'
import type { RecurringPayment } from '@/db/schema'
import { isValidDate } from '@/domain/dates'
import { AmountInput } from '@/ui/AmountInput'
import { Button } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'
import { useToast } from '@/ui/Toast'
import {
  AccountPicker,
  CategoryPicker,
  DateField,
  selectableAccounts,
} from '../forms/pickers'

export function PayDueSheet({
  open,
  onClose,
  payment,
}: {
  open: boolean
  onClose(): void
  payment: RecurringPayment | null
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Registrar pago">
      {/* Sheet no monta a sus hijos cerrada: el formulario nace limpio en cada apertura. */}
      {payment && <PayForm payment={payment} onClose={onClose} />}
    </Sheet>
  )
}

function PayForm({
  payment,
  onClose,
}: {
  payment: RecurringPayment
  onClose(): void
}) {
  const finance = useFinance()
  const toast = useToast()
  const [amount, setAmount] = useState<number | null>(payment.amount_cents)
  const [accountId, setAccountId] = useState<string | null>(payment.account_id)
  const [categoryId, setCategoryId] = useState<string | null>(
    payment.category_id,
  )
  const [date, setDate] = useState(payment.next_due_date ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)

  const accounts = selectableAccounts(finance?.accounts ?? [], [accountId])
  const categories = (finance?.categories ?? []).filter(
    (c) => c.kind === payment.kind && (!c.archived || c.id === categoryId),
  )

  async function save() {
    if (inFlight.current || !finance) return
    const next: Record<string, string> = {}
    if (amount === null || amount <= 0)
      next.amount = 'Escribe un monto mayor a 0'
    if (accountId === null) next.account = 'Elige la cuenta del pago'
    if (!isValidDate(date)) next.date = 'Elige una fecha válida'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    inFlight.current = true
    setBusy(true)
    try {
      await markPaid(payment, {
        amount_cents: amount!,
        account_id: accountId!,
        category_id: categoryId,
        date,
        note: null,
      })
      toast.show({ message: 'Pago registrado' })
      onClose()
    } catch {
      inFlight.current = false
      setBusy(false)
      toast.show({ message: 'No se pudo guardar. Intenta de nuevo' })
    }
  }

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <p className="-mt-2 text-texto-suave">{payment.name}</p>
      <AmountInput
        label="Monto"
        valueCents={amount}
        onChange={setAmount}
        error={errors.amount}
      />
      <CategoryPicker
        categories={categories}
        value={categoryId}
        onChange={setCategoryId}
      />
      <AccountPicker
        accounts={accounts}
        value={accountId}
        onChange={setAccountId}
        error={errors.account}
      />
      <DateField value={date} onChange={setDate} error={errors.date} />
      <Button variant="primaria" type="submit" loading={busy}>
        Registrar pago
      </Button>
    </form>
  )
}
