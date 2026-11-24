import { Link } from 'react-router'
import { useFinance } from '@/db/queries'
import { EmptyState } from '@/ui/EmptyState'
import { AccountLink } from './Cuentas'
import { TabScreen } from './TabScreen'

export function CuentasArchivadas() {
  const finance = useFinance()
  if (!finance) return null
  const archived = finance.accounts
    .filter((a) => a.archived)
    .sort((a, b) => a.position - b.position)
  return (
    <TabScreen title="Cuentas archivadas">
      <Link
        to="/cuentas"
        className="mb-2 -ml-2 inline-flex min-h-11 items-center px-2 text-sm font-medium text-agua"
      >
        ‹ Cuentas
      </Link>
      {archived.length === 0 ? (
        <EmptyState
          title="No hay cuentas archivadas"
          text="Las cuentas que archives aparecerán aquí con su historial."
        />
      ) : (
        <ul className="flex flex-col">
          {archived.map((a) => (
            <AccountLink
              key={a.id}
              account={a}
              cents={finance.balances.get(a.id) ?? 0}
            />
          ))}
        </ul>
      )}
    </TabScreen>
  )
}
