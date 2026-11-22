import { EmptyState } from '@/ui/EmptyState'
import { WaterLevelCard } from '@/ui/WaterLevelCard'

const monthFormat = new Intl.DateTimeFormat('es-MX', {
  month: 'long',
  timeZone: 'America/Mexico_City',
})

function currentMonth(): string {
  const month = monthFormat.format(new Date())
  return month.charAt(0).toUpperCase() + month.slice(1)
}

export function Inicio() {
  return (
    <>
      <header className="mb-4">
        <p className="text-etiqueta text-texto-suave">{currentMonth()}</p>
        <h1 className="text-titulo">Hola, Brian</h1>
      </header>

      <WaterLevelCard remainingCents={null} percent={null} daysLeft={null} />

      <section aria-labelledby="hoy" className="mt-6">
        <h2 id="hoy" className="text-sm font-semibold">
          Hoy
        </h2>
        <EmptyState
          title="Nada registrado hoy"
          text="Los gastos e ingresos de hoy aparecerán aquí."
        />
      </section>
    </>
  )
}
