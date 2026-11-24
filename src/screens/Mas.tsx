import { useId, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useSessionContext } from '@/app/SessionProvider'
import { useTheme } from '@/app/ThemeProvider'
import { useLiveRows, useSettings } from '@/db/queries'
import { DAILY_REMINDER_TITLE, saveDailyReminder } from '@/db/reminders'
import { updateSettings } from '@/db/settings'
import type { ThemePref } from '@/domain/theme'
import { AmountInput } from '@/ui/AmountInput'
import {
  useSyncAvailable,
  useSyncNow,
  useSyncStatus,
} from '@/sync/SyncProvider'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { Sheet } from '@/ui/Sheet'
import { SyncPill } from '@/ui/SyncPill'
import { TabScreen } from './TabScreen'

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
]

function IncomeCard({ initialCents }: { initialCents: number | null }) {
  const [cents, setCents] = useState(initialCents)
  const [valid, setValid] = useState(true)
  const [failed, setFailed] = useState(false)

  function save() {
    if (!valid || cents === initialCents) return
    setFailed(false)
    updateSettings({ monthly_income_cents: cents }).catch(() => setFailed(true))
  }

  return (
    <Card>
      <div onBlur={save}>
        <AmountInput
          label="Sueldo mensual"
          valueCents={cents}
          onChange={setCents}
          onValidityChange={setValid}
        />
      </div>
      <p className="mt-2 text-sm text-texto-suave">
        Con él calculamos cuánto te queda en el mes. Déjalo vacío si no tienes
        un sueldo fijo.
      </p>
      {failed && (
        <p role="alert" className="mt-2 text-sm text-gasto">
          No se pudo guardar el sueldo. Intenta de nuevo.
        </p>
      )}
    </Card>
  )
}

function ReminderCard() {
  const reminders = useLiveRows('reminders')
  const reminder = reminders?.find(
    (r) => r.title === DAILY_REMINDER_TITLE && r.frequency === 'daily',
  )
  const [failed, setFailed] = useState(false)
  if (!reminder) return null

  function save(changes: { enabled?: boolean; time?: string }) {
    setFailed(false)
    saveDailyReminder(reminder!, changes).catch(() => setFailed(true))
  }

  return (
    <Card>
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
        <span className="font-semibold">Recordatorio diario</span>
        <input
          type="checkbox"
          checked={reminder.enabled}
          onChange={(e) => save({ enabled: e.target.checked })}
          className="size-6 accent-cobalto"
        />
      </label>
      <p className="mt-0.5 text-sm text-texto-suave">
        Te avisamos en Inicio si a esa hora aún no registras nada del día.
      </p>
      {reminder.enabled && (
        <div className="mt-3">
          <label
            htmlFor="hora-recordatorio"
            className="text-etiqueta text-texto-suave"
          >
            Hora
          </label>
          <input
            id="hora-recordatorio"
            type="time"
            value={reminder.time ?? '20:00'}
            onChange={(e) => e.target.value && save({ time: e.target.value })}
            className="mt-1.5 block min-h-12 w-full rounded-boton bg-superficie-2 px-4 text-base text-texto cifras"
          />
        </div>
      )}
      {failed && (
        <p role="alert" className="mt-2 text-sm text-gasto">
          No se pudo guardar el recordatorio. Intenta de nuevo.
        </p>
      )}
    </Card>
  )
}

function NavRow({
  to,
  label,
  hint,
}: {
  to: string
  label: string
  hint: string
}) {
  return (
    <Link
      to={to}
      className="flex min-h-14 items-center gap-3 rounded-tarjeta bg-superficie px-5 py-3 transition-colors duration-150 hover:bg-superficie-2/60 active:bg-superficie-2"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm text-texto-suave">{hint}</span>
      </span>
      <span aria-hidden="true" className="text-xl text-texto-suave">
        ›
      </span>
    </Link>
  )
}

function ThemePicker() {
  const { pref, setPref } = useTheme()
  const { userId } = useSessionContext()
  const labelId = useId()
  const hintId = useId()
  const name = useId()

  function choose(theme: ThemePref) {
    setPref(theme)
    if (userId === null) return
    updateSettings({ theme }).catch(() => {
      // El tema ya se aplicó y quedó en este dispositivo; si la escritura
      // local falla, solo se pierde que viaje a otros dispositivos.
    })
  }

  return (
    <Card>
      <p id={labelId} className="font-semibold">
        Tema
      </p>
      <p id={hintId} className="mt-0.5 text-sm text-texto-suave">
        Sistema sigue el modo claro u oscuro de tu dispositivo.
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={hintId}
        className="mt-3 grid grid-cols-3 gap-1 rounded-boton bg-superficie-2 p-1"
      >
        {THEME_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 cursor-pointer items-center justify-center rounded-[1rem] text-sm font-medium text-texto-suave transition-colors duration-150 hover:text-texto has-checked:bg-cobalto has-checked:font-semibold has-checked:text-sobre-cobalto has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foco"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={pref === option.value}
              onChange={() => choose(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </Card>
  )
}

const timeFormat = new Intl.DateTimeFormat('es-MX', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Mexico_City',
})

function SyncCard() {
  const status = useSyncStatus()
  const syncNow = useSyncNow()

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">Sincronización</p>
        <SyncPill status={status} />
      </div>
      {status.lastSyncedAt && (
        <p className="mt-2 text-sm text-texto-suave">
          Última vez: {timeFormat.format(new Date(status.lastSyncedAt))}
        </p>
      )}
      {status.state === 'error' && status.message && (
        <p role="alert" className="mt-2 text-sm text-gasto">
          {status.message}
        </p>
      )}
      <Button
        variant="secundaria"
        className="mt-3 w-full"
        loading={status.state === 'sincronizando'}
        onClick={() => void syncNow()}
      >
        Sincronizar ahora
      </Button>
    </Card>
  )
}

function SignOut() {
  const status = useSyncStatus()
  const { signOut } = useSessionContext()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [leaving, setLeaving] = useState(false)

  async function confirm() {
    setLeaving(true)
    try {
      await signOut()
    } finally {
      navigate('/iniciar-sesion', { replace: true })
    }
  }

  return (
    <Card>
      <p className="font-semibold">Sesión</p>
      <p className="mt-0.5 text-sm text-texto-suave">
        Cerrar sesión no borra tus datos de este dispositivo.
      </p>
      <Button
        variant="secundaria"
        className="mt-3 w-full"
        onClick={() => setConfirming(true)}
      >
        Cerrar sesión
      </Button>

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title="¿Cerrar sesión en este dispositivo?"
      >
        <p className="text-texto-suave">
          Para volver a entrar necesitarás tu correo y tu contraseña.
        </p>
        {status.pending > 0 && (
          <p className="mt-2 text-texto-suave">
            Hay {status.pending} cambios sin sincronizar; se subirán la próxima
            vez que inicies sesión en este dispositivo.
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2">
          <Button variant="peligro" loading={leaving} onClick={confirm}>
            Cerrar sesión
          </Button>
          <Button
            variant="fantasma"
            disabled={leaving}
            onClick={() => setConfirming(false)}
          >
            Cancelar
          </Button>
        </div>
      </Sheet>
    </Card>
  )
}

export function Mas() {
  const settings = useSettings()
  const syncAvailable = useSyncAvailable()
  return (
    <TabScreen title="Más">
      <div className="flex flex-col gap-3">
        {settings !== undefined && (
          <IncomeCard
            key={settings?.updated_at ?? 'none'}
            initialCents={settings?.monthly_income_cents ?? null}
          />
        )}
        <NavRow
          to="/mas/categorias"
          label="Categorías"
          hint="Crea, edita y ponles un límite mensual."
        />
        <NavRow
          to="/mas/pagos"
          label="Pagos habituales"
          hint="Rentas, suscripciones y mensualidades."
        />
        <ReminderCard />
        <NavRow
          to="/mas/respaldo"
          label="Respaldo"
          hint="Descarga tus datos o restaura un respaldo."
        />
        {syncAvailable && <SyncCard />}
        <ThemePicker />
        <SignOut />
      </div>
      <p className="mt-8 text-center text-sm text-texto-suave cifras">
        Versión {import.meta.env.VITE_APP_VERSION}
      </p>
    </TabScreen>
  )
}
