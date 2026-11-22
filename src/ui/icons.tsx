import type { ReactNode } from 'react'

/** Iconos de la navegación: rejilla de 24 px, trazo 1.75, color del texto. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function IconInicio() {
  return (
    <Icon>
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
    </Icon>
  )
}

/** Entradas y salidas: dos flechas opuestas. */
export function IconMovimientos() {
  return (
    <Icon>
      <path d="M7 4v14M3.5 14.5 7 18l3.5-3.5" />
      <path d="M17 20V6M13.5 9.5 17 6l3.5 3.5" />
    </Icon>
  )
}

/** Tarjeta: efectivo, débito y crédito viven aquí. */
export function IconCuentas() {
  return (
    <Icon>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="M3.5 10h17M7 14.5h3" />
    </Icon>
  )
}

/** Barras de distinta altura sobre una base. */
export function IconGraficas() {
  return (
    <Icon>
      <path d="M4 20h16" />
      <path d="M7 16v-4M12 16V6M17 16v-7" />
    </Icon>
  )
}

/** Tres puntos: opciones y ajustes. */
export function IconMas() {
  return (
    <Icon>
      <circle cx="5.5" cy="12" r="1.25" />
      <circle cx="12" cy="12" r="1.25" />
      <circle cx="18.5" cy="12" r="1.25" />
    </Icon>
  )
}
