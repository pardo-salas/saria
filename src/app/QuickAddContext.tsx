import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { QuickAddSheet } from '@/features/quick-add/QuickAddSheet'

export type QuickKind = 'expense' | 'income' | 'transfer'

export interface QuickAddOptions {
  accountId?: string
  kind?: QuickKind
}

interface QuickAddApi {
  open(opts?: QuickAddOptions): void
  /** Pantallas con una cuenta a la vista (detalle de cuenta) la fijan aquí; `null` al salir. */
  setContextAccount(id: string | null): void
  /** Cuenta fijada por la pantalla actual. */
  contextAccount: string | null
}

const QuickAddContext = createContext<QuickAddApi | null>(null)

export function useQuickAdd(): QuickAddApi {
  const api = useContext(QuickAddContext)
  if (!api)
    throw new Error('useQuickAdd debe usarse dentro de <QuickAddProvider>')
  return api
}

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<QuickAddOptions | null>(null)
  const [contextAccount, setContextAccount] = useState<string | null>(null)

  const open = useCallback((o?: QuickAddOptions) => setOpts(o ?? {}), [])
  const api = useMemo(
    () => ({ open, setContextAccount, contextAccount }),
    [open, contextAccount],
  )

  return (
    <QuickAddContext.Provider value={api}>
      {children}
      <QuickAddSheet
        open={opts !== null}
        onClose={() => setOpts(null)}
        accountId={opts?.accountId}
        initialKind={opts?.kind}
      />
    </QuickAddContext.Provider>
  )
}
