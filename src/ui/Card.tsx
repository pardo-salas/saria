import type { ReactNode } from 'react'

export interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={['rounded-tarjeta bg-superficie p-4', className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}
