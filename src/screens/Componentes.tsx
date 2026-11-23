import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTheme } from '@/app/ThemeProvider'
import { ICON_NAMES } from '@/domain/catalog'
import type { FeedEntry } from '@/domain/feed'
import type { Lookups } from '@/domain/search'
import type { Account, Category, Transaction, Transfer } from '@/db/schema'
import { AmountInput } from '@/ui/AmountInput'
import { AppIcon } from '@/ui/AppIcon'
import { BottomNav } from '@/ui/BottomNav'
import { BrandMark } from '@/ui/BrandMark'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { Chip } from '@/ui/Chip'
import { EmptyState } from '@/ui/EmptyState'
import { Fab } from '@/ui/Fab'
import { FeedRow } from '@/ui/FeedRow'
import {
  IconCuentas,
  IconGraficas,
  IconInicio,
  IconMas,
  IconMovimientos,
} from '@/ui/icons'
import { List, ListItem } from '@/ui/List'
import { Segmented } from '@/ui/Segmented'
import { Sheet } from '@/ui/Sheet'
import { useToast } from '@/ui/Toast'
import { TextField } from '@/ui/TextField'
import { WaterLevelCard } from '@/ui/WaterLevelCard'

const NAV = [
  { to: '/componentes', label: 'Inicio', icon: <IconInicio /> },
  { to: '/movimientos', label: 'Movimientos', icon: <IconMovimientos /> },
  { to: '/cuentas', label: 'Cuentas', icon: <IconCuentas /> },
  { to: '/graficas', label: 'Gráficas', icon: <IconGraficas /> },
  { to: '/mas', label: 'Más', icon: <IconMas /> },
]

const SELLO = {
  user_id: 'demo',
  created_at: '2026-11-20T12:00:00Z',
  updated_at: '2026-11-20T12:00:00Z',
  deleted_at: null,
}
const CUENTA_DEBITO = { ...SELLO, id: 'a1', name: 'BBVA Débito' } as Account
const CUENTA_CREDITO = { ...SELLO, id: 'a2', name: 'BBVA Crédito' } as Account
const CAT_SUPER = {
  ...SELLO,
  id: 'c1',
  name: 'Súper',
  icon: 'super',
  color: '#5DB36A',
} as Category
const DEMO_LOOKUPS: Lookups = {
  accounts: new Map([
    [CUENTA_DEBITO.id, CUENTA_DEBITO],
    [CUENTA_CREDITO.id, CUENTA_CREDITO],
  ]),
  categories: new Map([[CAT_SUPER.id, CAT_SUPER]]),
}
const DEMO_GASTO: FeedEntry = {
  type: 'transaction',
  row: {
    ...SELLO,
    id: 't1',
    kind: 'expense',
    amount_cents: 18550,
    date: '2026-11-20',
    account_id: 'a1',
    category_id: 'c1',
    note: null,
  } as Transaction,
}
const DEMO_INGRESO: FeedEntry = {
  type: 'transaction',
  row: {
    ...DEMO_GASTO.row,
    id: 't2',
    kind: 'income',
    amount_cents: 1250000,
    category_id: null,
    note: 'Quincena',
  } as Transaction,
}
const DEMO_TRASPASO: FeedEntry = {
  type: 'transfer',
  row: {
    ...SELLO,
    id: 'tr1',
    from_account_id: 'a1',
    to_account_id: 'a2',
    amount_cents: 200000,
    date: '2026-11-20',
    note: null,
    legacy_id: null,
  } as Transfer,
}

type Tipo = 'gasto' | 'ingreso' | 'traspaso'

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
  const [tipo, setTipo] = useState<Tipo>('gasto')
  const [filtros, setFiltros] = useState(['Comida'])
  const toast = useToast()

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
              icon={<AppIcon name="transporte" color="#3A9BDC" />}
              title="Gasolina"
              subtitle="Nu crédito"
              amountCents={-65000}
            />
            <ListItem
              icon={<AppIcon name={null} />}
              title="Comida"
              subtitle="Efectivo"
              amountCents={-18450}
            />
            <ListItem
              icon={<AppIcon name="nomina" color="#2FB5A3" />}
              title="Quincena"
              subtitle="Débito"
              amountCents={1250000}
            />
          </List>
        </Card>
      </Section>

      <Section title="Renglones del historial">
        <Card>
          <List>
            {[DEMO_GASTO, DEMO_INGRESO, DEMO_TRASPASO].map((entry) => (
              <FeedRow
                key={entry.row.id}
                entry={entry}
                lookups={DEMO_LOOKUPS}
                onOpen={() => toast.show({ message: 'Abriste un renglón' })}
              />
            ))}
            <FeedRow
              entry={DEMO_TRASPASO}
              lookups={DEMO_LOOKUPS}
              accountId="a1"
              onOpen={() => {}}
            />
          </List>
        </Card>
      </Section>

      <Section title="Chips y selector">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {filtros.map((f) => (
              <Chip
                key={f}
                label={f}
                selected
                onRemove={() => setFiltros(filtros.filter((x) => x !== f))}
              />
            ))}
            <Chip label="Este mes" onClick={() => setFiltros(['Comida'])} />
            <Chip
              label="BBVA Débito"
              icon={<AppIcon name="tarjeta" size="sm" />}
              onClick={() => {}}
            />
          </div>
          <Segmented<Tipo>
            label="Tipo de movimiento"
            value={tipo}
            onChange={setTipo}
            options={[
              { value: 'gasto', label: 'Gasto' },
              { value: 'ingreso', label: 'Ingreso' },
              { value: 'traspaso', label: 'Traspaso' },
            ]}
          />
        </div>
      </Section>

      <Section title="Aviso con deshacer">
        <Button
          variant="secundaria"
          onClick={() =>
            toast.show({
              message: 'Gasto guardado',
              actionLabel: 'Deshacer',
              onAction: () => {},
            })
          }
        >
          Mostrar aviso
        </Button>
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
        <div className="mb-4 flex flex-wrap gap-2">
          {ICON_NAMES.map((name) => (
            <AppIcon
              key={name}
              name={name}
              color={name === 'otros' ? undefined : '#5B7CF0'}
            />
          ))}
          <AppIcon name="transferencia" size="lg" />
        </div>
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
