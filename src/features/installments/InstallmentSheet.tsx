import { useRef, useState } from 'react'
import { useFinance, useToday } from '@/db/queries'
import { repo } from '@/db/repo'
import type { InstallmentPlan } from '@/db/schema'
import { isValidDate } from '@/domain/dates'
import { AmountInput } from '@/ui/AmountInput'
import { Button } from '@/ui/Button'
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

export function InstallmentSheet({
  open,
  onClose,
  plan,
}: {
  open: boolean
  onClose(): void
  plan?: InstallmentPlan
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={plan ? 'Editar compra a meses' : 'Nueva compra a meses'}
    >
      {/* Sheet no monta a sus hijos cerrada: el formulario nace limpio en cada apertura. */}
      <InstallmentForm plan={plan} onClose={onClose} />
    </Sheet>
  )
}

type Errors = Partial<
  Record<
    'concept' | 'account' | 'date' | 'total' | 'months' | 'monthly' | 'paid',
    string
  >
>

function parseWhole(text: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(text.trim())) return null
  const n = Number(text)
  return n >= min && n <= max ? n : null
}

function InstallmentForm({
  plan,
  onClose,
}: {
  plan?: InstallmentPlan
  onClose(): void
}) {
  const finance = useFinance()
  const today = useToday()
  const toast = useToast()
  const [concept, setConcept] = useState(plan?.concept ?? '')
  const [accountId, setAccountId] = useState<string | null>(
    plan?.account_id ?? null,
  )
  const [categoryId, setCategoryId] = useState<string | null>(
    plan?.category_id ?? null,
  )
  const [date, setDate] = useState(plan?.purchase_date ?? today)
  const [total, setTotal] = useState<number | null>(plan?.total_cents ?? null)
  const [months, setMonths] = useState(plan ? String(plan.months) : '')
  // El pago real sigue a total / meses hasta que se edita a mano.
  const [monthly, setMonthly] = useState<number | null>(
    plan?.monthly_cents ?? null,
  )
  const [monthlyTouched, setMonthlyTouched] = useState(plan !== undefined)
  const [paid, setPaid] = useState(plan ? String(plan.paid_months) : '0')
  // Un plan terminado se ve como terminado, no como pausado.
  const [paused, setPaused] = useState(
    plan ? !plan.active && plan.paid_months < plan.months : false,
  )
  const [errors, setErrors] = useState<Errors>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)

  const monthsN = parseWhole(months, 1, 120)
  const suggested =
    total !== null && total > 0 && monthsN !== null
      ? Math.round(total / monthsN)
      : null
  const monthlyShown = monthlyTouched ? monthly : suggested

  const accounts = selectableAccounts(finance?.accounts ?? [], [
    plan?.account_id,
    accountId,
  ])
  const categories = (finance?.categories ?? []).filter(
    (c) => c.kind === 'expense' && (!c.archived || c.id === categoryId),
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

  function save() {
    if (!finance) return
    const next: Errors = {}
    if (concept.trim() === '') next.concept = 'Escribe qué compraste'
    if (accountId === null && !paused)
      next.account = 'Elige una tarjeta o cuenta'
    if (!isValidDate(date)) next.date = 'Elige una fecha de compra válida'
    if (total === null || total <= 0) next.total = 'Escribe un total mayor a 0'
    if (monthsN === null) next.months = 'Escribe de 1 a 120 meses'
    if (monthlyShown === null || monthlyShown <= 0)
      next.monthly = 'Escribe un pago mensual mayor a 0'
    const paidN = parseWhole(paid, 0, monthsN ?? 120)
    if (paidN === null)
      next.paid = 'Escribe cuántos meses ya pagaste (de 0 hasta el total)'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    void run(
      async () => {
        await repo.put('installment_plans', {
          id: plan?.id,
          concept: concept.trim(),
          account_id: accountId,
          category_id: categoryId,
          purchase_date: date,
          total_cents: total!,
          months: monthsN!,
          monthly_cents: monthlyShown!,
          paid_months: paidN!,
          active: !paused && paidN! < monthsN!,
        })
      },
      plan ? 'Compra guardada' : 'Compra creada',
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
        label="Concepto"
        value={concept}
        onChange={(e) => setConcept(e.target.value)}
        error={errors.concept}
        autoComplete="off"
        maxLength={80}
      />
      <AccountPicker
        label="Tarjeta o cuenta"
        accounts={accounts}
        value={accountId}
        onChange={setAccountId}
        error={errors.account}
      />
      <CategoryPicker
        categories={categories}
        value={categoryId}
        onChange={setCategoryId}
      />
      <DateField
        label="Fecha de compra"
        value={date}
        onChange={setDate}
        error={errors.date}
      />
      <AmountInput
        label="Total"
        valueCents={total}
        onChange={setTotal}
        error={errors.total}
      />
      <TextField
        label="Meses"
        inputMode="numeric"
        value={months}
        onChange={(e) => setMonths(e.target.value)}
        error={errors.months}
      />
      <AmountInput
        label="Pago real por mes"
        valueCents={monthlyShown}
        onChange={(c) => {
          setMonthly(c)
          setMonthlyTouched(true)
        }}
        error={errors.monthly}
      />
      <TextField
        label="Meses ya pagados"
        inputMode="numeric"
        value={paid}
        onChange={(e) => setPaid(e.target.value)}
        error={errors.paid}
        hint="Los que pagaste antes de usar Saria. Los cargos nuevos se crean solos."
      />
      <label className="flex min-h-11 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={paused}
          onChange={(e) => setPaused(e.target.checked)}
          className="mt-3 size-5 accent-cobalto"
        />
        <span className="py-2">
          Compra pausada
          <span className="block text-sm text-texto-suave">
            No genera cargos ni cuenta en el disponible
          </span>
        </span>
      </label>
      {confirmDelete ? (
        <ConfirmStep
          message="¿Borrar esta compra? Los movimientos ya creados se conservan."
          confirmLabel="Sí, borrar"
          busy={busy}
          onConfirm={() =>
            void run(
              () => repo.softDelete('installment_plans', plan!.id),
              'Compra borrada',
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
          {plan && (
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
