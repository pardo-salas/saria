import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTheme } from '@/app/ThemeProvider'
import { AmountInput } from '@/ui/AmountInput'
import { BottomNav } from '@/ui/BottomNav'
import { BrandMark } from '@/ui/BrandMark'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { EmptyState } from '@/ui/EmptyState'
import { Fab } from '@/ui/Fab'
import {
  IconCuentas,
  IconGraficas,
  IconInicio,
  IconMas,
  IconMovimientos,
} from '@/ui/icons'
import { List, ListItem } from '@/ui/List'
import { Sheet } from '@/ui/Sheet'
import { TextField } from '@/ui/TextField'
import { WaterLevelCard } from '@/ui/WaterLevelCard'

const NAV = [
  { to: '/componentes', label: 'Inicio', icon: <IconInicio /> },
  { to: '/movimientos', label: 'Movimientos', icon: <IconMovimientos /> },
  { to: '/cuentas', label: 'Cuentas', icon: <IconCuentas /> },
  { to: '/graficas', label: 'Gráficas', icon: <IconGraficas /> },
  { to: '/mas', label: 'Más', icon: <IconMas /> },
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-titulo">{title}</h2>
      {children}
    </section>
  )
}

/**
 * Catálogo de componentes, solo en desarrollo (/componentes). El selector de
 * arriba cambia el tema para revisar todo en claro y en oscuro.
 */
export function Componentes() {
  const { resolved, setPref } = useTheme()
  const [cents, setCents] = useState<number | null>(123450)
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <main className="mx-auto w-full max-w-[40rem] px-4 pt-6 pb-24">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-titulo">Componentes</h1>
        <Button
          variant="secundaria"
          onClick={() => setPref(resolved === 'dark' ? 'light' : 'dark')}
        >
          {resolved === 'dark' ? 'Ver en claro' : 'Ver en oscuro'}
        </Button>
      </div>

      <Section title="Botones">
        <div className="flex flex-wrap gap-2">
          <Button variant="primaria">Primaria</Button>
          <Button variant="secundaria">Secundaria</Button>
          <Button variant="fantasma">Fantasma</Button>
          <Button variant="peligro">Peligro</Button>
          <Button variant="primaria" loading>
            Cargando
          </Button>
          <Button variant="primaria" disabled>
            Deshabilitado
          </Button>
        </div>
      </Section>

      <Section title="Nivel de agua">
        <div className="flex flex-col gap-3">
          <WaterLevelCard remainingCents={724000} percent={58} daysLeft={8} />
          <WaterLevelCard remainingCents={52000} percent={9} daysLeft={1} />
          <WaterLevelCard
            remainingCents={null}
            percent={null}
            daysLeft={null}
          />
        </div>
      </Section>

      <Section title="Tarjeta y lista">
        <Card>
          <List>
            <ListItem
              title="Gasolina"
              subtitle="Nu crédito"
              iconColor="#2F5BE0"
              amountCents={65000}
            />
            <ListItem title="Comida" subtitle="Efectivo" amountCents={18450} />
            <ListItem
              title="Quincena"
              subtitle="Débito"
              amountCents={1250000}
              kind="income"
            />
          </List>
        </Card>
      </Section>

      <Section title="Estado vacío">
        <Card>
          <EmptyState
            title="Aún no hay movimientos"
            text="Aquí verás cada gasto e ingreso que registres."
            action={<Button variant="primaria">Registrar gasto</Button>}
          />
        </Card>
      </Section>

      <Section title="Campos">
        <div className="flex flex-col gap-4">
          <AmountInput label="Monto" valueCents={cents} onChange={setCents} />
          <TextField label="Correo" type="email" placeholder="tu@correo.com" />
          <TextField
            label="Contraseña"
            type="password"
            hint="Al menos 8 caracteres."
          />
        </div>
      </Section>

      <Section title="Hoja inferior">
        <Button variant="secundaria" onClick={() => setSheetOpen(true)}>
          Abrir hoja
        </Button>
        <Sheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Registrar gasto"
        >
          <p className="text-texto-suave">
            Muy pronto podrás anotar tus gastos aquí en dos toques.
          </p>
        </Sheet>
      </Section>

      <Section title="Marca e iconos">
        <div className="flex items-center gap-4 text-texto-suave [&_svg]:size-6">
          <BrandMark />
          <IconInicio />
          <IconMovimientos />
          <IconCuentas />
          <IconGraficas />
          <IconMas />
        </div>
      </Section>

      <Section title="Navegación y botón +">
        {/* transform crea un bloque contenedor: los elementos fixed quedan dentro de la muestra. */}
        <div className="relative h-44 [transform:translateZ(0)] overflow-hidden rounded-tarjeta border border-borde lg:h-80">
          <Fab label="Registrar gasto" onClick={() => setSheetOpen(true)} />
          <BottomNav items={NAV} />
        </div>
      </Section>
    </main>
  )
}
