import { useEffect, useState } from 'react'
import { useQuickAdd } from '@/app/QuickAddContext'
import { useFinance, useLiveRows, useToday } from '@/db/queries'
import { DAILY_REMINDER_TITLE } from '@/db/reminders'

const KEY = 'saria.recordatorio.oculto'

const clock = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Mexico_City',
})

function readDismissed(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function Banner({ today, onHide }: { today: string; onHide(): void }) {
  const quickAdd = useQuickAdd()
  return (
    <div className="mb-4 flex items-center gap-2 rounded-tarjeta bg-superficie-2 p-3 pl-4">
      <p className="min-w-0 flex-1 font-medium">
        ¿Ya registraste tus gastos de hoy?
      </p>
      <button
        type="button"
        onClick={() => quickAdd.open()}
        className="min-h-11 shrink-0 cursor-pointer rounded-full bg-cobalto px-4 text-sm font-semibold text-sobre-cobalto active:brightness-90"
      >
        Registrar
      </button>
      <button
        type="button"
        aria-label="Ocultar por hoy"
        onClick={() => {
          try {
            localStorage.setItem(KEY, today)
          } catch {
            // Sin almacenamiento solo se oculta mientras la pantalla siga abierta.
          }
          onHide()
        }}
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-xl text-texto-suave hover:bg-superficie"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  )
}

/** Aviso de Inicio: hora pasada, sin movimientos hoy y no oculto hoy. */
export function DailyReminderBanner() {
  const reminders = useLiveRows('reminders')
  const finance = useFinance()
  const today = useToday()
  const [dismissed, setDismissed] = useState(readDismissed)
  const hidden = dismissed === today
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const reminder = reminders?.find(
    (r) => r.title === DAILY_REMINDER_TITLE && r.frequency === 'daily',
  )
  if (!reminder || !finance || hidden || !reminder.enabled || !reminder.time)
    return null
  if (clock.format(now) < reminder.time) return null
  if (finance.transactions.some((t) => t.date === today)) return null
  return <Banner today={today} onHide={() => setDismissed(today)} />
}
