/** Nombres de los iconos disponibles para cuentas y categorías. */
export const ICON_NAMES = [
  'transporte',
  'cafe',
  'dulces',
  'palomitas',
  'casa',
  'moto',
  'seguro',
  'regalo',
  'deporte',
  'monedero',
  'celular',
  'ropa',
  'trabajo',
  'higiene',
  'super',
  'familia',
  'corazon',
  'perfume',
  'educacion',
  'banco',
  'nomina',
  'pago',
  'inversion',
  'tarjeta',
  'cartera',
  'efectivo',
  'otros',
] as const

export type IconName = (typeof ICON_NAMES)[number]

/**
 * Colores de tono medio: se usan como color del icono sobre un recuadro
 * teñido y mantienen contraste no textual >= 3:1 tanto sobre #0E1A33
 * (tema oscuro) como sobre #FFFFFF (tema claro).
 */
export const PALETTE: readonly string[] = [
  '#E8735A',
  '#E0A13B',
  '#5DB36A',
  '#2FB5A3',
  '#3A9BDC',
  '#5B7CF0',
  '#9B6BE0',
  '#D063B5',
  '#C98A5E',
  '#8A94A8',
]

/** Color de la paleta para el índice `i` (cíclico, `i` no negativo). */
export function colorAt(i: number): string {
  return PALETTE[i % PALETTE.length]!
}
