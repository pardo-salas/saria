import { EmptyState } from '@/ui/EmptyState'
import { TabScreen } from './TabScreen'

export function Movimientos() {
  return (
    <TabScreen title="Movimientos">
      <EmptyState
        title="Aún no hay movimientos"
        text="Aquí verás cada gasto e ingreso que registres, del más reciente al más antiguo."
      />
    </TabScreen>
  )
}
