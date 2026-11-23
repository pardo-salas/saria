/** Máximo monto permitido: 999,999,999.99 en centavos. */
export const MAX_CENTS = 99_999_999_999

export type ParseError = 'empty' | 'invalid' | 'too_many_decimals' | 'too_large'

export type ParseResult =
  { ok: true; cents: number } | { ok: false; error: ParseError }

const formatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
})

export function formatCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`Los centavos deben ser un entero seguro: ${cents}`)
  }
  // Solo presentación: con ≤ 11 dígitos, abs / 100 se redondea correctamente a 2 decimales.
  const text = formatter
    .format(Math.abs(cents) / 100)
    .replace(/[\u00a0\u202f]/g, '')
    .replace(/^MX\$/, '$')
  return cents < 0 ? `\u2212${text}` : text
}

/** Suma centavos como enteros; lanza RangeError si el resultado no es entero seguro. */
export function sumCents(values: Iterable<number>): number {
  let total = 0
  for (const v of values) total += v
  if (!Number.isSafeInteger(total)) {
    throw new RangeError(`La suma de centavos no es un entero seguro: ${total}`)
  }
  return total
}

const PLAIN_INT =/^\d+$/
const GROUPED_INT = /^\d{1,3}(,\d{3})+$/

function fail(error: ParseError): ParseResult {
  return { ok: false, error }
}

export function parseToCents(text: string): ParseResult {
  const cleaned = text.replace(/[$\s]/g, '')
  if (cleaned === '') return fail('empty')
  if (!/^[\d.,]+$/.test(cleaned)) return fail('invalid')

  let intPart: string
  let decPart = ''

  if (cleaned.includes('.')) {
    const parts = cleaned.split('.')
    if (parts.length !== 2 || !/^\d+$/.test(parts[1])) return fail('invalid')
    intPart = parts[0]
    decPart = parts[1]
  } else {
    const m = /^(.*),(\d{1,2})$/.exec(cleaned)
    if (m) {
      intPart = m[1]
      decPart = m[2]
    } else {
      intPart = cleaned
    }
  }

  if (!PLAIN_INT.test(intPart) && !GROUPED_INT.test(intPart))
    return fail('invalid')
  if (decPart.length > 2) return fail('too_many_decimals')

  const digits = intPart.replace(/,/g, '').replace(/^0+(?=\d)/, '')
  if (digits.length > 10) return fail('too_large')
  const cents = Number(digits) * 100 + Number(decPart.padEnd(2, '0'))
  if (cents > MAX_CENTS) return fail('too_large')
  return { ok: true, cents }
}
