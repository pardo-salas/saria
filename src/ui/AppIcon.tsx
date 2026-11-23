import type { ReactNode } from 'react'
import type { IconName } from '@/domain/catalog'

/** Glifos internos que no se ofrecen en el catálogo del usuario. */
export type GlyphName = IconName | 'transferencia'

/*
 * Glifos de línea en rejilla de 24 px, trazo 1.75 (como los de la navegación).
 * Cada uno es el contenido de un <svg>; el color lo pone `currentColor`.
 */
const GLYPHS: Record<GlyphName, ReactNode> = {
  transporte: (
    <>
      <rect x="5" y="4" width="14" height="13" rx="3" />
      <path d="M5 11h14M8 17v2.5M16 17v2.5M8.5 14h.01M15.5 14h.01" />
    </>
  ),
  cafe: (
    <>
      <path d="M5 9.5h11V14a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" />
      <path d="M16 10.5h1.5a2 2 0 0 1 0 4H16M9 3.5v2M12.5 3.5v2" />
    </>
  ),
  dulces: (
    <>
      <circle cx="12" cy="12" r="3.75" />
      <path d="M8.5 10.5 4.5 8v8l4-2.5M15.5 10.5l4-2.5v8l-4-2.5" />
    </>
  ),
  palomitas: (
    <>
      <path d="M6.5 11 8 20h8l1.5-9M5.5 11h13" />
      <path d="M7 11a2.5 2.5 0 0 1 1-4.5 2.8 2.8 0 0 1 4-1.5 2.8 2.8 0 0 1 4 1.5 2.5 2.5 0 0 1 1 4.5" />
    </>
  ),
  casa: (
    <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
  ),
  moto: (
    <>
      <circle cx="6" cy="16" r="3" />
      <circle cx="18" cy="16" r="3" />
      <path d="M9 16l3-6h4l2 6M13 7h3M12 10H8" />
    </>
  ),
  seguro: (
    <>
      <path d="M12 3.5 19 6v5.5c0 4.2-3 7.3-7 9-4-1.7-7-4.8-7-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  regalo: (
    <>
      <rect x="4" y="9" width="16" height="4" rx="1" />
      <path d="M5.5 13v6.5h13V13M12 9v10.5" />
      <path d="M12 9C10 9 8 8 8 6.5S9.5 4.5 12 9zm0 0c2 0 4-1 4-2.5S14.5 4.5 12 9z" />
    </>
  ),
  deporte: <path d="M7 7.5v9M17 7.5v9M4.5 10v4M19.5 10v4M7 12h10" />,
  monedero: (
    <>
      <path d="M6 10.5c0-3 2-5.5 6-5.5s6 2.5 6 5.5v6a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 16.5z" />
      <path d="m9 5 1.2 2h3.6L15 5M12 11v5M10.2 12.6c0-.7.8-1.1 1.8-1.1s1.8.4 1.8 1.1" />
    </>
  ),
  celular: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2.5" />
      <path d="M11 18h2" />
    </>
  ),
  ropa: (
    <path d="M8.5 4 4 6.5l2 4 2-1V20h8V9.5l2 1 2-4L15.5 4a3.5 3.5 0 0 1-7 0z" />
  ),
  trabajo: (
    <>
      <rect x="4" y="7.5" width="16" height="11" rx="2" />
      <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M4 12.5h16" />
    </>
  ),
  higiene: <path d="M12 3.5S6 10 6 14a6 6 0 0 0 12 0c0-4-6-10.5-6-10.5z" />,
  super: (
    <>
      <path d="M3.5 5h2.2l2 9.5h9.3l1.8-7H7" />
      <circle cx="9.5" cy="19" r="1.25" />
      <circle cx="16.5" cy="19" r="1.25" />
    </>
  ),
  familia: (
    <>
      <circle cx="8.5" cy="8" r="2.5" />
      <circle cx="16.5" cy="9.5" r="2" />
      <path d="M3.5 19v-1a5 5 0 0 1 10 0v1M15 14.3a4 4 0 0 1 5.5 3.7v1" />
    </>
  ),
  corazon: (
    <path d="M12 20s-7.5-4.5-7.5-10A4.2 4.2 0 0 1 12 7.5 4.2 4.2 0 0 1 19.5 10C19.5 15.5 12 20 12 20z" />
  ),
  perfume: (
    <>
      <rect x="6" y="10" width="12" height="10" rx="2.5" />
      <path d="M10 10V7h4v3M9 4.5h6" />
    </>
  ),
  educacion: (
    <>
      <path d="M2.5 9.5 12 5l9.5 4.5L12 14z" />
      <path d="M6.5 12v4c1.5 1.5 3.5 2.5 5.5 2.5s4-1 5.5-2.5v-4M21.5 9.5V15" />
    </>
  ),
  banco: (
    <>
      <path d="M3.5 9.5 12 4l8.5 5.5zM6 11.5v6M10 11.5v6M14 11.5v6M18 11.5v6M4 20h16" />
    </>
  ),
  nomina: (
    <>
      <path d="M6 3.5h12V20l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 20z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  pago: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5v9M14.5 10c0-.9-1-1.5-2.5-1.5s-2.5.6-2.5 1.5 1 1.4 2.5 1.6 2.5.7 2.5 1.6-1 1.5-2.5 1.5-2.5-.6-2.5-1.5" />
    </>
  ),
  inversion: <path d="m4 17 5-5 3.5 3.5L20 8M15 8h5v5" />,
  tarjeta: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="M3.5 10h17M7 14.5h3" />
    </>
  ),
  cartera: (
    <>
      <path d="M4 9.5V7.5a2 2 0 0 1 2-2h11M4 9.5a2 2 0 0 0 2 2h12a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M16 15h2" />
    </>
  ),
  efectivo: (
    <>
      <rect x="3" y="7" width="18" height="10" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6.5 12h.01M17.5 12h.01" />
    </>
  ),
  otros: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8 12h.01M12 12h.01M16 12h.01" />
    </>
  ),
  transferencia: (
    <path d="M4 8h14M14.5 4.5 18 8l-3.5 3.5M20 16H6M9.5 12.5 6 16l3.5 3.5" />
  ),
}

const TILE = {
  sm: { tile: 'size-8 rounded-[0.625rem]', glyph: 'size-4' },
  md: { tile: 'size-10 rounded-xl', glyph: 'size-5' },
  lg: { tile: 'size-12 rounded-[0.875rem]', glyph: 'size-6' },
} as const

export interface AppIconProps {
  /** Sin nombre se usa `otros`. */
  name: GlyphName | null
  /** Color del usuario (categoría o cuenta); sin él, superficie-2 y texto suave. */
  color?: string | null
  size?: 'sm' | 'md' | 'lg'
}

/** Recuadro redondeado con el glifo de línea; con color, fondo teñido al 18 %. */
export function AppIcon({ name, color, size = 'md' }: AppIconProps) {
  const { tile, glyph } = TILE[size]
  return (
    <span
      aria-hidden="true"
      data-icon={name ?? 'otros'}
      className={[
        'flex shrink-0 items-center justify-center',
        tile,
        color ? '' : 'bg-superficie-2 text-texto-suave',
      ].join(' ')}
      style={
        color
          ? {
              color,
              backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`,
            }
          : undefined
      }
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
        className={glyph}
      >
        {GLYPHS[name ?? 'otros']}
      </svg>
    </span>
  )
}
