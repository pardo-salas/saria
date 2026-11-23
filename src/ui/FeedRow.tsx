import { ICON_NAMES, type IconName } from '@/domain/catalog'
import { signedAmount, type FeedEntry } from '@/domain/feed'
import type { Lookups } from '@/domain/search'
import { AppIcon } from './AppIcon'
import { ListItem } from './List'

export interface FeedRowProps {
  entry: FeedEntry
  lookups: Lookups
  /** Cuenta desde la que se mira el historial (cambia el texto y signo de traspasos). */
  accountId?: string
  onOpen(entry: FeedEntry): void
}

function toIconName(icon: string | null | undefined): IconName | null {
  return (ICON_NAMES as readonly string[]).includes(icon ?? '')
    ? (icon as IconName)
    : null
}

/** Renglón del historial unificado: movimiento o transferencia. */
export function FeedRow({ entry, lookups, accountId, onOpen }: FeedRowProps) {
  const open = () => onOpen(entry)

  if (entry.type === 'transaction') {
    const { row } = entry
    const category = row.category_id
      ? lookups.categories.get(row.category_id)
      : undefined
    const account = lookups.accounts.get(row.account_id)
    return (
      <ListItem
        icon={
          <AppIcon name={toIconName(category?.icon)} color={category?.color} />
        }
        title={category?.name ?? 'Sin categoría'}
        subtitle={row.note || account?.name}
        amountCents={signedAmount(entry)}
        onClick={open}
      />
    )
  }

  const { row } = entry
  const from = lookups.accounts.get(row.from_account_id)?.name ?? 'Cuenta'
  const to = lookups.accounts.get(row.to_account_id)?.name ?? 'Cuenta'
  let title = `${from} → ${to}`
  if (accountId !== undefined) {
    title = row.from_account_id === accountId ? `A ${to}` : `De ${from}`
  }
  return (
    <ListItem
      icon={<AppIcon name="transferencia" />}
      title={title}
      subtitle={row.note || 'Transferencia'}
      amountCents={
        accountId === undefined
          ? row.amount_cents
          : signedAmount(entry, accountId)
      }
      tone="neutral"
      onClick={open}
    />
  )
}
