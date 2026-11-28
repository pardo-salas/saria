import { useId, useRef, useState } from 'react'
import { useFinance, useToday } from '@/db/queries'
import { repo } from '@/db/repo'
import type { Frequency, RecurringPayment } from '@/db/schema'
import { isValidDate } from '@/domain/dates'
import { nextOccurrence } from '@/domain/recurring'
import { AmountInput } from '@/ui/AmountInput'
import { Button } from '@/ui/Button'
import { Segmented } from '@/ui/Segmented'
import { Sheet } from '@/ui/Sheet'
import { TextField } from '@/ui/TextField'
import { useToast } from '@/ui/Toast'
import {
  AccountPicker,
  CategoryPicker,
  ConfirmStep,
  DateField,
  selectableAccounts,
} from '../forms/pickers'
import { FREQUENCY_OPTIONS, shiftDay } from './labels'

export function RecurringSheet({
  open,
  onClose,
  payment,
}: {
  open: boolean
  onClose(): void
  payment?: RecurringPayment
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={payment ? 'Editar pago habitual' : 'Nuevo pago habitual'}
    >
      {/* Sheet no monta a sus hijos cerrada: el formulario nace limpio en cada apertura. */}
      <RecurringForm payment={payment} onClose={onClose} />
    </Sheet>
  )
}

type Errors = Partial<
  Record<
    'name' | 'amount' | 'day' | 'day2' | 'interval' | 'start' | 'end',
    string
  >
>

function parseInt1(text: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(text.trim())) return null
  const n = Number(text)
  return n >= min && n <= max ? n : null
}

function RecurringForm({
  payment,
  onClose,
}: {
  payment?: RecurringPayment
  onClose(): void
}) {
  const finance = useFinance()
  const today = useToday()
  const toast = useToast()
  const selectId = useId()
  const [name, setName] = useState(payment?.name ?? '')
  const [kind, setKind] = useState<RecurringPayment['kind']>(
    payment?.kind ?? 'expense',
  )
  const [amount, setAmount] = useState<number | null>(
    payment?.amount_cents ?? null,
  )
  const [accountId, setAccountId] = useState<string | null>(
    payment?.account_id ?? null,
  )
  const [categoryId, setCategoryId] = useState<string | null>(
    payment?.category_id ?? null,
  )
  const [frequency, setFrequency] = useState<Frequency>(
    payment?.frequency ?? 'monthly',
  )
  const [day, setDay] = useState(String(payment?.day_of_month ?? ''))
  const [day2, setDay2] = useState(String(payment?.second_day_of_month ?? ''))
  const [interval, setInterval] = useState(String(payment?.interval_days ?? ''))
  const [start, setStart] = useState(
    payment ? (payment.start_date ?? '') : today,
  )
  const [end, setEnd] = useState(payment?.end_date ?? '')
  const [autoCreate, setAutoCreate] = useState(payment?.auto_create ?? false)
  const [active, setActive] = useState(payment?.active ?? true)
  const [errors, setErrors] = useState<Errors>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)

  const accounts = selectableAccounts(finance?.accounts ?? [], [
    payment?.account_id,
    accountId,
  ])
  const categories = (finance?.categories ?? []).filter(
    (c) => c.kind === kind && (!c.archived || c.id === categoryId),
  )

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

  const needsDay = frequency === 'monthly' || frequency === 'semimonthly'

  function save() {
    if (!finance) return
    const next: Errors = {}
    if (name.trim() === '') next.name = 'Escribe un nombre'
    if (amount === null || amount <= 0)
      next.amount = 'Escribe un monto mayor a 0'
    const dayN = needsDay ? parseInt1(day, 1, 31) : null
    if (needsDay && dayN === null) next.day = 'Escribe un día del 1 al 31'
    const day2N = frequency === 'semimonthly' ? parseInt1(day2, 1, 31) : null
    if (frequency === 'semimonthly' && day2N === null)
      next.day2 = 'Escribe un día del 1 al 31'
    const intervalN =
      frequency === 'custom' ? parseInt1(interval, 1, 3650) : null
    if (frequency === 'custom' && intervalN === null)
      next.interval = 'Escribe cada cuántos días (1 o más)'
    const startNeeded = !['daily', 'monthly', 'semimonthly'].includes(frequency)
    if (start === '' ? startNeeded : !isValidDate(start))
      next.start = 'Elige una fecha de inicio válida'
    if (end !== '' && !isValidDate(end)) next.end = 'Elige una fecha válida'
    else if (end !== '' && start !== '' && isValidDate(start) && end < start)
      next.end = 'La fecha de fin no puede ser antes del inicio'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const draft = {
      name: name.trim(),
      kind,
      amount_cents: amount!,
      account_id: accountId,
      category_id: categoryId,
      frequency,
      day_of_month: needsDay ? dayN : null,
      second_day_of_month: frequency === 'semimonthly' ? day2N : null,
      interval_days: frequency === 'custom' ? intervalN : null,
      start_date: start === '' ? null : start,
      end_date: end === '' ? null : end,
      auto_create: autoCreate,
      active,
    }
    const scheduleChanged =
      !payment ||
      payment.frequency !== draft.frequency ||
      payment.day_of_month !== draft.day_of_month ||
      payment.second_day_of_month !== draft.second_day_of_month ||
      payment.interval_days !== draft.interval_days ||
      payment.start_date !== draft.start_date ||
      payment.end_date !== draft.end_date ||
      (!payment.active && draft.active) ||
      (payment.next_due_date === null && draft.active)
    let nextDue = payment?.next_due_date ?? null
    if (scheduleChanged) {
      // Primera ocurrencia >= max(inicio, hoy).
      const from = start !== '' && start > today ? start : today
      nextDue = nextOccurrence(
        { ...(payment ?? ({} as RecurringPayment)), ...draft },
        shiftDay(from, -1),
      )
    }
    void run(
      async () => {
        await repo.put('recurring_payments', {
          id: payment?.id,
          ...draft,
          next_due_date: nextDue,
          active: draft.active && nextDue !== null,
        })
      },
      payment ? 'Pago habitual guardado' : 'Pago habitual creado',
    )
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
        error={errors.name}
        autoComplete="off"
      />
      <Segmented
        label="Tipo de pago"
        options={[
          { value: 'expense', label: 'Gasto' },
          { value: 'income', label: 'Ingreso' },
        ]}
        value={kind}
        onChange={(next) => {
          setKind(next)
          setCategoryId(null)
        }}
      />
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
      <div>
        <AccountPicker
          label="Cuenta (opcional)"
          accounts={accounts}
          value={accountId}
          onChange={setAccountId}
          showFunds={false}
        />
        {accountId !== null && (
          <button
            type="button"
            onClick={() => setAccountId(null)}
            className="mt-1 min-h-11 cursor-pointer text-sm font-medium text-agua"
          >
            Quitar cuenta
          </button>
        )}
      </div>
      <div>
        <label htmlFor={selectId} className="text-etiqueta text-texto-suave">
          Frecuencia
        </label>
        <select
          id={selectId}
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as Frequency)}
          className="mt-1.5 block min-h-12 w-full rounded-boton bg-superficie-2 px-4 text-base text-texto"
        >
          {FREQUENCY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {needsDay && (
        <TextField
          label={
            frequency === 'semimonthly' ? 'Primer día del mes' : 'Día del mes'
          }
          inputMode="numeric"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          error={errors.day}
          hint="Si el mes es más corto, cae en su último día."
        />
      )}
      {frequency === 'semimonthly' && (
        <TextField
          label="Segundo día del mes"
          inputMode="numeric"
          value={day2}
          onChange={(e) => setDay2(e.target.value)}
          error={errors.day2}
        />
      )}
      {frequency === 'custom' && (
        <TextField
          label="Cada cuántos días"
          inputMode="numeric"
          value={interval}
          onChange={(e) => setInterval(e.target.value)}
          error={errors.interval}
        />
      )}
      <DateField
        label="Fecha de inicio"
        value={start}
        onChange={setStart}
        error={errors.start}
      />
      <div>
        <DateField
          label="Fecha de fin (opcional)"
          value={end}
          onChange={setEnd}
          error={errors.end}
        />
        {end !== '' && (
          <button
            type="button"
            onClick={() => setEnd('')}
            className="mt-1 min-h-11 cursor-pointer text-sm font-medium text-agua"
          >
            Quitar fecha de fin
          </button>
        )}
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={autoCreate}
          onChange={(e) => setAutoCreate(e.target.checked)}
          className="size-5 accent-cobalto"
        />
        <span>Crear el movimiento automáticamente</span>
      </label>
      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="size-5 accent-cobalto"
        />
        <span>Activo</span>
      </label>
      {confirmDelete ? (
        <ConfirmStep
          message="¿Borrar este pago habitual? Los movimientos ya creados se conservan."
          confirmLabel="Sí, borrar"
          busy={busy}
          onConfirm={() =>
            void run(
              () => repo.softDelete('recurring_payments', payment!.id),
              'Pago habitual borrado',
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
          {payment && (
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
