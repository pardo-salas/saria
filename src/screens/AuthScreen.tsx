import type { ReactNode } from 'react'
import { BrandMark } from '@/ui/BrandMark'

/**
 * Marco de las pantallas sin sesión. En móvil el formulario queda abajo, en
 * la zona del pulgar (y arriba del teclado cuando se abre); en pantallas
 * grandes se centra.
 */
export function AuthScreen({
  title,
  intro,
  children,
}: {
  title: string
  intro?: string
  children: ReactNode
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-end px-4 pt-10 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:justify-center">
      <BrandMark />
      <h1 className="mt-6 text-[2rem] leading-tight font-extrabold tracking-[-0.02em]">
        {title}
      </h1>
      {intro && <p className="mt-2 text-texto-suave">{intro}</p>}
      <div className="mt-8">{children}</div>
    </main>
  )
}
