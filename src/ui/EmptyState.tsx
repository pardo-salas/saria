import type { ReactNode } from 'react'

export interface EmptyStateProps {
  title: string
  text?: string
  action?: ReactNode
}

export function EmptyState({ title, text, action }: EmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-xs flex-col items-center gap-2 px-4 py-10 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {text && <p className="text-sm text-texto-suave">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
