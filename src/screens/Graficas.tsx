import { EmptyState } from '@/ui/EmptyState'
import { TabScreen } from './TabScreen'

export function Graficas() {
  return (
    <TabScreen title="Gráficas">
      <EmptyState
        title="Aún no hay nada que graficar"
        text="Aquí verás en qué se va tu dinero cada mes, en cuanto registres tus gastos."
      />
    </TabScreen>
  )
}
