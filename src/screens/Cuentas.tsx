import { EmptyState } from '@/ui/EmptyState'
import { TabScreen } from './TabScreen'

export function Cuentas() {
  return (
    <TabScreen title="Cuentas">
      <EmptyState
        title="Aún no tienes cuentas"
        text="Aquí verás tu efectivo, tus cuentas de débito y tus tarjetas de crédito, cada una con su saldo."
      />
    </TabScreen>
  )
}
