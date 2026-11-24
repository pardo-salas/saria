import type { SyncStatus } from '@/sync/engine'

export function syncLabel(status: SyncStatus): string {
  switch (status.state) {
    case 'sincronizando':
      return 'Sincronizando…'
    case 'sin-conexion':
      return 'Sin conexión'
    case 'error':
      return 'Error al sincronizar'
    case 'pendiente':
      return status.pending === 1
        ? '1 pendiente'
        : `${status.pending} pendientes`
    default:
      return 'Sincronizado'
  }
}

const DOT: Record<SyncStatus['state'], string> = {
  sincronizado: 'bg-agua',
  pendiente: 'bg-cobalto',
  'sin-conexion': 'bg-texto-suave',
  error: 'bg-gasto',
  sincronizando: 'bg-cobalto motion-safe:animate-pulse',
}

/** Pastilla discreta con el estado de sincronización: punto de color y texto. */
export function SyncPill({ status }: { status: SyncStatus }) {
  return (
    <span
      role="status"
      className="inline-flex items-center gap-1.5 rounded-full bg-superficie px-2.5 py-1 text-xs font-medium text-texto-suave"
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${DOT[status.state]}`}
      />
      {syncLabel(status)}
    </span>
  )
}
