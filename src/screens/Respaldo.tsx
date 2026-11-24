import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { useSessionContext } from '@/app/SessionProvider'
import { useTheme } from '@/app/ThemeProvider'
import { downloadJson } from '@/app/download'
import { db } from '@/db/dexie'
import { readLiveTables, restoreBackup } from '@/db/backup'
import { useToday } from '@/db/queries'
import { repo } from '@/db/repo'
import { addRecurringPayments } from '@/db/recurringFile'
import { applyExcelFile } from '@/db/excelFile'
import {
  backupFileName,
  buildBackup,
  parseBackup,
  type Backup,
} from '@/domain/backup'
import { TIME_ZONE } from '@/domain/dates'
import {
  excelPreview,
  parseExcelFile,
  type ExcelFile,
} from '@/domain/excelFile'
import { parseRecurringFile, type RecurringRow } from '@/domain/recurringFile'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { Sheet } from '@/ui/Sheet'
import { useToast } from '@/ui/Toast'
import { TabScreen } from './TabScreen'

interface Pending {
  backup: Backup
  preview: string
}

type PendingFile =
  | { kind: 'recurring'; rows: RecurringRow[]; preview: string }
  | { kind: 'excel'; file: ExcelFile; preview: string }

/** Formato declarado por el archivo, o null si no es un JSON de Saria. */
function fileFormat(text: string): string | null {
  try {
    const data: unknown = JSON.parse(text)
    if (typeof data === 'object' && data !== null && 'format' in data)
      return String((data as { format: unknown }).format)
  } catch {
    /* no es JSON */
  }
  return null
}

function formatExported(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'long',
    timeZone: TIME_ZONE,
  }).format(date)
}

export function Respaldo() {
  const { userId } = useSessionContext()
  const { setPref } = useTheme()
  const toast = useToast()
  const today = useToday()
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const paymentsInput = useRef<HTMLInputElement>(null)
  const [paymentsError, setPaymentsError] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)

  async function currentBackup(id: string) {
    return buildBackup(await readLiveTables(db, id), new Date().toISOString())
  }

  async function exportAll() {
    if (userId === null) return
    setError(null)
    try {
      downloadJson(backupFileName(today), await currentBackup(userId))
    } catch {
      setError('No se pudo exportar el respaldo. Intenta de nuevo.')
    }
  }

  async function pick(file: File | undefined) {
    if (!file) return
    setError(null)
    let text: string
    try {
      text = await file.text()
    } catch {
      setError('No se pudo leer el archivo')
      return
    }
    const result = parseBackup(text)
    if (!result.ok) {
      setError(result.error)
      return
    }
    const c = result.counts
    setPending({
      backup: result.backup,
      preview: `Este respaldo tiene ${c.accounts} cuentas, ${c.categories} categorías, ${c.transactions} movimientos y ${c.transfers} transferencias (exportado el ${formatExported(result.backup.exported_at)})`,
    })
  }

  async function confirm() {
    if (!pending || userId === null) return
    setBusy(true)
    try {
      // Antes de reemplazar, se descarga un respaldo de lo que hay ahora.
      downloadJson(backupFileName(today), await currentBackup(userId))
      await restoreBackup(db, repo, userId, pending.backup)
      const theme = pending.backup.tables.settings[0]?.theme
      if (theme) setPref(theme)
      setPending(null)
      toast.show({ message: 'Respaldo restaurado' })
    } catch {
      setPending(null)
      setError('No se pudo restaurar el respaldo. No se cambió nada.')
    } finally {
      setBusy(false)
    }
  }

  async function pickPayments(file: File | undefined) {
    if (!file) return
    setPaymentsError(null)
    let text: string
    try {
      text = await file.text()
    } catch {
      setPaymentsError('No se pudo leer el archivo')
      return
    }
    const [accounts, categories, payments] = await Promise.all([
      db.accounts.toArray(),
      db.categories.toArray(),
      db.recurring_payments.toArray(),
    ])
    const live = (rows: { id: string; deleted_at: string | null }[]) =>
      new Set(rows.filter((r) => r.deleted_at === null).map((r) => r.id))
    const format = fileFormat(text)
    if (format === 'saria-excel') {
      const result = parseExcelFile(text, {
        accountIds: live(accounts),
        categoryIds: live(categories),
      })
      if (!result.ok) {
        setPaymentsError(result.error)
        return
      }
      setPendingFile({
        kind: 'excel',
        file: result.file,
        preview: excelPreview(result.file),
      })
      return
    }
    const result = parseRecurringFile(
      text,
      { accountIds: live(accounts), categoryIds: live(categories) },
      new Set(payments.map((p) => p.id)),
    )
    if (!result.ok) {
      setPaymentsError(result.error)
      return
    }
    setPendingFile({
      kind: 'recurring',
      rows: result.rows,
      preview: `Se agregarán ${result.nuevos} pagos habituales (${result.existentes} ya existen y se actualizarán)`,
    })
  }

  async function confirmPayments() {
    if (!pendingFile) return
    setBusy(true)
    try {
      if (pendingFile.kind === 'excel') await applyExcelFile(pendingFile.file)
      else await addRecurringPayments(repo, pendingFile.rows)
      setPendingFile(null)
      toast.show({ message: 'Datos agregados' })
    } catch {
      setPendingFile(null)
      setPaymentsError('No se pudieron agregar los datos. No se cambió nada.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <TabScreen title="Respaldo">
      <Link
        to="/mas"
        className="mb-2 -ml-2 inline-flex min-h-11 items-center px-2 text-sm font-medium text-agua"
      >
        ‹ Más
      </Link>
      <div className="flex flex-col gap-3">
        <Card>
          <p className="font-semibold">Exportar respaldo</p>
          <p className="mt-0.5 text-sm text-texto-suave">
            Descarga un archivo con tus cuentas, categorías, movimientos y
            transferencias.
          </p>
          <Button
            variant="primaria"
            className="mt-3 w-full"
            onClick={exportAll}
          >
            Exportar respaldo
          </Button>
        </Card>
        <Card>
          <p className="font-semibold">Importar respaldo</p>
          <p className="mt-0.5 text-sm text-texto-suave">
            Reemplaza los datos de este dispositivo por los de un archivo de
            respaldo.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            aria-label="Archivo de respaldo"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const input = e.target
              void pick(input.files?.[0])
              input.value = ''
            }}
          />
          <Button
            variant="secundaria"
            className="mt-3 w-full"
            onClick={() => fileInput.current?.click()}
          >
            Importar respaldo
          </Button>
          {error && (
            <p role="alert" className="mt-3 text-sm text-gasto">
              {error}
            </p>
          )}
        </Card>
        <Card>
          <p className="font-semibold">Agregar desde archivo</p>
          <p className="mt-0.5 text-sm text-texto-suave">
            Suma pagos habituales o los datos del Excel de un archivo sin borrar
            nada de lo que ya tienes.
          </p>
          <input
            ref={paymentsInput}
            type="file"
            accept="application/json,.json"
            aria-label="Archivo para agregar"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const input = e.target
              void pickPayments(input.files?.[0])
              input.value = ''
            }}
          />
          <Button
            variant="secundaria"
            className="mt-3 w-full"
            onClick={() => paymentsInput.current?.click()}
          >
            Agregar desde archivo
          </Button>
          {paymentsError && (
            <p role="alert" className="mt-3 text-sm text-gasto">
              {paymentsError}
            </p>
          )}
        </Card>
      </div>

      <Sheet
        open={pending !== null}
        onClose={() => {
          if (!busy) setPending(null)
        }}
        title="¿Restaurar este respaldo?"
      >
        <p className="cifras">{pending?.preview}</p>
        <p className="mt-3 text-texto-suave">
          Esto reemplaza todo lo que hay en este dispositivo. Antes
          descargaremos un respaldo de lo actual.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button variant="peligro" loading={busy} onClick={confirm}>
            Restaurar respaldo
          </Button>
          <Button
            variant="fantasma"
            disabled={busy}
            onClick={() => setPending(null)}
          >
            Cancelar
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={pendingFile !== null}
        onClose={() => {
          if (!busy) setPendingFile(null)
        }}
        title="¿Agregar estos datos?"
      >
        <p className="cifras">{pendingFile?.preview}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button variant="primaria" loading={busy} onClick={confirmPayments}>
            Agregar datos
          </Button>
          <Button
            variant="fantasma"
            disabled={busy}
            onClick={() => setPendingFile(null)}
          >
            Cancelar
          </Button>
        </div>
      </Sheet>
    </TabScreen>
  )
}
