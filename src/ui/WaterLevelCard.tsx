import { formatCents } from '@/domain/money'

export interface WaterLevelCardProps {
  remainingCents: number | null
  percent: number | null
  daysLeft: number | null
}

function clampPercent(percent: number | null): number {
  if (percent === null || Number.isNaN(percent)) return 0
  return Math.min(100, Math.max(0, percent))
}

function detail(percent: number | null, daysLeft: number | null): string {
  const parts: string[] = []
  if (percent !== null) parts.push(`${Math.round(percent)}% de tu disponible`)
  if (daysLeft !== null)
    parts.push(daysLeft === 1 ? 'falta 1 día' : `faltan ${daysLeft} días`)
  return parts.join(', ')
}

/**
 * Lo que te queda del mes como un nivel de agua. La tarjeta es oscura en ambos
 * temas; el agua sube a su nivel una sola vez al montar (nada con
 * prefers-reduced-motion).
 */
export function WaterLevelCard({
  remainingCents,
  percent,
  daysLeft,
}: WaterLevelCardProps) {
  const empty = remainingCents === null
  const level = empty ? 0 : clampPercent(percent)
  const line = empty ? '' : detail(percent, daysLeft)

  return (
    <section
      aria-label="Te queda este mes"
      className="relative isolate flex min-h-56 flex-col justify-between overflow-hidden rounded-tarjeta bg-nivel-tarjeta p-5 text-nivel-texto"
    >
      <div
        data-testid="agua"
        aria-hidden="true"
        style={{ height: `${level}%` }}
        className="absolute inset-x-0 bottom-0 -z-10 bg-linear-to-b from-nivel-arriba to-nivel-abajo motion-safe:animate-subir-agua"
      >
        <span className="absolute -top-[11px] -left-[10%] h-[22px] w-[120%] rounded-[50%] bg-nivel-arriba shadow-[0_-3px_0_var(--color-nivel-superficie)]" />
      </div>

      {empty ? (
        <div className="max-w-64">
          <p className="text-titulo">Aún no hay movimientos este mes</p>
          <p className="mt-2 text-sm text-nivel-texto/75">
            Registra tu primer gasto con el botón + y aquí verás lo que te
            queda.
          </p>
        </div>
      ) : (
        <>
          <div>
            <p className="text-etiqueta text-nivel-texto/75">
              Te queda este mes
            </p>
            <p className="mt-1 text-cifra [overflow-wrap:anywhere] cifras">
              {formatCents(remainingCents)}
            </p>
          </div>
          {line && <p className="mt-10 text-sm font-medium">{line}</p>}
        </>
      )}
    </section>
  )
}
