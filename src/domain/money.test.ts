import { formatCents, parseToCents, sumCents, MAX_CENTS } from './money'

describe('sumCents', () => {
  it('suma enteros', () => {
    expect(sumCents([100, -30, 5])).toBe(75)
    expect(sumCents([])).toBe(0)
  })
  it('lanza RangeError si el resultado no es entero seguro', () => {
    expect(() => sumCents([Number.MAX_SAFE_INTEGER, 1])).toThrow(RangeError)
  })
})

describe('formatCents', () => {
  it.each([
    [0, '$0.00'],
    [1, '$0.01'],
    [123456, '$1,234.56'],
    [-123456, '−$1,234.56'],
    [99999999999, '$999,999,999.99'],
  ])('formatea %i como %s', (cents, expected) => {
    expect(formatCents(cents)).toBe(expected)
  })

  it('lanza RangeError con un valor no entero', () => {
    expect(() => formatCents(1.5)).toThrow(RangeError)
  })
})

describe('parseToCents', () => {
  it.each([
    ['1234', 123400],
    ['1,234.5', 123450],
    ['1234.56', 123456],
    ['$1,234.56', 123456],
    [' 0.01 ', 1],
    ['12,5', 1250],
    ['12,50', 1250],
    ['1,234', 123400],
    ['0', 0],
    ['999999999.99', MAX_CENTS],
  ])('interpreta %j como %i', (text, cents) => {
    expect(parseToCents(text)).toEqual({ ok: true, cents })
  })

  it.each([
    ['', 'empty'],
    ['  ', 'empty'],
    ['abc', 'invalid'],
    ['1.2.3', 'invalid'],
    ['-5', 'invalid'],
    ['1,23,4', 'invalid'],
    ['1.234', 'too_many_decimals'],
    ['1000000000', 'too_large'],
  ])('rechaza %j con %s', (text, error) => {
    expect(parseToCents(text)).toEqual({ ok: false, error })
  })
})
