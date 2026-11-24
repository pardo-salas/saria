import { Link } from 'react-router'
import { formatCents } from '@/domain/money'
import type { WaterLevel } from '@/domain/balances'

export interface WaterLevelCardProps {
  /** `null` = cargando. */
  level: WaterLevel | null
}

function clampPercent(percent: number): number {
  if (Number.isNaN(percent)) return 0
  return Math.min(100, Math.max(0, percent))
}

function detail(percent: number, daysLeft: number): string {
  const days =
    daysLeft === 0
      ? 'último día del mes'
      : daysLeft === 1
        ? 'falta 1 día'
        : `faltan ${daysLeft} días`
  return `${Math.round(percent)}% de tu sueldo · ${days}`
}

/**
 * Lo que te queda del mes como un nivel de agua. La tarjeta es oscura en ambos
 * temas; el agua sube a su nivel una sola vez al montar (nada con
 * prefers-reduced-motion). El detalle va sobre una pastilla oscura fija para
 * conservar el contraste con el agua alta o baja.
 */
export function WaterLevelCard({ level }: WaterLevelCardProps) {
  const ok = level?.state === 'ok' ? level : null
  const height = ok ? clampPercent(ok.percent) : 0

  return (
    <section
      aria-label="Te queda este mes"
      className="relative isolate flex min-h-56 flex-col justify-between overflow-hidden rounded-tarjeta bg-nivel-tarjeta p-5 text-nivel-texto"
    >
      <div
        data-testid="agua"
        aria-hidden="true"
        style={{ height: `${height}%` }}
        className="absolute inset-x-0 bottom-0 -z-10 bg-linear-to-b from-nivel-arriba to-nivel-abajo motion-safe:animate-subir-agua"
      >
        <span className="absolute -top-[11px] -left-[10%] h-[22px] w-[120%] rounded-[50%] bg-nivel-arriba shadow-[0_-3px_0_var(--color-nivel-superficie)]" />
      </div>

      {level?.state === 'no-salary' ? (
        <div className="max-w-64">
          <p className="text-titulo">
            Captura tu sueldo en{' '}
            <Link to="/mas" className="underline underline-offset-4">
              Más
            </Link>{' '}
            para ver cuánto te queda
          </p>
        </div>
      ) : ok ? (
        <>
          <div>
            <p className="text-etiqueta text-nivel-texto/75">
              Te queda este mes
            </p>
            <p className="mt-1 text-cifra [overflow-wrap:anywhere] cifras">
              {formatCents(ok.remainingCents)}
            </p>
          </div>
          <p className="mt-10 w-fit rounded-full bg-nivel-tarjeta/85 px-3 py-1 text-sm font-medium">
            {detail(ok.percent, ok.daysLeft)}
          </p>
        </>
      ) : (
        <p className="text-etiqueta text-nivel-texto/75">Cargando…</p>
      )}
    </section>
  )
}
