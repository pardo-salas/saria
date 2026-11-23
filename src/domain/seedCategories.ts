import type { IconName } from './catalog'
import { uuidV5 } from './uuid'

/** Namespace fijo para derivar IDs deterministas de categorías iniciales. */
export const SARIA_NAMESPACE = '4f1d2c3a-8b7e-5c6d-9a0b-1e2f3a4b5c6d'

export interface SeedCategory {
  name: string
  kind: 'income' | 'expense'
  icon: IconName
  monthly_limit_cents: number | null
}

const e = (
  name: string,
  icon: IconName,
  monthly_limit_cents: number | null = null,
): SeedCategory => ({ name, kind: 'expense', icon, monthly_limit_cents })

const i = (name: string, icon: IconName): SeedCategory => ({
  name,
  kind: 'income',
  icon,
  monthly_limit_cents: null,
})

/** Categorías iniciales: 20 de gasto y 8 de ingreso. */
export const SEED_CATEGORIES: readonly SeedCategory[] = [
  e('Transporte', 'transporte'),
  e('Comida', 'cafe'),
  e('Antojo', 'dulces'),
  e('Entretenimiento', 'palomitas'),
  e('Casa', 'casa'),
  e('Moto', 'moto'),
  e('Otros', 'otros'),
  e('Seguro', 'seguro', 28800),
  e('Regalos', 'regalo'),
  e('Rutina', 'deporte'),
  e('Ocio', 'monedero'),
  e('Saldo', 'celular'),
  e('Ropa', 'ropa'),
  e('Trabajo', 'trabajo'),
  e('Higiene personal', 'higiene'),
  e('Alimentación', 'super'),
  e('Familia', 'familia'),
  e('Salud', 'corazon'),
  e('Perfume', 'perfume'),
  e('Educación', 'educacion'),
  i('Interés', 'banco'),
  i('Salario', 'nomina'),
  i('Transferencia', 'pago'),
  i('Regalo', 'regalo'),
  i('Otros', 'otros'),
  i('Aguinaldo', 'pago'),
  i('Cashback', 'inversion'),
  i('Utilidades', 'otros'),
]

/** ID determinista: el mismo usuario/tipo/nombre da siempre el mismo UUID. */
export function seedCategoryId(
  userId: string,
  kind: string,
  name: string,
): Promise<string> {
  return uuidV5(`${userId}:${kind}:${name}`, SARIA_NAMESPACE)
}
