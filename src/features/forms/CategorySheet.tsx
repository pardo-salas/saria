import { useRef, useState } from 'react'
import { useFinance } from '../../db/queries'
import { repo, type NewRow } from '../../db/repo'
import type { Category } from '../../db/schema'
import { colorAt } from '../../domain/catalog'
import { isCategoryInUse, nextPosition } from '../../domain/usage'
import { validateCategory } from '../../domain/validate'
import { AmountInput } from '../../ui/AmountInput'
import { Button } from '../../ui/Button'
import { Segmented } from '../../ui/Segmented'
import { Sheet } from '../../ui/Sheet'
import { TextField } from '../../ui/TextField'
import { useToast } from '../../ui/Toast'
import { ColorPicker, ConfirmStep, IconPicker } from './pickers'

export interface CategorySheetProps {
  open: boolean
  onClose(): void
  kind: 'income' | 'expense'
  category?: Category
}

function rowOf(c: Category): NewRow<'categories'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user_id, created_at, updated_at, deleted_at, ...fields } = c
  return fields
}

export function CategorySheet({
  open,
  onClose,
  kind,
  category,
}: CategorySheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={category ? 'Editar categoría' : 'Nueva categoría'}
    >
      {/* Sheet no monta a sus hijos cerrada: el formulario nace limpio en cada apertura. */}
      <CategoryForm onClose={onClose} kind={kind} category={category} />
    </Sheet>
  )
}

function CategoryForm({
  onClose,
  kind: initialKind,
  category,
}: Omit<CategorySheetProps, 'open'>) {
  const finance = useFinance()
  const toast = useToast()
  const [name, setName] = useState(category?.name ?? '')
  const [kind, setKind] = useState(category?.kind ?? initialKind)
  const [limit, setLimit] = useState<number | null>(
    category?.monthly_limit_cents ?? null,
  )
  // Una categoría existente conserva su icono y color (aunque sean null).
  const [icon, setIcon] = useState<string | null>(
    category ? category.icon : 'otros',
  )
  const [color, setColor] = useState<string | null>(
    category ? category.color : colorAt(0),
  )
  const [limitValid, setLimitValid] = useState(true)
  const limitRef = useRef<HTMLInputElement>(null)
  const inFlight = useRef(false)
  const [errors, setErrors] = useState<{ name?: string; limit?: string }>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  const inUse = category
    ? isCategoryInUse(category.id, finance?.transactions ?? [])
    : false

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
    const limitBlocked = kind === 'expense' && !limitValid
    const monthly = kind === 'expense' ? limit : null
    const result = validateCategory(
      { id: category?.id, name, kind, monthly_limit_cents: monthly },
      (finance?.categories ?? []).filter((c) => c.id !== category?.id),
    )
    if (!result.ok) {
      setErrors({
        name: result.errors.name,
        limit: result.errors.monthly_limit_cents,
      })
      // El texto inválido del límite lo explica el propio campo; solo se le da el foco.
      if (limitBlocked) limitRef.current?.focus()
      return
    }
    setErrors({})
    if (limitBlocked) {
      limitRef.current?.focus()
      return
    }
    void run(async () => {
      await repo.put('categories', {
        ...(category ? rowOf(category) : null),
        id: category?.id,
        name: name.trim(),
        kind,
        icon,
        color,
        monthly_limit_cents: monthly,
        archived: category?.archived ?? false,
        position: category?.position ?? nextPosition(finance?.categories ?? []),
      })
    }, 'Categoría guardada')
  }

  function setArchived(archived: boolean) {
    if (!category) return
    void run(
      async () => {
        await repo.put('categories', { ...rowOf(category), archived })
      },
      archived ? 'Categoría archivada' : 'Categoría desarchivada',
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
        maxLength={60}
      />
      {category && !inUse && (
        <Segmented<Category['kind']>
          label="Tipo"
          options={[
            { value: 'expense', label: 'Gasto' },
            { value: 'income', label: 'Ingreso' },
          ]}
          value={kind}
          onChange={(next) => {
            setKind(next)
            // El campo del límite se desmonta al salir de gasto y vuelve vacío.
            setLimitValid(true)
          }}
        />
      )}
      {kind === 'expense' && (
        <div>
          <AmountInput
            label="Límite mensual (opcional)"
            valueCents={limit}
            onChange={setLimit}
            error={errors.limit}
            onValidityChange={setLimitValid}
            inputRef={limitRef}
          />
        </div>
      )}
      <IconPicker value={icon} onChange={setIcon} color={color} />
      <ColorPicker value={color} onChange={setColor} />

      {confirmDelete ? (
        <ConfirmStep
          message="¿Borrar esta categoría?"
          confirmLabel="Sí, borrar"
          busy={busy}
          onConfirm={() =>
            void run(
              () => repo.softDelete('categories', category!.id),
              'Categoría borrada',
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
          {category && (
            <>
              <Button
                variant="secundaria"
                disabled={busy}
                onClick={() => setArchived(!category.archived)}
              >
                {category.archived ? 'Desarchivar' : 'Archivar'}
              </Button>
              {inUse ? (
                <p className="text-sm text-texto-suave">
                  Tiene movimientos: puedes archivarla
                </p>
              ) : (
                <Button
                  variant="fantasma"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
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
