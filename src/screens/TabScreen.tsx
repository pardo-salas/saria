import type { ReactNode } from 'react'

/** Encabezado común de las pestañas: título de la pantalla y su contenido. */
export function TabScreen({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <>
      <h1 className="mb-4 pt-5 text-titulo">{title}</h1>
      {children}
    </>
  )
}
